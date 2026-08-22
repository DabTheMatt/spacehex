import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import type { GameEvent } from '../../game/engine/events'
import { CameraController, makeLights } from './CameraController'
import { BoardRenderer } from '../board/BoardRenderer'
import { TilePreviewRenderer } from '../board/TilePreviewRenderer'
import { ShipRenderer } from '../entities/ShipRenderer'
import { HoverTargetRenderer } from '../entities/HoverTargetRenderer'
import { palette } from '../theme'
import type { HexCoord } from '../../game/board/HexCoord'
import { coordKey } from '../../game/board/HexCoord'
import { userDataFromHits } from './pickHelpers'
import type { BoardHover } from '../../ui/boardHover'
import { TILE_SETTLED_Y, TILE_SLOT_Y } from '../board/TileRenderer'
import {
  clamp01,
  easeOutCubic,
  lerp,
  prefersReducedMotion,
  TILE_RISE_MS,
} from '../motion'

export interface SceneOptions {
  showDebug: boolean
  showCoords: boolean
  showEdges: boolean
  selectedKey?: string | null
  showExploreGhosts?: boolean
  hover?: BoardHover | null
}

export class SpaceScene {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: CameraController
  readonly board: BoardRenderer
  readonly preview: TilePreviewRenderer
  readonly ships: ShipRenderer
  readonly hoverTargets: HoverTargetRenderer
  readonly raycaster = new THREE.Raycaster()
  private disposed = false
  private lastState: GameState | null = null
  private lastOptions: SceneOptions | null = null
  private primed = false
  private prevShipCoords = new Map<string, HexCoord>()
  private prevTileKeys = new Set<string>()
  private riseByKey = new Map<string, { start: number; duration: number }>()
  private tileY: Record<string, number> = {}
  private flightsByTile = new Map<string, Array<{ shipId: string; from: HexCoord; to: HexCoord }>>()
  private hideGlyphKeys = new Set<string>()
  private revealWhenSettled = new Set<string>()

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(palette.void)
    this.raycaster.params.Line = { threshold: 0.12 }
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(palette.void)
    this.camera = new CameraController(canvas)
    makeLights(this.scene)
    this.board = new BoardRenderer()
    this.preview = new TilePreviewRenderer()
    this.ships = new ShipRenderer()
    this.hoverTargets = new HoverTargetRenderer()
    this.scene.add(this.board.group, this.preview.group, this.ships.group, this.hoverTargets.group)
    this.loop()
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false)
    this.camera.resize(width, height)
  }

  sync(state: GameState, options: SceneOptions): void {
    this.lastState = state
    this.lastOptions = options
    this.camera.mapRotateEnabled = this.lastState.phase !== 'TILE_PLACEMENT'
    this.applySync()
  }

  handleEvents(events: GameEvent[], _state: GameState): void {
    for (const event of events) {
      if (event.type === 'GAME_STARTED') {
        this.resetSession()
        this.camera.panTo({ q: 0, r: 0 })
      }
    }
  }

  pickPlacement(clientX: number, clientY: number): boolean {
    const hits = this.intersectAll(clientX, clientY, this.preview.group.children)
    return userDataFromHits<boolean>(hits, 'placementTarget') === true
  }

  pickHover(clientX: number, clientY: number): BoardHover | null {
    const hits = this.intersectAll(clientX, clientY, this.hoverTargets.pickables())
    return userDataFromHits<BoardHover>(hits, 'boardHover') ?? null
  }

  pickDirection(clientX: number, clientY: number): { direction: number } | null {
    const hits = this.intersectAll(clientX, clientY, this.board.pickables())
    const direction = userDataFromHits<number>(hits, 'direction')
    return direction === undefined ? null : { direction }
  }

  pickShip(clientX: number, clientY: number): { shipId: string } | null {
    const hits = this.intersectAll(clientX, clientY, this.ships.pickables())
    const shipId = userDataFromHits<string>(hits, 'shipId')
    return shipId === undefined ? null : { shipId }
  }

  pickTile(clientX: number, clientY: number): HexCoord | null {
    const hits = this.intersectAll(clientX, clientY, this.board.tileMeshes())
    return userDataFromHits<HexCoord>(hits, 'tileCoord') ?? null
  }

  private beginRise(key: string): void {
    if (this.riseByKey.has(key) || this.tileY[key] !== undefined) return
    const duration = prefersReducedMotion() ? 0 : TILE_RISE_MS
    this.riseByKey.set(key, { start: performance.now(), duration })
    this.tileY = { ...this.tileY, [key]: TILE_SLOT_Y }
    this.hideGlyphKeys.add(key)
  }

  private queueStateMotions(state: GameState): void {
    const tileKeys = Object.keys(state.board.tiles)
    if (!this.primed) {
      this.prevTileKeys = new Set(tileKeys)
      this.prevShipCoords = new Map(
        Object.values(state.ships).map((ship) => [ship.id, { ...ship.coord }]),
      )
      this.primed = true
      return
    }

    for (const key of tileKeys) {
      if (!this.prevTileKeys.has(key)) this.beginRise(key)
    }

    for (const ship of Object.values(state.ships)) {
      const prev = this.prevShipCoords.get(ship.id)
      if (!prev) {
        this.prevShipCoords.set(ship.id, { ...ship.coord })
        continue
      }
      if (prev.q === ship.coord.q && prev.r === ship.coord.r) continue
      const dest = { ...ship.coord }
      if (this.ships.isFlyingTo(ship.id, dest) || this.ships.isParkedAt(ship.id, dest)) {
        this.prevShipCoords.set(ship.id, dest)
        continue
      }
      if (this.ships.isBusy(ship.id)) continue
      this.ships.fly(ship.id, prev, dest)
      this.prevShipCoords.set(ship.id, dest)
    }

    this.prevTileKeys = new Set(tileKeys)
  }

  private applySync(): void {
    if (!this.lastState || !this.lastOptions) return
    this.queueStateMotions(this.lastState)
    this.board.sync(this.lastState, {
      ...this.lastOptions,
      tileY: this.tileY,
      hideGlyphKeys: this.hideGlyphKeys,
    })
    this.preview.sync(this.lastState)
    this.ships.sync(this.lastState)
    this.hoverTargets.sync(this.lastState, this.lastOptions.hover ?? null)
  }

  private advanceRise(now: number): boolean {
    let revealed = false
    for (const [key, rise] of [...this.riseByKey.entries()]) {
      const t = rise.duration <= 0 ? 1 : clamp01((now - rise.start) / rise.duration)
      const y = lerp(TILE_SLOT_Y, TILE_SETTLED_Y, easeOutCubic(t))
      this.tileY = { ...this.tileY, [key]: y }
      this.board.setTileY(key, y)
      if (t < 1) continue
      this.riseByKey.delete(key)
      delete this.tileY[key]
      this.board.setTileY(key, TILE_SETTLED_Y)
      const flights = this.flightsByTile.get(key) ?? []
      this.flightsByTile.delete(key)
      for (const flight of flights) {
        this.ships.fly(flight.shipId, flight.from, flight.to)
      }
      if (this.revealWhenSettled.has(key)) {
        this.revealWhenSettled.delete(key)
        this.hideGlyphKeys.delete(key)
        revealed = true
      }
    }
    return revealed
  }

  private intersectAll(clientX: number, clientY: number, objects: THREE.Object3D[]): THREE.Intersection[] {
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera.camera)
    return this.raycaster.intersectObjects(objects, true)
  }

  dispose(): void {
    this.disposed = true
    this.camera.dispose()
    this.renderer.dispose()
  }

  private resetSession(): void {
    this.primed = false
    this.prevShipCoords.clear()
    this.prevTileKeys.clear()
    this.riseByKey.clear()
    this.tileY = {}
    this.flightsByTile.clear()
    this.hideGlyphKeys.clear()
    this.revealWhenSettled.clear()
    this.ships.reset()
  }

  private loop = (): void => {
    if (this.disposed) return
    requestAnimationFrame(this.loop)
    const now = performance.now()
    const riseRevealed = this.advanceRise(now)
    const time = now / 1000
    this.board.tick(time)
    this.preview.tick(time)
    const shipsSettled = this.ships.tick(this.camera.camera, time)
    this.hoverTargets.tick(time)
    let glyphsChanged = false
    for (const coord of this.ships.consumeLanded()) {
      const key = coordKey(coord)
      if (!this.hideGlyphKeys.has(key)) continue
      if (this.riseByKey.has(key)) {
        this.revealWhenSettled.add(key)
        continue
      }
      this.hideGlyphKeys.delete(key)
      glyphsChanged = true
    }
    this.camera.setFollow(this.ships.flyingWorld())
    if (shipsSettled || glyphsChanged || riseRevealed) this.applySync()
    this.camera.tick()
    this.renderer.render(this.scene, this.camera.camera)
  }
}

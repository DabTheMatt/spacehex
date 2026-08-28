import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import type { GameEvent } from '../../game/engine/events'
import { CameraController, makeLights } from './CameraController'
import { BoardRenderer } from '../board/BoardRenderer'
import { TilePreviewRenderer } from '../board/TilePreviewRenderer'
import { ShipRenderer } from '../entities/ShipRenderer'
import { HoverTargetRenderer } from '../entities/HoverTargetRenderer'
import { ProbeRenderer } from '../entities/ProbeRenderer'
import { CombatFx } from '../fx/CombatFx'
import { palette } from '../theme'
import type { HexCoord } from '../../game/board/HexCoord'
import { coordKey } from '../../game/board/HexCoord'
import { getNeighbor, getWorldPosition } from '../../game/board/hexMath'
import { activeShip } from '../../game/rules/fuel'
import type { ResourceId } from '../../game/definitions/resources'
import { userDataFromHits } from './pickHelpers'
import type { BoardHover } from '../../ui/boardHover'
import { TILE_SETTLED_Y, TILE_SLOT_Y, TILE_THICKNESS } from '../board/TileRenderer'
import {
  clamp01,
  easeOutCubic,
  lerp,
  prefersReducedMotion,
  TILE_RISE_MS,
  CAMERA_FOCUS_MS,
  VORTEX_CHASE_STEP_MS,
  VORTEX_CHASE_LAPS,
} from '../motion'

export interface SceneOptions {
  showDebug: boolean
  showCoords: boolean
  showEdges: boolean
  selectedKey?: string | null
  showExploreGhosts?: boolean
  hover?: BoardHover | null
  inspectKey?: string | null
  showTileNames?: boolean
  showMarketIcons?: boolean
  threatShipId?: string | null
  probeAim?: boolean
}

export class SpaceScene {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: CameraController
  readonly board: BoardRenderer
  readonly preview: TilePreviewRenderer
  readonly ships: ShipRenderer
  readonly hoverTargets: HoverTargetRenderer
  readonly probes: ProbeRenderer
  readonly combat: CombatFx
  readonly raycaster = new THREE.Raycaster()
  private disposed = false
  private duel: {
    attackerId: string
    defenderId: string
    coord: HexCoord
    shots: Array<{ attackerId: string; defenderId: string; damage: number; hullAfter: number }>
    index: number
    stage: 'align' | 'fire' | 'recover'
    sideCount: Record<string, number>
    startedAt: number
  } | null = null
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
  private startedProbeFlights = new Set<string>()
  private inflightProbeKeys = new Set<string>()
  private vortexFx: {
    shipId: string
    coord: HexCoord
    dest: HexCoord
    face: number
    startedAt: number
    stage: 'inbound' | 'chase' | 'hold'
  } | null = null

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'default',
    })
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
    this.probes = new ProbeRenderer()
    this.combat = new CombatFx()
    this.scene.add(
      this.board.group,
      this.preview.group,
      this.ships.group,
      this.hoverTargets.group,
      this.probes.group,
      this.combat.group,
    )
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
    const shots: Array<{ attackerId: string; defenderId: string; damage: number; hullAfter: number }> = []
    let started: {
      attackerId: string
      defenderId: string
      coord: HexCoord
      attackerHull: number
      defenderHull: number
    } | null = null
    for (const event of events) {
      if (event.type === 'GAME_STARTED') {
        this.resetSession()
        this.camera.panTo({ q: 0, r: 0 })
      }
      if (event.type === 'COMBAT_STARTED') started = event
      if (event.type === 'COMBAT_SHOT') {
        shots.push({
          attackerId: event.attackerId,
          defenderId: event.defenderId,
          damage: event.damage,
          hullAfter: event.hullAfter,
        })
      }
    }
    if (started) {
      this.duel = {
        attackerId: started.attackerId,
        defenderId: started.defenderId,
        coord: started.coord,
        shots,
        index: 0,
        stage: 'align',
        sideCount: {},
        startedAt: performance.now(),
      }
      this.ships.setThreat(null)
      this.ships.setDuel(started.attackerId, started.defenderId, started.coord)
      this.camera.inspectCombat(started.coord, 0)
    }
    for (const event of events) {
      if (event.type !== 'PROBE_LAUNCHED') continue
      this.launchProbeFlight(event.shipId, event.coord)
    }
    for (const event of events) {
      if (event.type === 'VORTEX_ROLL') {
        this.vortexFx = {
          shipId: event.shipId,
          coord: { ...event.coord },
          dest: { ...event.dest },
          face: event.face,
          startedAt: performance.now(),
          stage: 'inbound',
        }
      }
    }
    for (const event of events) {
      if (event.type === 'ASTEROID_STRIKE' && event.damage > 0) {
        const pose = this.ships.worldPose(event.shipId) ?? fallbackShipPose(this.lastState, event.shipId)
        const dest = getWorldPosition(event.coord)
        const target = pose
          ? { x: dest.x, y: pose.y, z: dest.z }
          : { x: dest.x, y: TILE_THICKNESS + 0.14, z: dest.z }
        this.combat.spawnDamage(target, event.damage, performance.now())
      }
    }
  }

  private launchProbeFlight(shipId: string, coord: HexCoord): void {
    const key = coordKey(coord)
    if (this.startedProbeFlights.has(key)) return
    this.startedProbeFlights.add(key)
    const destHex = getWorldPosition(coord)
    const target = { x: destHex.x, y: TILE_THICKNESS + 0.08, z: destHex.z }
    const from = this.ships.worldPose(shipId) ?? fallbackShipPose(this.lastState, shipId)
    this.inflightProbeKeys.add(key)
    this.hideGlyphKeys.add(key)
    const land = (): void => {
      this.inflightProbeKeys.delete(key)
      if (this.riseByKey.has(key)) this.revealWhenSettled.add(key)
      else this.hideGlyphKeys.delete(key)
      this.applySync()
    }
    if (!from || prefersReducedMotion()) {
      land()
      return
    }
    this.combat.spawnProbe(from, from.yaw, target, performance.now(), land)
  }

  pickPlacement(clientX: number, clientY: number): boolean {
    const hits = this.intersectAll(clientX, clientY, this.preview.group.children)
    return userDataFromHits<boolean>(hits, 'placementTarget') === true
  }

  pickHover(clientX: number, clientY: number): BoardHover | null {
    const diskHits = this.intersectAll(clientX, clientY, this.hoverTargets.pickables())
    const fromDisk = userDataFromHits<BoardHover>(diskHits, 'boardHover')
    if (fromDisk) return fromDisk
    if (!this.lastState) return null
    const ghostHits = this.intersectAll(clientX, clientY, this.board.pickables())
    const kind = userDataFromHits<'EXPLORE' | 'MOVE'>(ghostHits, 'kind')
    const direction = userDataFromHits<number>(ghostHits, 'direction')
    if (kind !== 'EXPLORE' && kind !== 'MOVE') return null
    if (direction === undefined) return null
    const coord = getNeighbor(activeShip(this.lastState).coord, direction)
    return { kind, coord, direction }
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

  pickBuy(clientX: number, clientY: number): { coord: HexCoord; resource: ResourceId } | null {
    const hits = this.intersectAll(clientX, clientY, this.board.tileMeshes())
    return userDataFromHits<{ coord: HexCoord; resource: ResourceId }>(hits, 'buyLot') ?? null
  }

  pickFuel(clientX: number, clientY: number): HexCoord | null {
    const hits = this.intersectAll(clientX, clientY, this.board.tileMeshes())
    return userDataFromHits<{ coord: HexCoord }>(hits, 'buyFuel')?.coord ?? null
  }

  pickRepair(clientX: number, clientY: number): boolean {
    const hits = this.intersectAll(clientX, clientY, this.board.tileMeshes())
    return userDataFromHits<boolean>(hits, 'repairHull') === true
  }

  pickSell(clientX: number, clientY: number): { resource: ResourceId } | null {
    const hits = this.intersectAll(clientX, clientY, this.board.tileMeshes())
    return userDataFromHits<{ resource: ResourceId }>(hits, 'sellLot') ?? null
  }

  pickPlanetName(clientX: number, clientY: number): HexCoord | null {
    const hits = this.intersectAll(clientX, clientY, this.board.tileMeshes())
    return userDataFromHits<HexCoord>(hits, 'planetName') ?? null
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
        [...Object.values(state.ships), ...Object.values(state.npcShips)].map((ship) => [
          ship.id,
          { ...ship.coord },
        ]),
      )
      this.primed = true
      return
    }

    for (const key of tileKeys) {
      if (!this.prevTileKeys.has(key)) this.beginRise(key)
    }

    for (const ship of [...Object.values(state.ships), ...Object.values(state.npcShips)]) {
      const prev = this.prevShipCoords.get(ship.id)
      if (!prev) {
        this.prevShipCoords.set(ship.id, { ...ship.coord })
        continue
      }
      if (prev.q === ship.coord.q && prev.r === ship.coord.r) continue
      const dest = { ...ship.coord }
      const vortex = this.vortexFx
      if (vortex && vortex.shipId === ship.id && coordKey(dest) === coordKey(vortex.dest)) {
        if (!this.ships.isFlyingTo(ship.id, vortex.coord) && !this.ships.isParkedAt(ship.id, vortex.coord)) {
          this.ships.fly(ship.id, prev, vortex.coord)
        }
        this.prevShipCoords.set(ship.id, dest)
        continue
      }
      if (this.ships.isFlyingTo(ship.id, dest) || this.ships.isParkedAt(ship.id, dest)) {
        this.prevShipCoords.set(ship.id, dest)
        continue
      }
      if (this.ships.isBusy(ship.id) && this.ships.isFlyingTo(ship.id, dest)) continue
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
    this.ships.setThreat(this.duel ? null : (this.lastOptions.threatShipId ?? null))
    this.hoverTargets.sync(this.lastState, this.lastOptions.hover ?? null, this.lastOptions.probeAim === true)
    for (const probe of Object.values(this.lastState.probes)) {
      this.launchProbeFlight(probe.ownerShipId, probe.coord)
    }
    this.probes.sync(this.lastState, this.inflightProbeKeys)
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
      this.revealWhenSettled.delete(key)
      if (!this.inflightProbeKeys.has(key)) {
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
    this.inflightProbeKeys.clear()
    this.startedProbeFlights.clear()
    this.vortexFx = null
    this.board.setVortexFlash(null)
    this.ships.reset()
    this.combat.dispose()
    this.duel = null
  }

  private advanceVortex(now: number): void {
    const fx = this.vortexFx
    if (!fx) {
      this.board.setVortexFlash(null)
      return
    }
    const key = coordKey(fx.coord)
    const step = prefersReducedMotion() ? 0 : VORTEX_CHASE_STEP_MS
    const chaseMs = step * 6 * VORTEX_CHASE_LAPS
    if (fx.stage === 'inbound') {
      if (this.ships.isBusy(fx.shipId) && this.ships.isFlyingTo(fx.shipId, fx.coord)) return
      this.ships.hold(fx.shipId, fx.coord, true)
      fx.stage = 'chase'
      fx.startedAt = now
    }
    if (fx.stage === 'chase') {
      const elapsed = now - fx.startedAt
      if (step <= 0 || elapsed >= chaseMs) {
        this.board.setVortexFlash({ key, face: fx.face, hold: true })
        fx.stage = 'hold'
        fx.startedAt = now
      } else {
        const idx = Math.floor(elapsed / step) % 6
        this.board.setVortexFlash({ key, face: idx + 1, hold: false })
        return
      }
    }
    if (fx.stage === 'hold') {
      this.board.setVortexFlash({ key, face: fx.face, hold: true })
      const same = coordKey(fx.coord) === coordKey(fx.dest)
      if (!same && !this.ships.isFlyingTo(fx.shipId, fx.dest) && !this.ships.isParkedAt(fx.shipId, fx.dest)) {
        this.ships.fly(fx.shipId, fx.coord, fx.dest, true)
        return
      }
      if (this.ships.isBusy(fx.shipId)) return
      this.vortexFx = null
      this.board.setVortexFlash(null)
    }
  }

  private advanceDuel(now: number): void {
    const duel = this.duel
    if (!duel) return
    if (duel.stage === 'align') {
      const wait = prefersReducedMotion() ? 0 : CAMERA_FOCUS_MS
      if (now - duel.startedAt < wait) return
      if (this.ships.anySliding() || this.ships.anyBusy()) return
      duel.stage = 'fire'
    }
    if (duel.stage === 'fire') {
      if (!this.combat.idle) return
      if (duel.index >= duel.shots.length) {
        duel.stage = 'recover'
        this.ships.clearDuel()
        this.applySync()
        this.camera.clearInspectLimits()
        return
      }
      const shot = duel.shots[duel.index]
      const from = this.ships.worldPose(shot.attackerId)
      const to = this.ships.worldPose(shot.defenderId)
      if (!from || !to) return
      const side = duel.sideCount[shot.attackerId] ?? 0
      duel.sideCount[shot.attackerId] = side + 1
      this.combat.spawnOne(from, from.yaw, to, now, side, (target) => {
        this.combat.spawnDamage(target, shot.damage, performance.now())
      })
      duel.index += 1
      return
    }
    if (duel.stage === 'recover') {
      if (this.ships.anySliding()) return
      this.duel = null
    }
  }

  private loop = (): void => {
    if (this.disposed) return
    requestAnimationFrame(this.loop)
    const now = performance.now()
    const riseRevealed = this.advanceRise(now)
    const time = now / 1000
    this.board.tick(time, this.camera.camera)
    this.preview.tick(time)
    const shipsSettled = this.ships.tick(this.camera.camera, time)
    this.hoverTargets.tick(time)
    this.probes.tick(time)
    this.advanceDuel(now)
    this.advanceVortex(now)
    this.combat.tick(now)
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
    if ((shipsSettled || glyphsChanged || riseRevealed) && (!this.duel || this.duel.stage === 'recover')) {
      this.applySync()
    }
    this.camera.tick()
    this.renderer.render(this.scene, this.camera.camera)
  }
}

function fallbackShipPose(
  state: GameState | null,
  shipId: string,
): { x: number; y: number; z: number; yaw: number } | null {
  const ship = state?.ships[shipId] ?? state?.npcShips[shipId]
  if (!ship) return null
  const pos = getWorldPosition(ship.coord)
  return { x: pos.x, y: TILE_THICKNESS + 0.14, z: pos.z, yaw: 0 }
}

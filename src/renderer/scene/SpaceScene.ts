import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import type { GameEvent } from '../../game/engine/events'
import { CameraController, makeLights } from './CameraController'
import { BoardRenderer } from '../board/BoardRenderer'
import { TilePreviewRenderer } from '../board/TilePreviewRenderer'
import { ShipRenderer } from '../entities/ShipRenderer'
import { palette } from '../theme'
import type { HexCoord } from '../../game/board/HexCoord'

export interface SceneOptions {
  showDebug: boolean
  showCoords: boolean
  showEdges: boolean
  selectedKey?: string | null
  showExploreGhosts?: boolean
}

export class SpaceScene {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: CameraController
  readonly board: BoardRenderer
  readonly preview: TilePreviewRenderer
  readonly ships: ShipRenderer
  readonly raycaster = new THREE.Raycaster()
  private disposed = false

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(palette.void)
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(palette.void)
    this.camera = new CameraController(canvas)
    makeLights(this.scene)
    this.board = new BoardRenderer()
    this.preview = new TilePreviewRenderer()
    this.ships = new ShipRenderer()
    this.scene.add(this.board.group, this.preview.group, this.ships.group)
    this.loop()
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false)
    this.camera.resize(width, height)
  }

  sync(state: GameState, options: SceneOptions): void {
    this.board.sync(state, options)
    this.preview.sync(state)
    this.ships.sync(state)
  }

  handleEvents(events: GameEvent[], state: GameState): void {
    for (const event of events) {
      if (event.type === 'TILE_DRAWN' && state.exploration.origin && state.exploration.target) {
        this.camera.focusPair(state.exploration.origin, state.exploration.target)
      }
      if (event.type === 'TILE_PLACED') {
        this.camera.focus(event.coord)
      }
      if (event.type === 'SHIP_MOVED') {
        this.camera.focus(event.to, 6.5)
      }
      if (event.type === 'GAME_STARTED') {
        this.camera.focus({ q: 0, r: 0 })
      }
    }
  }

  pickDirection(clientX: number, clientY: number): { direction: number } | null {
    const hit = this.intersect(clientX, clientY, this.board.pickables())
    if (!hit || hit.object.userData.direction === undefined) return null
    return { direction: hit.object.userData.direction as number }
  }

  pickShip(clientX: number, clientY: number): { shipId: string } | null {
    const hit = this.intersect(clientX, clientY, this.ships.pickables())
    if (!hit) return null
    let obj: THREE.Object3D | null = hit.object
    while (obj) {
      if (typeof obj.userData.shipId === 'string') return { shipId: obj.userData.shipId }
      obj = obj.parent
    }
    return null
  }

  pickTile(clientX: number, clientY: number): HexCoord | null {
    const hit = this.intersect(clientX, clientY, this.board.tileMeshes())
    if (!hit) return null
    let obj: THREE.Object3D | null = hit.object
    while (obj) {
      if (obj.userData.tileCoord) return obj.userData.tileCoord as HexCoord
      obj = obj.parent
    }
    return null
  }

  private intersect(clientX: number, clientY: number, objects: THREE.Object3D[]): THREE.Intersection | null {
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera.camera)
    const hits = this.raycaster.intersectObjects(objects, true)
    return hits[0] ?? null
  }

  dispose(): void {
    this.disposed = true
    this.camera.dispose()
    this.renderer.dispose()
  }

  private loop = (): void => {
    if (this.disposed) return
    requestAnimationFrame(this.loop)
    const time = performance.now() / 1000
    this.board.tick(time)
    this.preview.tick(time)
    this.ships.tick(time)
    this.camera.tick()
    this.renderer.render(this.scene, this.camera.camera)
  }
}

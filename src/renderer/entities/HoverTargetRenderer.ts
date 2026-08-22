import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { hoverCaption, type BoardHover } from '../../ui/boardHover'
import { getNeighbor, getWorldPosition, HEX_SIZE } from '../../game/board/hexMath'
import { canExploreDirection } from '../../game/rules/exploration'
import { canMoveTo } from '../../game/rules/movement'
import { activeShip } from '../../game/rules/fuel'
import { TILE_THICKNESS } from '../board/TileRenderer'
import { coordKey } from '../../game/board/HexCoord'
import { css } from '../theme'

export class HoverTargetRenderer {
  readonly group = new THREE.Group()
  private labels = new THREE.Group()

  constructor() {
    this.group.add(this.labels)
  }

  sync(state: GameState, hover: BoardHover | null): void {
    this.group.clear()
    this.labels = new THREE.Group()
    this.group.add(this.labels)
    if (state.phase !== 'PLAYER_TURN' || state.movementSpent) return
    const ship = activeShip(state)
    this.addHit({ kind: 'STAY', coord: ship.coord }, TILE_THICKNESS + 0.04, HEX_SIZE * 0.86)

    for (let dir = 0; dir < 6; dir++) {
      const target = getNeighbor(ship.coord, dir)
      if (canExploreDirection(state, dir)) {
        this.addHit({ kind: 'EXPLORE', coord: target, direction: dir }, 0.06, HEX_SIZE * 0.86)
      } else if (canMoveTo(state, target)) {
        this.addHit(
          { kind: 'MOVE', coord: target, direction: dir },
          TILE_THICKNESS + 0.04,
          HEX_SIZE * 0.86,
        )
      }
    }

    if (hover) this.addLabel(hover, ship.coord)
  }

  tick(time = 0): void {
    const pulse = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(time * 3.4))
    const scale = 0.92 + 0.08 * (0.5 + 0.5 * Math.sin(time * 3.4))
    this.labels.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const mat = obj.material
      if (Array.isArray(mat) || !('opacity' in mat)) return
      mat.opacity = pulse
      obj.scale.setScalar(scale)
    })
  }

  pickables(): THREE.Object3D[] {
    return this.group.children.filter((child) => child !== this.labels)
  }

  private addLabel(hover: BoardHover, origin: { q: number; r: number }): void {
    const pos = getWorldPosition(hover.coord)
    const edge = edgeOffset(hover.coord, origin)
    const mesh = makeCaption(hoverCaption(hover.kind))
    mesh.position.set(pos.x + edge.x, TILE_THICKNESS + 0.035, pos.z + edge.z)
    this.labels.add(mesh)
  }

  private addHit(hover: BoardHover, y: number, radius: number): void {
    const pos = getWorldPosition(hover.coord)
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 6),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(pos.x, y, pos.z)
    mesh.userData.boardHover = hover
    mesh.userData.tileKey = coordKey(hover.coord)
    this.group.add(mesh)
  }
}

function makeCaption(text: string): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 512, 96)
    ctx.fillStyle = css.ivory
    ctx.font = '500 26px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 50)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.14),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 12
  return mesh
}

function edgeOffset(
  target: { q: number; r: number },
  origin: { q: number; r: number },
): { x: number; z: number } {
  const from = getWorldPosition(origin)
  const to = getWorldPosition(target)
  let dx = from.x - to.x
  let dz = from.z - to.z
  const len = Math.hypot(dx, dz)
  if (len < 0.001) {
    dx = 0
    dz = 1
  } else {
    dx /= len
    dz /= len
  }
  const rim = HEX_SIZE * 0.7
  return { x: dx * rim, z: dz * rim }
}

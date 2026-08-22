import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import type { BoardHover } from '../../ui/boardHover'
import { getNeighbor, getWorldPosition, HEX_SIZE } from '../../game/board/hexMath'
import { canExploreDirection } from '../../game/rules/exploration'
import { canMoveTo } from '../../game/rules/movement'
import { activeShip } from '../../game/rules/fuel'
import { TILE_THICKNESS } from '../board/TileRenderer'
import { css } from '../theme'
import { coordKey } from '../../game/board/HexCoord'

const HIT_Y = 0.04

export class HoverTargetRenderer {
  readonly group = new THREE.Group()
  private hits = new THREE.Group()
  private rotate = new THREE.Group()

  constructor() {
    this.group.add(this.hits, this.rotate)
  }

  sync(state: GameState, hover: BoardHover | null): void {
    this.hits.clear()
    this.rotate.clear()
    if (state.phase !== 'PLAYER_TURN') return
    const ship = activeShip(state)
    this.addHit({ kind: 'STAY', coord: ship.coord }, HIT_Y)

    if (!state.movementSpent) {
      for (let dir = 0; dir < 6; dir++) {
        const target = getNeighbor(ship.coord, dir)
        if (canExploreDirection(state, dir)) {
          this.addHit({ kind: 'EXPLORE', coord: target, direction: dir }, HIT_Y)
        } else if (canMoveTo(state, target)) {
          this.addHit({ kind: 'MOVE', coord: target, direction: dir }, TILE_THICKNESS + 0.03)
        }
      }
    }

    if (hover?.kind === 'EXPLORE') {
      const pos = getWorldPosition(hover.coord)
      const token = makeRotateSprite()
      token.position.set(pos.x + HEX_SIZE * 0.72, TILE_THICKNESS + 0.28, pos.z + HEX_SIZE * 0.18)
      this.rotate.add(token)
    }
  }

  tick(camera: THREE.Camera): void {
    for (const child of this.rotate.children) {
      child.quaternion.copy(camera.quaternion)
    }
  }

  pickables(): THREE.Object3D[] {
    return this.hits.children
  }

  rotatePickables(): THREE.Object3D[] {
    return this.rotate.children
  }

  private addHit(hover: BoardHover, y: number): void {
    const pos = getWorldPosition(hover.coord)
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(HEX_SIZE * 0.9, 6),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(pos.x, y, pos.z)
    mesh.userData.boardHover = hover
    mesh.userData.tileKey = coordKey(hover.coord)
    this.hits.add(mesh)
  }
}

function makeRotateSprite(): THREE.Sprite {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, size, size)
    ctx.beginPath()
    ctx.arc(64, 64, 40, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(11, 12, 12, 0.75)'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = css.ochre
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(64, 64, 18, Math.PI * 0.15, Math.PI * 1.65)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(64 + 18 * Math.cos(Math.PI * 0.15), 64 + 18 * Math.sin(Math.PI * 0.15))
    ctx.lineTo(86, 52)
    ctx.lineTo(92, 70)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
  )
  sprite.scale.set(0.38, 0.38, 1)
  sprite.userData.rotateControl = true
  return sprite
}

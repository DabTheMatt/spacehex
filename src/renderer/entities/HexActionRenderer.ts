import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getWorldPosition, HEX_SIZE } from '../../game/board/hexMath'
import { TILE_THICKNESS } from '../board/TileRenderer'
import { activeShip } from '../../game/rules/fuel'
import { css } from '../theme'

export type HexActionId = 'MOVE' | 'EXPLORE' | 'STAY' | 'END_TURN'

const ICON_Y = TILE_THICKNESS + 0.22
const ICON_SCALE = 0.46
const REACH = HEX_SIZE * 0.92

export class HexActionRenderer {
  readonly group = new THREE.Group()

  sync(state: GameState, hide = false): void {
    this.group.clear()
    if (hide || state.phase !== 'PLAYER_TURN') return
    const ship = activeShip(state)
    const origin = getWorldPosition(ship.coord)
    const status = state.exploration.status

    if (state.movementSpent) {
      this.addToken('END_TURN', origin.x, origin.z + REACH, status === 'NONE')
      return
    }

    this.addToken('MOVE', origin.x - REACH * 0.78, origin.z + REACH * 0.42, status === 'SELECTING_MOVE')
    this.addToken('EXPLORE', origin.x, origin.z + REACH, status === 'SELECTING_DIRECTION')
    this.addToken('STAY', origin.x + REACH * 0.78, origin.z + REACH * 0.42, false)
  }

  tick(camera: THREE.Camera): void {
    for (const child of this.group.children) {
      child.quaternion.copy(camera.quaternion)
    }
  }

  pickables(): THREE.Object3D[] {
    return this.group.children
  }

  private addToken(action: HexActionId, x: number, z: number, accent: boolean): void {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeActionTexture(action, accent),
        transparent: true,
        depthWrite: false,
        depthTest: true,
      }),
    )
    sprite.position.set(x, ICON_Y, z)
    sprite.scale.set(ICON_SCALE, ICON_SCALE, 1)
    sprite.userData.hexAction = action
    sprite.userData.kind = 'HEX_ACTION'
    this.group.add(sprite)
  }
}

function makeActionTexture(action: HexActionId, accent: boolean): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, size, size)
    const stroke = accent ? css.ochre : css.ivory
    const fill = accent ? 'rgba(181, 138, 75, 0.28)' : 'rgba(11, 12, 12, 0.72)'
    ctx.beginPath()
    ctx.arc(64, 58, 42, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = stroke
    ctx.stroke()
    ctx.strokeStyle = stroke
    ctx.fillStyle = stroke
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    drawPictogram(ctx, action)
    ctx.font = '600 14px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = accent ? css.ochre : css.dusk
    ctx.fillText(caption(action), 64, 112)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function caption(action: HexActionId): string {
  if (action === 'MOVE') return '01'
  if (action === 'EXPLORE') return '02'
  if (action === 'STAY') return '03'
  return 'END'
}

function drawPictogram(ctx: CanvasRenderingContext2D, action: HexActionId): void {
  ctx.beginPath()
  if (action === 'MOVE') {
    ctx.moveTo(48, 72)
    ctx.lineTo(64, 44)
    ctx.lineTo(80, 72)
    ctx.moveTo(64, 50)
    ctx.lineTo(64, 78)
  } else if (action === 'EXPLORE') {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6
      const x = 64 + Math.cos(a) * 20
      const y = 58 + Math.sin(a) * 20
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  } else if (action === 'STAY') {
    ctx.moveTo(54, 44)
    ctx.lineTo(54, 74)
    ctx.moveTo(74, 44)
    ctx.lineTo(74, 74)
  } else {
    ctx.moveTo(46, 58)
    ctx.lineTo(72, 58)
    ctx.lineTo(64, 48)
    ctx.moveTo(72, 58)
    ctx.lineTo(64, 68)
  }
  ctx.stroke()
}

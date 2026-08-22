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

    if (hover) this.addLabel(hover)
  }

  tick(_camera: THREE.Camera): void {}

  pickables(): THREE.Object3D[] {
    return this.group.children.filter((child) => child !== this.labels)
  }

  private addLabel(hover: BoardHover): void {
    const pos = getWorldPosition(hover.coord)
    const sprite = makeCaption(hoverCaption(hover.kind))
    sprite.position.set(pos.x, TILE_THICKNESS + 0.28, pos.z)
    this.labels.add(sprite)
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

function makeCaption(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 512, 96)
    ctx.fillStyle = css.ivory
    ctx.font = '500 42px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 50)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  )
  sprite.center.set(0.5, 0.5)
  sprite.scale.set(1.35, 0.25, 1)
  sprite.renderOrder = 12
  return sprite
}

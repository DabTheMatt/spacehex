import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import type { BoardHover } from '../../ui/boardHover'
import { getNeighbor, getWorldPosition, HEX_SIZE } from '../../game/board/hexMath'
import { canExploreDirection } from '../../game/rules/exploration'
import { canMoveTo } from '../../game/rules/movement'
import { activeShip } from '../../game/rules/fuel'
import { TILE_THICKNESS } from '../board/TileRenderer'
import { coordKey } from '../../game/board/HexCoord'

export class HoverTargetRenderer {
  readonly group = new THREE.Group()

  sync(state: GameState, _hover: BoardHover | null): void {
    this.group.clear()
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
  }

  tick(_time = 0): void {}

  pickables(): THREE.Object3D[] {
    return this.group.children
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

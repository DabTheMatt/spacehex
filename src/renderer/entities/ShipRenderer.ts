import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getWorldPosition } from '../../game/board/hexMath'
import { SHIP_DEFINITIONS } from '../../game/definitions/ships'
import { palette } from '../theme'

export class ShipRenderer {
  readonly group = new THREE.Group()

  sync(state: GameState): void {
    this.group.clear()
    const ships = Object.values(state.ships)
    const occupants = new Map<string, number>()
    for (const ship of ships) {
      const key = `${ship.coord.q},${ship.coord.r}`
      const index = occupants.get(key) ?? 0
      occupants.set(key, index + 1)
      const pos = getWorldPosition(ship.coord)
      const active = state.players[state.activePlayerId]?.shipId === ship.id
      const mesh = createShipMesh(ship.class, active)
      const offset = (index - 0.5) * 0.28
      mesh.position.set(pos.x + offset, 0.22, pos.z + offset * 0.4)
      this.group.add(mesh)
    }
  }
}

function createShipMesh(shipClass: keyof typeof SHIP_DEFINITIONS, active: boolean): THREE.Mesh {
  const color = active ? palette.ochre : palette.ivory
  if (shipClass === 'MEWA') {
    const geom = new THREE.ConeGeometry(0.14, 0.42, 3)
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color }))
    mesh.rotation.x = Math.PI / 2
    return mesh
  }
  if (shipClass === 'CIERN') {
    return new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshBasicMaterial({ color }),
    )
  }
  return new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.34, 3),
    new THREE.MeshBasicMaterial({ color }),
  )
}

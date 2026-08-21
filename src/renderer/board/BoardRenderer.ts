import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getTileDefinition } from '../../game/definitions/tiles'
import { getRotatedEdges } from '../../game/board/tileRotation'
import { getWorldPosition, HEX_SIZE, getNeighbor } from '../../game/board/hexMath'
import { isTilePlaced } from '../../game/board/HexMap'
import { createHexMesh, makeDebugSprite, makeSymbolSprite } from './TileRenderer'
import { palette, css } from '../theme'
import { coordKey } from '../../game/board/HexCoord'

export class BoardRenderer {
  readonly group = new THREE.Group()
  private tiles = new THREE.Group()
  private markers = new THREE.Group()

  constructor() {
    this.group.add(this.tiles)
    this.group.add(this.markers)
  }

  sync(state: GameState, options: { showDebug: boolean; showCoords: boolean; showEdges: boolean }): void {
    this.tiles.clear()
    this.markers.clear()

    for (const tile of Object.values(state.board.tiles)) {
      const def = getTileDefinition(tile.definitionId)
      const pos = getWorldPosition(tile.coord)
      const mesh = createHexMesh({ fill: palette.tileFill, stroke: palette.ivory, y: 0 })
      mesh.position.set(pos.x, 0, pos.z)
      mesh.rotation.y = tile.rotation * (Math.PI / 3)
      mesh.add(makeSymbolSprite(def.symbol, css.paper))
      if (options.showDebug || options.showCoords || options.showEdges) {
        const edges = getRotatedEdges(def, tile.rotation)
        const lines = [
          options.showCoords ? `${coordKey(tile.coord)}` : '',
          options.showDebug ? tile.id : '',
          options.showDebug ? `rot ${tile.rotation} (${tile.rotation * 60}°)` : '',
          ...(options.showEdges ? edges.map((e, i) => `${i}:${e}`) : []),
        ].filter(Boolean)
        mesh.add(makeDebugSprite(lines))
      }
      this.tiles.add(mesh)

      if (options.showEdges) {
        for (let dir = 0; dir < 6; dir++) {
          const n = getNeighbor(tile.coord, dir)
          const np = getWorldPosition(n)
          const label = makeSymbolSprite(String(dir), css.ochre)
          label.position.set((pos.x + np.x) / 2, 0.2, (pos.z + np.z) / 2)
          label.scale.set(0.7, 0.7, 1)
          this.markers.add(label)
        }
      }
    }

    this.drawActionMarkers(state)
  }

  private drawActionMarkers(state: GameState): void {
    const origin = state.exploration.origin
    if (!origin) return
    const selectingExplore = state.exploration.status === 'SELECTING_DIRECTION'
    const selectingMove = state.exploration.status === 'SELECTING_MOVE'
    if (!selectingExplore && !selectingMove) return

    for (let dir = 0; dir < 6; dir++) {
      const target = getNeighbor(origin, dir)
      const occupied = isTilePlaced(state.board, target)
      if (selectingExplore && occupied) continue
      if (selectingMove && !occupied) continue
      const op = getWorldPosition(origin)
      const tp = getWorldPosition(target)
      const t = occupied ? 0.42 : 0.38
      const x = op.x + (tp.x - op.x) * t
      const z = op.z + (tp.z - op.z) * t
      const color = occupied ? palette.dusk : palette.blood
      const geom = new THREE.ConeGeometry(HEX_SIZE * 0.08, HEX_SIZE * 0.22, 4)
      const mat = new THREE.MeshBasicMaterial({ color })
      const cone = new THREE.Mesh(geom, mat)
      cone.position.set(x, 0.12, z)
      const angle = Math.atan2(tp.x - op.x, tp.z - op.z)
      cone.rotation.x = Math.PI / 2
      cone.rotation.z = -angle
      cone.userData = { kind: occupied ? 'MOVE' : 'EXPLORE', direction: dir, target }
      this.markers.add(cone)

      const tick = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshBasicMaterial({ color }),
      )
      tick.position.set(x, 0.05, z)
      tick.userData = cone.userData
      this.markers.add(tick)
    }
  }

  pickables(): THREE.Object3D[] {
    return this.markers.children
  }
}

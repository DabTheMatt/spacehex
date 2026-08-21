import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getTileDefinition } from '../../game/definitions/tiles'
import { getWorldPosition } from '../../game/board/hexMath'
import { createHexMesh, makeSymbolSprite } from './TileRenderer'
import { palette, css } from '../theme'

export class TilePreviewRenderer {
  readonly group = new THREE.Group()

  sync(state: GameState): void {
    this.group.clear()
    const exp = state.exploration
    if (state.phase !== 'TILE_PLACEMENT' || !exp.pendingTileId || !exp.target) return
    const def = getTileDefinition(exp.pendingTileId)
    const pos = getWorldPosition(exp.target)
    const mesh = createHexMesh({
      fill: palette.graphite,
      stroke: palette.paper,
      opacity: 0.45,
      y: 0.35,
    })
    mesh.position.set(pos.x, 0, pos.z)
    mesh.rotation.y = (exp.rotation ?? 0) * (Math.PI / 3)
    mesh.add(makeSymbolSprite(def.symbol + ' ↻', css.ivory))
    this.group.add(mesh)
  }
}

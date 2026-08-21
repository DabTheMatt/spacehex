import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getTileDefinition } from '../../game/definitions/tiles'
import { getWorldPosition } from '../../game/board/hexMath'
import { createHexMesh, TILE_THICKNESS } from './TileRenderer'
import { createTileGlyph, tickTileGlyphs } from './tileGlyphs'
import { palette } from '../theme'

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
      opacity: 0.55,
      y: 0.28,
    })
    mesh.position.set(pos.x, 0, pos.z)
    mesh.rotation.y = (exp.rotation ?? 0) * (Math.PI / 3)
    const glyph = createTileGlyph(def, palette.paper)
    glyph.position.y = 0.28 + TILE_THICKNESS
    mesh.add(glyph)
    this.group.add(mesh)
  }

  tick(time: number): void {
    tickTileGlyphs(this.group, time)
  }
}

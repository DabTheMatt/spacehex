import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getTileDefinition } from '../../game/definitions/tiles'
import { getWorldPosition } from '../../game/board/hexMath'
import { createHexMesh, TILE_SETTLED_Y, TILE_THICKNESS } from './TileRenderer'
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
      fill: palette.tileFill,
      stroke: palette.ivory,
      y: TILE_SETTLED_Y,
    })
    mesh.position.set(pos.x, TILE_SETTLED_Y, pos.z)
    mesh.rotation.y = (exp.rotation ?? 0) * (Math.PI / 3)
    const glyph = createTileGlyph(def)
    glyph.position.y = TILE_THICKNESS
    mesh.add(glyph)
    this.group.add(mesh)
  }

  tick(time: number): void {
    tickTileGlyphs(this.group, time)
  }
}

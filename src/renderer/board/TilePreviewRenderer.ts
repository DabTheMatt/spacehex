import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getTileDefinition } from '../../game/definitions/tiles'
import { getWorldPosition } from '../../game/board/hexMath'
import { createHexMesh, TILE_SLOT_Y, TILE_THICKNESS } from './TileRenderer'
import { createTileGlyph, tickTileGlyphs } from './tileGlyphs'
import { palette } from '../theme'
import type { HexCoord } from '../../game/board/HexCoord'

export class TilePreviewRenderer {
  readonly group = new THREE.Group()

  sync(
    state: GameState,
    peek?: { coord: HexCoord; tileId: string; rotation: number } | null,
  ): void {
    this.group.clear()
    const exp = state.exploration
    if (state.phase === 'TILE_PLACEMENT' && exp.pendingTileId && exp.target) {
      this.addPreview(exp.target, exp.pendingTileId, exp.rotation ?? 0)
      return
    }
    if (!peek) return
    this.addPreview(peek.coord, peek.tileId, peek.rotation)
  }

  tick(time: number): void {
    tickTileGlyphs(this.group, time)
  }

  private addPreview(coord: HexCoord, tileId: string, rotation: number): void {
    const def = getTileDefinition(tileId)
    const pos = getWorldPosition(coord)
    const mesh = createHexMesh({
      fill: palette.tileFill,
      stroke: palette.ochre,
      dashed: true,
      y: 0,
    })
    mesh.position.set(pos.x, TILE_SLOT_Y, pos.z)
    mesh.rotation.y = rotation * (Math.PI / 3)
    const glyph = createTileGlyph(def, palette.ochre)
    glyph.position.y = TILE_THICKNESS
    mesh.add(glyph)
    this.group.add(mesh)
  }
}

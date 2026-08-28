import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getWorldPosition } from '../../game/board/hexMath'
import { createHexMesh, TILE_SLOT_Y, TILE_THICKNESS } from './TileRenderer'
import { createTileGlyph, tickTileGlyphs } from './tileGlyphs'
import { scenePalette } from '../theme'
import { isInk, type GraphicMode } from '../graphicMode'
import { clamp01, easeOutCubic, prefersReducedMotion, TILE_REVEAL_MS } from '../motion'
import { coordKey } from '../../game/board/HexCoord'
import { getTileDefinition } from '../../game/definitions/tiles'

export class TilePreviewRenderer {
  readonly group = new THREE.Group()
  private placedKey: string | null = null
  private fadeStart = 0
  private fadeDuration = TILE_REVEAL_MS
  private revealed = false
  private graphicMode: GraphicMode = 'space'

  setGraphicMode(mode: GraphicMode): void {
    this.graphicMode = mode
    this.placedKey = null
    this.group.clear()
  }

  onRevealed: (() => void) | null = null

  sync(state: GameState): void {
    const exp = state.exploration
    if (state.phase !== 'TILE_PLACEMENT' || !exp.pendingTileId || !exp.target) {
      this.group.clear()
      this.placedKey = null
      this.revealed = false
      return
    }
    const key = `${coordKey(exp.target)}:${exp.pendingTileId}`
    if (this.placedKey === key) {
      const mesh = this.group.children[0]
      if (mesh) {
        mesh.rotation.y = (exp.rotation ?? 0) * (Math.PI / 3)
        mesh.userData.placementTarget = true
      }
      return
    }
    this.group.clear()
    this.placedKey = key
    this.revealed = false
    this.fadeStart = performance.now()
    this.fadeDuration = prefersReducedMotion() ? 0 : TILE_REVEAL_MS
    const pos = getWorldPosition(exp.target)
    const colors = scenePalette(this.graphicMode)
    const ink = isInk(this.graphicMode)
    const mesh = createHexMesh({
      fill: colors.tileFill,
      stroke: colors.ochre,
      dashed: true,
      y: 0,
      opacity: 0.04,
      flat: ink,
    })
    mesh.position.set(pos.x, TILE_SLOT_Y, pos.z)
    mesh.rotation.y = (exp.rotation ?? 0) * (Math.PI / 3)
    mesh.userData.placementTarget = true
    mesh.userData.tileCoord = exp.target
    const def = getTileDefinition(exp.pendingTileId)
    const glyph = createTileGlyph(
      def,
      colors.ochre,
      exp.pendingTileId,
      false,
      exp.pendingEdgeNumbers,
      ink,
    )
    glyph.position.y = TILE_THICKNESS
    mesh.add(glyph)
    this.group.add(mesh)
    this.applyOpacity(0.04)
  }

  tick(time: number): void {
    tickTileGlyphs(this.group, time)
    if (!this.placedKey || this.revealed) return
    const t = this.fadeDuration <= 0 ? 1 : clamp01((performance.now() - this.fadeStart) / this.fadeDuration)
    this.applyOpacity(lerpReveal(t))
    if (t < 1) return
    this.revealed = true
    this.onRevealed?.()
  }

  private applyOpacity(opacity: number): void {
    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      const mat = mesh.material
      if (!mat) return
      const list = Array.isArray(mat) ? mat : [mat]
      for (const item of list) {
        const material = item as THREE.Material & { opacity?: number }
        material.transparent = true
        material.depthWrite = false
        if (typeof material.opacity === 'number') {
          material.opacity = opacity
        }
      }
    })
  }
}

function lerpReveal(t: number): number {
  return 0.04 + (0.95 - 0.04) * easeOutCubic(t)
}

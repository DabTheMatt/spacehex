import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getWorldPosition } from '../../game/board/hexMath'
import { createHexMesh, TILE_SLOT_Y } from './TileRenderer'
import { tickTileGlyphs } from './tileGlyphs'
import { palette } from '../theme'
import { clamp01, easeOutCubic, prefersReducedMotion, TILE_REVEAL_MS } from '../motion'
import { coordKey } from '../../game/board/HexCoord'

export class TilePreviewRenderer {
  readonly group = new THREE.Group()
  private placedKey: string | null = null
  private fadeStart = 0
  private fadeDuration = TILE_REVEAL_MS
  private revealed = false

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
    if (this.placedKey === key) return
    this.group.clear()
    this.placedKey = key
    this.revealed = false
    this.fadeStart = performance.now()
    this.fadeDuration = prefersReducedMotion() ? 0 : TILE_REVEAL_MS
    const pos = getWorldPosition(exp.target)
    const mesh = createHexMesh({
      fill: palette.tileFill,
      stroke: palette.ochre,
      dashed: true,
      y: 0,
      opacity: 0.04,
    })
    mesh.position.set(pos.x, TILE_SLOT_Y, pos.z)
    mesh.rotation.y = (exp.rotation ?? 0) * (Math.PI / 3)
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

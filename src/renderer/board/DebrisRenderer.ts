import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getWorldPosition } from '../../game/board/hexMath'
import { TILE_THICKNESS } from './TileRenderer'
import { createCargoFigure, attachCrateMotion, CARGO_COLOR } from './cargoMesh'
import { tickTileGlyphs } from './tileGlyphs'
import { scenePalette } from '../theme'
import type { GraphicMode } from '../graphicMode'
import { isInk } from '../graphicMode'
import { RNG } from '../../game/random/RNG'

export class DebrisRenderer {
  readonly group = new THREE.Group()
  private graphicMode: GraphicMode = 'space'
  private sig = ''

  setGraphicMode(mode: GraphicMode): void {
    this.graphicMode = mode
    this.sig = ''
  }

  sync(state: GameState): void {
    const ink = isInk(this.graphicMode)
    const line = scenePalette(this.graphicMode).paper
    const next = `${this.graphicMode}|${state.debris.map((c) => `${c.id}:${c.kind}:${c.coord.q},${c.coord.r}`).join(';')}`
    if (next === this.sig) return
    this.sig = next
    this.group.clear()
    const byHex = new Map<string, typeof state.debris>()
    for (const crate of state.debris) {
      const key = `${crate.coord.q},${crate.coord.r}`
      const list = byHex.get(key) ?? []
      list.push(crate)
      byHex.set(key, list)
    }
    for (const crates of byHex.values()) {
      const pad = new THREE.Group()
      const pos = getWorldPosition(crates[0].coord)
      pad.position.set(pos.x, 0, pos.z)
      for (const crate of crates) {
        const size = 0.11
        const color = ink ? line : CARGO_COLOR[crate.kind]
        const mesh = createCargoFigure(crate.kind, size, color)
        const rng = new RNG(`debris-motion:${crate.id}`)
        const speed = 0.04 + rng.next() * 0.028
        const a = rng.next() * Math.PI * 2
        const ox = (rng.next() - 0.5) * 0.2
        const oz = (rng.next() - 0.5) * 0.2
        attachCrateMotion(
          mesh,
          ox,
          oz,
          TILE_THICKNESS + size * 0.55,
          Math.cos(a) * speed,
          Math.sin(a) * speed,
          {
            x: (0.5 + rng.next() * 0.8) * (rng.next() < 0.5 ? -1 : 1),
            y: (0.4 + rng.next() * 0.9) * (rng.next() < 0.5 ? -1 : 1),
            z: (0.3 + rng.next() * 0.7) * (rng.next() < 0.5 ? -1 : 1),
          },
        )
        pad.add(mesh)
      }
      this.group.add(pad)
    }
  }

  tick(time: number): void {
    tickTileGlyphs(this.group, time)
  }
}

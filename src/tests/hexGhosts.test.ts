import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { makeDashedHexGhost } from '../renderer/board/TileRenderer'

describe('move / explore hex ghosts', () => {
  it('uses a 2px screen-space line so destinations stay readable', () => {
    const ghost = makeDashedHexGhost(0, 0.72, 'EXPLORE')
    const lines: LineMaterial[] = []
    ghost.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material
      if (mat && (mat as LineMaterial).isLineMaterial) lines.push(mat as LineMaterial)
    })
    expect(lines).toHaveLength(1)
    expect(lines[0].opacity).toBeGreaterThanOrEqual(0.65)
    expect(lines[0].linewidth).toBeGreaterThanOrEqual(2.5)
    expect(lines[0].dashed).toBe(false)
  })

  it('does not fill a placed move-target hex', () => {
    const ghost = makeDashedHexGhost(2, 0.8, 'MOVE')
    const fills: number[] = []
    ghost.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const mat = obj.material as THREE.MeshBasicMaterial
      if (!mat || (mat as unknown as LineMaterial).isLineMaterial) return
      fills.push(mat.opacity)
    })
    expect(fills.every((opacity) => opacity === 0)).toBe(true)
  })
})

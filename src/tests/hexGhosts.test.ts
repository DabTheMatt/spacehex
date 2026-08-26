import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { makeDashedHexGhost, pulseHexGhosts } from '../renderer/board/TileRenderer'

function lineMaterials(root: THREE.Object3D): LineMaterial[] {
  const lines: LineMaterial[] = []
  root.traverse((obj) => {
    const mat = (obj as THREE.Mesh).material
    if (mat && (mat as LineMaterial).isLineMaterial) lines.push(mat as LineMaterial)
  })
  return lines
}

describe('move / explore hex ghosts', () => {
  it('marks only the six corners with short ticks', () => {
    const ghost = makeDashedHexGhost(0, 0.38, 'EXPLORE')
    const lines = lineMaterials(ghost)
    expect(lines).toHaveLength(12)
    expect(lines[0].dashed).toBe(false)
  })

  it('does not fill a placed move-target hex', () => {
    const ghost = makeDashedHexGhost(2, 0.38, 'MOVE')
    const fills: number[] = []
    ghost.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const mat = obj.material as THREE.MeshBasicMaterial
      if (!mat || (mat as unknown as LineMaterial).isLineMaterial) return
      fills.push(mat.opacity)
    })
    expect(fills.every((opacity) => opacity === 0)).toBe(true)
  })

  it('breathes opacity over time', () => {
    const ghost = makeDashedHexGhost(1, 0.38, 'EXPLORE')
    pulseHexGhosts(ghost, 0)
    const dim = lineMaterials(ghost)[0].opacity
    pulseHexGhosts(ghost, 0.6)
    const bright = lineMaterials(ghost)[0].opacity
    expect(bright).toBeGreaterThan(dim)
    expect(bright).toBeLessThan(0.45)
  })
})

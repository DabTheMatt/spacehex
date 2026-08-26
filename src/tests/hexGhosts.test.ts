import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { makeDashedHexGhost, pulseHexGhosts } from '../renderer/board/TileRenderer'

describe('move / explore hex ghosts', () => {
  it('has no visible frame, only an invisible hit hex', () => {
    const ghost = makeDashedHexGhost(0, 0.38, 'EXPLORE')
    const lines: THREE.Line[] = []
    const fills: number[] = []
    ghost.traverse((obj) => {
      if (obj instanceof THREE.Line) lines.push(obj)
      if (!(obj instanceof THREE.Mesh)) return
      const mat = obj.material as THREE.MeshBasicMaterial
      if (!mat || !('opacity' in mat)) return
      fills.push(mat.opacity)
    })
    expect(lines).toHaveLength(0)
    expect(fills.length).toBeGreaterThan(0)
    expect(fills.every((opacity) => opacity === 0)).toBe(true)
  })

  it('pulse is a no-op when there is no frame', () => {
    const ghost = makeDashedHexGhost(1, 0.38, 'MOVE')
    expect(() => pulseHexGhosts(ghost, 0.6)).not.toThrow()
  })
})

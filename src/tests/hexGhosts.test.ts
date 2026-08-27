import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  makeDashedHexGhost,
  makeHoverArrow,
  makeHoverHighlight,
  pulseHexGhosts,
} from '../renderer/board/TileRenderer'

function firstOpacity(root: THREE.Object3D): number | undefined {
  let opacity: number | undefined
  root.traverse((obj) => {
    if (opacity !== undefined) return
    const mat = (obj as THREE.Mesh).material as THREE.Material & { opacity?: number }
    if (!mat || Array.isArray(mat) || typeof mat.opacity !== 'number') return
    opacity = mat.opacity
  })
  return opacity
}

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

  it('hover highlight has corner ticks that pulse', () => {
    const highlight = makeHoverHighlight()
    const lines: THREE.Line[] = []
    highlight.traverse((obj) => {
      if (obj instanceof THREE.Line) lines.push(obj)
    })
    expect(lines.length).toBeGreaterThan(0)
    pulseHexGhosts(highlight, 0)
    const a = firstOpacity(highlight)
    pulseHexGhosts(highlight, 0.3)
    const b = firstOpacity(highlight)
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).not.toBe(b)
  })

  it('hover arrow has a shaft and head that pulse', () => {
    const arrow = makeHoverArrow({ x: 0, z: 0 }, { x: 1.7, z: 0 })
    let lines = 0
    let meshes = 0
    arrow.traverse((obj) => {
      if (obj instanceof THREE.Line) lines += 1
      if (obj instanceof THREE.Mesh) meshes += 1
    })
    expect(lines).toBeGreaterThan(0)
    expect(meshes).toBeGreaterThan(0)
    pulseHexGhosts(arrow, 0)
    const a = firstOpacity(arrow)
    pulseHexGhosts(arrow, 0.3)
    const b = firstOpacity(arrow)
    expect(a).not.toBe(b)
  })
})

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { makeDashedHexGhost } from '../renderer/board/TileRenderer'

describe('move / explore hex ghosts', () => {
  it('uses a solid mesh frame so destinations stay visible on phones', () => {
    const ghost = makeDashedHexGhost(0, 0.78, 'EXPLORE')
    const frames: THREE.Mesh[] = []
    ghost.traverse((obj) => {
      if (obj instanceof THREE.Mesh) frames.push(obj)
    })
    expect(frames.length).toBeGreaterThanOrEqual(1)
    const mat = frames[0].material as THREE.MeshBasicMaterial
    expect(mat.opacity).toBeGreaterThanOrEqual(0.7)
    expect(mat.depthTest).toBe(false)
  })

  it('does not fill a placed move-target hex', () => {
    const ghost = makeDashedHexGhost(2, 0.86, 'MOVE')
    let meshCount = 0
    ghost.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshCount += 1
    })
    expect(meshCount).toBe(1)
  })
})

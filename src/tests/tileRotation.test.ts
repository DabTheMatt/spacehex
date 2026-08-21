import { describe, expect, it } from 'vitest'
import type { TileDefinition } from '../game/board/tileRotation'
import {
  getRotatedEdge,
  getRotatedEdges,
  rotateEdgeIndex,
} from '../game/board/tileRotation'

const SAMPLE: TileDefinition = {
  id: 'rotation-fixture',
  type: 'VOID',
  label: 'Fixture',
  symbol: 'T',
  edges: ['OPEN', 'BLOCKED', 'ASTEROID', 'OPEN', 'GATE', 'BLOCKED'],
}

describe('tile rotation', () => {
  it('rotateEdgeIndex maps definition edge onto world direction', () => {
    expect(rotateEdgeIndex(0, 0)).toBe(0)
    expect(rotateEdgeIndex(0, 1)).toBe(1)
    expect(rotateEdgeIndex(5, 1)).toBe(0)
    expect(rotateEdgeIndex(0, 3)).toBe(3)
  })

  it('rotation 0° leaves edges in place', () => {
    expect(getRotatedEdges(SAMPLE, 0)).toEqual([
      'OPEN',
      'BLOCKED',
      'ASTEROID',
      'OPEN',
      'GATE',
      'BLOCKED',
    ])
  })

  it('rotation 60° (1) is CCW: world 0 gets former edge 5', () => {
    expect(getRotatedEdges(SAMPLE, 1)).toEqual([
      'BLOCKED',
      'OPEN',
      'BLOCKED',
      'ASTEROID',
      'OPEN',
      'GATE',
    ])
  })

  it('rotation 120° (2)', () => {
    expect(getRotatedEdges(SAMPLE, 2)).toEqual([
      'GATE',
      'BLOCKED',
      'OPEN',
      'BLOCKED',
      'ASTEROID',
      'OPEN',
    ])
  })

  it('rotation 180° (3)', () => {
    expect(getRotatedEdges(SAMPLE, 3)).toEqual([
      'OPEN',
      'GATE',
      'BLOCKED',
      'OPEN',
      'BLOCKED',
      'ASTEROID',
    ])
  })

  it('rotation 240° (4)', () => {
    expect(getRotatedEdges(SAMPLE, 4)).toEqual([
      'ASTEROID',
      'OPEN',
      'GATE',
      'BLOCKED',
      'OPEN',
      'BLOCKED',
    ])
  })

  it('rotation 300° (5)', () => {
    expect(getRotatedEdges(SAMPLE, 5)).toEqual([
      'BLOCKED',
      'ASTEROID',
      'OPEN',
      'GATE',
      'BLOCKED',
      'OPEN',
    ])
  })

  it('getRotatedEdge matches getRotatedEdges for all 6 rotations', () => {
    for (let rot = 0; rot < 6; rot++) {
      const edges = getRotatedEdges(SAMPLE, rot)
      for (let dir = 0; dir < 6; dir++) {
        expect(getRotatedEdge(SAMPLE, dir, rot)).toBe(edges[dir])
      }
    }
  })

  it('does not mutate the original definition', () => {
    const original = [...SAMPLE.edges]
    getRotatedEdges(SAMPLE, 4)
    expect(SAMPLE.edges).toEqual(original)
  })
})

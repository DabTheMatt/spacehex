import { describe, expect, it } from 'vitest'
import { sawTriangle } from '../renderer/entities/ShipRenderer'

describe('enemy hull silhouette', () => {
  it('is a saw-toothed triangle, not a 3-point diamond', () => {
    const shape = sawTriangle(0.42, 0.12, 4)
    expect(shape.getPoints().length).toBeGreaterThan(6)
  })
})

import { describe, expect, it } from 'vitest'
import { dicePips, EDGE_MARGIN, OVERLAY_HOVER } from '../renderer/board/planetLots'
import { BASE_HOVER } from '../renderer/entities/ShipRenderer'
import { EVA_HUB_SPIN } from '../renderer/board/evaDocks'
import { missileSidePoint, missileWorldPos } from '../renderer/fx/missilePath'
import { SHIP_DEFINITIONS } from '../game/definitions/ships'

describe('dice pips', () => {
  it('uses a six-sided die layout', () => {
    expect(dicePips(0)).toEqual([])
    expect(dicePips(1)).toHaveLength(1)
    expect(dicePips(2)).toHaveLength(2)
    expect(dicePips(3)).toHaveLength(3)
    expect(dicePips(4)).toHaveLength(4)
    expect(dicePips(5)).toHaveLength(5)
    expect(dicePips(6)).toHaveLength(6)
    expect(dicePips(9)).toHaveLength(6)
  })

  it('keeps a shared inset from the hex flat', () => {
    expect(EDGE_MARGIN).toBeGreaterThan(0.05)
    expect(EDGE_MARGIN).toBeLessThan(0.2)
  })

  it('floats names and markets at half ship hover', () => {
    expect(OVERLAY_HOVER).toBeCloseTo(BASE_HOVER * 0.5, 5)
  })
})

describe('eva spin', () => {
  it('turns the hub twice as slow as the previous 0.22/3 rate', () => {
    expect(EVA_HUB_SPIN).toBeCloseTo(0.22 / 6, 8)
  })
})

describe('missiles', () => {
  it('goes sideways then homes in', () => {
    const origin = { x: 0, y: 0.24, z: 0 }
    const side = { x: 0.2, y: 0.26, z: 0 }
    const target = { x: 1, y: 0.24, z: 1 }
    expect(missileWorldPos(origin, side, target, 0)).toEqual(origin)
    expect(missileWorldPos(origin, side, target, 1)).toEqual(side)
    expect(missileWorldPos(origin, side, target, 2)).toEqual(target)
    const midSide = missileWorldPos(origin, side, target, 0.5)
    expect(midSide.x).toBeCloseTo(0.1)
    const midFly = missileWorldPos(origin, side, target, 1.5)
    expect(midFly.x).toBeCloseTo(0.6)
  })

  it('peels to alternating flanks', () => {
    const origin = { x: 0, y: 0.24, z: 0 }
    const a = missileSidePoint(origin, 0, 0)
    const b = missileSidePoint(origin, 0, 1)
    expect(a.x).toBeGreaterThan(0)
    expect(b.x).toBeLessThan(0)
  })

  it('fires as many rockets as the ship attack value', () => {
    expect(SHIP_DEFINITIONS.MEWA.attack).toBe(3)
    expect(SHIP_DEFINITIONS.DRZAZGA.attack).toBe(2)
  })
})

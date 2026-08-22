import { describe, expect, it } from 'vitest'
import {
  clamp01,
  easeInOutCubic,
  easeInOutSmooth,
  easeOutCubic,
  lerp,
  lerpAngle,
  shipEngineBurn,
  shipsTooClose,
  shortestAngleDelta,
  yieldOffSegment,
  SHIP_BRAKE_MS,
  SHIP_CLEARANCE,
  SHIP_MAIN_IGNITE_MS,
  SHIP_RCS_COUNTER_MS,
  SHIP_RCS_KICK_MS,
  SHIP_TURN_MS,
} from '../renderer/motion'
import { TILE_SETTLED_Y, TILE_SLOT_Y, TILE_THICKNESS } from '../renderer/board/TileRenderer'

describe('placement motion', () => {
  it('eases a tile from below the floor up to settled height', () => {
    expect(TILE_SLOT_Y + TILE_THICKNESS).toBe(TILE_SETTLED_Y)
    expect(TILE_SLOT_Y).toBeLessThan(TILE_SETTLED_Y)
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    const mid = lerp(TILE_SLOT_Y, TILE_SETTLED_Y, easeOutCubic(0.5))
    expect(mid).toBeGreaterThan(TILE_SLOT_Y)
    expect(mid).toBeLessThan(TILE_SETTLED_Y)
    expect(lerp(TILE_SLOT_Y, TILE_SETTLED_Y, easeOutCubic(1))).toBe(TILE_SETTLED_Y)
  })

  it('eases in and out so a ship starts still and brakes at the target', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
    expect(easeInOutSmooth(0)).toBe(0)
    expect(easeInOutSmooth(1)).toBe(1)
    expect(easeInOutSmooth(0.25)).toBeLessThan(0.25)
    expect(easeInOutSmooth(0.75)).toBeGreaterThan(0.75)
    expect(clamp01(2)).toBe(1)
  })

  it('turns the short way around the circle', () => {
    expect(lerpAngle(0, Math.PI / 2, 0)).toBeCloseTo(0)
    expect(lerpAngle(0, Math.PI / 2, 1)).toBeCloseTo(Math.PI / 2)
    const mid = lerpAngle(Math.PI * 0.9, -Math.PI * 0.9, 0.5)
    expect(Math.atan2(Math.sin(mid), Math.cos(mid))).toBeCloseTo(Math.PI)
    expect(shortestAngleDelta(0, -Math.PI / 2)).toBeCloseTo(-Math.PI / 2)
  })

  it('fires the opposite RCS to start a left turn, then the near side to stop it', () => {
    const left = -Math.PI / 3
    const kick = shipEngineBurn({
      elapsed: 40,
      turnMs: SHIP_TURN_MS,
      igniteMs: SHIP_MAIN_IGNITE_MS,
      moveMs: 900,
      yawDelta: left,
    })
    expect(kick.starboard).toBe(1)
    expect(kick.port).toBe(0)
    expect(kick.main).toBe(0)

    const counter = shipEngineBurn({
      elapsed: SHIP_TURN_MS - 20,
      turnMs: SHIP_TURN_MS,
      igniteMs: SHIP_MAIN_IGNITE_MS,
      moveMs: 900,
      yawDelta: left,
    })
    expect(counter.port).toBe(1)
    expect(counter.starboard).toBe(0)
    const rightKick = shipEngineBurn({
      elapsed: 40,
      turnMs: SHIP_TURN_MS,
      igniteMs: SHIP_MAIN_IGNITE_MS,
      moveMs: 900,
      yawDelta: Math.PI / 3,
    })
    expect(rightKick.port).toBe(1)
    expect(rightKick.starboard).toBe(0)
  })

  it('holds with the main engine for a second before the ship translates', () => {
    const burn = shipEngineBurn({
      elapsed: SHIP_TURN_MS + 200,
      turnMs: SHIP_TURN_MS,
      igniteMs: SHIP_MAIN_IGNITE_MS,
      moveMs: 900,
      yawDelta: -0.8,
    })
    expect(burn.main).toBeGreaterThan(0.5)
    expect(burn.port).toBe(0)
    expect(SHIP_MAIN_IGNITE_MS).toBe(1000)
    expect(SHIP_RCS_KICK_MS).toBeGreaterThan(0)
    expect(SHIP_RCS_COUNTER_MS).toBeGreaterThan(0)
    expect(SHIP_BRAKE_MS).toBeGreaterThan(0)
  })

  it('brakes with both side thrusters at the end of the burn', () => {
    const burn = shipEngineBurn({
      elapsed: SHIP_TURN_MS + SHIP_MAIN_IGNITE_MS + 900 - 40,
      turnMs: SHIP_TURN_MS,
      igniteMs: SHIP_MAIN_IGNITE_MS,
      moveMs: 900,
      yawDelta: 0.8,
    })
    expect(burn.port).toBe(0)
    expect(burn.brakePort).toBeGreaterThan(0.5)
    expect(burn.brakeStarboard).toBeGreaterThan(0.5)
    expect(burn.main).toBeLessThan(0.5)
  })

  it('keeps the same ignite and brake clock when the ship is already aligned', () => {
    const early = shipEngineBurn({
      elapsed: 200,
      turnMs: SHIP_TURN_MS,
      igniteMs: SHIP_MAIN_IGNITE_MS,
      moveMs: 900,
      yawDelta: 0,
    })
    expect(early.main).toBe(0)
    expect(early.brakePort).toBe(0)

    const brakes = shipEngineBurn({
      elapsed: SHIP_TURN_MS + SHIP_MAIN_IGNITE_MS + 900 - 40,
      turnMs: SHIP_TURN_MS,
      igniteMs: SHIP_MAIN_IGNITE_MS,
      moveMs: 900,
      yawDelta: 0,
    })
    expect(brakes.brakePort).toBeGreaterThan(0.5)
    expect(brakes.brakeStarboard).toBeGreaterThan(0.5)
  })
})

describe('ship clearance', () => {
  it('keeps hulls from overlapping at the clearance radius', () => {
    expect(shipsTooClose(0, 0, 0.1, 0)).toBe(true)
    expect(shipsTooClose(0, 0, 1, 0)).toBe(false)
    expect(shipsTooClose(0, 0, SHIP_CLEARANCE, 0)).toBe(false)
    expect(shipsTooClose(0, 0, SHIP_CLEARANCE * 0.5, 0)).toBe(true)
  })

  it('slides a parked hull off the flight segment', () => {
    const moved = yieldOffSegment(0, 0, -1, 0, 1, 0)
    expect(Math.abs(moved.z)).toBeGreaterThan(SHIP_CLEARANCE)
    expect(moved.x).toBeCloseTo(0)
  })
})

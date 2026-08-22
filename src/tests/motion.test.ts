import { describe, expect, it } from 'vitest'
import {
  clamp01,
  easeInOutCubic,
  easeOutCubic,
  lerp,
  lerpAngle,
  shipEngineBurn,
  shortestAngleDelta,
  SHIP_BRAKE_MS,
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
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25)
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75)
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
    expect(burn.port).toBeGreaterThan(0.5)
    expect(burn.starboard).toBeGreaterThan(0.5)
    expect(burn.main).toBeLessThan(0.5)
  })
})

import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { getNeighbor } from '../game/board/hexMath'
import { coordKey } from '../game/board/HexCoord'
import { STARTING_PROBES } from '../game/definitions/constants'
import { formatLogLine } from '../ui/eventLog'

describe('probes', () => {
  it('starts each ship with two probes', () => {
    const state = createInitialState('probe-start')
    expect(state.ships['mewa-1'].probes).toBe(STARTING_PROBES)
    expect(state.ships['mewa-2'].probes).toBe(STARTING_PROBES)
    expect(state.probes).toEqual({})
  })

  it('launches onto an empty neighbor instead of moving', () => {
    let state = createInitialState('probe-launch')
    const target = getNeighbor({ q: 0, r: 0 }, 1)
    const result = applyCommand(state, { type: 'LAUNCH_PROBE', direction: 1 })
    state = result.state
    expect(result.events.some((e) => e.type === 'PROBE_LAUNCHED')).toBe(true)
    expect(state.ships['mewa-1'].probes).toBe(STARTING_PROBES - 1)
    expect(state.movementSpent).toBe(true)
    expect(state.ships['mewa-1'].coord).toEqual({ q: 0, r: 0 })
    expect(state.probes[coordKey(target)]?.ownerShipId).toBe('mewa-1')
    const again = applyCommand(state, { type: 'LAUNCH_PROBE', direction: 2 })
    expect(again.events.some((e) => e.type === 'COMMAND_REJECTED')).toBe(true)
  })

  it('dismisses the probe when a ship enters the hex', () => {
    let state = createInitialState('probe-land')
    state = applyCommand(state, { type: 'LAUNCH_PROBE', direction: 0 }).state
    state = applyCommand(state, { type: 'END_TURN' }).state
    state = applyCommand(state, { type: 'SKIP_MOVEMENT' }).state
    state = applyCommand(state, { type: 'END_TURN' }).state
    const target = getNeighbor({ q: 0, r: 0 }, 0)
    expect(state.probes[coordKey(target)]).toBeTruthy()
    state = applyCommand(state, { type: 'START_EXPLORATION', direction: 0 }).state
    const placed = applyCommand(state, { type: 'CONFIRM_TILE_PLACEMENT' })
    state = placed.state
    expect(state.ships['mewa-1'].coord).toEqual(target)
    expect(state.probes[coordKey(target)]).toBeUndefined()
    expect(placed.events.some((e) => e.type === 'PROBE_DISMISSED')).toBe(true)
  })
})

describe('event log copy', () => {
  it('phrases probe launch and damage for the HUD', () => {
    const state = createInitialState('log-copy')
    expect(
      formatLogLine(state, {
        type: 'PROBE_LAUNCHED',
        playerId: 'player-1',
        shipId: 'mewa-1',
        coord: { q: 1, r: 0 },
      }),
    ).toBe('Player 1 launched a probe.')
    expect(
      formatLogLine(state, { type: 'SHIP_DAMAGED', shipId: 'mewa-2', damage: 2, hullAfter: 1 }),
    ).toBe('SG-2 took 2 damage.')
  })
})

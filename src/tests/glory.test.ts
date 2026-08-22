import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { canDeclareAttack, planDuelShots } from '../game/rules/combat'
import { discoveryGlory, GLORY_DAMAGE, GLORY_DESTROY } from '../game/rules/glory'
import { COMBAT_DAMAGE, MAX_ATTACKS_PER_TURN } from '../game/definitions/constants'

describe('glory', () => {
  it('awards 1 for void, 2 for other features, and 3 plus range for planets', () => {
    expect(discoveryGlory('VOID', { q: 1, r: 0 })).toBe(1)
    expect(discoveryGlory('ASTEROID', { q: 1, r: 0 })).toBe(2)
    expect(discoveryGlory('PLANET_SMALL', { q: 1, r: 0 })).toBe(4)
    expect(discoveryGlory('PLANET_LARGE', { q: 2, r: 0 })).toBe(5)
  })

  it('grants glory when a tile is discovered', () => {
    let state = createInitialState('glory-void')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    expect(state.players['player-1'].glory).toBe(1)

    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-small-1',
      coord: { q: 2, r: 0 },
      rotation: 0,
    }).state
    expect(state.players['player-1'].glory).toBe(1 + 5)
  })
})

describe('declared combat', () => {
  it('does not fight on hex entry', () => {
    let state = createInitialState('glory-fight')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    state = {
      ...state,
      ships: {
        ...state.ships,
        'mewa-2': { ...state.ships['mewa-2'], coord: { q: 1, r: 0 } },
      },
    }
    const moved = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } })
    expect(moved.events.some((event) => event.type === 'COMBAT_STARTED')).toBe(false)
    expect(moved.state.ships['mewa-2'].hull).toBe(3)
  })

  it('grants glory for dealing damage and destroying a Mewa after a declared attack', () => {
    let state = createInitialState('glory-fight')
    state = applyCommand(state, { type: 'DEV_DAMAGE_SHIP', shipId: 'mewa-2', amount: 2 }).state
    expect(state.ships['mewa-2'].hull).toBe(1)
    const fight = applyCommand(state, { type: 'DECLARE_ATTACK', defenderId: 'mewa-2' })
    expect(fight.events.some((event) => event.type === 'COMBAT_STARTED')).toBe(true)
    expect(fight.events.some((event) => event.type === 'COMBAT_SHOT')).toBe(true)
    expect(fight.state.ships['mewa-2'].hull).toBe(0)
    expect(fight.state.players['player-1'].glory).toBe(GLORY_DAMAGE + GLORY_DESTROY.MEWA)
    expect(fight.state.players['player-1'].attacksThisTurn).toBe(1)
    expect(COMBAT_DAMAGE).toBe(1)
    expect(MAX_ATTACKS_PER_TURN).toBe(1)
  })

  it('allows only one declared attack per turn', () => {
    let state = createInitialState('attack-limit')
    state = applyCommand(state, { type: 'DEV_DAMAGE_SHIP', shipId: 'mewa-2', amount: 2 }).state
    state = applyCommand(state, { type: 'DECLARE_ATTACK', defenderId: 'mewa-2' }).state
    expect(state.players['player-1'].attacksThisTurn).toBe(1)
    state = {
      ...state,
      ships: {
        ...state.ships,
        'mewa-2': { ...state.ships['mewa-2'], hull: 3 },
      },
    }
    const again = applyCommand(state, { type: 'DECLARE_ATTACK', defenderId: 'mewa-2' })
    expect(again.events.some((event) => event.type === 'COMMAND_REJECTED')).toBe(true)
    expect(canDeclareAttack(again.state, 'mewa-2').ok).toBe(false)
  })

  it('alternates shots until a hull is gone', () => {
    const state = createInitialState('duel-plan')
    const shots = planDuelShots(state.ships['mewa-1'], state.ships['mewa-2'])
    expect(shots[0]?.attackerId).toBe('mewa-1')
    expect(shots[1]?.attackerId).toBe('mewa-2')
    const last = shots[shots.length - 1]
    expect(last?.defenderId).toBe('mewa-2')
    expect(shots.filter((shot) => shot.attackerId === 'mewa-1')).toHaveLength(3)
    expect(shots.filter((shot) => shot.attackerId === 'mewa-2')).toHaveLength(2)
  })
})

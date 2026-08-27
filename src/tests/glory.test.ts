import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { canDeclareAttack, combatAbility, planContestShot, rollCombatDice } from '../game/rules/combat'
import { discoveryGlory, GLORY_DAMAGE, GLORY_DESTROY } from '../game/rules/glory'
import { COMBAT_DAMAGE, MAX_ATTACKS_PER_TURN } from '../game/definitions/constants'

describe('glory', () => {
  it('awards 1 for void, 2 for other features, and 3 plus range for planets', () => {
    expect(discoveryGlory('VOID', { q: 1, r: 0 })).toBe(1)
    expect(discoveryGlory('ASTEROID', { q: 1, r: 0 })).toBe(2)
    expect(discoveryGlory('VORTEX', { q: 1, r: 0 })).toBe(2)
    expect(discoveryGlory('SPACE_GATE', { q: 1, r: 0 })).toBe(2)
    expect(discoveryGlory('STRAIT', { q: 1, r: 0 })).toBe(2)
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
    const dice = rollCombatDice(state, 'mewa-1', 'mewa-2')
    const shot = planContestShot(state.ships['mewa-1'], state.ships['mewa-2'], dice)
    const fight = applyCommand(state, { type: 'DECLARE_ATTACK', defenderId: 'mewa-2' })
    expect(fight.events.some((event) => event.type === 'COMBAT_STARTED')).toBe(true)
    expect(fight.events.some((event) => event.type === 'COMBAT_ROLL')).toBe(true)
    if (shot?.defenderId === 'mewa-2') {
      expect(fight.state.ships['mewa-2'].hull).toBe(0)
      expect(fight.state.players['player-1'].glory).toBe(GLORY_DAMAGE + GLORY_DESTROY.MEWA)
    } else if (shot?.defenderId === 'mewa-1') {
      expect(fight.state.ships['mewa-1'].hull).toBe(2)
      expect(fight.state.ships['mewa-2'].hull).toBe(1)
      expect(fight.state.players['player-1'].glory).toBe(0)
    } else {
      expect(fight.state.ships['mewa-2'].hull).toBe(1)
      expect(fight.state.players['player-1'].glory).toBe(0)
    }
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

  it('resolves one contest (ability + d6) and lets the next player attack on their turn', () => {
    const state = createInitialState('duel-plan')
    expect(combatAbility('MEWA')).toBe(3)
    const dice = rollCombatDice(state, 'mewa-1', 'mewa-2')
    const shot = planContestShot(state.ships['mewa-1'], state.ships['mewa-2'], dice)
    if (shot) expect(shot.damage).toBe(1)

    let next = applyCommand(state, { type: 'DECLARE_ATTACK', defenderId: 'mewa-2' }).state
    const aHull = next.ships['mewa-1'].hull
    const bHull = next.ships['mewa-2'].hull
    expect(aHull + bHull).toBe(shot ? 5 : 6)
    if (shot?.defenderId === 'mewa-2') {
      expect(bHull).toBe(2)
      expect(aHull).toBe(3)
    } else if (shot?.defenderId === 'mewa-1') {
      expect(aHull).toBe(2)
      expect(bHull).toBe(3)
    }
    next = applyCommand(next, { type: 'END_TURN' }).state
    expect(next.activePlayerId).toBe('player-2')
    expect(canDeclareAttack(next, 'mewa-1').ok).toBe(true)
  })
})

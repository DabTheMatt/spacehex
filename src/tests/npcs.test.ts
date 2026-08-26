import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { canDeclareAttack, hostileOnHex } from '../game/rules/combat'
import { GLORY_DAMAGE, GLORY_DESTROY } from '../game/rules/glory'
import { SHIP_DEFINITIONS } from '../game/definitions/ships'
import { getNeighbor } from '../game/board/hexMath'
import { coordKey } from '../game/board/HexCoord'
import { formatLogLine, shipCallsign } from '../ui/eventLog'

const SHADOW = 'shadow-base-1'
const VOID = 'void-1'

function placeShadow(seed = 'thorn-place') {
  let state = createInitialState(seed)
  const coord = { q: 1, r: 0 }
  const result = applyCommand(state, {
    type: 'DEV_PLACE_TILE',
    tileId: SHADOW,
    coord,
    rotation: 0,
  })
  return { ...result, coord }
}

describe('Thorn spawn', () => {
  it('appears on Shadow Base when that tile is placed', () => {
    const { state, events, coord } = placeShadow()
    const id = `ciern-${coordKey(coord)}`
    const npc = state.npcShips[id]
    expect(npc).toBeTruthy()
    expect(npc.class).toBe('CIERN')
    expect(npc.hull).toBe(SHIP_DEFINITIONS.CIERN.hull)
    expect(npc.maxHull).toBe(SHIP_DEFINITIONS.CIERN.hull)
    expect(npc.coord).toEqual(coord)
    expect(events.some((e) => e.type === 'NPC_SPAWNED' && e.shipId === id && e.class === 'CIERN')).toBe(
      true,
    )
    expect(Object.keys(state.npcShips)).toHaveLength(1)
  })

  it('does not spawn on void', () => {
    let state = createInitialState('thorn-void')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: VOID,
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    expect(state.npcShips).toEqual({})
  })

  it('does not spawn at game start', () => {
    const state = createInitialState('thorn-start')
    expect(state.npcShips).toEqual({})
  })

  it('spawns when a probe lays Shadow Base', () => {
    let state = createInitialState('thorn-probe')
    state = applyCommand(state, { type: 'DEV_FORCE_NEXT_TILE', tileId: SHADOW }).state
    const dest = getNeighbor({ q: 0, r: 0 }, 0)
    const result = applyCommand(state, { type: 'LAUNCH_PROBE', direction: 0 })
    state = result.state
    expect(result.events.some((e) => e.type === 'NPC_SPAWNED')).toBe(true)
    expect(state.npcShips[`ciern-${coordKey(dest)}`]?.coord).toEqual(dest)
    expect(state.ships['mewa-1'].coord).toEqual({ q: 0, r: 0 })
  })

  it('lands the explorer on the Thorn after placing Shadow Base', () => {
    let state = createInitialState('thorn-explore')
    state = applyCommand(state, { type: 'DEV_FORCE_NEXT_TILE', tileId: SHADOW }).state
    state = applyCommand(state, { type: 'START_EXPLORATION', direction: 0 }).state
    const dest = getNeighbor({ q: 0, r: 0 }, 0)
    const placed = applyCommand(state, { type: 'CONFIRM_TILE_PLACEMENT' })
    state = placed.state
    expect(placed.events.some((e) => e.type === 'NPC_SPAWNED')).toBe(true)
    expect(state.ships['mewa-1'].coord).toEqual(dest)
    expect(state.npcShips[`ciern-${coordKey(dest)}`]?.coord).toEqual(dest)
    expect(hostileOnHex(state, `ciern-${coordKey(dest)}`)).toBe(true)
  })
})

describe('Thorn combat', () => {
  it('does not fight on hex entry', () => {
    const { state, coord } = placeShadow('thorn-entry')
    const id = `ciern-${coordKey(coord)}`
    const moved = applyCommand(state, { type: 'DECLARE_MOVE', target: coord })
    expect(moved.events.some((e) => e.type === 'COMBAT_STARTED')).toBe(false)
    expect(moved.state.npcShips[id].hull).toBe(3)
  })

  it('grants glory for damaging and destroying a Thorn', () => {
    let { state, coord } = placeShadow('thorn-kill')
    const id = `ciern-${coordKey(coord)}`
    state = applyCommand(state, { type: 'DECLARE_MOVE', target: coord }).state
    state = applyCommand(state, { type: 'DEV_DAMAGE_SHIP', shipId: id, amount: 2 }).state
    expect(state.npcShips[id].hull).toBe(1)
    const gloryBefore = state.players['player-1'].glory
    const fight = applyCommand(state, { type: 'DECLARE_ATTACK', defenderId: id })
    expect(fight.events.some((e) => e.type === 'COMBAT_STARTED')).toBe(true)
    expect(fight.state.npcShips[id].hull).toBe(0)
    expect(fight.state.players['player-1'].glory).toBe(
      gloryBefore + GLORY_DAMAGE + GLORY_DESTROY.CIERN,
    )
    expect(fight.state.players['player-1'].attacksThisTurn).toBe(1)
    expect(canDeclareAttack(fight.state, id).ok).toBe(false)
  })

  it('lets the Thorn return fire without awarding it glory', () => {
    let { state, coord } = placeShadow('thorn-duel')
    const id = `ciern-${coordKey(coord)}`
    state = applyCommand(state, { type: 'DECLARE_MOVE', target: coord }).state
    const gloryBefore = state.players['player-1'].glory
    const fight = applyCommand(state, { type: 'DECLARE_ATTACK', defenderId: id })
    expect(fight.state.ships['mewa-1'].hull).toBe(2)
    expect(fight.state.npcShips[id].hull).toBe(2)
    expect(fight.state.players['player-1'].glory).toBe(gloryBefore + GLORY_DAMAGE)
    const npcGlory = fight.events.filter(
      (e) => e.type === 'GLORY_CHANGED' && e.playerId !== 'player-1',
    )
    expect(npcGlory).toHaveLength(0)
  })
})

describe('Thorn log copy', () => {
  it('names the hull THORN', () => {
    const { state, coord } = placeShadow('thorn-log')
    const id = `ciern-${coordKey(coord)}`
    expect(shipCallsign(state, id)).toBe('THORN')
    expect(
      formatLogLine(state, {
        type: 'NPC_SPAWNED',
        shipId: id,
        class: 'CIERN',
        coord,
      }),
    ).toBe('A Thorn appeared.')
  })
})

import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { combatAbility, combatStrength, planContestShot } from '../game/rules/combat'
import { STARTING_FUEL } from '../game/definitions/constants'
import { stayFuelCost } from '../game/rules/fuel'
import { npcStepByFace } from '../game/rules/npcs'
import { faceOnWorldEdge } from '../game/board/edgeNumbers'
import { coordKey } from '../game/board/HexCoord'
import { TILE_DEFINITIONS } from '../game/definitions/tiles'
import { createTileGlyph } from '../renderer/board/tileGlyphs'

describe('combat contest', () => {
  it('uses ship combat ability plus a d6, and only the loser takes 1 damage', () => {
    expect(combatAbility('MEWA')).toBe(3)
    expect(combatAbility('CIERN')).toBe(3)
    expect(combatAbility('DRZAZGA')).toBe(2)
    expect(combatStrength(3, 4)).toBe(7)
    const a = { id: 'a', class: 'MEWA' as const, coord: { q: 0, r: 0 }, hull: 3, playerId: 'p1' }
    const b = { id: 'b', class: 'CIERN' as const, coord: { q: 0, r: 0 }, hull: 3 }
    expect(planContestShot(a, b, { attackerDie: 6, defenderDie: 1 })?.defenderId).toBe('b')
    expect(planContestShot(a, b, { attackerDie: 1, defenderDie: 6 })?.defenderId).toBe('a')
    expect(planContestShot(a, b, { attackerDie: 3, defenderDie: 3 })).toBeNull()
  })
})

describe('stay fuel', () => {
  it('does not spend a cell on EVA, and spends one on a void hex', () => {
    const eva = createInitialState('stay-eva')
    expect(stayFuelCost(eva)).toBe(0)
    const skipped = applyCommand(eva, { type: 'SKIP_MOVEMENT' })
    expect(skipped.state.players['player-1'].fuel).toBe(STARTING_FUEL)
    expect(skipped.events.some((e) => e.type === 'FUEL_CHANGED')).toBe(false)

    let voided = createInitialState('stay-void')
    voided = applyCommand(voided, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    voided = applyCommand(voided, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } }).state
    voided = applyCommand(voided, { type: 'END_TURN' }).state
    voided = applyCommand(voided, { type: 'SKIP_MOVEMENT' }).state
    voided = applyCommand(voided, { type: 'END_TURN' }).state
    expect(stayFuelCost(voided)).toBe(1)
    const stay = applyCommand(voided, { type: 'SKIP_MOVEMENT' })
    expect(stay.state.players['player-1'].fuel).toBe(STARTING_FUEL - 1 - 1)
    expect(stay.events.some((e) => e.type === 'FUEL_CHANGED')).toBe(true)
  })
})

describe('NPC face movement', () => {
  it('steps the numbered face when that neighbor is placed', () => {
    let state = createInitialState('npc-face')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'shadow-base-1',
      coord: { q: 2, r: 0 },
      rotation: 0,
    }).state
    const id = `ciern-${coordKey({ q: 2, r: 0 })}`
    const npc = state.npcShips[id]
    expect(npc?.coord).toEqual({ q: 2, r: 0 })
    const tile = state.board.tiles[coordKey({ q: 2, r: 0 })]
    const faceWest = faceOnWorldEdge(tile.edgeNumbers, tile.rotation, 3)
    expect(npcStepByFace(state, npc, faceWest)).toEqual({ q: 1, r: 0 })
    state = applyCommand(state, { type: 'SKIP_MOVEMENT' }).state
    const ended = applyCommand(state, { type: 'END_TURN' })
    const rolled = ended.events.find((e) => e.type === 'NPC_FACE_ROLLED' && e.shipId === id)
    expect(rolled).toMatchObject({ type: 'NPC_FACE_ROLLED', shipId: id })
    if (rolled && rolled.type === 'NPC_FACE_ROLLED') {
      expect(rolled.face).toBeGreaterThanOrEqual(1)
      expect(rolled.face).toBeLessThanOrEqual(6)
    }
  })
})

describe('fuel cell marks', () => {
  it('marks EVA, planets, and the tanker, but not void', () => {
    const marked = ['eva-1', 'planet-small-1', 'wreck-tanker-1']
    for (const id of marked) {
      const glyph = createTileGlyph(TILE_DEFINITIONS[id])
      let cells = 0
      glyph.traverse((obj) => {
        if (obj.userData.fuelCell) cells += 1
      })
      expect(cells).toBe(1)
    }
    const voidGlyph = createTileGlyph(TILE_DEFINITIONS['void-1'])
    let cells = 0
    voidGlyph.traverse((obj) => {
      if (obj.userData.fuelCell) cells += 1
    })
    expect(cells).toBe(0)
  })
})

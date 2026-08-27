import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { EXPLORATION_TILE_IDS } from '../game/definitions/tiles'
import { getNeighbor } from '../game/board/hexMath'
import { coordKey } from '../game/board/HexCoord'
import { RNG } from '../game/random/RNG'

describe('RNG', () => {
  it('is deterministic for a seed', () => {
    const a = new RNG('abc').shuffle([1, 2, 3, 4, 5, 6])
    const b = new RNG('abc').shuffle([1, 2, 3, 4, 5, 6])
    expect(a).toEqual(b)
  })

  it('differs across seeds', () => {
    const a = new RNG('abc').shuffle([1, 2, 3, 4, 5, 6, 7, 8])
    const b = new RNG('xyz').shuffle([1, 2, 3, 4, 5, 6, 7, 8])
    expect(a).not.toEqual(b)
  })
})

describe('exploration engine', () => {
  it('starts with only EVA-1 and a shuffled exploration deck', () => {
    const state = createInitialState('seed-1')
    expect(Object.keys(state.board.tiles)).toEqual(['0,0'])
    expect(state.board.tiles['0,0'].definitionId).toBe('eva-1')
    expect(state.explorationDeck.drawPile).toHaveLength(EXPLORATION_TILE_IDS.length)
    expect(state.explorationDeck.drawPile).toHaveLength(EXPLORATION_TILE_IDS.length)
    const other = createInitialState('seed-2')
    expect(state.explorationDeck.drawPile).not.toEqual(other.explorationDeck.drawPile)
  })

  it('is JSON serializable', () => {
    const state = createInitialState('json')
    const roundTrip = JSON.parse(JSON.stringify(state))
    expect(roundTrip.board.tiles['0,0'].coord).toEqual({ q: 0, r: 0 })
  })

  it('BEGIN_EXPLORATION then START_EXPLORATION draws the pending tile', () => {
    let state = createInitialState('ghost-click')
    const top = state.explorationDeck.drawPile[0]
    state = applyCommand(state, { type: 'BEGIN_EXPLORATION' }).state
    expect(state.exploration.status).toBe('SELECTING_DIRECTION')
    const started = applyCommand(state, { type: 'START_EXPLORATION', direction: 2 })
    state = started.state
    expect(started.events.some((e) => e.type === 'TILE_DRAWN' && e.tileId === top)).toBe(true)
    expect(state.phase).toBe('TILE_PLACEMENT')
    expect(state.exploration.pendingTileId).toBe(top)
    expect(state.exploration.target).toEqual(getNeighbor({ q: 0, r: 0 }, 2))
  })

  it('draws, rotates six times, places, and moves the ship', () => {
    let state = createInitialState('explore')
    const top = state.explorationDeck.drawPile[0]
    const started = applyCommand(state, { type: 'START_EXPLORATION', direction: 0 })
    state = started.state
    expect(started.events.some((e) => e.type === 'TILE_DRAWN' && e.tileId === top)).toBe(true)
    expect(state.phase).toBe('TILE_PLACEMENT')
    expect(state.exploration.target).toEqual(getNeighbor({ q: 0, r: 0 }, 0))
    expect(state.explorationDeck.drawPile).toHaveLength(EXPLORATION_TILE_IDS.length - 1)

    const rotations = new Set<number>()
    for (let i = 0; i < 6; i++) {
      const r = applyCommand(state, { type: 'ROTATE_PENDING_TILE', direction: 'RIGHT' })
      state = r.state
      rotations.add(state.exploration.rotation ?? -1)
    }
    expect(rotations.size).toBe(6)

    const confirmed = applyCommand(state, { type: 'CONFIRM_TILE_PLACEMENT' })
    state = confirmed.state
    const key = coordKey(getNeighbor({ q: 0, r: 0 }, 0))
    expect(state.board.tiles[key].definitionId).toBe(top)
    expect(state.ships['mewa-1'].coord).toEqual(getNeighbor({ q: 0, r: 0 }, 0))
    expect(state.phase).toBe('PLAYER_TURN')
    expect(state.activePlayerId).toBe('player-1')
    expect(state.movementSpent).toBe(true)
    expect(confirmed.events.some((e) => e.type === 'TURN_ENDED')).toBe(false)
    expect(Object.keys(state.board.tiles)).toHaveLength(2)
    expect(confirmed.events.some((e) => e.type === 'GLORY_CHANGED')).toBe(true)
    expect(state.players['player-1'].glory).toBeGreaterThan(0)

    const ended = applyCommand(state, { type: 'END_TURN' })
    expect(ended.state.activePlayerId).toBe('player-2')
    expect(ended.events.some((e) => e.type === 'TURN_ENDED')).toBe(true)
  })

  it('moves onto a discovered hex without ending the turn', () => {
    let state = createInitialState('move-turn')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    const moved = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } })
    expect(moved.state.ships['mewa-1'].coord).toEqual({ q: 1, r: 0 })
    expect(moved.state.activePlayerId).toBe('player-1')
    expect(moved.state.movementSpent).toBe(true)
    expect(moved.events.some((e) => e.type === 'SHIP_MOVED')).toBe(true)
    expect(moved.events.some((e) => e.type === 'TURN_ENDED')).toBe(false)
    const ended = applyCommand(moved.state, { type: 'END_TURN' })
    expect(ended.state.activePlayerId).toBe('player-2')
  })

  it('does not allow placing on an occupied hex via move-as-explore', () => {
    let state = createInitialState('blocked')
    state = applyCommand(state, { type: 'START_EXPLORATION', direction: 0 }).state
    state = applyCommand(state, { type: 'CONFIRM_TILE_PLACEMENT' }).state
    const result = applyCommand(state, { type: 'START_EXPLORATION', direction: 0 })
    expect(result.events.some((e) => e.type === 'COMMAND_REJECTED')).toBe(true)
  })

  it('lets player 2 explore a free neighbor after player 1 has moved', () => {
    let state = createInitialState('p2-explore')
    state = applyCommand(state, { type: 'START_EXPLORATION', direction: 0 }).state
    state = applyCommand(state, { type: 'CONFIRM_TILE_PLACEMENT' }).state
    state = applyCommand(state, { type: 'END_TURN' }).state
    expect(state.activePlayerId).toBe('player-2')
    expect(state.ships['mewa-2'].coord).toEqual({ q: 0, r: 0 })
    const started = applyCommand(state, { type: 'START_EXPLORATION', direction: 2 })
    expect(started.events.some((e) => e.type === 'COMMAND_REJECTED')).toBe(false)
    expect(started.state.phase).toBe('TILE_PLACEMENT')
    expect(started.state.exploration.origin).toEqual({ q: 0, r: 0 })
    const placed = applyCommand(started.state, { type: 'CONFIRM_TILE_PLACEMENT' })
    expect(placed.state.ships['mewa-2'].coord).toEqual(getNeighbor({ q: 0, r: 0 }, 2))
    expect(placed.state.activePlayerId).toBe('player-2')
    expect(placed.state.movementSpent).toBe(true)
  })
})

describe('edge numbers', () => {
  it('assigns a permutation of 1–6 when a tile is placed', () => {
    const eva = createInitialState('edges-eva').board.tiles['0,0'].edgeNumbers
    expect([...eva].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])
    let state = createInitialState('edges-place')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    const numbers = state.board.tiles['1,0'].edgeNumbers
    expect([...numbers].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])
    expect(new Set(numbers).size).toBe(6)
  })
})

describe('straits and vortex', () => {
  it('blocks travel through a closed strait edge', () => {
    let state = createInitialState('strait-block')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'strait-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 1, r: 1 },
      rotation: 0,
    }).state
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-2',
      coord: { q: 2, r: 0 },
      rotation: 0,
    }).state
    state = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } }).state
    const blocked = applyCommand(state, { type: 'END_TURN' }).state
    const p2 = applyCommand(blocked, { type: 'SKIP_MOVEMENT' }).state
    const p1 = applyCommand(p2, { type: 'END_TURN' }).state
    const closed = applyCommand(p1, { type: 'DECLARE_MOVE', target: { q: 1, r: 1 } })
    expect(closed.events.some((e) => e.type === 'COMMAND_REJECTED')).toBe(true)
    const open = applyCommand(p1, { type: 'DECLARE_MOVE', target: { q: 2, r: 0 } })
    expect(open.events.some((e) => e.type === 'SHIP_MOVED')).toBe(true)
  })

  it('sweeps a ship on vortex entry', () => {
    let state = createInitialState('vortex-in')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'vortex-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 2, r: 0 },
      rotation: 0,
    }).state
    const moved = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } })
    expect(moved.events.some((e) => e.type === 'VORTEX_ROLL')).toBe(true)
  })
})

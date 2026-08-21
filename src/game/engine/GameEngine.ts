import type { GameCommand } from './commands'
import type { GameEvent } from './events'
import type { GameState } from '../state/GameState'
import { GAME_STATE_VERSION, PLAYER_IDS, STARTING_FUEL } from '../definitions/constants'
import { EXPLORATION_TILE_IDS, EVA_TILE_ID, getTileDefinition } from '../definitions/tiles'
import { SHIP_DEFINITIONS } from '../definitions/ships'
import { RNG } from '../random/RNG'
import { emptyBoard, getPlacedTile, isTilePlaced, validateTilePlacement } from '../board/HexMap'
import { coordKey } from '../board/HexCoord'
import { getNeighbor } from '../board/hexMath'
import { wrapRotation } from '../board/tileRotation'
import { drawFromDeck, forceNextTile } from '../board/TileDeck'
import { FUEL_COST_EXPLORE, FUEL_COST_MOVE, FUEL_COST_SKIP } from '../definitions/constants'
import { activePlayer, activeShip, spendFuel } from '../rules/fuel'
import { canMoveTo } from '../rules/movement'
import { canExploreDirection } from '../rules/exploration'
import { resolveCombatOnEntry } from '../rules/combat'
import { resolveSector } from '../rules/glory'
import type { HexCoord } from '../board/HexCoord'
import type { PlacedTile } from '../board/Tile'

export interface EngineResult {
  state: GameState
  events: GameEvent[]
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

export function createInitialState(seed: string): GameState {
  const rng = new RNG(seed)
  const drawPile = rng.shuffle(EXPLORATION_TILE_IDS)
  const eva: PlacedTile = {
    id: EVA_TILE_ID,
    definitionId: EVA_TILE_ID,
    coord: { q: 0, r: 0 },
    rotation: 0,
    discoveredByPlayerId: null,
    discoveredRound: 0,
  }

  const players: GameState['players'] = {
    'player-1': {
      id: 'player-1',
      name: 'Gracz 1',
      shipId: 'mewa-1',
      fuel: STARTING_FUEL,
      glory: 0,
    },
    'player-2': {
      id: 'player-2',
      name: 'Gracz 2',
      shipId: 'mewa-2',
      fuel: STARTING_FUEL,
      glory: 0,
    },
  }

  const mewa = SHIP_DEFINITIONS.MEWA
  const ships: GameState['ships'] = {
    'mewa-1': {
      id: 'mewa-1',
      playerId: 'player-1',
      class: 'MEWA',
      coord: { q: 0, r: 0 },
      hull: mewa.hull,
      maxHull: mewa.hull,
    },
    'mewa-2': {
      id: 'mewa-2',
      playerId: 'player-2',
      class: 'MEWA',
      coord: { q: 0, r: 0 },
      hull: mewa.hull,
      maxHull: mewa.hull,
    },
  }

  return {
    version: GAME_STATE_VERSION,
    seed,
    round: 1,
    activePlayerId: PLAYER_IDS[0],
    phase: 'PLAYER_TURN',
    board: { tiles: { [coordKey(eva.coord)]: eva } },
    explorationDeck: { drawPile, discardedTiles: [] },
    exploration: { status: 'NONE' },
    players,
    ships,
    npcShips: {},
    log: [{ type: 'GAME_STARTED', seed }, { type: 'ROUND_STARTED', round: 1 }],
    movementSpent: false,
  }
}

function reject(state: GameState, command: string, reason: string): EngineResult {
  const event: GameEvent = { type: 'COMMAND_REJECTED', command, reason }
  return { state: { ...state, log: [...state.log, event] }, events: [event] }
}

function append(state: GameState, events: GameEvent[]): GameState {
  return { ...state, log: [...state.log, ...events] }
}

function requireTurn(state: GameState): boolean {
  return state.phase === 'PLAYER_TURN'
}

export function applyCommand(state: GameState, command: GameCommand): EngineResult {
  switch (command.type) {
    case 'START_GAME':
    case 'DEV_RESET': {
      const next = createInitialState(command.seed)
      return { state: next, events: next.log }
    }
    case 'BEGIN_MOVE':
      return beginMove(state)
    case 'BEGIN_EXPLORATION':
      return beginExploration(state)
    case 'CANCEL_SELECTION':
      return cancelSelection(state)
    case 'DECLARE_MOVE':
      return declareMove(state, command.target)
    case 'START_EXPLORATION':
      return startExploration(state, command.direction)
    case 'ROTATE_PENDING_TILE':
      return rotatePending(state, command.direction)
    case 'CONFIRM_TILE_PLACEMENT':
      return confirmPlacement(state)
    case 'SKIP_MOVEMENT':
      return skipMovement(state)
    case 'END_TURN':
      return endTurn(state)
    case 'DEV_ADD_FUEL':
      return devFuel(state, command.playerId, command.amount)
    case 'DEV_REMOVE_FUEL':
      return devFuel(state, command.playerId, -command.amount)
    case 'DEV_ADD_GLORY': {
      const p = state.players[command.playerId]
      if (!p) return reject(state, command.type, 'NO_PLAYER')
      const next = {
        ...state,
        players: {
          ...state.players,
          [p.id]: { ...p, glory: p.glory + command.amount },
        },
      }
      return { state: next, events: [] }
    }
    case 'DEV_DAMAGE_SHIP': {
      const ship = state.ships[command.shipId]
      if (!ship) return reject(state, command.type, 'NO_SHIP')
      const next = {
        ...state,
        ships: {
          ...state.ships,
          [ship.id]: { ...ship, hull: Math.max(0, ship.hull - command.amount) },
        },
      }
      return { state: next, events: [] }
    }
    case 'DEV_FORCE_NEXT_TILE':
      return {
        state: {
          ...state,
          explorationDeck: forceNextTile(state.explorationDeck, command.tileId),
        },
        events: [],
      }
    case 'DEV_PLACE_TILE':
      return devPlace(state, command.tileId, command.coord, command.rotation)
    case 'DEV_ROTATE_PLACED':
      return devRotate(state, command.coord, command.direction)
    case 'DEV_NEXT_PLAYER':
      return endTurn({ ...state, movementSpent: true, phase: 'PLAYER_TURN', exploration: { status: 'NONE' } })
    default:
      return reject(state, 'UNKNOWN', 'UNKNOWN_COMMAND')
  }
}

function beginMove(state: GameState): EngineResult {
  if (!requireTurn(state) || state.movementSpent) {
    return reject(state, 'BEGIN_MOVE', 'NOT_IN_MOVEMENT')
  }
  const events: GameEvent[] = [{ type: 'MOVE_SELECTION_STARTED' }]
  const next = append(
    {
      ...state,
      exploration: { status: 'SELECTING_MOVE', origin: activeShip(state).coord },
    },
    events,
  )
  return { state: next, events }
}

function beginExploration(state: GameState): EngineResult {
  if (!requireTurn(state) || state.movementSpent) {
    return reject(state, 'BEGIN_EXPLORATION', 'NOT_IN_MOVEMENT')
  }
  const events: GameEvent[] = [{ type: 'EXPLORATION_STARTED' }]
  const next = append(
    {
      ...state,
      exploration: { status: 'SELECTING_DIRECTION', origin: activeShip(state).coord },
    },
    events,
  )
  return { state: next, events }
}

function cancelSelection(state: GameState): EngineResult {
  if (state.phase === 'TILE_PLACEMENT') {
    return reject(state, 'CANCEL_SELECTION', 'MUST_PLACE_TILE')
  }
  const events: GameEvent[] = [{ type: 'SELECTION_CANCELLED' }]
  return { state: append({ ...state, exploration: { status: 'NONE' } }, events), events }
}

function declareMove(state: GameState, target: HexCoord): EngineResult {
  if (!requireTurn(state) || state.movementSpent) {
    return reject(state, 'DECLARE_MOVE', 'NOT_IN_MOVEMENT')
  }
  if (!canMoveTo(state, target)) {
    return reject(state, 'DECLARE_MOVE', 'ILLEGAL_MOVE')
  }
  return moveShip(state, target, FUEL_COST_MOVE)
}

function startExploration(state: GameState, direction: number): EngineResult {
  if (state.phase === 'TILE_PLACEMENT') {
    return reject(state, 'START_EXPLORATION', 'ALREADY_PLACING')
  }
  if (state.movementSpent) {
    return reject(state, 'START_EXPLORATION', 'MOVEMENT_SPENT')
  }
  if (!canExploreDirection(state, direction)) {
    return reject(state, 'START_EXPLORATION', 'ILLEGAL_EXPLORE')
  }
  const origin = activeShip(state).coord
  const target = getNeighbor(origin, direction)
  const drawn = drawFromDeck(state.explorationDeck)
  if (!drawn) {
    return reject(state, 'START_EXPLORATION', 'EMPTY_DECK')
  }
  const events: GameEvent[] = [
    { type: 'EXPLORATION_STARTED' },
    { type: 'TILE_DRAWN', tileId: drawn.tileId },
  ]
  const next: GameState = append(
    {
      ...state,
      phase: 'TILE_PLACEMENT',
      explorationDeck: drawn.deck,
      exploration: {
        status: 'PLACING_TILE',
        origin,
        target,
        pendingTileId: drawn.tileId,
        rotation: 0,
      },
    },
    events,
  )
  return { state: next, events }
}

function rotatePending(state: GameState, direction: 'LEFT' | 'RIGHT'): EngineResult {
  if (state.phase !== 'TILE_PLACEMENT' || !state.exploration.pendingTileId) {
    return reject(state, 'ROTATE_PENDING_TILE', 'NOT_PLACING')
  }
  const delta = direction === 'RIGHT' ? 1 : -1
  const rotation = wrapRotation((state.exploration.rotation ?? 0) + delta)
  const events: GameEvent[] = [{ type: 'TILE_ROTATED', rotation }]
  const next = append(
    {
      ...state,
      exploration: { ...state.exploration, rotation },
    },
    events,
  )
  return { state: next, events }
}

function confirmPlacement(state: GameState): EngineResult {
  const exp = state.exploration
  if (state.phase !== 'TILE_PLACEMENT' || !exp.pendingTileId || !exp.target || !exp.origin) {
    return reject(state, 'CONFIRM_TILE_PLACEMENT', 'NOT_PLACING')
  }
  const definition = getTileDefinition(exp.pendingTileId)
  const rotation = exp.rotation ?? 0
  const validation = validateTilePlacement(
    state.board,
    exp.target,
    exp.origin,
    definition,
    rotation,
    getTileDefinition,
  )
  if (!validation.ok) {
    return reject(state, 'CONFIRM_TILE_PLACEMENT', validation.reason ?? 'INVALID')
  }

  const placed: PlacedTile = {
    id: exp.pendingTileId,
    definitionId: exp.pendingTileId,
    coord: exp.target,
    rotation,
    discoveredByPlayerId: state.activePlayerId,
    discoveredRound: state.round,
  }

  const placeEvents: GameEvent[] = [
    { type: 'TILE_PLACED', tileId: placed.id, coord: placed.coord },
    { type: 'HEX_DISCOVERED', tileId: placed.id },
  ]

  let next: GameState = append(
    {
      ...state,
      board: {
        tiles: {
          ...state.board.tiles,
          [coordKey(exp.target)]: placed,
        },
      },
      phase: 'PLAYER_TURN',
      exploration: { status: 'NONE' },
    },
    placeEvents,
  )

  const moved = moveShip(next, placed.coord, FUEL_COST_EXPLORE)
  next = moved.state
  const sector = resolveSector(next, placed.id)
  next = append(next, [sector])

  return { state: next, events: [...placeEvents, ...moved.events, sector] }
}

function moveShip(state: GameState, target: HexCoord, fuelCost: number): EngineResult {
  const ship = activeShip(state)
  const from = ship.coord
  let next = spendFuel(state, fuelCost)
  next = {
    ...next,
    ships: {
      ...next.ships,
      [ship.id]: { ...ship, coord: target },
    },
    movementSpent: true,
    exploration: { status: 'NONE' },
    phase: 'PLAYER_TURN',
  }
  const moveEvent: GameEvent = { type: 'SHIP_MOVED', shipId: ship.id, from, to: target }
  const fuelEvent: GameEvent = {
    type: 'FUEL_CHANGED',
    playerId: activePlayer(state).id,
    fuel: next.players[activePlayer(state).id].fuel,
  }
  next = append(next, [moveEvent, fuelEvent])
  const combat = resolveCombatOnEntry(next, ship.id, target)
  next = combat.state
  next = append(next, combat.events)
  return { state: next, events: [moveEvent, fuelEvent, ...combat.events] }
}

function skipMovement(state: GameState): EngineResult {
  if (!requireTurn(state) || state.movementSpent) {
    return reject(state, 'SKIP_MOVEMENT', 'NOT_IN_MOVEMENT')
  }
  let next = spendFuel(state, FUEL_COST_SKIP)
  next = {
    ...next,
    movementSpent: true,
    exploration: { status: 'NONE' },
  }
  return endTurn(next)
}

function endTurn(state: GameState): EngineResult {
  if (state.phase === 'TILE_PLACEMENT') {
    return reject(state, 'END_TURN', 'MUST_PLACE_TILE')
  }
  if (!state.movementSpent) {
    return reject(state, 'END_TURN', 'MUST_MOVE_OR_SKIP')
  }
  const currentIndex = PLAYER_IDS.indexOf(state.activePlayerId as (typeof PLAYER_IDS)[number])
  const nextIndex = (currentIndex + 1) % PLAYER_IDS.length
  const nextPlayerId = PLAYER_IDS[nextIndex]
  const newRound = nextIndex === 0 ? state.round + 1 : state.round
  const events: GameEvent[] = [{ type: 'TURN_ENDED', playerId: state.activePlayerId }]
  if (nextIndex === 0) {
    events.push({ type: 'ROUND_STARTED', round: newRound })
  }
  const next = append(
    {
      ...state,
      activePlayerId: nextPlayerId,
      round: newRound,
      movementSpent: false,
      exploration: { status: 'NONE' },
      phase: 'PLAYER_TURN',
    },
    events,
  )
  return { state: next, events }
}

function devFuel(state: GameState, playerId: string, delta: number): EngineResult {
  const p = state.players[playerId]
  if (!p) return reject(state, 'DEV_FUEL', 'NO_PLAYER')
  const fuel = Math.max(0, p.fuel + delta)
  const event: GameEvent = { type: 'FUEL_CHANGED', playerId, fuel }
  const next = append(
    {
      ...state,
      players: { ...state.players, [playerId]: { ...p, fuel } },
    },
    [event],
  )
  return { state: next, events: [event] }
}

function devPlace(
  state: GameState,
  tileId: string,
  coord: HexCoord,
  rotation: GameState['exploration']['rotation'] & number,
): EngineResult {
  if (isTilePlaced(state.board, coord)) {
    return reject(state, 'DEV_PLACE_TILE', 'OCCUPIED')
  }
  getTileDefinition(tileId)
  const placed: PlacedTile = {
    id: tileId,
    definitionId: tileId,
    coord,
    rotation: wrapRotation(rotation),
    discoveredByPlayerId: state.activePlayerId,
    discoveredRound: state.round,
  }
  const deck = {
    ...state.explorationDeck,
    drawPile: state.explorationDeck.drawPile.filter((id) => id !== tileId),
  }
  const events: GameEvent[] = [
    { type: 'TILE_PLACED', tileId, coord },
    { type: 'HEX_DISCOVERED', tileId },
  ]
  return {
    state: append(
      {
        ...state,
        board: { tiles: { ...state.board.tiles, [coordKey(coord)]: placed } },
        explorationDeck: deck,
      },
      events,
    ),
    events,
  }
}

function devRotate(
  state: GameState,
  coord: HexCoord,
  direction: 'LEFT' | 'RIGHT',
): EngineResult {
  const tile = getPlacedTile(state.board, coord)
  if (!tile) return reject(state, 'DEV_ROTATE_PLACED', 'NO_TILE')
  const rotation = wrapRotation(tile.rotation + (direction === 'RIGHT' ? 1 : -1))
  const nextTile = { ...tile, rotation }
  const event: GameEvent = { type: 'TILE_ROTATED', rotation }
  return {
    state: append(
      {
        ...state,
        board: {
          tiles: { ...state.board.tiles, [coordKey(coord)]: nextTile },
        },
      },
      [event],
    ),
    events: [event],
  }
}

export class GameEngine {
  private state: GameState

  constructor(seed = 'spacehex-v0.1') {
    this.state = createInitialState(seed)
  }

  getState(): GameState {
    return this.state
  }

  load(state: GameState): void {
    this.state = clone(state)
  }

  dispatch(command: GameCommand): EngineResult {
    const result = applyCommand(this.state, command)
    this.state = result.state
    return result
  }
}

export { emptyBoard }

import type { GameCommand } from './commands'
import type { GameEvent } from './events'
import type { GameState } from '../state/GameState'
import { GAME_STATE_VERSION, PLAYER_IDS, STARTING_FUEL, STARTING_PROBES, FUEL_COST_EXPLORE, FUEL_COST_MOVE } from '../definitions/constants'
import { emptyCargo, STARTING_CREDITS } from '../definitions/resources'
import { EXPLORATION_TILE_IDS, EVA_TILE_ID, getTileDefinition } from '../definitions/tiles'
import { SHIP_DEFINITIONS } from '../definitions/ships'
import { RNG } from '../random/RNG'
import { getNeighbor, directionFromTo } from '../board/hexMath'
import { emptyBoard, getPlacedTile, isTilePlaced, oppositeDirection, validateTilePlacement } from '../board/HexMap'
import { coordKey } from '../board/HexCoord'
import { rollEdgeNumbers } from '../board/edgeNumbers'
import { wrapRotation, getRotatedEdge, type Rotation } from '../board/tileRotation'
import { drawFromDeck, forceNextTile } from '../board/TileDeck'
import { activePlayer, activeShip, spendFuel, stayFuelCost } from '../rules/fuel'
import { canMoveTo } from '../rules/movement'
import { canExploreDirection } from '../rules/exploration'
import { resolveDeclaredCombat, canDeclareAttack } from '../rules/combat'
import { resolveDiscovery, addGlory } from '../rules/glory'
import { buyFuel, buyResource, sellResource, stockPlanetIfNeeded, repairHull } from '../rules/planetMarket'
import { canLaunchProbe, dismissProbesUnderShips } from '../rules/probes'
import { spawnThornsForPlacedTile, runNpcPhase } from '../rules/npcs'
import { resolveEntryHazards } from '../rules/sectorHazards'
import { applyHullDamage } from '../rules/damage'
import { straitRotationForEntry, straitRotationStep } from '../rules/strait'
import { rollSectorName } from '../definitions/sectorNames'
import type { ResourceId } from '../definitions/resources'
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
    designation: rollSectorName(seed, EVA_TILE_ID, 'EVA_1', null),
    edgeNumbers: rollEdgeNumbers(seed, EVA_TILE_ID, '0,0'),
  }

  const players: GameState['players'] = {
    'player-1': {
      id: 'player-1',
      name: 'Player 1',
      shipId: 'mewa-1',
      fuel: STARTING_FUEL,
      glory: 0,
      credits: STARTING_CREDITS,
      buysThisTurn: 0,
      salvagesThisTurn: 0,
      attacksThisTurn: 0,
    },
    'player-2': {
      id: 'player-2',
      name: 'Player 2',
      shipId: 'mewa-2',
      fuel: STARTING_FUEL,
      glory: 0,
      credits: STARTING_CREDITS,
      buysThisTurn: 0,
      salvagesThisTurn: 0,
      attacksThisTurn: 0,
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
      cargo: emptyCargo(),
      probes: STARTING_PROBES,
    },
    'mewa-2': {
      id: 'mewa-2',
      playerId: 'player-2',
      class: 'MEWA',
      coord: { q: 0, r: 0 },
      hull: mewa.hull,
      maxHull: mewa.hull,
      cargo: emptyCargo(),
      probes: STARTING_PROBES,
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
    planetMarkets: {},
    probes: {},
    log: [
      { type: 'GAME_STARTED', seed },
      { type: 'DECK_SHUFFLED', count: drawPile.length },
      { type: 'ROUND_STARTED', round: 1 },
    ],
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
    case 'DECLARE_ATTACK':
      return declareAttack(state, command.defenderId)
    case 'START_EXPLORATION':
      return startExploration(state, command.direction)
    case 'ROTATE_PENDING_TILE':
      return rotatePending(state, command.direction)
    case 'CONFIRM_TILE_PLACEMENT':
      return confirmPlacement(state)
    case 'SKIP_MOVEMENT':
      return skipMovement(state)
    case 'LAUNCH_PROBE':
      return launchProbe(state, command.direction)
    case 'BUY_RESOURCE':
      return buyResourceCommand(state, command.coord, command.resource)
    case 'BUY_FUEL':
      return buyFuelCommand(state, command.coord)
    case 'REPAIR_HULL':
      return repairHullCommand(state)
    case 'SELL_RESOURCE':
      return sellResourceCommand(state, command.resource)
    case 'END_TURN':
      return endTurn(state)
    case 'DEV_ADD_FUEL':
      return devFuel(state, command.playerId, command.amount)
    case 'DEV_REMOVE_FUEL':
      return devFuel(state, command.playerId, -command.amount)
    case 'DEV_ADD_GLORY': {
      const p = state.players[command.playerId]
      if (!p) return reject(state, command.type, 'NO_PLAYER')
      const next = addGlory(state, p.id, command.amount)
      const event: GameEvent = {
        type: 'GLORY_CHANGED',
        playerId: p.id,
        glory: next.players[p.id].glory,
        delta: command.amount,
      }
      return { state: append(next, [event]), events: [event] }
    }
    case 'DEV_DAMAGE_SHIP': {
      const hit = applyHullDamage(state, command.shipId, command.amount)
      if (!state.ships[command.shipId] && !state.npcShips[command.shipId]) {
        return reject(state, command.type, 'NO_SHIP')
      }
      if (hit.events.length === 0) return reject(state, command.type, 'NO_DAMAGE')
      return { state: append(hit.state, hit.events), events: hit.events }
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
  const moved = moveShip(state, target, FUEL_COST_MOVE)
  return moved
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
  const pendingEdgeNumbers = rollEdgeNumbers(state.seed, drawn.tileId, coordKey(target))
  let rotation: Rotation = 0
  if (getTileDefinition(drawn.tileId).type === 'STRAIT') {
    rotation = straitRotationForEntry(state, drawn.tileId, target, direction)
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
        rotation,
        pendingEdgeNumbers,
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
  const exp = state.exploration
  let rotation = wrapRotation((exp.rotation ?? 0) + delta)
  if (exp.pendingTileId && exp.origin && exp.target) {
    rotation = straitRotationStep(exp.pendingTileId, exp.origin, exp.target, exp.rotation ?? 0, delta)
  }
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
  let rotation = exp.rotation ?? 0
  if (definition.type === 'STRAIT') {
    const dir = directionFromTo(exp.origin, exp.target)
    if (dir !== null && getRotatedEdge(definition, oppositeDirection(dir), rotation) !== 'OPEN') {
      rotation = straitRotationForEntry(state, exp.pendingTileId, exp.target, dir)
    }
  }
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

  const placed: PlacedTile = makePlacedTile(
    state,
    exp.pendingTileId,
    exp.target,
    rotation,
    state.activePlayerId,
    state.round,
    exp.pendingEdgeNumbers,
  )

  const placeEvents: GameEvent[] = [
    { type: 'TILE_PLACED', tileId: placed.id, coord: placed.coord },
    { type: 'HEX_DISCOVERED', tileId: placed.id, playerId: placed.discoveredByPlayerId ?? state.activePlayerId },
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

  const spawn = spawnThornsForPlacedTile(next, placed.id, placed.coord)
  next = spawn.state
  const extra: GameEvent[] = []
  if (spawn.spawned) {
    extra.push({
      type: 'NPC_SPAWNED',
      shipId: spawn.spawned.id,
      class: spawn.spawned.class,
      coord: { ...placed.coord },
    })
  }
  const moved = moveShip(next, placed.coord, FUEL_COST_EXPLORE)
  const before = moved.state
  next = stockPlanetIfNeeded(before, placed.id, placed.coord)
  if (next.planetMarkets[coordKey(placed.coord)] && !before.planetMarkets[coordKey(placed.coord)]) {
    extra.push({ type: 'PLANET_STOCKED', tileId: placed.id, coord: placed.coord })
  }
  const discovered = resolveDiscovery(
    next,
    placed.id,
    placed.coord,
    placed.discoveredByPlayerId ?? state.activePlayerId,
  )
  next = discovered.state
  extra.push(...discovered.events)
  next = append(next, extra)
  return { state: next, events: [...placeEvents, ...moved.events, ...extra] }
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
  const dismissed = dismissProbesUnderShips(next)
  next = append(dismissed.state, dismissed.events)
  const hazard = resolveEntryHazards(next, ship.id, target)
  next = append(hazard.state, hazard.events)
  return { state: next, events: [moveEvent, fuelEvent, ...dismissed.events, ...hazard.events] }
}

function launchProbe(state: GameState, direction: number): EngineResult {
  const check = canLaunchProbe(state, direction)
  if (!check.ok) return reject(state, 'LAUNCH_PROBE', check.reason)
  const drawn = drawFromDeck(state.explorationDeck)
  if (!drawn) return reject(state, 'LAUNCH_PROBE', 'EMPTY_DECK')
  const ship = activeShip(state)
  const player = activePlayer(state)
  const dest = check.target
  const key = coordKey(dest)
  let rotation = 0
  if (getTileDefinition(drawn.tileId).type === 'STRAIT') {
    rotation = straitRotationForEntry(state, drawn.tileId, dest, direction)
  }
  const placed = makePlacedTile(state, drawn.tileId, dest, rotation, player.id, state.round)
  const probe = {
    id: `probe-${ship.id}-${state.round}-${direction}`,
    coord: dest,
    ownerPlayerId: player.id,
    ownerShipId: ship.id,
  }
  const placeEvents: GameEvent[] = [
    { type: 'TILE_DRAWN', tileId: drawn.tileId },
    { type: 'TILE_PLACED', tileId: placed.id, coord: dest },
    { type: 'HEX_DISCOVERED', tileId: placed.id, playerId: player.id },
  ]
  let next = spendFuel(state, FUEL_COST_EXPLORE)
  const fuelEvent: GameEvent = {
    type: 'FUEL_CHANGED',
    playerId: player.id,
    fuel: next.players[player.id].fuel,
  }
  const launchEvent: GameEvent = {
    type: 'PROBE_LAUNCHED',
    playerId: player.id,
    shipId: ship.id,
    coord: dest,
  }
  next = {
    ...next,
    board: {
      tiles: {
        ...next.board.tiles,
        [key]: placed,
      },
    },
    explorationDeck: drawn.deck,
    ships: {
      ...next.ships,
      [ship.id]: { ...ship, probes: ship.probes - 1 },
    },
    probes: { ...next.probes, [key]: probe },
    movementSpent: true,
    exploration: { status: 'NONE' },
    phase: 'PLAYER_TURN',
  }
  next = append(next, [...placeEvents, fuelEvent, launchEvent])
  const spawn = spawnThornsForPlacedTile(next, placed.id, dest)
  next = spawn.state
  const extra: GameEvent[] = []
  if (spawn.spawned) {
    extra.push({
      type: 'NPC_SPAWNED',
      shipId: spawn.spawned.id,
      class: spawn.spawned.class,
      coord: { ...dest },
    })
  }
  const beforeMarket = next
  next = stockPlanetIfNeeded(next, placed.id, dest)
  if (next.planetMarkets[key] && !beforeMarket.planetMarkets[key]) {
    extra.push({ type: 'PLANET_STOCKED', tileId: placed.id, coord: dest })
  }
  const discovered = resolveDiscovery(next, placed.id, dest, player.id)
  next = discovered.state
  extra.push(...discovered.events)
  next = append(next, extra)
  return {
    state: next,
    events: [...placeEvents, fuelEvent, launchEvent, ...extra],
  }
}

function declareAttack(state: GameState, defenderId: string): EngineResult {
  const check = canDeclareAttack(state, defenderId)
  if (!check.ok) return reject(state, 'DECLARE_ATTACK', check.reason)
  const combat = resolveDeclaredCombat(state, defenderId)
  const next = append(combat.state, combat.events)
  return { state: next, events: combat.events }
}

function skipMovement(state: GameState): EngineResult {
  if (!requireTurn(state) || state.movementSpent) {
    return reject(state, 'SKIP_MOVEMENT', 'NOT_IN_MOVEMENT')
  }
  const cost = stayFuelCost(state)
  let next = spendFuel(state, cost)
  const player = activePlayer(next)
  next = {
    ...next,
    movementSpent: true,
    exploration: { status: 'NONE' },
  }
  const events: GameEvent[] =
    cost > 0 ? [{ type: 'FUEL_CHANGED', playerId: player.id, fuel: player.fuel }] : []
  if (events.length) next = append(next, events)
  return { state: next, events }
}

function buyResourceCommand(
  state: GameState,
  coord: HexCoord,
  resource: ResourceId,
): EngineResult {
  if (!requireTurn(state)) return reject(state, 'BUY_RESOURCE', 'NOT_IN_TURN')
  const result = buyResource(state, coord, resource)
  if (!result.ok) return reject(state, 'BUY_RESOURCE', result.reason)
  const player = activePlayer(result.state)
  const events: GameEvent[] = [
    { type: 'RESOURCE_BOUGHT', playerId: player.id, resource, price: result.price, coord },
    { type: 'CREDITS_CHANGED', playerId: player.id, credits: player.credits },
  ]
  return { state: append(result.state, events), events }
}

function buyFuelCommand(state: GameState, coord: HexCoord): EngineResult {
  if (!requireTurn(state)) return reject(state, 'BUY_FUEL', 'NOT_IN_TURN')
  const result = buyFuel(state, coord)
  if (!result.ok) return reject(state, 'BUY_FUEL', result.reason)
  const player = activePlayer(result.state)
  const events: GameEvent[] = [
    { type: 'FUEL_BOUGHT', playerId: player.id, price: result.price, fuel: player.fuel, coord },
    { type: 'FUEL_CHANGED', playerId: player.id, fuel: player.fuel },
    { type: 'CREDITS_CHANGED', playerId: player.id, credits: player.credits },
  ]
  return { state: append(result.state, events), events }
}

function sellResourceCommand(state: GameState, resource: ResourceId): EngineResult {
  if (!requireTurn(state)) return reject(state, 'SELL_RESOURCE', 'NOT_IN_TURN')
  const result = sellResource(state, resource)
  if (!result.ok) return reject(state, 'SELL_RESOURCE', result.reason)
  const player = activePlayer(result.state)
  const events: GameEvent[] = [
    {
      type: 'RESOURCE_SOLD',
      playerId: player.id,
      resource,
      qty: result.qty,
      spot: result.spot,
      margin: result.margin,
      total: result.total,
    },
    { type: 'CREDITS_CHANGED', playerId: player.id, credits: player.credits },
  ]
  return { state: append(result.state, events), events }
}

function repairHullCommand(state: GameState): EngineResult {
  if (!requireTurn(state)) return reject(state, 'REPAIR_HULL', 'NOT_IN_TURN')
  const result = repairHull(state)
  if (!result.ok) return reject(state, 'REPAIR_HULL', result.reason)
  const ship = activeShip(result.state)
  const player = activePlayer(result.state)
  const events: GameEvent[] = [
    { type: 'HULL_REPAIRED', shipId: ship.id, hullAfter: ship.hull, price: result.price },
    { type: 'CREDITS_CHANGED', playerId: player.id, credits: player.credits },
  ]
  return { state: append(result.state, events), events }
}

function makePlacedTile(
  state: GameState,
  tileId: string,
  coord: HexCoord,
  rotation: number,
  discovererId: string | null,
  discoveredRound: number | null,
  edgeNumbers?: PlacedTile['edgeNumbers'],
): PlacedTile {
  const definition = getTileDefinition(tileId)
  return {
    id: tileId,
    definitionId: tileId,
    coord,
    rotation: wrapRotation(rotation),
    discoveredByPlayerId: discovererId,
    discoveredRound,
    designation: rollSectorName(state.seed, tileId, definition.type, discovererId),
    edgeNumbers: edgeNumbers ?? rollEdgeNumbers(state.seed, tileId, coordKey(coord)),
  }
}

function endTurn(state: GameState): EngineResult {
  if (state.phase === 'TILE_PLACEMENT') {
    return reject(state, 'END_TURN', 'MUST_PLACE_TILE')
  }
  const attacked = (activePlayer(state).attacksThisTurn ?? 0) > 0
  if (!state.movementSpent && !attacked) {
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
  const nextPlayer = state.players[nextPlayerId]
  let working: GameState = {
    ...state,
    activePlayerId: nextPlayerId,
    round: newRound,
    movementSpent: false,
    exploration: { status: 'NONE' },
    phase: 'PLAYER_TURN',
    players: {
      ...state.players,
      [nextPlayerId]: { ...nextPlayer, buysThisTurn: 0, salvagesThisTurn: 0, attacksThisTurn: 0 },
    },
  }
  const hunt = runNpcPhase(working)
  working = hunt.state
  events.push(...hunt.events)
  const next = append(working, events)
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
  const placed: PlacedTile = makePlacedTile(
    state,
    tileId,
    coord,
    rotation,
    state.activePlayerId,
    state.round,
  )
  const deck = {
    ...state.explorationDeck,
    drawPile: state.explorationDeck.drawPile.filter((id) => id !== tileId),
  }
  const events: GameEvent[] = [
    { type: 'TILE_PLACED', tileId, coord },
    { type: 'HEX_DISCOVERED', tileId, playerId: placed.discoveredByPlayerId ?? state.activePlayerId },
  ]
  let next = append(
    {
      ...state,
      board: { tiles: { ...state.board.tiles, [coordKey(coord)]: placed } },
      explorationDeck: deck,
    },
    events,
  )
  const spawn = spawnThornsForPlacedTile(next, tileId, coord)
  next = spawn.state
  if (spawn.spawned) {
    const spawned: GameEvent = {
      type: 'NPC_SPAWNED',
      shipId: spawn.spawned.id,
      class: spawn.spawned.class,
      coord: { ...coord },
    }
    next = append(next, [spawned])
    events.push(spawned)
  }
  const beforeMarkets = next.planetMarkets
  next = stockPlanetIfNeeded(next, tileId, coord)
  if (next.planetMarkets[coordKey(coord)] && !beforeMarkets[coordKey(coord)]) {
    const stocked: GameEvent = { type: 'PLANET_STOCKED', tileId, coord }
    next = append(next, [stocked])
    events.push(stocked)
  }
  const discovered = resolveDiscovery(next, tileId, coord, placed.discoveredByPlayerId ?? state.activePlayerId)
  next = append(discovered.state, discovered.events)
  events.push(...discovered.events)
  return { state: next, events }
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

import type { GameState, NpcShipState, ShipState } from '../state/GameState'
import { COMBAT_DAMAGE, MAX_ATTACKS_PER_TURN } from '../definitions/constants'
import type { HexCoord } from '../board/HexCoord'
import type { GameEvent } from '../engine/events'
import { SHIP_DEFINITIONS, type ShipClass } from '../definitions/ships'
import { addGlory, GLORY_DAMAGE, GLORY_DESTROY } from './glory'
import { activeShip } from './fuel'
import { RNG } from '../random/RNG'

export type Combatant = {
  id: string
  class: ShipClass
  coord: HexCoord
  hull: number
  playerId?: string
}

export function combatAbility(shipClass: ShipClass): number {
  return SHIP_DEFINITIONS[shipClass].attack
}

export function shipsAt(state: GameState, coord: HexCoord): ShipState[] {
  return Object.values(state.ships).filter(
    (s) => s.coord.q === coord.q && s.coord.r === coord.r,
  )
}

export function getCombatant(state: GameState, id: string): Combatant | undefined {
  const ship = state.ships[id]
  if (ship) {
    return {
      id: ship.id,
      class: ship.class,
      coord: ship.coord,
      hull: ship.hull,
      playerId: ship.playerId,
    }
  }
  const npc: NpcShipState | undefined = state.npcShips[id]
  if (!npc) return undefined
  return { id: npc.id, class: npc.class, coord: npc.coord, hull: npc.hull }
}

export type CombatReject =
  | 'NOT_IN_TURN'
  | 'NO_SHIP'
  | 'SELF'
  | 'NOT_COLOCATED'
  | 'ATTACK_LIMIT'
  | 'WRECK'

export function hostileOnHex(state: GameState, defenderId: string): boolean {
  if (state.phase !== 'PLAYER_TURN') return false
  const attacker = activeShip(state)
  const defender = getCombatant(state, defenderId)
  if (!attacker || !defender || defender.id === attacker.id) return false
  if (defender.playerId && defender.playerId === attacker.playerId) return false
  if (defender.coord.q !== attacker.coord.q || defender.coord.r !== attacker.coord.r) return false
  return attacker.hull > 0 && defender.hull > 0
}

export function canDeclareAttack(
  state: GameState,
  defenderId: string,
): { ok: true } | { ok: false; reason: CombatReject } {
  if (state.phase !== 'PLAYER_TURN') return { ok: false, reason: 'NOT_IN_TURN' }
  const attacker = activeShip(state)
  const defender = getCombatant(state, defenderId)
  if (!attacker) return { ok: false, reason: 'NO_SHIP' }
  if (!defender) return { ok: false, reason: 'NO_SHIP' }
  if (defender.id === attacker.id) return { ok: false, reason: 'SELF' }
  if (defender.coord.q !== attacker.coord.q || defender.coord.r !== attacker.coord.r) {
    return { ok: false, reason: 'NOT_COLOCATED' }
  }
  if (defender.playerId && defender.playerId === attacker.playerId) {
    return { ok: false, reason: 'SELF' }
  }
  if ((state.players[attacker.playerId]?.attacksThisTurn ?? 0) >= MAX_ATTACKS_PER_TURN) {
    return { ok: false, reason: 'ATTACK_LIMIT' }
  }
  if (attacker.hull <= 0 || defender.hull <= 0) return { ok: false, reason: 'WRECK' }
  return { ok: true }
}

export interface CombatDice {
  attackerDie: number
  defenderDie: number
}

/** Seeded d6 pair for one contest. Faces are 1–6. */
export function rollCombatDice(
  state: GameState,
  attackerId: string,
  defenderId: string,
): CombatDice {
  const rng = new RNG(`${state.seed}:combat:${state.log.length}:${attackerId}:${defenderId}`)
  return {
    attackerDie: rng.nextInt(6) + 1,
    defenderDie: rng.nextInt(6) + 1,
  }
}

export function combatStrength(ability: number, die: number): number {
  return ability + die
}

export interface PlannedShot {
  attackerId: string
  defenderId: string
  damage: number
}

/**
 * One contest: each side rolls ability + d6. Only the loser takes 1 hull.
 * A tie deals no damage.
 */
export function planContestShot(
  attacker: Combatant,
  defender: Combatant,
  dice: CombatDice,
): PlannedShot | null {
  if (attacker.hull <= 0 || defender.hull <= 0) return null
  const a = combatStrength(combatAbility(attacker.class), dice.attackerDie)
  const b = combatStrength(combatAbility(defender.class), dice.defenderDie)
  if (a === b) return null
  if (a > b) {
    return {
      attackerId: attacker.id,
      defenderId: defender.id,
      damage: Math.min(COMBAT_DAMAGE, defender.hull),
    }
  }
  return {
    attackerId: defender.id,
    defenderId: attacker.id,
    damage: Math.min(COMBAT_DAMAGE, attacker.hull),
  }
}

function withHull(state: GameState, id: string, hull: number): GameState {
  const ship = state.ships[id]
  if (ship) {
    return { ...state, ships: { ...state.ships, [id]: { ...ship, hull } } }
  }
  const npc: NpcShipState | undefined = state.npcShips[id]
  if (!npc) return state
  return { ...state, npcShips: { ...state.npcShips, [id]: { ...npc, hull } } }
}

function awardDamageGlory(
  state: GameState,
  shooter: Combatant | undefined,
  defenderClass: ShipClass,
  hullAfter: number,
  hullBefore: number,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  if (!shooter?.playerId || !state.players[shooter.playerId]) return { state, events }
  let next = addGlory(state, shooter.playerId, GLORY_DAMAGE)
  events.push({
    type: 'GLORY_CHANGED',
    playerId: shooter.playerId,
    glory: next.players[shooter.playerId].glory,
    delta: GLORY_DAMAGE,
  })
  if (hullAfter === 0 && hullBefore > 0) {
    const bonus = GLORY_DESTROY[defenderClass]
    next = addGlory(next, shooter.playerId, bonus)
    events.push({
      type: 'GLORY_CHANGED',
      playerId: shooter.playerId,
      glory: next.players[shooter.playerId].glory,
      delta: bonus,
    })
  }
  return { state: next, events }
}

/** Resolve a contested exchange. Does not consume the player's attack. */
export function resolveCombatExchange(
  state: GameState,
  attackerId: string,
  defenderId: string,
): { state: GameState; events: GameEvent[] } {
  const attacker = getCombatant(state, attackerId)
  const defender = getCombatant(state, defenderId)
  if (!attacker || !defender) return { state, events: [] }
  if (attacker.hull <= 0 || defender.hull <= 0) return { state, events: [] }
  if (attacker.coord.q !== defender.coord.q || attacker.coord.r !== defender.coord.r) {
    return { state, events: [] }
  }
  const dice = rollCombatDice(state, attacker.id, defender.id)
  const shot = planContestShot(attacker, defender, dice)
  const events: GameEvent[] = [
    {
      type: 'COMBAT_STARTED',
      attackerId: attacker.id,
      defenderId: defender.id,
      coord: { ...attacker.coord },
      attackerHull: attacker.hull,
      defenderHull: defender.hull,
    },
    {
      type: 'COMBAT_ROLL',
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerAbility: combatAbility(attacker.class),
      defenderAbility: combatAbility(defender.class),
      attackerDie: dice.attackerDie,
      defenderDie: dice.defenderDie,
    },
  ]
  let nextState: GameState = state
  if (shot) {
    const before = shot.defenderId === defender.id ? defender.hull : attacker.hull
    const hullAfter = Math.max(0, before - shot.damage)
    nextState = withHull(nextState, shot.defenderId, hullAfter)
    events.push({
      type: 'COMBAT_SHOT',
      attackerId: shot.attackerId,
      defenderId: shot.defenderId,
      damage: shot.damage,
      hullAfter,
    })
    const shooter = getCombatant(nextState, shot.attackerId)
    const loserClass = shot.defenderId === defender.id ? defender.class : attacker.class
    const glory = awardDamageGlory(nextState, shooter, loserClass, hullAfter, before)
    nextState = glory.state
    events.push(...glory.events)
  }
  events.push({
    type: 'COMBAT_ENDED',
    attackerId: attacker.id,
    defenderId: defender.id,
  })
  return { state: nextState, events }
}

export function resolveDeclaredCombat(
  state: GameState,
  defenderId: string,
): { state: GameState; events: GameEvent[] } {
  const check = canDeclareAttack(state, defenderId)
  if (!check.ok) return { state, events: [] }
  const attacker = activeShip(state)
  const exchange = resolveCombatExchange(state, attacker.id, defenderId)
  const player = exchange.state.players[attacker.playerId]
  const nextState: GameState = {
    ...exchange.state,
    players: {
      ...exchange.state.players,
      [attacker.playerId]: {
        ...player,
        attacksThisTurn: (player.attacksThisTurn ?? 0) + 1,
      },
    },
  }
  return { state: nextState, events: exchange.events }
}

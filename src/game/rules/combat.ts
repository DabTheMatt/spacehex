import type { GameState, NpcShipState, ShipState } from '../state/GameState'
import { COMBAT_DAMAGE, MAX_ATTACKS_PER_TURN } from '../definitions/constants'
import type { HexCoord } from '../board/HexCoord'
import type { GameEvent } from '../engine/events'
import type { ShipClass } from '../definitions/ships'
import { addGlory, GLORY_DAMAGE, GLORY_DESTROY } from './glory'
import { activeShip } from './fuel'

export type Combatant = {
  id: string
  class: ShipClass
  coord: HexCoord
  hull: number
  playerId?: string
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
  const npc = state.npcShips[id]
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

export interface PlannedShot {
  attackerId: string
  defenderId: string
  damage: number
}

/** One exchange per declaration: attacker fires once, defender answers if still up. */
export function planDuelShots(attacker: Combatant, defender: Combatant): PlannedShot[] {
  const shots: PlannedShot[] = []
  let bHull = defender.hull
  if (attacker.hull > 0 && bHull > 0) {
    const damage = Math.min(COMBAT_DAMAGE, bHull)
    bHull -= damage
    shots.push({ attackerId: attacker.id, defenderId: defender.id, damage })
  }
  if (bHull > 0 && defender.hull > 0 && attacker.hull > 0) {
    const damage = Math.min(COMBAT_DAMAGE, attacker.hull)
    shots.push({ attackerId: defender.id, defenderId: attacker.id, damage })
  }
  return shots
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

/** TODO RULE CLARIFICATION T5 — 1 obrażenie na rakietę, liczba rakiet = atak. */
export function resolveDeclaredCombat(
  state: GameState,
  defenderId: string,
): { state: GameState; events: GameEvent[] } {
  const check = canDeclareAttack(state, defenderId)
  if (!check.ok) return { state, events: [] }
  const attacker = activeShip(state)
  const defender = getCombatant(state, defenderId)
  if (!defender) return { state, events: [] }
  const planned = planDuelShots(attacker, defender)
  const events: GameEvent[] = [
    {
      type: 'COMBAT_STARTED',
      attackerId: attacker.id,
      defenderId: defender.id,
      coord: { ...attacker.coord },
      attackerHull: attacker.hull,
      defenderHull: defender.hull,
    },
  ]
  let nextState: GameState = state
  const hullLeft: Record<string, number> = {
    [attacker.id]: attacker.hull,
    [defender.id]: defender.hull,
  }
  const classes: Record<string, ShipClass> = {
    [attacker.id]: attacker.class,
    [defender.id]: defender.class,
  }
  for (const shot of planned) {
    const before = hullLeft[shot.defenderId]
    const hullAfter = Math.max(0, before - shot.damage)
    hullLeft[shot.defenderId] = hullAfter
    nextState = withHull(nextState, shot.defenderId, hullAfter)
    events.push({
      type: 'COMBAT_SHOT',
      attackerId: shot.attackerId,
      defenderId: shot.defenderId,
      damage: shot.damage,
      hullAfter,
    })
    const shooter = getCombatant(nextState, shot.attackerId)
    if (shooter?.playerId && nextState.players[shooter.playerId]) {
      nextState = addGlory(nextState, shooter.playerId, GLORY_DAMAGE)
      events.push({
        type: 'GLORY_CHANGED',
        playerId: shooter.playerId,
        glory: nextState.players[shooter.playerId].glory,
        delta: GLORY_DAMAGE,
      })
      if (hullAfter === 0 && before > 0) {
        const bonus = GLORY_DESTROY[classes[shot.defenderId]]
        nextState = addGlory(nextState, shooter.playerId, bonus)
        events.push({
          type: 'GLORY_CHANGED',
          playerId: shooter.playerId,
          glory: nextState.players[shooter.playerId].glory,
          delta: bonus,
        })
      }
    }
  }
  const player = nextState.players[attacker.playerId]
  nextState = {
    ...nextState,
    players: {
      ...nextState.players,
      [attacker.playerId]: {
        ...player,
        attacksThisTurn: (player.attacksThisTurn ?? 0) + 1,
      },
    },
  }
  events.push({
    type: 'COMBAT_ENDED',
    attackerId: attacker.id,
    defenderId: defender.id,
  })
  return { state: nextState, events }
}

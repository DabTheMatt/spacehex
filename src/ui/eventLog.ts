import type { GameEvent } from '@/game/engine/events'
import type { GameState } from '@/game/state/GameState'
import { RESOURCE_LABEL } from '@/game/definitions/resources'
import { SHIP_DEFINITIONS } from '@/game/definitions/ships'
import { discoveryNoun } from '@/ui/discoveryCopy'

export function shipCallsign(state: GameState, shipId: string): string {
  const ship = state.ships[shipId]
  if (ship) {
    const n = ship.playerId.replace(/\D/g, '') || '1'
    return `SG-${n}`
  }
  const npc = state.npcShips[shipId]
  if (npc) return SHIP_DEFINITIONS[npc.class].label.toUpperCase()
  return shipId.toUpperCase()
}

export function formatLogLine(state: GameState, event: GameEvent): string | null {
  switch (event.type) {
    case 'DECK_SHUFFLED':
      return 'Exploration deck shuffled.'
    case 'HEX_DISCOVERED': {
      const name = state.players[event.playerId]?.name ?? 'Player'
      return `${name} discovered ${discoveryNoun(event.tileId)}.`
    }
    case 'ASTEROID_STRIKE':
      return event.damage > 0
        ? `${shipCallsign(state, event.shipId)} hit an asteroid field (−${event.damage}).`
        : `${shipCallsign(state, event.shipId)} crossed an asteroid field.`
    case 'SHIP_DESTROYED':
      return `${shipCallsign(state, event.shipId)} was destroyed.`
    case 'FUEL_BOUGHT':
      return `${state.players[event.playerId]?.name ?? 'Player'} bought fuel.`
    case 'HULL_REPAIRED':
      return `${shipCallsign(state, event.shipId)} repaired hull (−${event.price} CR).`
    case 'PROBE_LAUNCHED': {
      const name = state.players[event.playerId]?.name ?? event.playerId
      return `${name} launched a probe.`
    }
    case 'PROBE_DISMISSED':
      return `Probe recovered · ${shipCallsign(state, event.shipId)}.`
    case 'NPC_FACE_ROLLED':
      return `${shipCallsign(state, event.shipId)} rolled ${event.face}.`
    case 'VORTEX_ROLL':
      return `${shipCallsign(state, event.shipId)} swept by a vortex (${event.face}).`
    case 'NPC_SPAWNED':
      return `A ${SHIP_DEFINITIONS[event.class].label} appeared.`
    case 'SHIP_DAMAGED':
      return `${shipCallsign(state, event.shipId)} took ${event.damage} damage.`
    case 'COMBAT_ROLL': {
      const a = shipCallsign(state, event.attackerId)
      const b = shipCallsign(state, event.defenderId)
      return `${a} ${event.attackerAbility}+${event.attackerDie} vs ${b} ${event.defenderAbility}+${event.defenderDie}.`
    }
    case 'COMBAT_SHOT':
      return `${shipCallsign(state, event.defenderId)} took ${event.damage} damage.`
    case 'COMBAT_STARTED':
      return `${shipCallsign(state, event.attackerId)} declared attack.`
    case 'RESOURCE_BOUGHT':
      return `${state.players[event.playerId]?.name ?? 'Player'} bought ${RESOURCE_LABEL[event.resource]}.`
    case 'RESOURCE_SOLD':
      return `${state.players[event.playerId]?.name ?? 'Player'} sold ${RESOURCE_LABEL[event.resource]}.`
    case 'SHIP_MOVED':
    case 'TILE_PLACED':
      return null
    case 'TURN_ENDED':
      return `${state.players[event.playerId]?.name ?? 'Player'} ended turn.`
    case 'ROUND_STARTED':
      return `Cycle ${String(event.round).padStart(2, '0')}.`
    case 'GAME_STARTED':
      return 'New game.'
    default:
      return null
  }
}

export function visibleLogLines(state: GameState, limit = 10): string[] {
  const lines: string[] = []
  for (let i = state.log.length - 1; i >= 0 && lines.length < limit; i--) {
    const line = formatLogLine(state, state.log[i])
    if (line) lines.push(line)
  }
  return lines
}

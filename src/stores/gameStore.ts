import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { GameEngine } from '@/game/engine/GameEngine'
import type { GameCommand } from '@/game/engine/commands'
import type { GameEvent } from '@/game/engine/events'
import type { GameState } from '@/game/state/GameState'
import { getNeighbor } from '@/game/board/hexMath'
import { isTilePlaced } from '@/game/board/HexMap'
import { activePlayer, activeShip } from '@/game/rules/fuel'
import { getTileDefinition } from '@/game/definitions/tiles'

const engine = new GameEngine(`spacehex-${Date.now()}`)

export const useGameStore = defineStore('game', () => {
  const state = ref<GameState>(engine.getState())
  const lastEvents = ref<GameEvent[]>(state.value.log)

  function dispatch(command: GameCommand): GameEvent[] {
    const result = engine.dispatch(command)
    state.value = result.state
    lastEvents.value = result.events
    return result.events
  }

  const player = computed(() => activePlayer(state.value))
  const ship = computed(() => activeShip(state.value))
  const pendingDef = computed(() => {
    const id = state.value.exploration.pendingTileId
    return id ? getTileDefinition(id) : null
  })

  function edgeKind(direction: number): 'EXPLORE' | 'MOVE' | 'NONE' {
    const origin = ship.value.coord
    const target = getNeighbor(origin, direction)
    if (isTilePlaced(state.value.board, target)) return 'MOVE'
    return 'EXPLORE'
  }

  return { state, lastEvents, dispatch, player, ship, pendingDef, edgeKind }
})

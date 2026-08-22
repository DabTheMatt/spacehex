<template>
  <footer class="command-bar">
    <div class="command-bar__context">
      <div v-if="identity" class="command-bar__id">{{ identity }}</div>
      <div v-if="modeLine" class="command-bar__mode">{{ modeLine }}</div>
      <div v-if="params.length" class="command-bar__params">
        <span v-for="row in params" :key="row.label">
          <span class="muted">{{ row.label }}</span>
          {{ row.value }}
        </span>
      </div>
      <div v-if="hint" class="command-bar__hint muted">{{ hint }}</div>
    </div>

    <div class="command-bar__end">
      <button
        v-if="showEndTurn"
        type="button"
        class="action accent"
        @click="game.dispatch({ type: 'END_TURN' })"
      >
        END TURN
      </button>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'
import { commandMode } from '@/ui/commandMode'
import { coordKey } from '@/game/board/HexCoord'
import { getTileDefinition } from '@/game/definitions/tiles'
import { SHIP_DEFINITIONS } from '@/game/definitions/ships'

const game = useGameStore()
const ui = useUiStore()

const mode = computed(() =>
  commandMode(game.state, { shipId: ui.selectedShipId, tile: ui.selectedTile }),
)

const identity = computed(() => {
  if (mode.value === 'EXPLORE_ROTATION') return 'EXPLORATION / ORIENT SECTOR'
  if (mode.value !== 'OBJECT_SELECTED') return ''
  if (ui.selectedTile) {
    const tile = game.state.board.tiles[coordKey(ui.selectedTile)]
    if (!tile) return ''
    const def = getTileDefinition(tile.definitionId)
    return `${coordKey(ui.selectedTile)} / ${def.label.toUpperCase()}`
  }
  const ship = ui.selectedShipId ? game.state.ships[ui.selectedShipId] : null
  if (!ship) return ''
  const n = ship.playerId.replace(/\D/g, '') || '1'
  return `${SHIP_DEFINITIONS[ship.class].id} / SG-${n}`
})

const modeLine = computed(() => {
  if (mode.value === 'EXPLORE_ROTATION') return game.pendingDef ? game.pendingDef.type.replace(/_/g, ' ') : ''
  return ''
})

const params = computed(() => {
  if (mode.value === 'OBJECT_SELECTED' && ui.selectedTile) {
    const tile = game.state.board.tiles[coordKey(ui.selectedTile)]
    if (!tile) return []
    const def = getTileDefinition(tile.definitionId)
    return [
      { label: 'TYPE', value: def.type.replace(/_/g, ' ') },
      { label: 'ORIENT', value: `${tile.rotation * 60}°` },
    ]
  }
  if (mode.value === 'OBJECT_SELECTED' && ui.selectedShipId) {
    const ship = game.state.ships[ui.selectedShipId]
    const player = ship ? game.state.players[ship.playerId] : null
    if (!ship || !player) return []
    return [
      { label: 'HULL', value: `${pad(ship.hull)} / ${pad(ship.maxHull)}` },
      { label: 'FUEL', value: pad(player.fuel) },
      { label: 'PCH', value: pad(player.glory) },
    ]
  }
  return []
})

const hint = computed(() => {
  if (mode.value === 'EXPLORE_ROTATION') return 'Q / E  ROTATE   ·   CLICK HEX TO PLACE'
  return ''
})

const showEndTurn = computed(
  () => game.state.movementSpent && game.state.phase !== 'TILE_PLACEMENT',
)

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
</script>

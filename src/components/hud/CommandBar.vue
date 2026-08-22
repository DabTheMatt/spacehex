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

    <nav v-if="actions.length" class="command-bar__actions">
      <button
        v-for="action in actions"
        :key="action.id"
        type="button"
        class="action"
        :class="{ accent: action.accent, muted: action.muted }"
        :disabled="action.disabled"
        @click="action.run"
      >
        <span class="num">{{ action.num }}</span>
        <span>{{ action.label }}</span>
      </button>
    </nav>

    <div class="command-bar__end">
      <button
        v-if="showEndTurn"
        type="button"
        class="action accent"
        @click="game.dispatch({ type: 'END_TURN' })"
      >
        <span class="num">09</span>
        <span>END TURN</span>
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
  if (mode.value === 'MOVE_TARGETING') return 'NAVIGATION / SELECT DESTINATION'
  if (mode.value === 'EXPLORE_EDGE_SELECTION') return 'EXPLORATION / SELECT EDGE'
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
  if (mode.value === 'MOVE_TARGETING') return [{ label: 'RANGE', value: '01' }]
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
  if (mode.value === 'MOVE_TARGETING' || mode.value === 'EXPLORE_EDGE_SELECTION') return 'ESC  CANCEL'
  if (mode.value === 'EXPLORE_ROTATION') return 'Q / E  ROTATE   ·   ENTER  CONFIRM'
  return ''
})

const canAct = computed(() => {
  const ship = ui.selectedShipId ? game.state.ships[ui.selectedShipId] : null
  return ship?.id === game.ship.id && !game.state.movementSpent
})

const actions = computed(() => {
  if (mode.value === 'MOVE_TARGETING' || mode.value === 'EXPLORE_EDGE_SELECTION') {
    return [
      {
        id: 'esc',
        num: 'ESC',
        label: 'CANCEL',
        accent: false,
        muted: false,
        disabled: false,
        run: () => game.dispatch({ type: 'CANCEL_SELECTION' }),
      },
    ]
  }
  if (mode.value === 'EXPLORE_ROTATION') {
    return [
      {
        id: 'q',
        num: 'Q',
        label: 'ROTATE',
        accent: false,
        muted: false,
        disabled: false,
        run: () => game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'LEFT' }),
      },
      {
        id: 'e',
        num: 'E',
        label: 'ROTATE',
        accent: false,
        muted: false,
        disabled: false,
        run: () => game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'RIGHT' }),
      },
      {
        id: 'enter',
        num: 'ENT',
        label: 'CONFIRM',
        accent: true,
        muted: false,
        disabled: false,
        run: () => game.dispatch({ type: 'CONFIRM_TILE_PLACEMENT' }),
      },
    ]
  }
  if (mode.value !== 'OBJECT_SELECTED' || !canAct.value) return []
  const status = game.state.exploration.status
  return [
    {
      id: '01',
      num: '01',
      label: 'MOVE',
      accent: status === 'SELECTING_MOVE',
      muted: false,
      disabled: false,
      run: () => game.dispatch({ type: 'BEGIN_MOVE' }),
    },
    {
      id: '02',
      num: '02',
      label: 'EXPLORE',
      accent: status === 'SELECTING_DIRECTION',
      muted: false,
      disabled: false,
      run: () => game.dispatch({ type: 'BEGIN_EXPLORATION' }),
    },
    {
      id: '03',
      num: '03',
      label: 'STAY',
      accent: false,
      muted: false,
      disabled: false,
      run: () => game.dispatch({ type: 'SKIP_MOVEMENT' }),
    },
  ]
})

const showEndTurn = computed(
  () => game.state.movementSpent && game.state.phase !== 'TILE_PLACEMENT',
)

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
</script>

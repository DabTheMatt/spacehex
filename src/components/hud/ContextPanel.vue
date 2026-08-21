<template>
  <aside v-if="block" class="context-panel">
    <div class="display-name">{{ block.title }}</div>
    <div class="muted">{{ block.kicker }}</div>
    <div class="rule" />
    <div v-for="row in block.rows" :key="row.label" class="stat">
      <span>{{ row.label }}</span>
      <span>{{ row.value }}</span>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'
import { coordKey } from '@/game/board/HexCoord'
import { getTileDefinition } from '@/game/definitions/tiles'

const game = useGameStore()
const ui = useUiStore()

const block = computed(() => {
  const coord = ui.selectedTile
  if (coord) {
    const tile = game.state.board.tiles[coordKey(coord)]
    if (!tile) return null
    const def = getTileDefinition(tile.definitionId)
    const ships = Object.values(game.state.ships).filter(
      (s) => s.coord.q === coord.q && s.coord.r === coord.r,
    )
    return {
      title: def.label.toUpperCase(),
      kicker: `${coordKey(coord)}  ·  ${tile.rotation * 60}°`,
      rows: [
        { label: 'TYPE', value: def.type.replace(/_/g, ' ') },
        { label: 'SHIPS', value: ships.length ? ships.map((s) => s.playerId.replace(/\D/g, '')).join(' ') : '—' },
        { label: 'SCAN', value: '—' },
      ],
    }
  }
  return {
    title: 'MEWA',
    kicker: `${game.player.name.toUpperCase()}  ·  ${game.ship.coord.q},${game.ship.coord.r}`,
    rows: [
      { label: 'HULL', value: `${pad(game.ship.hull)} / ${pad(game.ship.maxHull)}` },
      { label: 'FUEL', value: pad(game.player.fuel) },
      { label: 'PCH', value: pad(game.player.glory) },
    ],
  }
})

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
</script>

<template>
  <aside v-if="info" class="tile-info">
    <h2>{{ info.label }}</h2>
    <dl>
      <div><dt>Typ</dt><dd>{{ info.type }}</dd></div>
      <div><dt>Pole</dt><dd>{{ info.key }}</dd></div>
      <div><dt>Orientacja</dt><dd>{{ info.rotationDeg }}°</dd></div>
      <div><dt>Odkrył</dt><dd>{{ info.discovered }}</dd></div>
      <div><dt>Statki</dt><dd>{{ info.ships }}</dd></div>
    </dl>
    <p class="tiny">{{ info.note }}</p>
    <button type="button" @click="ui.selectedTile = null">ZAMKNIJ</button>
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

const info = computed(() => {
  const coord = ui.selectedTile
  if (!coord) return null
  const key = coordKey(coord)
  const tile = game.state.board.tiles[key]
  if (!tile) return null
  const def = getTileDefinition(tile.definitionId)
  const ships = Object.values(game.state.ships)
    .filter((s) => s.coord.q === coord.q && s.coord.r === coord.r)
    .map((s) => {
      const n = s.playerId.replace(/\D/g, '')
      return `${n} ${s.class}`
    })
  const discoverer = tile.discoveredByPlayerId
    ? game.state.players[tile.discoveredByPlayerId]?.name ?? tile.discoveredByPlayerId
    : 'start'
  return {
    label: def.label,
    type: def.type,
    key,
    rotationDeg: tile.rotation * 60,
    discovered: `${discoverer}${tile.discoveredRound != null ? ` · runda ${tile.discoveredRound}` : ''}`,
    ships: ships.length ? ships.join(', ') : '—',
    note: 'TODO RULE CLARIFICATION T7: efekt sektora nie jest jeszcze zdefiniowany.',
  }
})
</script>

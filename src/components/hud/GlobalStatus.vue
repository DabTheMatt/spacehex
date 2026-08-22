<template>
  <header class="global-status">
    <span>{{ left }}</span>
    <button type="button" class="action global-status__new" @click="newGame">NEW GAME</button>
    <span class="muted">DECK {{ pad(game.state.explorationDeck.drawPile.length) }}</span>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'

const game = useGameStore()
const ui = useUiStore()

const left = computed(() => {
  const n = game.player.id.replace(/\D/g, '') || '1'
  return `SG-${n} / CYCLE ${pad(game.state.round)}`
})

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function newGame(): void {
  const seed = `spacehex-${Date.now()}`
  ui.seedInput = seed
  ui.selectedTile = null
  ui.hover = null
  game.dispatch({ type: 'START_GAME', seed })
  ui.selectedShipId = game.ship.id
}
</script>

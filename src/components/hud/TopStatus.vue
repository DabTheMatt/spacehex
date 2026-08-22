<template>
  <header class="top-status">
    <span>{{ playerLabel }}</span>
    <span>CYCLE {{ pad(game.state.round) }}</span>
    <span>FUEL {{ pad(game.player.fuel) }}</span>
    <span class="muted">DECK {{ pad(game.state.explorationDeck.drawPile.length) }}</span>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()

const playerLabel = computed(() => {
  const n = game.player.id.replace(/\D/g, '') || '1'
  return `SG-${n}`
})

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
</script>

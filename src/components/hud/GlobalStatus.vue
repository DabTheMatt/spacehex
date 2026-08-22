<template>
  <header class="global-status">
    <span>{{ left }}</span>
    <span class="muted">DECK {{ pad(game.state.explorationDeck.drawPile.length) }}</span>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()

const left = computed(() => {
  const n = game.player.id.replace(/\D/g, '') || '1'
  return `SG-${n} / CYCLE ${pad(game.state.round)}`
})

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
</script>

<template>
  <button
    v-if="visible"
    type="button"
    class="end-turn-btn"
    aria-label="Koniec tury"
    @click="game.dispatch({ type: 'END_TURN' })"
  >
    <span class="end-turn-btn__ring" />
    <span class="end-turn-btn__label">KONIEC<br />TURY</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()

const visible = computed(
  () => game.state.movementSpent && game.state.phase !== 'TILE_PLACEMENT',
)
</script>

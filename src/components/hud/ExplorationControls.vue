<template>
  <section v-if="active" class="explore-controls">
    <div class="display-name">{{ game.pendingDef?.label.toUpperCase() }}</div>
    <div class="muted">NEW SECTOR</div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()
const active = computed(() => game.state.phase === 'TILE_PLACEMENT')
</script>

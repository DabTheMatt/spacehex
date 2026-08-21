<template>
  <section v-if="active" class="explore-controls">
    <div class="display-name">{{ game.pendingDef?.label.toUpperCase() }}</div>
    <div class="muted">NEW SECTOR  ·  {{ (game.state.exploration.rotation ?? 0) * 60 }}°</div>
    <div class="rule" />
    <button type="button" class="action" @click="rotate('LEFT')"><span class="num">Q</span> ROTATE LEFT</button>
    <button type="button" class="action" @click="rotate('RIGHT')"><span class="num">E</span> ROTATE RIGHT</button>
    <button type="button" class="action accent" @click="confirm"><span class="num">F</span> CONFIRM</button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()
const active = computed(() => game.state.phase === 'TILE_PLACEMENT')

function rotate(direction: 'LEFT' | 'RIGHT'): void {
  game.dispatch({ type: 'ROTATE_PENDING_TILE', direction })
}

function confirm(): void {
  game.dispatch({ type: 'CONFIRM_TILE_PLACEMENT' })
}
</script>

<template>
  <aside class="event-log" aria-label="Event log">
    <div v-for="(line, index) in lines" :key="`${line}-${index}`" class="event-log__line">
      {{ line }}
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { visibleLogLines } from '@/ui/eventLog'

const game = useGameStore()
const lines = computed(() => visibleLogLines(game.state, 10))
</script>

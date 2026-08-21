<template>
  <nav v-if="actions.length" class="action-list">
    <button
      v-for="action in actions"
      :key="action.id"
      type="button"
      class="action"
      :class="{ accent: action.accent, muted: action.muted }"
      :disabled="action.disabled"
      @click="action.run"
    >
      <span class="num">{{ action.id }}</span>
      <span>{{ action.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()

const actions = computed(() => {
  const st = game.state
  if (st.phase === 'TILE_PLACEMENT') return []
  if (st.movementSpent) {
    return [
      {
        id: '01',
        label: 'END TURN',
        accent: true,
        muted: false,
        disabled: false,
        run: () => game.dispatch({ type: 'END_TURN' }),
      },
    ]
  }
  const status = st.exploration.status
  return [
    {
      id: '01',
      label: 'MOVE',
      accent: status === 'SELECTING_MOVE',
      muted: false,
      disabled: false,
      run: () => game.dispatch({ type: 'BEGIN_MOVE' }),
    },
    {
      id: '02',
      label: 'EXPLORE',
      accent: status === 'SELECTING_DIRECTION',
      muted: false,
      disabled: false,
      run: () => game.dispatch({ type: 'BEGIN_EXPLORATION' }),
    },
    {
      id: '03',
      label: 'STAY',
      accent: false,
      muted: false,
      disabled: false,
      run: () => game.dispatch({ type: 'SKIP_MOVEMENT' }),
    },
  ]
})
</script>

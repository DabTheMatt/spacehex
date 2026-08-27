<template>
  <nav class="action-strip" aria-label="Available actions">
    <button
      v-for="id in ACTION_IDS"
      :key="id"
      type="button"
      :class="['action-strip__item', { on: lit[id], aiming: id === 'PROBE' && ui.probeAiming, probe: id === 'PROBE' }]"
      :disabled="!lit[id]"
      @click="onAction(id)"
    >
      {{ id }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'
import { ACTION_IDS, availableActions, type ActionId } from '@/ui/availableActions'
import { canLaunchAnyProbe } from '@/game/rules/probes'

const game = useGameStore()
const ui = useUiStore()

const lit = computed(() => availableActions(game.state))

function onAction(id: ActionId): void {
  if (id === 'STAY' && lit.value.STAY) {
    game.dispatch({ type: 'SKIP_MOVEMENT' })
    return
  }
  if (id === 'PROBE' && canLaunchAnyProbe(game.state)) {
    ui.probeAiming = !ui.probeAiming
  }
}
</script>

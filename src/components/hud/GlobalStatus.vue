<template>
  <header class="global-status">
    <span>{{ left }}</span>
    <button type="button" class="action global-status__new" @click="newGame">NEW GAME</button>
    <span class="muted">v{{ APP_VERSION }} · DECK {{ pad(game.state.explorationDeck.drawPile.length) }}</span>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { APP_VERSION } from '@/appVersion'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'

const game = useGameStore()
const ui = useUiStore()

const left = computed(() => {
  const n = game.player.id.replace(/\D/g, '') || '1'
  return `SG-${n} / CYCLE ${pad(game.state.round)} / CR ${pad(game.player.credits)} / GLORY ${pad(game.player.glory)}`
})

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function newGame(): void {
  const seed = `spacehex-${Date.now()}`
  ui.seedInput = seed
  ui.selectedTile = null
  ui.hover = null
  ui.probeAiming = false
  game.dispatch({ type: 'START_GAME', seed })
  ui.selectedShipId = game.ship.id
}
</script>

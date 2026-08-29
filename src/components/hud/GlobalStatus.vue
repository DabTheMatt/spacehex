<template>
  <header class="global-status">
    <div class="global-status__start">
      <div class="graphic-toggle" role="group" aria-label="Graphic version">
        <button
          type="button"
          :class="{ on: ui.graphicMode === 'space' }"
          @click="ui.setGraphicMode('space')"
        >
          SPACE
        </button>
        <button
          type="button"
          :class="{ on: ui.graphicMode === 'ink' }"
          @click="ui.setGraphicMode('ink')"
        >
          INK
        </button>
        <button
          type="button"
          :class="{ on: ui.graphicMode === 'ink-reversed' }"
          @click="ui.setGraphicMode('ink-reversed')"
        >
          INK REV
        </button>
        <button
          type="button"
          class="sound-toggle"
          :class="{ on: ui.soundEnabled }"
          :title="ui.soundEnabled ? 'Sound on' : 'Sound off'"
          :aria-pressed="ui.soundEnabled"
          aria-label="Sound"
          @click="ui.toggleSound"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M3.2 8.2 H6.2 L10.2 5.2 V14.8 L6.2 11.8 H3.2 Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linejoin="miter"
            />
            <path
              d="M12.2 7.4 C13.4 8.2 13.4 11.8 12.2 12.6"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <path
              v-if="ui.soundEnabled"
              d="M13.8 5.8 C16 7.2 16 12.8 13.8 14.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <path
              v-else
              d="M3 4 L17 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
            />
          </svg>
        </button>
      </div>
      <span>{{ left }}</span>
    </div>
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

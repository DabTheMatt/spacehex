<template>
  <section class="hud-bar">
    <div v-if="game.state.phase === 'PLAYER_TURN' && game.state.exploration.status === 'NONE' && !game.state.movementSpent" class="row">
      <span class="label">TURA</span>
      <button type="button" @click="game.dispatch({ type: 'BEGIN_MOVE' })">RUCH</button>
      <button type="button" class="accent" @click="game.dispatch({ type: 'BEGIN_EXPLORATION' })">
        EKSPLORACJA
      </button>
      <button type="button" @click="skip">POZOSTAŃ</button>
    </div>

    <div v-else-if="game.state.exploration.status === 'SELECTING_MOVE'" class="row">
      <span class="label dusk">WYBIERZ POLE (RUCH)</span>
      <button type="button" @click="game.dispatch({ type: 'CANCEL_SELECTION' })">ANULUJ</button>
    </div>

    <div v-else-if="game.state.exploration.status === 'SELECTING_DIRECTION'" class="row">
      <span class="label blood">WYBIERZ KIERUNEK</span>
      <button type="button" @click="game.dispatch({ type: 'CANCEL_SELECTION' })">ANULUJ</button>
    </div>

    <div v-else-if="game.state.phase === 'TILE_PLACEMENT'" class="placement">
      <div class="drawn">
        WYL0SOWANO:
        <strong>{{ game.pendingDef?.label }}</strong>
        <span class="sym">{{ game.pendingDef?.symbol }}</span>
      </div>
      <div class="row">
        <button type="button" @click="rotate('LEFT')">← OBRÓĆ</button>
        <button type="button" @click="rotate('RIGHT')">OBRÓĆ →</button>
      </div>
      <div class="orient">ORIENTACJA: {{ (game.state.exploration.rotation ?? 0) * 60 }}°</div>
      <button type="button" class="accent" @click="confirm">ZATWIERDŹ</button>
      <p class="hint">Q / E — obrót · Enter — zatwierdź</p>
    </div>

    <div v-else-if="game.state.movementSpent" class="row">
      <span class="label">RUCH WYKONANY</span>
      <button type="button" class="accent" @click="game.dispatch({ type: 'END_TURN' })">
        KONIEC TURY
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()

function rotate(direction: 'LEFT' | 'RIGHT'): void {
  game.dispatch({ type: 'ROTATE_PENDING_TILE', direction })
}

function confirm(): void {
  game.dispatch({ type: 'CONFIRM_TILE_PLACEMENT' })
}

function skip(): void {
  game.dispatch({ type: 'SKIP_MOVEMENT' })
}
</script>

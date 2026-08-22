<template>
  <section class="hud-bar">
    <div v-if="game.state.phase === 'PLAYER_TURN' && game.state.exploration.status === 'NONE' && !game.state.movementSpent" class="row">
      <span class="label">TURN</span>
      <button type="button" @click="game.dispatch({ type: 'BEGIN_MOVE' })">MOVE</button>
      <button type="button" class="accent" @click="game.dispatch({ type: 'BEGIN_EXPLORATION' })">
        EXPLORE
      </button>
      <button type="button" @click="skip">STAY</button>
    </div>

    <div v-else-if="game.state.exploration.status === 'SELECTING_MOVE'" class="row">
      <span class="label dusk">SELECT HEX (MOVE)</span>
      <button type="button" @click="game.dispatch({ type: 'CANCEL_SELECTION' })">CANCEL</button>
    </div>

    <div v-else-if="game.state.exploration.status === 'SELECTING_DIRECTION'" class="row">
      <span class="label blood">SELECT EDGE</span>
      <button type="button" @click="game.dispatch({ type: 'CANCEL_SELECTION' })">CANCEL</button>
    </div>

    <div v-else-if="game.state.phase === 'TILE_PLACEMENT'" class="placement">
      <div class="drawn">
        DRAWN:
        <strong>{{ game.pendingDef?.label }}</strong>
        <span class="sym">{{ game.pendingDef?.symbol }}</span>
      </div>
      <div class="row">
        <button type="button" @click="rotate('LEFT')">← ROTATE</button>
        <button type="button" @click="rotate('RIGHT')">ROTATE →</button>
      </div>
      <div class="orient">ORIENTATION: {{ (game.state.exploration.rotation ?? 0) * 60 }}°</div>
      <p class="hint">Q / E — rotate · click the hex to place</p>
    </div>

    <div v-else-if="game.state.movementSpent" class="row">
      <span class="label">MOVE COMPLETE</span>
      <button type="button" class="accent" @click="game.dispatch({ type: 'END_TURN' })">
        END TURN
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

function skip(): void {
  game.dispatch({ type: 'SKIP_MOVEMENT' })
}
</script>

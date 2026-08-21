<template>
  <aside class="dev">
    <h2>DEV</h2>
    <label>
      seed
      <input v-model="ui.seedInput" />
    </label>
    <button type="button" @click="game.dispatch({ type: 'DEV_RESET', seed: ui.seedInput })">
      reset gry
    </button>
    <button type="button" @click="game.dispatch({ type: 'DEV_NEXT_PLAYER' })">następny gracz</button>
    <button type="button" @click="game.dispatch({ type: 'DEV_ADD_FUEL', playerId: game.player.id, amount: 1 })">
      + paliwo
    </button>
    <button type="button" @click="game.dispatch({ type: 'DEV_REMOVE_FUEL', playerId: game.player.id, amount: 1 })">
      − paliwo
    </button>
    <button type="button" @click="game.dispatch({ type: 'DEV_ADD_GLORY', playerId: game.player.id, amount: 1 })">
      + PCH
    </button>
    <button type="button" @click="game.dispatch({ type: 'DEV_DAMAGE_SHIP', shipId: game.ship.id, amount: 1 })">
      zadaj obrażenie
    </button>
    <label>
      wymuś kafel
      <select v-model="forced">
        <option value="">—</option>
        <option v-for="id in remaining" :key="id" :value="id">{{ id }}</option>
      </select>
    </label>
    <button type="button" :disabled="!forced" @click="force">wstaw na wierzch stosu</button>
    <label class="chk"><input v-model="ui.showCoords" type="checkbox" /> współrzędne q,r</label>
    <label class="chk"><input v-model="ui.showEdges" type="checkbox" /> indeksy krawędzi 0–5</label>
    <label class="chk"><input v-model="ui.showDebug" type="checkbox" /> overlay tileId / rotation</label>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'

const game = useGameStore()
const ui = useUiStore()
const forced = ref('')
const remaining = computed(() => game.state.explorationDeck.drawPile)

function force(): void {
  if (!forced.value) return
  game.dispatch({ type: 'DEV_FORCE_NEXT_TILE', tileId: forced.value })
}
</script>

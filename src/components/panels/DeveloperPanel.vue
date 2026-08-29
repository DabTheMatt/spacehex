<template>
  <aside class="dev">
    <h2>DEV</h2>
    <label>
      seed
      <input v-model="ui.seedInput" />
    </label>
    <button type="button" @click="game.dispatch({ type: 'DEV_RESET', seed: ui.seedInput })">
      reset game
    </button>
    <button type="button" @click="game.dispatch({ type: 'DEV_NEXT_PLAYER' })">next player</button>
    <button type="button" @click="game.dispatch({ type: 'DEV_ADD_FUEL', playerId: game.player.id, amount: 1 })">
      + fuel
    </button>
    <button type="button" @click="game.dispatch({ type: 'DEV_REMOVE_FUEL', playerId: game.player.id, amount: 1 })">
      − fuel
    </button>
    <button type="button" @click="game.dispatch({ type: 'DEV_ADD_GLORY', playerId: game.player.id, amount: 1 })">
      + glory
    </button>
    <button type="button" @click="game.dispatch({ type: 'DEV_DAMAGE_SHIP', shipId: game.ship.id, amount: 1 })">
      deal damage
    </button>
    <label>
      force tile
      <select v-model="forced">
        <option value="">—</option>
        <option v-for="id in remaining" :key="id" :value="id">{{ id }}</option>
      </select>
    </label>
    <button type="button" :disabled="!forced" @click="force">put on top of deck</button>
    <button type="button" :disabled="!forced" @click="placeBeside">place beside ship</button>
    <label class="chk"><input v-model="ui.showCoords" type="checkbox" /> coordinates q,r</label>
    <label class="chk"><input v-model="ui.showEdges" type="checkbox" /> edge indices 0–5</label>
    <label class="chk"><input v-model="ui.showDebug" type="checkbox" /> overlay tileId / rotation</label>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'
import { getNeighbor } from '@/game/board/hexMath'
import { isTilePlaced } from '@/game/board/HexMap'
import { straitRotationForEntry } from '@/game/rules/strait'

const game = useGameStore()
const ui = useUiStore()
const forced = ref('')
const remaining = computed(() => game.state.explorationDeck.drawPile)

function force(): void {
  if (!forced.value) return
  game.dispatch({ type: 'DEV_FORCE_NEXT_TILE', tileId: forced.value })
}

function placeBeside(): void {
  if (!forced.value) return
  const origin = game.ship.coord
  for (let dir = 0; dir < 6; dir++) {
    const coord = getNeighbor(origin, dir)
    if (isTilePlaced(game.state.board, coord)) continue
    const rotation = straitRotationForEntry(game.state, forced.value, coord, dir)
    game.dispatch({ type: 'DEV_PLACE_TILE', tileId: forced.value, coord, rotation })
    return
  }
}
</script>

<template>
  <aside class="status">
    <h2>{{ game.player.name }}</h2>
    <dl>
      <div><dt>Round</dt><dd>{{ game.state.round }}</dd></div>
      <div><dt>Phase</dt><dd>{{ game.state.phase }}</dd></div>
      <div><dt>Ship</dt><dd>Mewa △</dd></div>
      <div><dt>Fuel</dt><dd>{{ game.player.fuel }}</dd></div>
      <div><dt>Hull</dt><dd>{{ game.ship.hull }}/{{ game.ship.maxHull }}</dd></div>
      <div><dt>PCH</dt><dd>{{ game.player.glory }}</dd></div>
      <div>
        <dt>Exploration deck</dt>
        <dd>{{ game.state.explorationDeck.drawPile.length }}</dd>
      </div>
      <div>
        <dt>Position</dt>
        <dd>{{ game.ship.coord.q }},{{ game.ship.coord.r }}</dd>
      </div>
    </dl>
    <p class="tiny">WASD or LMB drag · scroll zoom · RMB orbit</p>
  </aside>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()
</script>

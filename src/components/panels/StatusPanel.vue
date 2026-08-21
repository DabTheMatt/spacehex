<template>
  <aside class="status">
    <h2>{{ game.player.name }}</h2>
    <dl>
      <div><dt>Runda</dt><dd>{{ game.state.round }}</dd></div>
      <div><dt>Faza</dt><dd>{{ game.state.phase }}</dd></div>
      <div><dt>Statek</dt><dd>Mewa △</dd></div>
      <div><dt>Paliwo</dt><dd>{{ game.player.fuel }}</dd></div>
      <div><dt>Kadłub</dt><dd>{{ game.ship.hull }}/{{ game.ship.maxHull }}</dd></div>
      <div><dt>PCH</dt><dd>{{ game.player.glory }}</dd></div>
      <div>
        <dt>Stos eksploracji</dt>
        <dd>{{ game.state.explorationDeck.drawPile.length }}</dd>
      </div>
      <div>
        <dt>Pozycja</dt>
        <dd>{{ game.ship.coord.q }},{{ game.ship.coord.r }}</dd>
      </div>
    </dl>
    <p class="tiny">WASD lub LPM przeciągnij mapę · scroll zoom · PPM orbit</p>
  </aside>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()
</script>

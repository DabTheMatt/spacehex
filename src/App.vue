<template>
  <div class="app-shell">
    <header class="masthead">
      <div class="mark">SPACE HEX</div>
      <div class="sub">Prototype v0.1 — surowy kosmiczny drzeworyt</div>
    </header>
    <GameCanvas />
    <ActionHud />
    <StatusPanel />
    <TileInfoPanel />
    <DeveloperPanel v-if="ui.showDev" />
  </div>
</template>

<script setup lang="ts">
import GameCanvas from './components/GameCanvas.vue'
import ActionHud from './components/hud/ActionHud.vue'
import StatusPanel from './components/panels/StatusPanel.vue'
import TileInfoPanel from './components/panels/TileInfoPanel.vue'
import DeveloperPanel from './components/panels/DeveloperPanel.vue'
import { useUiStore } from './stores/uiStore'

const ui = useUiStore()
</script>

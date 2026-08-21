<template>
  <div class="app-shell">
    <GameCanvas />
    <TopStatus />
    <ContextPanel />
    <ActionList />
    <ExplorationControls />
    <DeveloperPanel v-if="ui.showDev" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import GameCanvas from './components/GameCanvas.vue'
import TopStatus from './components/hud/TopStatus.vue'
import ContextPanel from './components/hud/ContextPanel.vue'
import ActionList from './components/hud/ActionList.vue'
import ExplorationControls from './components/hud/ExplorationControls.vue'
import DeveloperPanel from './components/panels/DeveloperPanel.vue'
import { useUiStore } from './stores/uiStore'

const ui = useUiStore()

function onKey(ev: KeyboardEvent): void {
  if (ev.key === '`' || ev.key === 'Backquote') {
    ui.showDev = !ui.showDev
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

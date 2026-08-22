<template>
  <div class="app-shell">
    <GameCanvas />
    <TopStatus />
    <ContextPanel />
    <ActionList />
    <EndTurnButton />
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
import EndTurnButton from './components/hud/EndTurnButton.vue'
import ExplorationControls from './components/hud/ExplorationControls.vue'
import DeveloperPanel from './components/panels/DeveloperPanel.vue'
import { useUiStore } from './stores/uiStore'
import { useGameHotkeys } from './ui/useGameHotkeys'
import { isTypingTarget } from './ui/actionHotkeys'

const ui = useUiStore()
useGameHotkeys()

function onDevKey(ev: KeyboardEvent): void {
  if (isTypingTarget(ev.target)) return
  if (ev.code === 'Backquote' || ev.key === '`') {
    ui.showDev = !ui.showDev
  }
}

onMounted(() => window.addEventListener('keydown', onDevKey, true))
onUnmounted(() => window.removeEventListener('keydown', onDevKey, true))
</script>

<template>
  <div class="app-shell" :class="{ ink: ui.graphicMode === 'ink' }">
    <GameCanvas />
    <GameHUD />
    <DeveloperPanel v-if="ui.showDev" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import GameCanvas from './components/GameCanvas.vue'
import GameHUD from './components/hud/GameHUD.vue'
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

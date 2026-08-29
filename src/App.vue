<template>
  <div
    class="app-shell"
    :class="{
      ink: isInk(ui.graphicMode),
      'ink-reversed': ui.graphicMode === 'ink-reversed',
    }"
  >
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
import { isInk } from './renderer/graphicMode'
import { useGameHotkeys } from './ui/useGameHotkeys'
import { isTypingTarget } from './ui/actionHotkeys'
import { unlockSound } from './ui/sound'

const ui = useUiStore()
useGameHotkeys()

function onDevKey(ev: KeyboardEvent): void {
  if (isTypingTarget(ev.target)) return
  if (ev.code === 'Backquote' || ev.key === '`') {
    ui.showDev = !ui.showDev
  }
}

const unlockOpts: AddEventListenerOptions = { capture: true }

function bindUnlock(on: boolean): void {
  const method = on ? window.addEventListener : window.removeEventListener
  method('pointerdown', unlockSound, unlockOpts)
  method('pointerup', unlockSound, unlockOpts)
  method('touchstart', unlockSound, unlockOpts)
  method('click', unlockSound, unlockOpts)
  method('keydown', unlockSound, unlockOpts)
}

onMounted(() => {
  window.addEventListener('keydown', onDevKey, true)
  bindUnlock(true)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onDevKey, true)
  bindUnlock(false)
})
</script>

<template>
  <canvas ref="canvasEl" class="space-canvas" @pointerdown="onPointer" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { SpaceScene } from '@/renderer/scene/SpaceScene'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'
import { getNeighbor } from '@/game/board/hexMath'

const canvasEl = ref<HTMLCanvasElement | null>(null)
const game = useGameStore()
const ui = useUiStore()
let scene: SpaceScene | null = null

function sync(): void {
  if (!scene) return
  scene.sync(game.state, {
    showDebug: ui.showDebug,
    showCoords: ui.showCoords,
    showEdges: ui.showEdges,
  })
}

function resize(): void {
  if (!scene || !canvasEl.value) return
  const parent = canvasEl.value.parentElement ?? document.body
  scene.resize(parent.clientWidth, parent.clientHeight)
}

function onPointer(ev: PointerEvent): void {
  if (!scene) return
  const picked = scene.pickDirection(ev.clientX, ev.clientY)
  if (!picked) return
  const status = game.state.exploration.status
  if (status === 'SELECTING_DIRECTION') {
    game.dispatch({ type: 'START_EXPLORATION', direction: picked.direction })
    scene.handleEvents(game.lastEvents, game.state)
    sync()
  } else if (status === 'SELECTING_MOVE') {
    const origin = game.ship.coord
    game.dispatch({ type: 'DECLARE_MOVE', target: getNeighbor(origin, picked.direction) })
    scene.handleEvents(game.lastEvents, game.state)
    sync()
  }
}

function onKey(ev: KeyboardEvent): void {
  if (game.state.phase !== 'TILE_PLACEMENT') return
  if (ev.key === 'q' || ev.key === 'Q') {
    game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'LEFT' })
  } else if (ev.key === 'e' || ev.key === 'E' || ev.key === 'r' || ev.key === 'R') {
    game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'RIGHT' })
  } else if (ev.key === 'Enter') {
    game.dispatch({ type: 'CONFIRM_TILE_PLACEMENT' })
  } else {
    return
  }
  scene?.handleEvents(game.lastEvents, game.state)
  sync()
}

onMounted(() => {
  if (!canvasEl.value) return
  scene = new SpaceScene(canvasEl.value)
  resize()
  sync()
  scene.camera.focus({ q: 0, r: 0 })
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('keydown', onKey)
  scene?.dispose()
})

watch(
  () => [game.state, ui.showDebug, ui.showCoords, ui.showEdges],
  () => sync(),
  { deep: true },
)
</script>

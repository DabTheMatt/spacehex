<template>
  <canvas
    ref="canvasEl"
    class="space-canvas"
    @pointerdown="onDown"
    @pointerup="onUp"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { SpaceScene } from '@/renderer/scene/SpaceScene'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'
import { getNeighbor } from '@/game/board/hexMath'
import { coordKey } from '@/game/board/HexCoord'

const canvasEl = ref<HTMLCanvasElement | null>(null)
const game = useGameStore()
const ui = useUiStore()
let scene: SpaceScene | null = null
let downX = 0
let downY = 0

function sync(): void {
  if (!scene) return
  scene.sync(game.state, {
    showDebug: ui.showDebug,
    showCoords: ui.showCoords,
    showEdges: ui.showEdges,
    selectedKey: ui.selectedTile ? coordKey(ui.selectedTile) : null,
  })
}

function resize(): void {
  if (!scene || !canvasEl.value) return
  const parent = canvasEl.value.parentElement ?? document.body
  scene.resize(parent.clientWidth, parent.clientHeight)
}

function onDown(ev: PointerEvent): void {
  downX = ev.clientX
  downY = ev.clientY
}

function onUp(ev: PointerEvent): void {
  if (!scene) return
  if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6) return

  const status = game.state.exploration.status
  if (status === 'SELECTING_DIRECTION' || status === 'SELECTING_MOVE') {
    const picked = scene.pickDirection(ev.clientX, ev.clientY)
    if (!picked) return
    if (status === 'SELECTING_DIRECTION') {
      game.dispatch({ type: 'START_EXPLORATION', direction: picked.direction })
    } else {
      game.dispatch({
        type: 'DECLARE_MOVE',
        target: getNeighbor(game.ship.coord, picked.direction),
      })
    }
    scene.handleEvents(game.lastEvents, game.state)
    sync()
    return
  }

  const tile = scene.pickTile(ev.clientX, ev.clientY)
  ui.selectedTile = tile
  sync()
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
  () => [game.state, ui.showDebug, ui.showCoords, ui.showEdges, ui.selectedTile],
  () => sync(),
  { deep: true },
)
</script>

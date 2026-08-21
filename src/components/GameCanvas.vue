<template>
  <canvas
    ref="canvasEl"
    class="space-canvas"
    tabindex="0"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { SpaceScene } from '@/renderer/scene/SpaceScene'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'
import { getNeighbor } from '@/game/board/hexMath'
import { coordKey } from '@/game/board/HexCoord'

const DRAG_PX = 12

const canvasEl = ref<HTMLCanvasElement | null>(null)
const game = useGameStore()
const ui = useUiStore()
let scene: SpaceScene | null = null
let downX = 0
let downY = 0
let dragging = false

function showExploreGhosts(): boolean {
  return game.state.exploration.status === 'SELECTING_DIRECTION'
}

function sync(): void {
  if (!scene) return
  scene.sync(game.state, {
    showDebug: ui.showDebug,
    showCoords: ui.showCoords,
    showEdges: ui.showEdges,
    selectedKey: ui.selectedTile ? coordKey(ui.selectedTile) : null,
    showExploreGhosts: showExploreGhosts(),
  })
}

function focusShip(shipId: string): void {
  const ship = game.state.ships[shipId]
  if (!ship || !scene) return
  scene.camera.focus(ship.coord)
}

function resize(): void {
  if (!scene || !canvasEl.value) return
  const parent = canvasEl.value.parentElement ?? document.body
  scene.resize(parent.clientWidth, parent.clientHeight)
}

function onDown(ev: PointerEvent): void {
  downX = ev.clientX
  downY = ev.clientY
  dragging = false
  canvasEl.value?.focus()
  if (ev.button === 0) {
    canvasEl.value?.setPointerCapture(ev.pointerId)
  }
}

function onMove(ev: PointerEvent): void {
  if (!scene || (ev.buttons & 1) === 0) return
  const dist = Math.hypot(ev.clientX - downX, ev.clientY - downY)
  if (!dragging && dist > DRAG_PX) {
    dragging = true
    scene.camera.beginPan(downX, downY)
    scene.camera.updatePan(ev.clientX, ev.clientY)
    return
  }
  if (dragging) scene.camera.updatePan(ev.clientX, ev.clientY)
}

function onUp(ev: PointerEvent): void {
  if (!scene) return
  const wasDrag = dragging
  if (ev.button === 0) {
    scene.camera.endPan()
    canvasEl.value?.releasePointerCapture(ev.pointerId)
  }
  dragging = false
  if (wasDrag) return

  const status = game.state.exploration.status
  if (status === 'SELECTING_MOVE') {
    const picked = scene.pickDirection(ev.clientX, ev.clientY)
    if (!picked) return
    game.dispatch({
      type: 'DECLARE_MOVE',
      target: getNeighbor(game.ship.coord, picked.direction),
    })
    return
  }

  if (status === 'SELECTING_DIRECTION') {
    const ghost = scene.pickDirection(ev.clientX, ev.clientY)
    if (ghost) {
      game.dispatch({ type: 'START_EXPLORATION', direction: ghost.direction })
      return
    }
  }

  const shipHit = scene.pickShip(ev.clientX, ev.clientY)
  if (shipHit) {
    ui.selectedShipId = shipHit.shipId
    ui.selectedTile = null
    return
  }

  const tile = scene.pickTile(ev.clientX, ev.clientY)
  ui.selectedTile = tile
  if (tile) ui.selectedShipId = null
}

onMounted(() => {
  if (!canvasEl.value) return
  scene = new SpaceScene(canvasEl.value)
  resize()
  ui.selectedShipId = game.ship.id
  focusShip(game.ship.id)
  sync()
  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
  scene?.dispose()
})

watch(
  () => game.lastEvents,
  (events) => {
    if (!scene) return
    scene.handleEvents(events, game.state)
    sync()
  },
)

watch(
  () => [game.state, ui.showDebug, ui.showCoords, ui.showEdges, ui.selectedTile, ui.selectedShipId],
  () => sync(),
  { deep: true },
)

watch(
  () => game.state.activePlayerId,
  () => {
    ui.selectedShipId = game.ship.id
    ui.selectedTile = null
  },
)
</script>

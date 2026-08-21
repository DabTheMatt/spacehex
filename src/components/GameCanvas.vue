<template>
  <canvas
    ref="canvasEl"
    class="space-canvas"
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

const canvasEl = ref<HTMLCanvasElement | null>(null)
const game = useGameStore()
const ui = useUiStore()
let scene: SpaceScene | null = null
let downX = 0
let downY = 0

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
  if (ev.button === 0 && scene) {
    scene.camera.beginPan(ev.clientX, ev.clientY)
    canvasEl.value?.setPointerCapture(ev.pointerId)
  }
}

function onMove(ev: PointerEvent): void {
  if (!scene?.camera.panning) return
  scene.camera.updatePan(ev.clientX, ev.clientY)
}

function onUp(ev: PointerEvent): void {
  if (!scene) return
  const dragged = Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6
  if (ev.button === 0) {
    scene.camera.endPan()
    canvasEl.value?.releasePointerCapture(ev.pointerId)
  }
  if (dragged) return

  const status = game.state.exploration.status
  if (status === 'SELECTING_MOVE') {
    const picked = scene.pickDirection(ev.clientX, ev.clientY)
    if (!picked) return
    game.dispatch({
      type: 'DECLARE_MOVE',
      target: getNeighbor(game.ship.coord, picked.direction),
    })
    scene.handleEvents(game.lastEvents, game.state)
    sync()
    return
  }

  if (status === 'SELECTING_DIRECTION') {
    const ghost = scene.pickDirection(ev.clientX, ev.clientY)
    if (ghost) {
      game.dispatch({ type: 'START_EXPLORATION', direction: ghost.direction })
      scene.handleEvents(game.lastEvents, game.state)
      sync()
      return
    }
  }

  const shipHit = scene.pickShip(ev.clientX, ev.clientY)
  if (shipHit) {
    ui.selectedShipId = shipHit.shipId
    ui.selectedTile = null
    focusShip(shipHit.shipId)
    sync()
    return
  }

  const tile = scene.pickTile(ev.clientX, ev.clientY)
  ui.selectedTile = tile
  if (tile) ui.selectedShipId = null
  sync()
}

function onKey(ev: KeyboardEvent): void {
  const target = ev.target
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return
  }

  if (game.state.phase === 'TILE_PLACEMENT') {
    const key = ev.key.toLowerCase()
    if (key === 'q') {
      game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'LEFT' })
    } else if (key === 'e' || key === 'r') {
      game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'RIGHT' })
    } else if (key === 'f' || ev.key === 'Enter') {
      game.dispatch({ type: 'CONFIRM_TILE_PLACEMENT' })
    } else {
      return
    }
    scene?.handleEvents(game.lastEvents, game.state)
    sync()
    return
  }

  if (ev.key === 'Escape') {
    game.dispatch({ type: 'CANCEL_SELECTION' })
    sync()
    return
  }
  if (ev.key === '1') {
    if (game.state.movementSpent) game.dispatch({ type: 'END_TURN' })
    else game.dispatch({ type: 'BEGIN_MOVE' })
    scene?.handleEvents(game.lastEvents, game.state)
    sync()
    return
  }
  if (ev.key === '2') {
    game.dispatch({ type: 'BEGIN_EXPLORATION' })
    sync()
    return
  }
  if (ev.key === '3') {
    game.dispatch({ type: 'SKIP_MOVEMENT' })
    scene?.handleEvents(game.lastEvents, game.state)
    sync()
  }
}

onMounted(() => {
  if (!canvasEl.value) return
  scene = new SpaceScene(canvasEl.value)
  resize()
  ui.selectedShipId = game.ship.id
  focusShip(game.ship.id)
  sync()
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('keydown', onKey)
  scene?.dispose()
})

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
    focusShip(game.ship.id)
    sync()
  },
)
</script>

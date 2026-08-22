<template>
  <canvas
    ref="canvasEl"
    class="space-canvas"
    tabindex="0"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @pointerleave="onLeave"
    @contextmenu.prevent
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { SpaceScene } from '@/renderer/scene/SpaceScene'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'
import { coordKey } from '@/game/board/HexCoord'

const DRAG_PX = 12

const canvasEl = ref<HTMLCanvasElement | null>(null)
const game = useGameStore()
const ui = useUiStore()
let scene: SpaceScene | null = null
let downX = 0
let downY = 0
let dragging = false

function sync(): void {
  if (!scene) return
  scene.sync(game.state, {
    showDebug: ui.showDebug,
    showCoords: ui.showCoords,
    showEdges: ui.showEdges,
    selectedKey: ui.selectedTile ? coordKey(ui.selectedTile) : null,
    showExploreGhosts: true,
    hover: ui.hover,
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

function updateHover(clientX: number, clientY: number): void {
  if (!scene || game.state.phase === 'TILE_PLACEMENT') return
  ui.hover = scene.pickHover(clientX, clientY)
}

function confirmHover(): void {
  const hover = ui.hover
  if (!hover || game.state.phase === 'TILE_PLACEMENT') return
  if (hover.kind === 'STAY') {
    game.dispatch({ type: 'SKIP_MOVEMENT' })
    ui.hover = null
    return
  }
  if (hover.kind === 'MOVE') {
    game.dispatch({ type: 'DECLARE_MOVE', target: hover.coord })
    ui.hover = null
    return
  }
  game.dispatch({ type: 'START_EXPLORATION', direction: hover.direction })
  ui.hover = null
}

function onLeave(): void {
  if (dragging) return
  ui.hover = null
  scene?.camera.setOrbitEnabled(true)
}

function onDown(ev: PointerEvent): void {
  downX = ev.clientX
  downY = ev.clientY
  dragging = false
  canvasEl.value?.focus()
  if (ev.button === 0) {
    canvasEl.value?.setPointerCapture(ev.pointerId)
  }
  if (ev.button === 2) {
    ev.preventDefault()
  }
}

function onMove(ev: PointerEvent): void {
  if (!scene) return
  if ((ev.buttons & 1) === 1) {
    const dist = Math.hypot(ev.clientX - downX, ev.clientY - downY)
    if (!dragging && dist > DRAG_PX) {
      dragging = true
      scene.camera.setOrbitEnabled(false)
      scene.camera.beginPan(ev.clientX, ev.clientY)
      return
    }
    if (dragging) scene.camera.updatePan(ev.clientX, ev.clientY)
    return
  }
  if (ev.buttons === 0) updateHover(ev.clientX, ev.clientY)
}

function onUp(ev: PointerEvent): void {
  if (!scene) return
  const wasDrag = dragging
  if (ev.button === 0) {
    scene.camera.endPan()
    scene.camera.setOrbitEnabled(true)
    canvasEl.value?.releasePointerCapture(ev.pointerId)
  }
  dragging = false
  if (wasDrag) return

  if (ev.button === 2) {
    ev.preventDefault()
    return
  }

  if (ev.button === 0 && ui.hover && !previewBusy()) {
    confirmHover()
    return
  }

  const status = game.state.exploration.status
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
  ui.selectedShipId = null
}

function previewBusy(): boolean {
  return game.state.phase === 'TILE_PLACEMENT'
}

onMounted(() => {
  if (!canvasEl.value) return
  scene = new SpaceScene(canvasEl.value)
  scene.preview.onRevealed = null
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
    if (events.some((event) => event.type === 'TURN_ENDED')) {
      scene.camera.panTo(game.ship.coord)
    }
    sync()
  },
)

watch(
  () => [
    game.state,
    ui.showDebug,
    ui.showCoords,
    ui.showEdges,
    ui.selectedTile,
    ui.selectedShipId,
    ui.hover,
  ],
  () => sync(),
  { deep: true },
)

watch(
  () => game.state.activePlayerId,
  () => {
    ui.selectedShipId = game.ship.id
    ui.selectedTile = null
    ui.hover = null
  },
)
</script>

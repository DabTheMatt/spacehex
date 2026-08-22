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
import { getNeighbor } from '@/game/board/hexMath'
import { coordKey } from '@/game/board/HexCoord'
import { wrapRotation } from '@/game/board/tileRotation'
import { hoverKey } from '@/ui/boardHover'

const DRAG_PX = 12

const canvasEl = ref<HTMLCanvasElement | null>(null)
const game = useGameStore()
const ui = useUiStore()
let scene: SpaceScene | null = null
let downX = 0
let downY = 0
let dragging = false
let rotateClick = false

function peekTileId(): string | null {
  if (ui.hover?.kind !== 'EXPLORE') return null
  return game.state.explorationDeck.drawPile[0] ?? null
}

function sync(): void {
  if (!scene) return
  scene.sync(game.state, {
    showDebug: ui.showDebug,
    showCoords: ui.showCoords,
    showEdges: ui.showEdges,
    selectedKey: ui.selectedTile ? coordKey(ui.selectedTile) : null,
    showExploreGhosts: game.state.exploration.status === 'SELECTING_DIRECTION',
    hover: ui.hover,
    peekTileId: peekTileId(),
    hoverRotation: ui.hoverRotation,
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
  if (scene.pickRotateControl(clientX, clientY)) {
    scene.camera.setOrbitEnabled(false)
    return
  }
  const next = scene.pickHover(clientX, clientY)
  const prevKey = hoverKey(ui.hover)
  const nextKey = hoverKey(next)
  if (prevKey !== nextKey) ui.hoverRotation = 0
  ui.hover = next
  scene.camera.setOrbitEnabled(!next)
}

function confirmHover(): void {
  const hover = ui.hover
  if (!hover || game.state.phase === 'TILE_PLACEMENT') return
  if (hover.kind === 'STAY') {
    if (game.state.movementSpent) game.dispatch({ type: 'END_TURN' })
    else game.dispatch({ type: 'SKIP_MOVEMENT' })
    ui.hover = null
    return
  }
  if (hover.kind === 'MOVE') {
    game.dispatch({ type: 'DECLARE_MOVE', target: hover.coord })
    ui.hover = null
    return
  }
  const wanted = ui.hoverRotation
  game.dispatch({ type: 'START_EXPLORATION', direction: hover.direction })
  if (!game.state.exploration.pendingTileId) return
  let guard = 0
  while ((game.state.exploration.rotation ?? 0) !== wanted && guard < 6) {
    game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'RIGHT' })
    guard += 1
  }
  game.dispatch({ type: 'CONFIRM_TILE_PLACEMENT' })
  ui.hover = null
  ui.hoverRotation = 0
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
  rotateClick = false
  canvasEl.value?.focus()
  if (ev.button === 0) {
    if (scene?.pickRotateControl(ev.clientX, ev.clientY)) {
      rotateClick = true
      return
    }
    canvasEl.value?.setPointerCapture(ev.pointerId)
  }
  if (ev.button === 2) {
    ev.preventDefault()
  }
}

function onMove(ev: PointerEvent): void {
  if (!scene) return
  if ((ev.buttons & 1) === 1 && !rotateClick) {
    const dist = Math.hypot(ev.clientX - downX, ev.clientY - downY)
    if (!dragging && dist > DRAG_PX) {
      dragging = true
      scene.camera.beginPan(downX, downY)
      scene.camera.updatePan(ev.clientX, ev.clientY)
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
    canvasEl.value?.releasePointerCapture(ev.pointerId)
  }
  dragging = false
  if (wasDrag) {
    rotateClick = false
    return
  }

  if (ev.button === 0 && rotateClick) {
    rotateClick = false
    if (ui.hover?.kind === 'EXPLORE') {
      ui.hoverRotation = wrapRotation(ui.hoverRotation + 1)
    }
    return
  }
  rotateClick = false

  if (ev.button === 2) {
    ev.preventDefault()
    confirmHover()
    return
  }

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
  () => [
    game.state,
    ui.showDebug,
    ui.showCoords,
    ui.showEdges,
    ui.selectedTile,
    ui.selectedShipId,
    ui.hover,
    ui.hoverRotation,
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
    ui.hoverRotation = 0
  },
)
</script>

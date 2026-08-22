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
import { planetInspectTheta } from '@/renderer/board/planetLots'

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
    inspectKey: ui.inspectPlanet ? coordKey(ui.inspectPlanet) : null,
  })
}

function focusShip(shipId: string): void {
  const ship = game.state.ships[shipId]
  if (!ship || !scene) return
  scene.camera.panTo(ship.coord)
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

  if (game.state.phase === 'TILE_PLACEMENT') {
    if (scene.pickPlacement(ev.clientX, ev.clientY)) {
      game.dispatch({ type: 'CONFIRM_TILE_PLACEMENT' })
    }
    return
  }

  const name = scene.pickPlanetName(ev.clientX, ev.clientY)
  if (name && game.state.planetMarkets[coordKey(name)]) {
    const same =
      ui.inspectPlanet && ui.inspectPlanet.q === name.q && ui.inspectPlanet.r === name.r
    if (same) {
      ui.inspectPlanet = null
      scene.camera.clearInspectLimits()
    } else {
      ui.inspectPlanet = name
    }
    return
  }

  if (ui.inspectPlanet) {
    const buy = scene.pickBuy(ev.clientX, ev.clientY)
    if (
      buy &&
      game.state.phase === 'PLAYER_TURN' &&
      buy.coord.q === ui.inspectPlanet.q &&
      buy.coord.r === ui.inspectPlanet.r
    ) {
      game.dispatch({ type: 'BUY_RESOURCE', coord: buy.coord, resource: buy.resource })
      return
    }
  }

  const hover = scene.pickHover(ev.clientX, ev.clientY)
  if (hover && game.state.phase === 'PLAYER_TURN') {
    if (hover.kind === 'STAY') {
      ui.inspectPlanet = null
      scene.camera.clearInspectLimits()
      game.dispatch({ type: 'SKIP_MOVEMENT' })
      ui.hover = null
      return
    }
    if (hover.kind === 'MOVE') {
      ui.inspectPlanet = null
      scene.camera.clearInspectLimits()
      game.dispatch({ type: 'DECLARE_MOVE', target: hover.coord })
      ui.hover = null
      return
    }
    if (hover.kind === 'EXPLORE') {
      ui.inspectPlanet = null
      scene.camera.clearInspectLimits()
      game.dispatch({ type: 'START_EXPLORATION', direction: hover.direction })
      game.dispatch({ type: 'CONFIRM_TILE_PLACEMENT' })
      ui.hover = null
      return
    }
  }

  const shipHit = scene.pickShip(ev.clientX, ev.clientY)
  if (shipHit) {
    ui.inspectPlanet = null
    scene.camera.clearInspectLimits()
    ui.selectedShipId = shipHit.shipId
    ui.selectedTile = null
    return
  }

  const tile = scene.pickTile(ev.clientX, ev.clientY)
  ui.inspectPlanet = null
  scene.camera.clearInspectLimits()
  ui.selectedTile = tile
  ui.selectedShipId = null
}

onMounted(() => {
  if (!canvasEl.value) return
  scene = new SpaceScene(canvasEl.value)
  scene.camera.onBreakInspect = () => {
    ui.inspectPlanet = null
  }
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
      ui.inspectPlanet = null
      scene.camera.clearInspectLimits()
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
    ui.inspectPlanet,
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
    ui.inspectPlanet = null
  },
)

watch(
  () => ui.inspectPlanet,
  (coord) => {
    if (!scene) return
    if (!coord) {
      scene.camera.clearInspectLimits()
      return
    }
    const tile = game.state.board.tiles[coordKey(coord)]
    if (!tile) return
    scene.camera.inspectPlanet(coord, planetInspectTheta(tile.rotation))
  },
)
</script>

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
  <p v-if="bootError" class="boot-error">{{ bootError }}</p>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { SpaceScene } from '@/renderer/scene/SpaceScene'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'
import { coordKey } from '@/game/board/HexCoord'
import { planetInspectTheta } from '@/renderer/board/planetLots'
import { canDeclareAttack, hostileOnHex } from '@/game/rules/combat'
import { isEvaHex } from '@/game/rules/planetMarket'
import {
  dragThreshold,
  isAttackConfirmTap,
  isTouchLike,
  LONG_PRESS_MS,
} from '@/ui/pointerInput'

const canvasEl = ref<HTMLCanvasElement | null>(null)
const bootError = ref('')
const game = useGameStore()
const ui = useUiStore()
let scene: SpaceScene | null = null
let downX = 0
let downY = 0
let dragging = false
let pinch = false
let tapConsumed = false
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let lastTapShip: { id: string; at: number } | null = null
const pointers = new Set<number>()

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
    showTileNames: ui.showTileNames,
    showMarketIcons: ui.showMarketIcons,
    threatShipId: ui.threatShipId,
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
  const vv = window.visualViewport
  const width = Math.round(vv?.width ?? parent.clientWidth)
  const height = Math.round(vv?.height ?? parent.clientHeight)
  scene.resize(width, height)
}

function clearLongPress(): void {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function setCursor(kind: 'grab' | 'pointer'): void {
  if (canvasEl.value) canvasEl.value.style.cursor = kind
}

function updateHover(clientX: number, clientY: number): void {
  if (!scene || game.state.phase === 'TILE_PLACEMENT') return
  const shipHit = scene.pickShip(clientX, clientY)
  if (shipHit && hostileOnHex(game.state, shipHit.shipId)) {
    ui.threatShipId = shipHit.shipId
    ui.hover = null
    setCursor('pointer')
    return
  }
  ui.threatShipId = null
  setCursor('grab')
  ui.hover = scene.pickHover(clientX, clientY)
}

function tryAttack(shipId: string): boolean {
  if (!scene) return false
  const check = canDeclareAttack(game.state, shipId)
  if (!check.ok) {
    if (check.reason === 'ATTACK_LIMIT') ui.flashNotice('ATTACK LIMIT REACHED')
    return false
  }
  ui.inspectPlanet = null
  ui.mapOverview = false
  scene.camera.clearInspectLimits()
  game.dispatch({ type: 'DECLARE_ATTACK', defenderId: shipId })
  ui.threatShipId = null
  lastTapShip = null
  return true
}

function onLeave(): void {
  if (dragging || pinch || pointers.size > 0) return
  ui.hover = null
  ui.threatShipId = null
  scene?.camera.setOrbitEnabled(true)
  setCursor('grab')
}

function onDown(ev: PointerEvent): void {
  pointers.add(ev.pointerId)
  downX = ev.clientX
  downY = ev.clientY
  dragging = false
  tapConsumed = false
  canvasEl.value?.focus()
  if (pointers.size >= 2) {
    pinch = true
    clearLongPress()
    if (dragging) scene?.camera.endPan()
    dragging = false
    scene?.camera.setOrbitEnabled(true)
    return
  }
  pinch = false
  if (!isTouchLike(ev.pointerType) && ev.button === 0) {
    canvasEl.value?.setPointerCapture(ev.pointerId)
  }
  if (ev.button === 2) ev.preventDefault()
  if (!scene) return
  if (isTouchLike(ev.pointerType)) {
    scene.camera.setOrbitEnabled(false)
    updateHover(ev.clientX, ev.clientY)
    const shipHit = scene.pickShip(ev.clientX, ev.clientY)
    if (shipHit && hostileOnHex(game.state, shipHit.shipId)) {
      const id = shipHit.shipId
      longPressTimer = setTimeout(() => {
        longPressTimer = null
        tapConsumed = tryAttack(id)
      }, LONG_PRESS_MS)
    }
  } else if (ev.button === 0 && ui.threatShipId) {
    scene.camera.setOrbitEnabled(false)
  }
}

function onMove(ev: PointerEvent): void {
  if (!scene) return
  if (pinch || pointers.size >= 2) return
    const held =
      isTouchLike(ev.pointerType) || (ev.pointerType === 'mouse' && (ev.buttons & 1) === 1)
  if (held && pointers.has(ev.pointerId)) {
    const dist = Math.hypot(ev.clientX - downX, ev.clientY - downY)
    if (!dragging && dist > dragThreshold(ev.pointerType)) {
      dragging = true
      clearLongPress()
      scene.camera.setOrbitEnabled(false)
      scene.camera.beginPan(ev.clientX, ev.clientY)
      return
    }
    if (dragging) scene.camera.updatePan(ev.clientX, ev.clientY)
    return
  }
  if (ev.pointerType === 'mouse' && ev.buttons === 0) updateHover(ev.clientX, ev.clientY)
}

function onUp(ev: PointerEvent): void {
  if (!scene) return
  pointers.delete(ev.pointerId)
  const wasDrag = dragging
  const wasPinch = pinch
  if (pointers.size === 0) pinch = false
  clearLongPress()
  if (!isTouchLike(ev.pointerType) && ev.button === 0) {
    scene.camera.endPan()
    scene.camera.setOrbitEnabled(true)
    canvasEl.value?.releasePointerCapture(ev.pointerId)
  } else {
    scene.camera.endPan()
    if (pointers.size === 0) scene.camera.setOrbitEnabled(true)
  }
  dragging = false
  if (wasDrag || wasPinch || pointers.size > 0) return
  if (tapConsumed) {
    tapConsumed = false
    return
  }

  if (ev.button === 2) {
    ev.preventDefault()
    if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > dragThreshold(ev.pointerType)) return
    const shipHit = scene.pickShip(ev.clientX, ev.clientY)
    if (shipHit) tryAttack(shipHit.shipId)
    return
  }

  if (isTouchLike(ev.pointerType)) {
    const shipHit = scene.pickShip(ev.clientX, ev.clientY)
    if (shipHit && hostileOnHex(game.state, shipHit.shipId)) {
      if (isAttackConfirmTap(lastTapShip, shipHit.shipId, performance.now())) {
        tryAttack(shipHit.shipId)
        return
      }
      lastTapShip = { id: shipHit.shipId, at: performance.now() }
      ui.threatShipId = shipHit.shipId
      return
    }
    lastTapShip = null
  }

  handleTap(ev.clientX, ev.clientY)
}

function handleTap(clientX: number, clientY: number): void {
  if (!scene) return
  if (game.state.phase === 'TILE_PLACEMENT') {
    if (scene.pickPlacement(clientX, clientY)) {
      game.dispatch({ type: 'CONFIRM_TILE_PLACEMENT' })
    }
    return
  }

  const name = scene.pickPlanetName(clientX, clientY)
  if (name) {
    const key = coordKey(name)
    const inspectable = Boolean(game.state.planetMarkets[key] || isEvaHex(name))
    if (inspectable) {
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
  }

  const buy = scene.pickBuy(clientX, clientY)
  if (buy && game.state.phase === 'PLAYER_TURN') {
    const events = game.dispatch({ type: 'BUY_RESOURCE', coord: buy.coord, resource: buy.resource })
    if (events.some((event) => event.type === 'COMMAND_REJECTED' && event.reason === 'BUY_LIMIT')) {
      ui.flashNotice('OPERATION LIMIT REACHED')
    }
    return
  }

  const sell = scene.pickSell(clientX, clientY)
  if (sell && game.state.phase === 'PLAYER_TURN') {
    game.dispatch({ type: 'SELL_RESOURCE', resource: sell.resource })
    return
  }

  const hover = scene.pickHover(clientX, clientY)
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

  const shipHit = scene.pickShip(clientX, clientY)
  if (shipHit) {
    ui.inspectPlanet = null
    scene.camera.clearInspectLimits()
    ui.selectedShipId = shipHit.shipId
    ui.selectedTile = null
    return
  }

  const tile = scene.pickTile(clientX, clientY)
  ui.inspectPlanet = null
  scene.camera.clearInspectLimits()
  ui.selectedTile = tile
  ui.selectedShipId = null
}

onMounted(() => {
  if (!canvasEl.value) return
  try {
    scene = new SpaceScene(canvasEl.value)
  } catch (err) {
    bootError.value = err instanceof Error ? err.message : String(err)
    return
  }
  scene.camera.onBreakInspect = () => {
    ui.inspectPlanet = null
  }
  scene.preview.onRevealed = null
  resize()
  ui.selectedShipId = game.ship.id
  focusShip(game.ship.id)
  sync()
  window.addEventListener('resize', resize)
  window.visualViewport?.addEventListener('resize', resize)
  window.visualViewport?.addEventListener('scroll', resize)
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
  window.visualViewport?.removeEventListener('resize', resize)
  window.visualViewport?.removeEventListener('scroll', resize)
  clearLongPress()
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
    ui.threatShipId,
    ui.inspectPlanet,
    ui.showTileNames,
    ui.showMarketIcons,
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
    ui.threatShipId = null
    ui.inspectPlanet = null
  },
)

watch(
  () => ui.inspectPlanet,
  (coord) => {
    if (!scene) return
    if (coord) {
      ui.mapOverview = false
      const tile = game.state.board.tiles[coordKey(coord)]
      if (!tile) return
      scene.camera.inspectPlanet(coord, planetInspectTheta(tile.rotation))
      return
    }
    if (!ui.mapOverview) scene.camera.clearInspectLimits()
  },
)

watch(
  () => ui.mapOverview,
  (on) => {
    if (!scene) return
    if (on) {
      ui.inspectPlanet = null
      scene.camera.showBoardOverview(Object.values(game.state.board.tiles).map((tile) => tile.coord))
      return
    }
    if (scene.camera.isOverview) scene.camera.exitOverview()
  },
)
</script>

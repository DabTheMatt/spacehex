<template>
  <canvas ref="canvasEl" class="space-canvas" tabindex="0" @contextmenu.prevent />
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
const pointers = new Map<number, { x: number; y: number }>()

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
    probeAim: ui.probeAiming,
    graphicMode: ui.graphicMode,
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

function pinchPair(): [{ x: number; y: number }, { x: number; y: number }] | null {
  if (pointers.size < 2) return null
  const pts = [...pointers.values()]
  return [pts[0], pts[1]]
}

function blockSafariGesture(ev: Event): void {
  ev.preventDefault()
}

function onLeave(): void {
  if (dragging || pinch || pointers.size > 0) return
  ui.hover = null
  ui.threatShipId = null
  scene?.camera.setOrbitEnabled(true)
  setCursor('grab')
}

function onDown(ev: PointerEvent): void {
  pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
  downX = ev.clientX
  downY = ev.clientY
  dragging = false
  tapConsumed = false
  canvasEl.value?.focus()
  if (isTouchLike(ev.pointerType)) {
    ev.preventDefault()
    ev.stopImmediatePropagation()
  }
  const pair = pinchPair()
  if (pair && scene) {
    pinch = true
    clearLongPress()
    scene.camera.endPan()
    dragging = false
    scene.camera.beginPinch(pair[0], pair[1])
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
  if (isTouchLike(ev.pointerType)) ev.preventDefault()
  if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
  const pair = pinchPair()
  if (pinch && pair) {
    scene.camera.updatePinch(pair[0], pair[1])
    return
  }
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
  if (pointers.size < 2) {
    scene.camera.endPinch()
    pinch = false
  }
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
  if (wasPinch || pointers.size > 0) return
  if (tapConsumed) {
    tapConsumed = false
    return
  }
  if (wasDrag) {
    tryLaunchAimedProbe(ev.clientX, ev.clientY)
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

function tryLaunchAimedProbe(clientX: number, clientY: number): boolean {
  if (!scene || !ui.probeAiming || game.state.phase !== 'PLAYER_TURN') return false
  const hover = scene.pickHover(clientX, clientY)
  if (hover?.kind !== 'EXPLORE') return false
  ui.inspectPlanet = null
  scene.camera.clearInspectLimits()
  game.dispatch({ type: 'LAUNCH_PROBE', direction: hover.direction })
  ui.probeAiming = false
  ui.hover = null
  return true
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
  if (name && !ui.probeAiming) {
    const key = coordKey(name)
    if (game.state.board.tiles[key]) {
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

  const buyFuel = scene.pickFuel(clientX, clientY)
  if (buyFuel && game.state.phase === 'PLAYER_TURN' && !ui.probeAiming) {
    const events = game.dispatch({ type: 'BUY_FUEL', coord: buyFuel })
    if (events.some((event) => event.type === 'COMMAND_REJECTED' && event.reason === 'TANK_FULL')) {
      ui.flashNotice('FUEL TANK FULL')
    }
    return
  }

  if (scene.pickRepair(clientX, clientY) && game.state.phase === 'PLAYER_TURN' && !ui.probeAiming) {
    const events = game.dispatch({ type: 'REPAIR_HULL' })
    if (events.some((event) => event.type === 'COMMAND_REJECTED' && event.reason === 'HULL_FULL')) {
      ui.flashNotice('HULL FULL')
    }
    return
  }

  const buy = scene.pickBuy(clientX, clientY)
  if (buy && game.state.phase === 'PLAYER_TURN' && !ui.probeAiming) {
    const events = game.dispatch({ type: 'BUY_RESOURCE', coord: buy.coord, resource: buy.resource })
    if (events.some((event) => event.type === 'COMMAND_REJECTED' && event.reason === 'BUY_LIMIT')) {
      ui.flashNotice('OPERATION LIMIT REACHED')
    }
    return
  }

  const sell = scene.pickSell(clientX, clientY)
  if (sell && game.state.phase === 'PLAYER_TURN' && !ui.probeAiming) {
    game.dispatch({ type: 'SELL_RESOURCE', resource: sell.resource })
    return
  }

  const hover = scene.pickHover(clientX, clientY)
  if (hover && game.state.phase === 'PLAYER_TURN') {
    if (hover.kind === 'STAY') {
      if (ui.probeAiming) return
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
      if (tryLaunchAimedProbe(clientX, clientY)) return
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
  const el = canvasEl.value
  const pointerOpts: AddEventListenerOptions = { capture: true, passive: false }
  el.addEventListener('pointerdown', onDown, pointerOpts)
  el.addEventListener('pointermove', onMove, pointerOpts)
  el.addEventListener('pointerup', onUp, pointerOpts)
  el.addEventListener('pointercancel', onUp, pointerOpts)
  el.addEventListener('pointerleave', onLeave, pointerOpts)
  el.addEventListener('gesturestart', blockSafariGesture, { passive: false })
  el.addEventListener('gesturechange', blockSafariGesture, { passive: false })
  try {
    scene = new SpaceScene(el)
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
  const el = canvasEl.value
  if (el) {
    const pointerOpts: AddEventListenerOptions = { capture: true }
    el.removeEventListener('pointerdown', onDown, pointerOpts)
    el.removeEventListener('pointermove', onMove, pointerOpts)
    el.removeEventListener('pointerup', onUp, pointerOpts)
    el.removeEventListener('pointercancel', onUp, pointerOpts)
    el.removeEventListener('pointerleave', onLeave, pointerOpts)
    el.removeEventListener('gesturestart', blockSafariGesture)
    el.removeEventListener('gesturechange', blockSafariGesture)
  }
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
    if (events.some((event) => event.type === 'TURN_ENDED' || event.type === 'SHIP_MOVED')) {
      ui.inspectPlanet = null
      scene.camera.clearInspectLimits()
      if (events.some((event) => event.type === 'TURN_ENDED')) {
        scene.camera.panTo(game.ship.coord)
      }
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
    ui.probeAiming,
    ui.graphicMode,
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
  () => ui.shipFocusNonce,
  () => {
    if (!scene || !game.ship) return
    scene.camera.focusShip(game.ship.coord)
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

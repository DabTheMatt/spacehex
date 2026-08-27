<template>
  <footer class="command-bar">
    <ActionStrip />
    <section class="hud-pane hud-pane--planet">
      <div class="hud-pane__label muted">{{ paneLabel }}</div>
      <div v-if="stationName" class="hud-pane__id">{{ stationName }}</div>
      <div v-else class="hud-pane__empty muted">NONE</div>
      <div v-if="planetLots.length" class="hud-pane__lots">
        <span
          v-for="lot in planetLots"
          :key="lot.id"
          :class="['cargo', `cargo--${lot.id.toLowerCase()}`]"
        >
          {{ lot.text }}
        </span>
      </div>
      <div v-if="planetHint" class="command-bar__hint muted">{{ planetHint }}</div>
    </section>

    <section class="hud-pane hud-pane--ship">
      <div class="hud-pane__label muted">SHIP</div>
      <div class="hud-pane__id">{{ shipId }}</div>
      <div class="command-bar__params">
        <span class="hull-readout">
          <span class="muted">HULL</span>
          <span class="hull-pips" aria-hidden="true">
            <i
              v-for="i in hullPips"
              :key="i"
              :class="['hull-pip', { filled: hullPipFilled(i, game.ship.hull) }]"
            />
          </span>
          <span>{{ game.ship.hull }}</span>
        </span>
        <span v-for="row in shipParams" :key="row.label">
          <span class="muted">{{ row.label }}</span>
          {{ row.value }}
        </span>
      </div>
      <div v-if="cargoRows.length" class="command-bar__cargo">
        <span
          v-for="row in cargoRows"
          :key="row.id"
          :class="['cargo', `cargo--${row.id.toLowerCase()}`]"
        >
          {{ row.text }}
        </span>
      </div>
      <div v-else class="command-bar__cargo muted">HOLD EMPTY</div>
    </section>

    <div class="command-bar__end">
      <div v-if="mode === 'EXPLORE_ROTATION'" class="command-bar__rotate">
        <button type="button" class="action" @click="game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'LEFT' })">
          Q
        </button>
        <button type="button" class="action" @click="game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'RIGHT' })">
          E
        </button>
      </div>
      <button
        v-if="showEndTurn"
        type="button"
        class="action accent"
        @click="game.dispatch({ type: 'END_TURN' })"
      >
        END TURN
      </button>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import ActionStrip from './ActionStrip.vue'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'
import { commandMode } from '@/ui/commandMode'
import { coordKey } from '@/game/board/HexCoord'
import { SHIP_DEFINITIONS } from '@/game/definitions/ships'
import {
  CARGO_CAPACITY,
  cargoUsed,
  MAX_BUYS_PER_TURN,
  RESOURCE_IDS,
  RESOURCE_LABEL,
} from '@/game/definitions/resources'
import { shipsAt } from '@/game/rules/combat'
import { buyPrice, evaSellParts, formatSellParts, isEvaHex } from '@/game/rules/planetMarket'
import { canLaunchAnyProbe } from '@/game/rules/probes'
import { prefersCoarsePointer } from '@/ui/pointerInput'
import { hudPaneLabel } from '@/ui/sectorPane'
import { getTileDefinition } from '@/game/definitions/tiles'
import { hullPipCount, hullPipFilled } from '@/ui/hullPips'
import { FUEL_BUY_PRICE, FUEL_TANK, REPAIR_PRICE } from '@/game/definitions/constants'

const game = useGameStore()
const ui = useUiStore()

const mode = computed(() =>
  commandMode(game.state, { shipId: ui.selectedShipId, tile: ui.selectedTile }),
)

const planetCoord = computed(() => ui.inspectPlanet ?? game.ship?.coord ?? { q: 0, r: 0 })

const planet = computed(() => {
  const market = game.state.planetMarkets[coordKey(planetCoord.value)]
  return market ?? null
})

const stationName = computed(() => {
  if (planet.value) return planet.value.designation
  const tile = game.state.board.tiles[coordKey(planetCoord.value)]
  return tile?.designation ?? ''
})

const paneLabel = computed(() => {
  if (isEvaHex(planetCoord.value)) return 'STATION'
  const tile = game.state.board.tiles[coordKey(planetCoord.value)]
  return hudPaneLabel(tile ? getTileDefinition(tile.definitionId).type : undefined)
})

const planetLots = computed(() => {
  if (isEvaHex(planetCoord.value)) {
    const cargo = game.ship.cargo
    return [
      ...RESOURCE_IDS.map((id) => ({
        id,
        text: `${RESOURCE_LABEL[id]} ×${cargo[id]}  ${formatSellParts(evaSellParts(game.state, id))}`,
      })),
      { id: 'FUEL' as const, text: `FUEL  ${FUEL_BUY_PRICE}CR  ${game.player.fuel}/${FUEL_TANK}` },
      { id: 'REPAIR' as const, text: `REPAIR  ${REPAIR_PRICE}CR` },
    ]
  }
  const market = planet.value
  if (!market) return []
  return [
    ...market.lots.map((lot) => ({
      id: lot.id,
      text: `${RESOURCE_LABEL[lot.id]} ×${lot.amount}  ${buyPrice(game.state, lot.id)}CR`,
    })),
    { id: 'FUEL' as const, text: `FUEL  ${FUEL_BUY_PRICE}CR  ${game.player.fuel}/${FUEL_TANK}` },
  ]
})

const planetHint = computed(() => {
  if (ui.probeAiming) return prefersCoarsePointer() ? 'TAP EMPTY HEX TO LAUNCH' : 'CLICK EMPTY HEX TO LAUNCH'
  if (mode.value === 'EXPLORE_ROTATION') return prefersCoarsePointer() ? 'TAP HEX TO PLACE' : 'Q / E  ROTATE'
  const others = shipsAt(game.state, game.ship.coord).filter((item) => item.id !== game.ship.id)
  if (others.length && others.some((item) => item.hull > 0)) {
    if ((game.player.attacksThisTurn ?? 0) >= 1) return 'ATTACK USED THIS TURN'
    return prefersCoarsePointer() ? 'HOLD OR TAP ENEMY TO ATTACK' : 'RIGHT-CLICK ENEMY TO ATTACK'
  }
  if (isEvaHex(planetCoord.value)) {
    const here = isEvaHex(game.ship.coord)
    if (!here) return 'DOCK TO SELL'
    return 'CLICK CONTAINER TO SELL'
  }
  if (!planet.value) return ''
  const coord = planetCoord.value
  const here = game.ship.coord.q === coord.q && game.ship.coord.r === coord.r
  const left = MAX_BUYS_PER_TURN - (game.player.buysThisTurn ?? 0)
  if (!here) return 'DOCK TO BUY'
  if (left <= 0) return 'BUY LIMIT  ·  2 PER TURN'
  return `CLICK PRICE TO BUY  ·  ${left} / ${MAX_BUYS_PER_TURN}`
})

const shipId = computed(() => {
  const ship = game.ship
  const n = ship.playerId.replace(/\D/g, '') || '1'
  const id = `${SHIP_DEFINITIONS[ship.class].id} / SG-${n}`
  return ship.hull <= 0 ? `${id}  DESTROYED` : id
})

const hullPips = computed(() => hullPipCount(game.ship.maxHull))

const shipParams = computed(() => {
  const ship = game.ship
  const player = game.player
  return [
    { label: 'ATK', value: pad(SHIP_DEFINITIONS[ship.class].attack) },
    { label: 'FUEL', value: pad(player.fuel) },
    { label: 'CR', value: pad(player.credits) },
    { label: 'HOLD', value: `${cargoUsed(ship.cargo)}/${CARGO_CAPACITY[ship.class]}` },
    { label: 'PROBES', value: pad(ship.probes ?? 0) },
    { label: 'GLORY', value: pad(player.glory) },
  ]
})

const cargoRows = computed(() => {
  const ship = game.ship
  if (!ship) return []
  return RESOURCE_IDS.filter((id) => ship.cargo[id] > 0).map((id) => ({
    id,
    text: `${RESOURCE_LABEL[id]} ×${ship.cargo[id]}  ${formatSellParts(evaSellParts(game.state, id))}`,
  }))
})

const showEndTurn = computed(
  () =>
    game.state.phase !== 'TILE_PLACEMENT' &&
    (game.state.movementSpent || (game.player.attacksThisTurn ?? 0) > 0),
)

const showProbe = computed(
  () => game.state.phase === 'PLAYER_TURN' && !game.state.movementSpent && canLaunchAnyProbe(game.state),
)

watch(showProbe, (ok) => {
  if (!ok) ui.probeAiming = false
})

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
</script>

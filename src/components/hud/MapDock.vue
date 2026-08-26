<template>
  <div class="map-dock">
    <div class="map-dock__filters">
      <button
        type="button"
        class="map-filter"
        :class="{ on: ui.showTileNames }"
        @click="ui.showTileNames = !ui.showTileNames"
      >
        NAMES
      </button>
      <button
        type="button"
        class="map-filter"
        :class="{ on: ui.showMarketIcons }"
        @click="ui.showMarketIcons = !ui.showMarketIcons"
      >
        MARKETS
      </button>
    </div>
    <button
      type="button"
      class="map-btn"
      :class="{ on: ui.mapOverview }"
      title="Board map"
      @click="toggleMap"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <polygon
          points="16,3 28,10 28,22 16,29 4,22 4,10"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
        />
        <polygon points="16,9 22,12.5 22,19.5 16,23 10,19.5 10,12.5" fill="currentColor" opacity="0.35" />
      </svg>
    </button>
    <button type="button" class="map-btn" title="Focus ship" @click="focusShip">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M6 10 V6 H10 M22 6 H26 V10 M26 22 V26 H22 M10 26 H6 V22"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="square"
        />
        <polygon points="16,11 20,21 16,19 12,21" fill="currentColor" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from '@/stores/uiStore'

const ui = useUiStore()

function toggleMap(): void {
  ui.mapOverview = !ui.mapOverview
}

function focusShip(): void {
  ui.mapOverview = false
  ui.inspectPlanet = null
  ui.shipFocusNonce += 1
}
</script>

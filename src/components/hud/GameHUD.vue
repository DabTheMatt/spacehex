<template>
  <div class="game-hud">
    <GlobalStatus />
    <div class="phase-banner" aria-live="polite">{{ phaseBanner }}</div>
    <EventLog />
    <div v-if="ui.notice" class="hud-notice">{{ ui.notice }}</div>
    <MapDock />
    <CommandBar />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GlobalStatus from './GlobalStatus.vue'
import CommandBar from './CommandBar.vue'
import MapDock from './MapDock.vue'
import EventLog from './EventLog.vue'
import { useUiStore } from '@/stores/uiStore'
import { useGameStore } from '@/stores/gameStore'
import { turnBannerText } from '@/ui/turnBanner'

const ui = useUiStore()
const game = useGameStore()
const phaseBanner = computed(() => turnBannerText(game.state))
</script>

<template>
  <div class="game-hud">
    <GlobalStatus />
    <EventLog />
    <div v-if="ui.notice" class="hud-notice">{{ ui.notice }}</div>
    <MapDock />
    <CommandBar />
  </div>
</template>

<script setup lang="ts">
import GlobalStatus from './GlobalStatus.vue'
import CommandBar from './CommandBar.vue'
import MapDock from './MapDock.vue'
import EventLog from './EventLog.vue'
import { useUiStore } from '@/stores/uiStore'

const ui = useUiStore()
</script>

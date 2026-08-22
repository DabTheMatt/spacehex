<template>
  <div class="game-hud">
    <GlobalStatus />
    <div v-if="ui.notice" class="hud-notice">{{ ui.notice }}</div>
    <CommandBar />
  </div>
</template>

<script setup lang="ts">
import GlobalStatus from './GlobalStatus.vue'
import CommandBar from './CommandBar.vue'
import { useUiStore } from '@/stores/uiStore'

const ui = useUiStore()
</script>

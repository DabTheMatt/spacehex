<template>
  <svg class="cargo-icon" viewBox="0 0 16 16" aria-hidden="true">
    <g v-if="kind === 'ORE'" fill="none" stroke="currentColor" stroke-width="1.15">
      <path d="M3.2 6.2 8 3.4 12.8 6.2v4.6L8 13.6 3.2 10.8Z" />
      <path d="M3.2 6.2 8 8.8l4.8-2.6" />
      <path d="M8 8.8v4.8" />
    </g>
    <g v-else-if="kind === 'BIOMASS'" fill="none" stroke="currentColor" stroke-width="1.15">
      <path d="M8 2.4 13.2 13.2H2.8Z" />
      <path d="M8 6.2v7" />
    </g>
    <g v-else-if="kind === 'ICE'" fill="none" stroke="currentColor" stroke-width="1.15">
      <circle cx="8" cy="8" r="5.2" />
      <path d="M8 3.4v9.2M3.6 8h8.8" />
    </g>
    <g v-else fill="none" stroke="currentColor" stroke-width="1.15">
      <path d="M4.4 4.2h7.2v7.6H4.4Z" />
      <path d="M4.4 4.2a3.6 1.4 0 0 0 7.2 0" />
      <path d="M4.4 11.8a3.6 1.4 0 0 0 7.2 0" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import type { CargoKind } from '@/game/definitions/cargoFigures'

defineProps<{ kind: CargoKind | string }>()
</script>

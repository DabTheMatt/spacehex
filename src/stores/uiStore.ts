import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HexCoord } from '@/game/board/HexCoord'

export const useUiStore = defineStore('ui', () => {
  const showDebug = ref(false)
  const showCoords = ref(false)
  const showEdges = ref(false)
  const showDev = ref(false)
  const seedInput = ref('spacehex-v0.1')
  const selectedTile = ref<HexCoord | null>(null)

  const selectedShipId = ref<string | null>('mewa-1')

  return { showDebug, showCoords, showEdges, showDev, seedInput, selectedTile, selectedShipId }
})

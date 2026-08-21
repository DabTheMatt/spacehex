import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HexCoord } from '@/game/board/HexCoord'

export const useUiStore = defineStore('ui', () => {
  const showDebug = ref(false)
  const showCoords = ref(false)
  const showEdges = ref(false)
  const showDev = ref(true)
  const seedInput = ref('spacehex-v0.1')
  const selectedTile = ref<HexCoord | null>(null)

  return { showDebug, showCoords, showEdges, showDev, seedInput, selectedTile }
})

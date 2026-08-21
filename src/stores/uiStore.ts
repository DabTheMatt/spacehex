import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const showDebug = ref(false)
  const showCoords = ref(false)
  const showEdges = ref(false)
  const showDev = ref(true)
  const seedInput = ref('spacehex-v0.1')

  return { showDebug, showCoords, showEdges, showDev, seedInput }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HexCoord } from '@/game/board/HexCoord'
import type { BoardHover } from '@/ui/boardHover'
import {
  type GraphicMode,
  readStoredGraphicMode,
  writeStoredGraphicMode,
} from '@/renderer/graphicMode'
import { isSoundEnabled, playToggleCue, setSoundEnabled } from '@/ui/sound'

export const useUiStore = defineStore('ui', () => {
  const showDebug = ref(false)
  const showCoords = ref(false)
  const showEdges = ref(false)
  const showDev = ref(false)
  const seedInput = ref('spacehex-v0.1')
  const selectedTile = ref<HexCoord | null>(null)

  const selectedShipId = ref<string | null>('mewa-1')
  const hover = ref<BoardHover | null>(null)
  const threatShipId = ref<string | null>(null)
  const hoverRotation = ref(0)
  const inspectPlanet = ref<HexCoord | null>(null)
  const mapOverview = ref(false)
  const shipFocusNonce = ref(0)
  const showTileNames = ref(true)
  const showMarketIcons = ref(true)
  const notice = ref<string | null>(null)
  const probeAiming = ref(false)
  const graphicMode = ref<GraphicMode>(readStoredGraphicMode())
  const soundEnabled = ref(isSoundEnabled())
  let noticeTimer: ReturnType<typeof setTimeout> | null = null

  function flashNotice(text: string, ms = 2800): void {
    notice.value = text
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => {
      notice.value = null
      noticeTimer = null
    }, ms)
  }

  function setGraphicMode(mode: GraphicMode): void {
    graphicMode.value = mode
    writeStoredGraphicMode(mode)
  }

  function toggleSound(): void {
    const next = !soundEnabled.value
    soundEnabled.value = next
    setSoundEnabled(next)
    playToggleCue(next)
  }

  return {
    showDebug,
    showCoords,
    showEdges,
    showDev,
    seedInput,
    selectedTile,
    selectedShipId,
    hover,
    threatShipId,
    hoverRotation,
    inspectPlanet,
    mapOverview,
    shipFocusNonce,
    showTileNames,
    showMarketIcons,
    notice,
    probeAiming,
    graphicMode,
    soundEnabled,
    flashNotice,
    setGraphicMode,
    toggleSound,
  }
})

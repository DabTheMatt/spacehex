import { onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'
import { actionHotkey, isTypingTarget } from './actionHotkeys'

export function useGameHotkeys(): void {
  const game = useGameStore()
  const ui = useUiStore()

  function onKey(ev: KeyboardEvent): void {
    if (ev.repeat || isTypingTarget(ev.target)) return

    if (game.state.phase === 'TILE_PLACEMENT') {
      if (ev.code === 'KeyQ') {
        ev.preventDefault()
        game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'LEFT' })
        return
      }
      if (ev.code === 'KeyE') {
        ev.preventDefault()
        game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'RIGHT' })
        return
      }
      return
    }

    if (ev.key === 'Escape') {
      ev.preventDefault()
      if (ui.inspectPlanet) {
        ui.inspectPlanet = null
        return
      }
      game.dispatch({ type: 'CANCEL_SELECTION' })
      return
    }

    const action = actionHotkey(ev.code)
    if (!action) return
    ev.preventDefault()
    if (
      action === 'END_TURN' &&
      (game.state.movementSpent || (game.player.attacksThisTurn ?? 0) > 0)
    ) {
      game.dispatch({ type: 'END_TURN' })
    }
  }

  onMounted(() => window.addEventListener('keydown', onKey, true))
  onUnmounted(() => window.removeEventListener('keydown', onKey, true))
}

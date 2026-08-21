import { onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { actionHotkey, isTypingTarget } from './actionHotkeys'

export function useGameHotkeys(): void {
  const game = useGameStore()

  function onKey(ev: KeyboardEvent): void {
    if (ev.repeat || isTypingTarget(ev.target)) return

    if (game.state.phase === 'TILE_PLACEMENT') {
      const key = ev.key.toLowerCase()
      if (ev.code === 'KeyQ' || key === 'q') {
        ev.preventDefault()
        game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'LEFT' })
        return
      }
      if (ev.code === 'KeyE' || ev.code === 'KeyR' || key === 'e' || key === 'r') {
        ev.preventDefault()
        game.dispatch({ type: 'ROTATE_PENDING_TILE', direction: 'RIGHT' })
        return
      }
      if (ev.code === 'KeyF' || ev.key === 'Enter') {
        ev.preventDefault()
        game.dispatch({ type: 'CONFIRM_TILE_PLACEMENT' })
      }
      return
    }

    if (ev.key === 'Escape') {
      ev.preventDefault()
      game.dispatch({ type: 'CANCEL_SELECTION' })
      return
    }

    const action = actionHotkey(ev.code)
    if (!action) return
    ev.preventDefault()
    if (action === 'MOVE') {
      if (game.state.movementSpent) game.dispatch({ type: 'END_TURN' })
      else game.dispatch({ type: 'BEGIN_MOVE' })
      return
    }
    if (action === 'EXPLORE') {
      game.dispatch({ type: 'BEGIN_EXPLORATION' })
      return
    }
    game.dispatch({ type: 'SKIP_MOVEMENT' })
  }

  onMounted(() => window.addEventListener('keydown', onKey, true))
  onUnmounted(() => window.removeEventListener('keydown', onKey, true))
}

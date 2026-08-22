import type { GameState } from '@/game/state/GameState'
import type { HexCoord } from '@/game/board/HexCoord'

export type CommandMode =
  | 'IDLE'
  | 'OBJECT_SELECTED'
  | 'MOVE_TARGETING'
  | 'EXPLORE_EDGE_SELECTION'
  | 'EXPLORE_ROTATION'

export function commandMode(
  state: GameState,
  selection: { shipId: string | null; tile: HexCoord | null },
): CommandMode {
  if (state.phase === 'TILE_PLACEMENT') return 'EXPLORE_ROTATION'
  if (state.exploration.status === 'SELECTING_MOVE') return 'MOVE_TARGETING'
  if (state.exploration.status === 'SELECTING_DIRECTION') return 'EXPLORE_EDGE_SELECTION'
  if (selection.shipId || selection.tile) return 'OBJECT_SELECTED'
  return 'IDLE'
}

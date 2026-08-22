import type { HexCoord } from '@/game/board/HexCoord'

export type BoardHover =
  | { kind: 'EXPLORE'; coord: HexCoord; direction: number }
  | { kind: 'MOVE'; coord: HexCoord; direction: number }
  | { kind: 'STAY'; coord: HexCoord }

export function hoverKey(hover: BoardHover | null): string | null {
  if (!hover) return null
  return `${hover.coord.q},${hover.coord.r}`
}

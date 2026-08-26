import type { TileType } from '@/game/board/tileRotation'

export function hudPaneLabel(type: TileType | undefined): 'STATION' | 'PLANET' | 'SECTOR' {
  if (!type || type === 'EVA_1') return 'STATION'
  if (type === 'PLANET_LARGE' || type === 'PLANET_MEDIUM' || type === 'PLANET_SMALL') return 'PLANET'
  return 'SECTOR'
}

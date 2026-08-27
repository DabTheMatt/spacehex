import type { TileType } from '../board/tileRotation'

/** Hexes where a ship can tank — stay does not spend a fuel cell. */
export const REFUEL_TILE_TYPES: readonly TileType[] = [
  'EVA_1',
  'PLANET_LARGE',
  'PLANET_MEDIUM',
  'PLANET_SMALL',
  'WRECK_TANKER',
]

export function isRefuelTileType(type: TileType): boolean {
  return (REFUEL_TILE_TYPES as readonly string[]).includes(type)
}

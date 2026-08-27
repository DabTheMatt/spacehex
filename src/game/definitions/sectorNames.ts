import type { TileType } from '../board/tileRotation'
import { RNG } from '../random/RNG'
import { GREEK_LETTERS, LATIN_LETTERS } from './resources'

export const TILE_TYPE_ABBR: Record<TileType, string> = {
  EVA_1: 'eva',
  VOID: 'v',
  PLANET_LARGE: 'lp',
  PLANET_MEDIUM: 'mp',
  PLANET_SMALL: 'sp',
  ASTEROID: 'a',
  SHADOW_BASE: 'sb',
  WRECK_TANKER: 'wt',
  WRECK_TRANSPORT: 'wr',
  BLACK_HOLE: 'bh',
  VORTEX: 'vx',
  SPACE_GATE: 'gt',
  STRAIT: 'st',
}

export function discovererSlot(playerId: string | null | undefined): 1 | 2 {
  return playerId === 'player-2' ? 2 : 1
}

export function rollSectorName(
  seed: string,
  tileId: string,
  type: TileType,
  discovererId: string | null,
): string {
  if (type === 'EVA_1') return 'EVA-1 Space Station'
  const rng = new RNG(`${seed}:name:${tileId}`)
  const greek = GREEK_LETTERS[rng.nextInt(GREEK_LETTERS.length)]
  const latin = LATIN_LETTERS[rng.nextInt(LATIN_LETTERS.length)]
  const slot = discovererSlot(discovererId)
  const abbr = TILE_TYPE_ABBR[type]
  if (type === 'PLANET_LARGE') return `SG${slot}-3-${greek}-${latin}-${abbr}`
  if (type === 'PLANET_MEDIUM') return `SG${slot}-2-${greek}-${latin}-${abbr}`
  if (type === 'PLANET_SMALL') return `SG${slot}-1-${greek}-${latin}-${abbr}`
  return `SG${slot}-${greek}-${latin}-${abbr}`
}

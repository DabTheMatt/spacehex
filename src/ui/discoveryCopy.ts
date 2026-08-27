import type { TileType } from '@/game/board/tileRotation'
import { getTileDefinition } from '@/game/definitions/tiles'

export function discoveryNoun(tileId: string): string {
  return discoveryNounForType(getTileDefinition(tileId).type)
}

export function discoveryNounForType(type: TileType): string {
  switch (type) {
    case 'VOID':
      return 'a void sector'
    case 'PLANET_LARGE':
      return 'a large planet'
    case 'PLANET_MEDIUM':
      return 'a medium planet'
    case 'PLANET_SMALL':
      return 'a small planet'
    case 'ASTEROID':
      return 'an asteroid field'
    case 'VORTEX':
      return 'a cosmic vortex'
    case 'SPACE_GATE':
      return 'a space gate'
    case 'STRAIT':
      return 'a strait'
    case 'SHADOW_BASE':
      return 'a Shadow Base'
    case 'WRECK_TANKER':
      return 'a drifting tanker'
    case 'WRECK_TRANSPORT':
      return 'a wrecked transport'
    case 'BLACK_HOLE':
      return 'a black hole'
    case 'EVA_1':
      return 'EVA-1'
    default:
      return 'a sector'
  }
}

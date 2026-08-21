import type { TileDefinition } from '../board/tileRotation'

const OPEN6 = ['OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN'] as const

function def(
  id: string,
  type: TileDefinition['type'],
  label: string,
  symbol: string,
  edges: TileDefinition['edges'] = [...OPEN6],
): TileDefinition {
  return { id, type, label, symbol, edges }
}

/** Physical exploration tiles — unique ids, shuffled into the deck. EVA-1 is not in the deck. */
export const TILE_DEFINITIONS: Record<string, TileDefinition> = {
  'eva-1': def('eva-1', 'EVA_1', 'EVA-1', 'EVA'),

  'void-1': def('void-1', 'VOID', 'Pustka', '+'),
  'void-2': def('void-2', 'VOID', 'Pustka', '+'),
  'void-3': def('void-3', 'VOID', 'Pustka', '+'),
  'void-4': def('void-4', 'VOID', 'Pustka', '+'),
  'void-5': def('void-5', 'VOID', 'Pustka', '+'),

  'planet-large-1': def('planet-large-1', 'PLANET_LARGE', 'Planeta duża', '○L'),
  'planet-large-2': def('planet-large-2', 'PLANET_LARGE', 'Planeta duża', '○L'),
  'planet-large-3': def('planet-large-3', 'PLANET_LARGE', 'Planeta duża', '○L'),

  'planet-medium-1': def('planet-medium-1', 'PLANET_MEDIUM', 'Planeta średnia', '○'),
  'planet-medium-2': def('planet-medium-2', 'PLANET_MEDIUM', 'Planeta średnia', '○'),
  'planet-medium-3': def('planet-medium-3', 'PLANET_MEDIUM', 'Planeta średnia', '○'),
  'planet-medium-4': def('planet-medium-4', 'PLANET_MEDIUM', 'Planeta średnia', '○'),

  'planet-small-1': def('planet-small-1', 'PLANET_SMALL', 'Planeta mała', 'o'),
  'planet-small-2': def('planet-small-2', 'PLANET_SMALL', 'Planeta mała', 'o'),
  'planet-small-3': def('planet-small-3', 'PLANET_SMALL', 'Planeta mała', 'o'),
  'planet-small-4': def('planet-small-4', 'PLANET_SMALL', 'Planeta mała', 'o'),
  'planet-small-5': def('planet-small-5', 'PLANET_SMALL', 'Planeta mała', 'o'),

  'asteroid-1': def('asteroid-1', 'ASTEROID', 'Asteroidy', '•••', [
    'ASTEROID',
    'OPEN',
    'ASTEROID',
    'OPEN',
    'ASTEROID',
    'OPEN',
  ]),
  'asteroid-2': def('asteroid-2', 'ASTEROID', 'Asteroidy', '•••', [
    'OPEN',
    'ASTEROID',
    'OPEN',
    'ASTEROID',
    'OPEN',
    'ASTEROID',
  ]),
  'asteroid-3': def('asteroid-3', 'ASTEROID', 'Asteroidy', '•••', [
    'ASTEROID',
    'ASTEROID',
    'OPEN',
    'OPEN',
    'OPEN',
    'OPEN',
  ]),

  'shadow-base-1': def('shadow-base-1', 'SHADOW_BASE', 'Baza Cieni', '□', [
    'GATE',
    'OPEN',
    'OPEN',
    'GATE',
    'OPEN',
    'OPEN',
  ]),

  'wreck-tanker-1': def('wreck-tanker-1', 'WRECK_TANKER', 'Dryfujący tankowiec', '⊏'),
  'wreck-transport-1': def(
    'wreck-transport-1',
    'WRECK_TRANSPORT',
    'Rozbity transportowiec',
    '⊐',
  ),

  'black-hole-1': def('black-hole-1', 'BLACK_HOLE', 'Czarna dziura', '●', [
    'SPECIAL',
    'SPECIAL',
    'SPECIAL',
    'SPECIAL',
    'SPECIAL',
    'SPECIAL',
  ]),
}

export const EXPLORATION_TILE_IDS: string[] = Object.keys(TILE_DEFINITIONS).filter(
  (id) => id !== 'eva-1',
)

export const EVA_TILE_ID = 'eva-1'

export function getTileDefinition(id: string): TileDefinition {
  const defn = TILE_DEFINITIONS[id]
  if (!defn) {
    throw new Error(`Unknown tile definition: ${id}`)
  }
  return defn
}

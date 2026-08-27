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

  'void-1': def('void-1', 'VOID', 'Void', '+'),
  'void-2': def('void-2', 'VOID', 'Void', '+'),
  'void-3': def('void-3', 'VOID', 'Void', '+'),
  'void-4': def('void-4', 'VOID', 'Void', '+'),
  'void-5': def('void-5', 'VOID', 'Void', '+'),

  'planet-large-1': def('planet-large-1', 'PLANET_LARGE', 'Large Planet', '○L'),
  'planet-large-2': def('planet-large-2', 'PLANET_LARGE', 'Large Planet', '○L'),
  'planet-large-3': def('planet-large-3', 'PLANET_LARGE', 'Large Planet', '○L'),

  'planet-medium-1': def('planet-medium-1', 'PLANET_MEDIUM', 'Medium Planet', '○'),
  'planet-medium-2': def('planet-medium-2', 'PLANET_MEDIUM', 'Medium Planet', '○'),
  'planet-medium-3': def('planet-medium-3', 'PLANET_MEDIUM', 'Medium Planet', '○'),
  'planet-medium-4': def('planet-medium-4', 'PLANET_MEDIUM', 'Medium Planet', '○'),

  'planet-small-1': def('planet-small-1', 'PLANET_SMALL', 'Small Planet', 'o'),
  'planet-small-2': def('planet-small-2', 'PLANET_SMALL', 'Small Planet', 'o'),
  'planet-small-3': def('planet-small-3', 'PLANET_SMALL', 'Small Planet', 'o'),
  'planet-small-4': def('planet-small-4', 'PLANET_SMALL', 'Small Planet', 'o'),
  'planet-small-5': def('planet-small-5', 'PLANET_SMALL', 'Small Planet', 'o'),

  'asteroid-1': def('asteroid-1', 'ASTEROID', 'Asteroids', '•••', [
    'ASTEROID',
    'OPEN',
    'ASTEROID',
    'OPEN',
    'ASTEROID',
    'OPEN',
  ]),
  'asteroid-2': def('asteroid-2', 'ASTEROID', 'Asteroids', '•••', [
    'OPEN',
    'ASTEROID',
    'OPEN',
    'ASTEROID',
    'OPEN',
    'ASTEROID',
  ]),
  'asteroid-3': def('asteroid-3', 'ASTEROID', 'Asteroids', '•••', [
    'ASTEROID',
    'ASTEROID',
    'OPEN',
    'OPEN',
    'OPEN',
    'OPEN',
  ]),

  'shadow-base-1': def('shadow-base-1', 'SHADOW_BASE', 'Shadow Base', '□', [
    'GATE',
    'OPEN',
    'OPEN',
    'GATE',
    'OPEN',
    'OPEN',
  ]),

  'wreck-tanker-1': def('wreck-tanker-1', 'WRECK_TANKER', 'Drifting Tanker', '⊏'),
  'wreck-transport-1': def(
    'wreck-transport-1',
    'WRECK_TRANSPORT',
    'Wrecked Transport',
    '⊐',
  ),

  'black-hole-1': def('black-hole-1', 'BLACK_HOLE', 'Black Hole', '●', [
    'SPECIAL',
    'SPECIAL',
    'SPECIAL',
    'SPECIAL',
    'SPECIAL',
    'SPECIAL',
  ]),

  'vortex-1': def('vortex-1', 'VORTEX', 'Cosmic Vortex', '↯'),

  'space-gate-1': def('space-gate-1', 'SPACE_GATE', 'Space Gate', '⬡', [
    'GATE',
    'GATE',
    'GATE',
    'GATE',
    'GATE',
    'GATE',
  ]),

  'strait-1': def('strait-1', 'STRAIT', 'Strait', '═', [
    'OPEN',
    'BLOCKED',
    'BLOCKED',
    'OPEN',
    'BLOCKED',
    'BLOCKED',
  ]),
  'strait-2': def('strait-2', 'STRAIT', 'Strait', '═', [
    'OPEN',
    'BLOCKED',
    'BLOCKED',
    'OPEN',
    'BLOCKED',
    'BLOCKED',
  ]),
  'strait-3': def('strait-3', 'STRAIT', 'Strait', '═', [
    'OPEN',
    'BLOCKED',
    'BLOCKED',
    'OPEN',
    'BLOCKED',
    'BLOCKED',
  ]),
}

export const EXPLORATION_TILE_IDS: string[] = Object.keys(TILE_DEFINITIONS).filter(
  (id) => id !== 'eva-1',
)

export const EVA_TILE_ID = 'eva-1'

export function asteroidEdgeCount(edges: readonly string[]): number {
  return edges.filter((edge) => edge === 'ASTEROID').length
}

/** Printed collision chance from asteroid edges / 6. */
export function asteroidCollisionPercent(edges: readonly string[]): number {
  return Math.round((asteroidEdgeCount(edges) / 6) * 100)
}

export function getTileDefinition(id: string): TileDefinition {
  const defn = TILE_DEFINITIONS[id]
  if (!defn) {
    throw new Error(`Unknown tile definition: ${id}`)
  }
  return defn
}

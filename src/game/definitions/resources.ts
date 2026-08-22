import type { ShipClass } from './ships'
import type { TileType } from '../board/tileRotation'

/**
 * TODO RULE CLARIFICATION T7 — prowizoryczna ekonomia planet, żeby odkrycie
 * sektora i ładownia były grywalne. Kwoty / ceny / ładowność do doprecyzowania.
 */
export const RESOURCE_IDS = ['ORE', 'ICE', 'RARE'] as const
export type ResourceId = (typeof RESOURCE_IDS)[number]

export interface ResourceLot {
  id: ResourceId
  amount: number
  price: number
}

export interface PlanetMarket {
  tileId: string
  lots: ResourceLot[]
}

export const RESOURCE_LABEL: Record<ResourceId, string> = {
  ORE: 'ORE',
  ICE: 'ICE',
  RARE: 'RARE',
}

export const RESOURCE_PRICE: Record<ResourceId, number> = {
  ORE: 2,
  ICE: 3,
  RARE: 4,
}

export const STARTING_CREDITS = 10

export const CARGO_CAPACITY: Record<ShipClass, number> = {
  MEWA: 4,
  CIERN: 3,
  DRZAZGA: 2,
}

export function emptyCargo(): Record<ResourceId, number> {
  return { ORE: 0, ICE: 0, RARE: 0 }
}

export function cargoUsed(cargo: Record<ResourceId, number>): number {
  return RESOURCE_IDS.reduce((sum, id) => sum + cargo[id], 0)
}

export function planetBudget(type: TileType): { units: number; kinds: number } | null {
  if (type === 'PLANET_LARGE') return { units: 5, kinds: 3 }
  if (type === 'PLANET_MEDIUM') return { units: 3, kinds: 2 }
  if (type === 'PLANET_SMALL') return { units: 2, kinds: 1 }
  return null
}

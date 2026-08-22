import type { ShipClass } from './ships'
import type { TileType } from '../board/tileRotation'

/** Container types. Board colors: ore red, biomass green, ice blue. */
export const RESOURCE_IDS = ['ORE', 'BIOMASS', 'ICE'] as const
export type ResourceId = (typeof RESOURCE_IDS)[number]

export interface ResourceLot {
  id: ResourceId
  amount: number
}

export interface PlanetMarket {
  tileId: string
  designation: string
  lots: ResourceLot[]
  /** Colors this planet produced when discovered — homeworlds for transport margin. */
  homeColors: ResourceId[]
}

export const RESOURCE_LABEL: Record<ResourceId, string> = {
  ORE: 'ORE',
  BIOMASS: 'BIOMASS',
  ICE: 'ICE',
}

export const STARTING_CREDITS = 10

export const CARGO_CAPACITY: Record<ShipClass, number> = {
  MEWA: 4,
  CIERN: 3,
  DRZAZGA: 2,
}

/** Max containers bought and loaded onto the ship per player turn. */
export const MAX_BUYS_PER_TURN = 2

/** Max drifting containers salvaged per player turn (pickup not in v0.1). */
export const MAX_SALVAGE_PER_TURN = 3

export const GREEK_LETTERS = [
  'Α',
  'Β',
  'Γ',
  'Δ',
  'Ε',
  'Ζ',
  'Η',
  'Θ',
  'Ι',
  'Κ',
  'Λ',
  'Μ',
  'Ν',
  'Ξ',
  'Ο',
  'Π',
  'Ρ',
  'Σ',
  'Τ',
  'Υ',
  'Φ',
  'Χ',
  'Ψ',
  'Ω',
] as const

export const LATIN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function emptyCargo(): Record<ResourceId, number> {
  return { ORE: 0, BIOMASS: 0, ICE: 0 }
}

export function cargoUsed(cargo: Record<ResourceId, number>): number {
  return RESOURCE_IDS.reduce((sum, id) => sum + cargo[id], 0)
}

/** Size code in the planet designation: large 3, medium 2, small 1. */
export function planetSizeCode(type: TileType): 1 | 2 | 3 | null {
  if (type === 'PLANET_LARGE') return 3
  if (type === 'PLANET_MEDIUM') return 2
  if (type === 'PLANET_SMALL') return 1
  return null
}

/**
 * Spot price from containers of that color still on the board (planets),
 * not including cargo in ships.
 */
export function priceFromSupply(available: number): number {
  if (available <= 0) return 10
  if (available === 1) return 6
  if (available === 2) return 5
  if (available === 3) return 4
  if (available === 4) return 3
  if (available === 5) return 2
  return 1
}

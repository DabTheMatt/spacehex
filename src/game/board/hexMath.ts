import type { HexCoord } from './HexCoord'
import { coordKey } from './HexCoord'

/**
 * Flat-top axial directions, index 0 = east (+q).
 * Order is CCW, matching Three.js +Y rotation.
 */
export const AXIAL_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export function getNeighbor(coord: HexCoord, direction: number): HexCoord {
  const dir = AXIAL_DIRECTIONS[((direction % 6) + 6) % 6]
  return { q: coord.q + dir.q, r: coord.r + dir.r }
}

export function getNeighbors(coord: HexCoord): HexCoord[] {
  return AXIAL_DIRECTIONS.map((d) => ({ q: coord.q + d.q, r: coord.r + d.r }))
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const aq = a.q
  const ar = a.r
  const as = -aq - ar
  const bq = b.q
  const br = b.r
  const bs = -bq - br
  return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(as - bs))
}

/** Center-to-vertex radius used for layout and mesh. */
export const HEX_SIZE = 1

/**
 * World XZ for flat-top axial (Y up in Three.js).
 * x east, z south-of-east convention matching vertex at +X.
 */
export function getWorldPosition(coord: HexCoord, size = HEX_SIZE): { x: number; z: number } {
  const x = size * (1.5 * coord.q)
  const z = size * (Math.sqrt(3) * (coord.r + coord.q / 2))
  return { x, z }
}

export function directionFromTo(origin: HexCoord, target: HexCoord): number | null {
  const dq = target.q - origin.q
  const dr = target.r - origin.r
  const index = AXIAL_DIRECTIONS.findIndex((d) => d.q === dq && d.r === dr)
  return index === -1 ? null : index
}

export function neighborKey(coord: HexCoord, direction: number): string {
  return coordKey(getNeighbor(coord, direction))
}

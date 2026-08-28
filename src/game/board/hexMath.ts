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
 * Flat-top: vertices on world ±X (phase 0). Face i then aims at axial neighbor i,
 * whose world bearing is 30° + 60°·i — matching getWorldPosition.
 * A −30° phase would make pointy-top meshes that overlap on this lattice.
 */
export const HEX_CORNER_PHASE = 0

export function hexCornerAngle(index: number): number {
  return (Math.PI / 3) * index + HEX_CORNER_PHASE
}

export function hexCorner(index: number, radius = HEX_SIZE): { x: number; z: number } {
  const a = hexCornerAngle(index)
  return { x: Math.cos(a) * radius, z: Math.sin(a) * radius }
}

/**
 * The two outline vertices whose shared edge faces axial direction `dir`.
 * Outline corners run CCW from +X; axial dirs run the other way after east,
 * so dir 1 uses corners 5–0, not 1–2.
 */
export function hexEdgeCornerIndex(dir: number): number {
  const d = ((dir % 6) + 6) % 6
  return ((-d % 6) + 6) % 6
}

export function hexEdgeCorners(
  dir: number,
  radius = HEX_SIZE,
): [{ x: number; z: number }, { x: number; z: number }] {
  const i = hexEdgeCornerIndex(dir)
  return [hexCorner(i, radius), hexCorner(i + 1, radius)]
}

/**
 * World XZ for flat-top axial (Y up in Three.js).
 * x east, z south-of-east convention matching vertex at +X.
 */
export function getWorldPosition(coord: HexCoord, size = HEX_SIZE): { x: number; z: number } {
  const x = size * (1.5 * coord.q)
  const z = size * (Math.sqrt(3) * (coord.r + coord.q / 2))
  return { x, z }
}

/**
 * Point-in-hex for a flat-top hex of center-to-vertex radius `radius`
 * (vertices on ±X). Cube-max tests overshoot the horizontal flats.
 */
export function pointInFlatTopHex(x: number, z: number, radius: number): boolean {
  const R = Math.max(1e-6, radius)
  const ax = Math.abs(x)
  const az = Math.abs(z)
  if (ax > R + 1e-6) return false
  if (az > (R * Math.sqrt(3)) / 2 + 1e-6) return false
  if (az > Math.sqrt(3) * (R - ax) + 1e-6) return false
  return true
}

export function clampToFlatTopHex(
  x: number,
  z: number,
  radius: number,
): { x: number; z: number } {
  if (pointInFlatTopHex(x, z, radius)) return { x, z }
  let nx = x
  let nz = z
  for (let i = 0; i < 12; i++) {
    nx *= 0.86
    nz *= 0.86
    if (pointInFlatTopHex(nx, nz, radius)) return { x: nx, z: nz }
  }
  return { x: 0, z: 0 }
}

/** Midpoint, unit tangent, inward normal, and Yaw that maps local +X onto the edge. */
export function hexEdgeFrame(
  dir: number,
  radius = HEX_SIZE,
): {
  mx: number
  mz: number
  tx: number
  tz: number
  ix: number
  iz: number
  edgeLen: number
  yaw: number
} {
  const [p0, p1] = hexEdgeCorners(dir, radius)
  const edgeLen = Math.hypot(p1.x - p0.x, p1.z - p0.z) || 1
  const tx = (p1.x - p0.x) / edgeLen
  const tz = (p1.z - p0.z) / edgeLen
  const mx = (p0.x + p1.x) / 2
  const mz = (p0.z + p1.z) / 2
  const inward = Math.hypot(mx, mz) || 1
  return {
    mx,
    mz,
    tx,
    tz,
    ix: -mx / inward,
    iz: -mz / inward,
    edgeLen,
    yaw: Math.atan2(-tz, tx),
  }
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

import type { HexCoord } from './HexCoord'

export function mustTouchOrigin(origin: HexCoord, target: HexCoord): boolean {
  const dq = Math.abs(origin.q - target.q)
  const dr = Math.abs(origin.r - target.r)
  const ds = Math.abs(-origin.q - origin.r - (-target.q - target.r))
  return Math.max(dq, dr, ds) === 1
}

export interface HexCoord {
  q: number
  r: number
}

export function coordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`
}

export function parseCoordKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number)
  return { q, r }
}

export function coordsEqual(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r
}

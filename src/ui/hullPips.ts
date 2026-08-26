export function hullPipFilled(index: number, hull: number): boolean {
  return index < hull
}

export function hullPipCount(maxHull: number): number[] {
  return Array.from({ length: Math.max(0, maxHull) }, (_, i) => i)
}

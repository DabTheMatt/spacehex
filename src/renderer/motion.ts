export const TILE_RISE_MS = 520
export const SHIP_TURN_MS = 420
export const SHIP_FLIGHT_MS = 780
export const SHIP_SLIDE_MS = 420

export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t))
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t)
  return 1 - (1 - x) ** 3
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Shortest-path interpolation on radians. */
export function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return from + diff * clamp01(t)
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

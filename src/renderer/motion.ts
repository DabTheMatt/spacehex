export const TILE_RISE_MS = 1400
export const TILE_REVEAL_MS = 2000
export const SHIP_TURN_MS = 1600
export const SHIP_RCS_KICK_MS = 520
export const SHIP_RCS_COUNTER_MS = 480
export const SHIP_MAIN_IGNITE_MS = 1000
export const SHIP_FLIGHT_MS = 2400
export const SHIP_BRAKE_MS = 720
export const SHIP_SLIDE_MS = 1000

export interface EngineBurn {
  main: number
  port: number
  starboard: number
}

/** Signed yaw delta, positive = right (Three.js +Y with nose along +Z). */
export function shortestAngleDelta(from: number, to: number): number {
  let diff = to - from
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return diff
}

/**
 * RCS kick (opposite side) → counter-brake → main ignite → cruise → side brake.
 * Left yaw fires starboard first, then port; right yaw is the reverse.
 */
export function shipEngineBurn(options: {
  elapsed: number
  turnMs: number
  igniteMs: number
  moveMs: number
  yawDelta: number
  kickMs?: number
  counterMs?: number
  brakeMs?: number
}): EngineBurn {
  const kickMs = options.kickMs ?? SHIP_RCS_KICK_MS
  const counterMs = options.counterMs ?? SHIP_RCS_COUNTER_MS
  const brakeMs = options.brakeMs ?? SHIP_BRAKE_MS
  const turning = options.turnMs > 0 && Math.abs(options.yawDelta) > 0.04
  const left = options.yawDelta < 0
  const off: EngineBurn = { main: 0, port: 0, starboard: 0 }

  if (turning && options.elapsed < options.turnMs) {
    if (options.elapsed <= kickMs) {
      return left ? { ...off, starboard: 1 } : { ...off, port: 1 }
    }
    if (options.elapsed >= options.turnMs - counterMs) {
      return left ? { ...off, port: 1 } : { ...off, starboard: 1 }
    }
    return off
  }

  const afterTurn = options.elapsed - (turning ? options.turnMs : 0)
  if (afterTurn < options.igniteMs) {
    const ramp = options.igniteMs <= 0 ? 1 : clamp01(afterTurn / 160)
    return { main: 0.25 + 0.75 * ramp, port: 0, starboard: 0 }
  }

  const afterIgnite = afterTurn - options.igniteMs
  if (afterIgnite < 0) return off
  if (afterIgnite < options.moveMs) {
    const remaining = options.moveMs - afterIgnite
    if (remaining <= brakeMs) {
      const t = brakeMs <= 0 ? 1 : 1 - remaining / brakeMs
      return { main: Math.max(0, 1 - t), port: 0.55 + 0.45 * t, starboard: 0.55 + 0.45 * t }
    }
    return { main: 1, port: 0, starboard: 0 }
  }
  return off
}

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

/** Slow start and finish — ship burns and coasts instead of popping. */
export function easeInOutSmooth(t: number): number {
  const x = clamp01(t)
  return x * x * x * (x * (x * 6 - 15) + 10)
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

import type { HexCoord } from '../../game/board/HexCoord'

export const EVA_DOCK_RADIUS = 0.46
export const EVA_DOCK_PHASE = Math.PI / 6
export const EVA_DOCK_COUNT = 3

export function isEvaCoord(coord: HexCoord): boolean {
  return coord.q === 0 && coord.r === 0
}

export function evaDockAngle(index: number): number {
  return ((Math.PI * 2) / EVA_DOCK_COUNT) * index + EVA_DOCK_PHASE
}

/** Nose along +Z maps to world (sin yaw, cos yaw). Point that vector outward from the dock. */
export function evaDockLocal(index: number): { x: number; z: number; yaw: number } {
  const a = evaDockAngle(index)
  return {
    x: Math.cos(a) * EVA_DOCK_RADIUS,
    z: Math.sin(a) * EVA_DOCK_RADIUS,
    yaw: Math.atan2(Math.cos(a), Math.sin(a)),
  }
}

export function evaDockIndexForPlayer(playerId: string): number {
  const n = Number(playerId.replace(/\D/g, '')) || 1
  return ((n - 1) % EVA_DOCK_COUNT + EVA_DOCK_COUNT) % EVA_DOCK_COUNT
}

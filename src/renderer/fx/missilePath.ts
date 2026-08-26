import { easeOutCubic } from '../motion'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  }
}

/** Side launch: t 0–1 origin→side. Homing: t 1–2 side→target. */
export function missileWorldPos(origin: Vec3, side: Vec3, target: Vec3, t: number): Vec3 {
  if (t <= 1) return lerpVec(origin, side, Math.max(0, t))
  return lerpVec(side, target, Math.min(1, t - 1))
}

/** Same peel as a missile, then ease-out so the probe brakes onto the hex. */
export function probeWorldPos(origin: Vec3, side: Vec3, target: Vec3, t: number): Vec3 {
  if (t <= 1) return lerpVec(origin, side, Math.max(0, t))
  return lerpVec(side, target, easeOutCubic(Math.min(1, t - 1)))
}

/** Alternate port/starboard, then step farther out. Nose is +Z at yaw 0. */
export function missileSidePoint(origin: Vec3, yaw: number, index: number): Vec3 {
  const rightX = Math.cos(yaw)
  const rightZ = -Math.sin(yaw)
  const fwdX = Math.sin(yaw)
  const fwdZ = Math.cos(yaw)
  const side = index % 2 === 0 ? 1 : -1
  const rank = Math.floor(index / 2) + 1
  const dist = 0.16 + rank * 0.07
  return {
    x: origin.x + rightX * side * dist + fwdX * 0.03,
    y: origin.y + 0.02,
    z: origin.z + rightZ * side * dist + fwdZ * 0.03,
  }
}

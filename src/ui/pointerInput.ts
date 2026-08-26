export const LONG_PRESS_MS = 480
export const DOUBLE_TAP_MS = 520
export const TOUCH_DRAG_PX = 16
export const MOUSE_DRAG_PX = 12

export function isTouchLike(pointerType: string): boolean {
  return pointerType === 'touch' || pointerType === 'pen'
}

export function dragThreshold(pointerType: string): number {
  return isTouchLike(pointerType) ? TOUCH_DRAG_PX : MOUSE_DRAG_PX
}

export function isAttackConfirmTap(
  prev: { id: string; at: number } | null,
  shipId: string,
  now: number,
): boolean {
  return Boolean(prev && prev.id === shipId && now - prev.at <= DOUBLE_TAP_MS)
}

export function prefersCoarsePointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(pointer: coarse)').matches
}

/** Pinch-out (larger span) moves the camera closer. */
export function pinchDollyRadius(
  startRadius: number,
  startSpan: number,
  span: number,
  min: number,
  max: number,
): number {
  if (startSpan < 1 || span < 1) return startRadius
  const next = startRadius * (startSpan / span)
  return Math.min(max, Math.max(min, next))
}

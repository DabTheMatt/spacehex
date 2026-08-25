import { describe, expect, it } from 'vitest'
import {
  DOUBLE_TAP_MS,
  dragThreshold,
  isAttackConfirmTap,
  isTouchLike,
  MOUSE_DRAG_PX,
  TOUCH_DRAG_PX,
} from '../ui/pointerInput'

describe('pointer input', () => {
  it('treats touch and pen as coarse pointers with a wider drag gate', () => {
    expect(isTouchLike('touch')).toBe(true)
    expect(isTouchLike('pen')).toBe(true)
    expect(isTouchLike('mouse')).toBe(false)
    expect(dragThreshold('touch')).toBe(TOUCH_DRAG_PX)
    expect(dragThreshold('mouse')).toBe(MOUSE_DRAG_PX)
  })

  it('confirms an attack on a second tap of the same ship', () => {
    expect(isAttackConfirmTap({ id: 'mewa-2', at: 1000 }, 'mewa-2', 1000 + DOUBLE_TAP_MS)).toBe(true)
    expect(isAttackConfirmTap({ id: 'mewa-2', at: 1000 }, 'mewa-2', 1000 + DOUBLE_TAP_MS + 1)).toBe(
      false,
    )
    expect(isAttackConfirmTap({ id: 'mewa-2', at: 1000 }, 'mewa-1', 1100)).toBe(false)
    expect(isAttackConfirmTap(null, 'mewa-2', 1100)).toBe(false)
  })
})

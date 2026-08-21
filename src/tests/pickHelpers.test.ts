import { describe, expect, it } from 'vitest'
import { userDataFromHits, type PickNode } from '../renderer/scene/pickHelpers'
import { actionHotkey } from '../ui/actionHotkeys'

function node(userData: Record<string, unknown>, parent: PickNode | null = null): PickNode {
  return { userData, parent }
}

describe('userDataFromHits', () => {
  it('skips a line without direction and reads the hit-mesh parent', () => {
    const ghost = node({ kind: 'EXPLORE', direction: 4 })
    const line = node({}, ghost)
    const mesh = node({ kind: 'EXPLORE', direction: 4 }, ghost)
    const direction = userDataFromHits<number>([{ object: line }, { object: mesh }], 'direction')
    expect(direction).toBe(4)
  })

  it('returns undefined when nothing carries the key', () => {
    expect(userDataFromHits([{ object: node({}) }], 'direction')).toBeUndefined()
  })
})

describe('actionHotkey', () => {
  it('maps digit and numpad codes', () => {
    expect(actionHotkey('Digit1')).toBe('MOVE')
    expect(actionHotkey('Digit2')).toBe('EXPLORE')
    expect(actionHotkey('Digit3')).toBe('STAY')
    expect(actionHotkey('Numpad2')).toBe('EXPLORE')
    expect(actionHotkey('KeyW')).toBeNull()
  })
})

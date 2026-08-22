import { describe, expect, it } from 'vitest'
import { dicePips } from '../renderer/board/planetLots'

describe('dice pips', () => {
  it('uses a six-sided die layout', () => {
    expect(dicePips(0)).toEqual([])
    expect(dicePips(1)).toHaveLength(1)
    expect(dicePips(2)).toHaveLength(2)
    expect(dicePips(3)).toHaveLength(3)
    expect(dicePips(4)).toHaveLength(4)
    expect(dicePips(5)).toHaveLength(5)
    expect(dicePips(6)).toHaveLength(6)
    expect(dicePips(9)).toHaveLength(6)
  })
})

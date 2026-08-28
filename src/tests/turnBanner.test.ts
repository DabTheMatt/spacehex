import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { turnBannerKind, turnBannerText } from '../ui/turnBanner'

describe('turn banner', () => {
  it('names tanking on EVA, then action after movement if the ship can still tank', () => {
    let start = createInitialState('banner-eva')
    expect(turnBannerKind(start)).toBe('TANKING')
    expect(turnBannerText(start)).toBe('PLAYER 1 · TANKING PHASE')
    start = applyCommand(start, { type: 'DEV_REMOVE_FUEL', playerId: 'player-1', amount: 1 }).state
    const skipped = applyCommand(start, { type: 'SKIP_MOVEMENT' }).state
    expect(turnBannerKind(skipped)).toBe('ACTION')
    expect(turnBannerText(skipped)).toBe('PLAYER 1 · ACTION PHASE')
  })

  it('names movement while placing a tile', () => {
    let state = createInitialState('banner-place')
    state = applyCommand(state, { type: 'BEGIN_EXPLORATION' }).state
    state = applyCommand(state, { type: 'START_EXPLORATION', direction: 0 }).state
    expect(state.phase).toBe('TILE_PLACEMENT')
    expect(turnBannerKind(state)).toBe('MOVEMENT')
    expect(turnBannerText(state)).toBe('PLAYER 1 · MOVEMENT PHASE')
  })

  it('names end turn when movement is spent and no actions remain', () => {
    const skipped = applyCommand(createInitialState('banner-end'), { type: 'SKIP_MOVEMENT' }).state
    const solo = {
      ...skipped,
      ships: { 'mewa-1': skipped.ships['mewa-1'] },
    }
    expect(turnBannerKind(solo)).toBe('END_TURN')
    expect(turnBannerText(solo)).toBe('PLAYER 1 · END TURN')
  })
})

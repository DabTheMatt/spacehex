import { describe, expect, it } from 'vitest'
import { hudPaneLabel } from '../ui/sectorPane'
import { CAMERA_INSPECT_FILL } from '../renderer/scene/CameraController'

describe('sector pane label', () => {
  it('calls EVA a station, planets planets, and everything else a sector', () => {
    expect(hudPaneLabel('EVA_1')).toBe('STATION')
    expect(hudPaneLabel(undefined)).toBe('STATION')
    expect(hudPaneLabel('PLANET_SMALL')).toBe('PLANET')
    expect(hudPaneLabel('PLANET_MEDIUM')).toBe('PLANET')
    expect(hudPaneLabel('VOID')).toBe('SECTOR')
    expect(hudPaneLabel('WRECK_TANKER')).toBe('SECTOR')
    expect(hudPaneLabel('ASTEROID')).toBe('SECTOR')
  })
})

describe('planet inspect framing', () => {
  it('fills more of the view than the previous 60% framing', () => {
    expect(CAMERA_INSPECT_FILL).toBeGreaterThan(0.6)
    expect(CAMERA_INSPECT_FILL).toBeLessThanOrEqual(1)
  })
})

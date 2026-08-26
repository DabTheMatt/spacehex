import { describe, expect, it } from 'vitest'
import { hudPaneLabel } from '../ui/sectorPane'
import { CAMERA_INSPECT_FILL } from '../renderer/scene/CameraController'
import { PROBE_FEED_OPACITY } from '../renderer/entities/ProbeRenderer'

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

describe('probe feed', () => {
  it('keeps the CRT overlay around a quarter opaque', () => {
    expect(PROBE_FEED_OPACITY).toBeGreaterThanOrEqual(0.2)
    expect(PROBE_FEED_OPACITY).toBeLessThanOrEqual(0.3)
  })
})

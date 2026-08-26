import { describe, expect, it } from 'vitest'
import { APP_VERSION } from '../appVersion'
import { hudPaneLabel } from '../ui/sectorPane'
import { CAMERA_INSPECT_FILL } from '../renderer/scene/CameraController'
import {
  PROBE_SCAN_OPACITY,
  PROBE_STROKE_OPACITY,
  PROBE_TILE_OPACITY,
} from '../renderer/entities/ProbeRenderer'

describe('app version', () => {
  it('is a semver label shown on the Pages build', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

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
  it('keeps the scanned hex a wireframe hologram, not a filled slab', () => {
    expect(PROBE_TILE_OPACITY).toBe(0)
    expect(PROBE_STROKE_OPACITY).toBeGreaterThan(0.25)
    expect(PROBE_STROKE_OPACITY).toBeLessThanOrEqual(0.45)
    expect(PROBE_SCAN_OPACITY).toBeLessThanOrEqual(0.18)
  })
})

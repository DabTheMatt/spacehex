import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CARGO_KINDS } from '../game/definitions/cargoFigures'
import { createFlatCargoMark } from '../renderer/board/cargoMesh'
import { cueForEvent, parseSoundEnabled, playGameEvents, setSoundEnabled } from '../ui/sound'

describe('flat cargo marks', () => {
  it('lies on the hex face with no tilt and the same kind box', () => {
    const sizes: number[] = []
    for (const kind of CARGO_KINDS) {
      const mark = createFlatCargoMark(kind, 0.1, 0xffffff)
      expect(mark.userData.flatCargo).toBe(kind)
      expect(mark.rotation.x).toBe(0)
      expect(mark.rotation.y).toBe(0)
      expect(mark.rotation.z).toBe(0)
      const box = new THREE.Box3().setFromObject(mark)
      const extent = box.getSize(new THREE.Vector3())
      expect(extent.x).toBeGreaterThan(0.04)
      expect(extent.z).toBeGreaterThan(0.04)
      expect(extent.y).toBeLessThan(0.02)
      sizes.push(Math.max(extent.x, extent.z))
    }
    const span = Math.max(...sizes) - Math.min(...sizes)
    expect(span).toBeLessThan(0.04)
  })
})

describe('sound cues', () => {
  it('treats missing storage as on and off as muted', () => {
    expect(parseSoundEnabled(null)).toBe(true)
    expect(parseSoundEnabled('on')).toBe(true)
    expect(parseSoundEnabled('off')).toBe(false)
  })

  it('maps move buy sell and reject to short tones', () => {
    expect(cueForEvent('SHIP_MOVED')?.freq).toBeGreaterThan(0)
    expect(cueForEvent('RESOURCE_BOUGHT')?.slide).toBeGreaterThan(0)
    expect(cueForEvent('RESOURCE_SOLD')?.freq).toBeGreaterThan(0)
    expect(cueForEvent('COMMAND_REJECTED')?.freq).toBeLessThan(200)
    expect(cueForEvent('GAME_STARTED')).toBeNull()
  })

  it('skips playback when muted', () => {
    setSoundEnabled(false)
    playGameEvents([{ type: 'SHIP_MOVED', shipId: 'x', from: { q: 0, r: 0 }, to: { q: 1, r: 0 } }])
    setSoundEnabled(true)
  })
})

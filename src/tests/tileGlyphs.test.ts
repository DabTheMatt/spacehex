import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { TILE_DEFINITIONS } from '../game/definitions/tiles'
import { createTileGlyph, planetTintForId, EDGE_DIGIT_INSET } from '../renderer/board/tileGlyphs'
import { palette } from '../renderer/theme'

const CARGO = new Set(['ORE', 'BIOMASS', 'ICE', 'FUEL'])

describe('tile glyphs', () => {
  it('spins each asteroid in the tile plane at its own rate', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['asteroid-1'])
    const spins: number[] = []
    glyph.traverse((obj) => {
      if (obj.userData.animate !== 'asteroid') return
      spins.push(Number(obj.userData.spinY))
    })
    expect(spins.length).toBeGreaterThanOrEqual(6)
    expect(new Set(spins).size).toBe(spins.length)
    expect(spins.some((speed) => speed > 0)).toBe(true)
    expect(spins.some((speed) => speed < 0)).toBe(true)
  })

  it('stacks two or three resource cubes on the wrecked transport', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['wreck-transport-1'], palette.paper, 'wreck-a')
    const kinds: string[] = []
    glyph.traverse((obj) => {
      if (obj.userData.cargoCube) kinds.push(String(obj.userData.cargoCube))
    })
    expect(kinds.length).toBeGreaterThanOrEqual(2)
    expect(kinds.length).toBeLessThanOrEqual(3)
    expect(new Set(kinds).size).toBe(kinds.length)
    expect(kinds.every((kind) => CARGO.has(kind))).toBe(true)
    const again = createTileGlyph(TILE_DEFINITIONS['wreck-transport-1'], palette.paper, 'wreck-a')
    const kinds2: string[] = []
    again.traverse((obj) => {
      if (obj.userData.cargoCube) kinds2.push(String(obj.userData.cargoCube))
    })
    expect(kinds2).toEqual(kinds)
  })

  it('orbits a moon around medium planets', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['planet-medium-1'])
    let moons = 0
    glyph.traverse((obj) => {
      if (obj.userData.animate === 'moon') moons += 1
    })
    expect(moons).toBe(1)
  })

  it('gives each planet its own spin rate and phase', () => {
    const a = createTileGlyph(TILE_DEFINITIONS['planet-medium-1'], palette.paper, 'spin-a')
    const b = createTileGlyph(TILE_DEFINITIONS['planet-medium-2'], palette.paper, 'spin-b')
    const rates: number[] = []
    const phases: number[] = []
    for (const glyph of [a, b]) {
      glyph.traverse((obj) => {
        if (obj.userData.animate !== 'spin') return
        rates.push(Number(obj.userData.spinRate))
        phases.push(Number(obj.userData.spinPhase))
      })
    }
    expect(rates).toHaveLength(2)
    expect(rates[0]).not.toBeCloseTo(rates[1])
    expect(phases[0]).not.toBeCloseTo(phases[1])
  })

  it('paints a probe-scan planet glyph engine blue instead of a muted tint', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['planet-medium-1'], palette.engine, 'scan-planet', true)
    const colors = new Set<number>()
    glyph.traverse((obj) => {
      const mat = (obj as THREE.Line).material as THREE.LineBasicMaterial | undefined
      if (!mat || !('color' in mat)) return
      colors.add(mat.color.getHex())
    })
    expect(colors.has(palette.engine)).toBe(true)
    expect(colors.has(planetTintForId('scan-planet'))).toBe(false)
  })

  it('tints planets from the muted violet / rose / sage set', () => {
    const tints = [palette.planetViolet, palette.planetRose, palette.planetSage]
    expect(tints).toContain(planetTintForId('planet-large-1'))
    expect(planetTintForId('planet-large-1')).toBe(planetTintForId('planet-large-1'))
    const seen = new Set(
      ['planet-large-1', 'planet-large-2', 'planet-medium-1', 'planet-small-1', 'planet-small-5'].map(
        (id) => planetTintForId(id),
      ),
    )
    expect(seen.size).toBeGreaterThan(1)
  })

  it('keeps the EVA core still while the hub, docks, and airlock dots spin', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['eva-1'])
    let hubs = 0
    const pulses: number[] = []
    glyph.traverse((obj) => {
      if (obj.userData.animate === 'evaHub') hubs += 1
      if (obj.userData.animate === 'evaPulse') pulses.push(Number(obj.userData.pulseIndex))
    })
    expect(hubs).toBe(1)
    expect(pulses.sort()).toEqual([0, 1, 2])
  })

  it('marks EVA repair and tanker fuel, with edge numbers on the top face', () => {
    const eva = createTileGlyph(TILE_DEFINITIONS['eva-1'], palette.paper, 'eva-1', false, [1, 2, 3, 4, 5, 6])
    let fuel = 0
    let repair = 0
    let digits = 0
    eva.traverse((obj) => {
      if (obj.userData.fuelCell) fuel += 1
      if (obj.userData.repairMark) repair += 1
      if (obj.userData.edgeDigit) digits += 1
    })
    expect(fuel).toBe(0)
    expect(repair).toBe(1)
    expect(digits).toBe(6)
    expect(EDGE_DIGIT_INSET).toBeCloseTo(0.9)
    eva.traverse((obj) => {
      if (!obj.userData.edgeDigit) return
      expect(obj.userData.edgeTop).toBe(true)
      expect(obj.userData.edgeWall).toBeUndefined()
      expect(obj.position.y).toBeGreaterThan(0)
      const len = Math.hypot(obj.position.x, obj.position.z) || 1
      const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(obj.quaternion)
      expect(localY.x).toBeCloseTo(-obj.position.x / len, 5)
      expect(localY.z).toBeCloseTo(-obj.position.z / len, 5)
      expect(localY.y).toBeCloseTo(0, 5)
      expect(obj.userData.digitColor).toBe(palette.paper)
      expect(obj).not.toBeInstanceOf(THREE.Sprite)
    })
    const rock = createTileGlyph(TILE_DEFINITIONS['asteroid-1'])
    let chance = 0
    rock.traverse((obj) => {
      if (obj.userData.collisionChance) chance += 1
    })
    expect(chance).toBe(1)
    expect(createTileGlyph(TILE_DEFINITIONS['vortex-1']).children.length).toBeGreaterThan(0)
    expect(createTileGlyph(TILE_DEFINITIONS['space-gate-1']).children.length).toBeGreaterThan(0)
  })

  it('piles asteroid clusters on blocked strait edges', () => {
    const threeWay = createTileGlyph(
      TILE_DEFINITIONS['strait-1'],
      palette.paper,
      'strait-vis',
      false,
      [1, 2, 3, 4, 5, 6],
    )
    let blockedFaces = 0
    const digitR: number[] = []
    const rockR: number[] = []
    threeWay.traverse((obj) => {
      if (obj.userData.straitBlocked) blockedFaces += 1
      if (obj.userData.edgeDigit) digitR.push(Math.hypot(obj.position.x, obj.position.z))
      if (obj.userData.animate === 'asteroid') rockR.push(Math.hypot(obj.position.x, obj.position.z))
      if (obj.userData.openChannels) {
        expect(obj.userData.openChannels).toBe(3)
        expect(obj.userData.blockedWalls).toBe(3)
      }
    })
    expect(blockedFaces).toBe(3)
    expect(digitR).toHaveLength(6)
    expect(rockR.length).toBeGreaterThan(0)
    expect(Math.min(...digitR)).toBeGreaterThan(Math.max(...rockR))
    const bent = createTileGlyph(TILE_DEFINITIONS['strait-2'])
    bent.traverse((obj) => {
      if (obj.userData.openChannels) {
        expect(obj.userData.openChannels).toBe(2)
        expect(obj.userData.blockedWalls).toBe(4)
      }
    })
    const through = createTileGlyph(TILE_DEFINITIONS['strait-3'])
    through.traverse((obj) => {
      if (obj.userData.openChannels) {
        expect(obj.userData.openChannels).toBe(2)
        expect(obj.userData.blockedWalls).toBe(4)
      }
    })
  })
})

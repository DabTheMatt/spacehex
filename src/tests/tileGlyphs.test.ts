import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { TILE_DEFINITIONS } from '../game/definitions/tiles'
import { createTileGlyph, planetTintForId, EDGE_DIGIT_INSET, tickTileGlyphs } from '../renderer/board/tileGlyphs'
import { attachCrateMotion, createCargoFigure } from '../renderer/board/cargoMesh'
import { HEX_SIZE, pointInFlatTopHex } from '../game/board/hexMath'
import { CARGO_FIGURE } from '../game/definitions/cargoFigures'
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

  it('stacks two or three resource cubes on the wrecked tanker and transport', () => {
    for (const id of ['wreck-tanker-1', 'wreck-transport-1'] as const) {
      const glyph = createTileGlyph(TILE_DEFINITIONS[id], palette.paper, `${id}-cargo`)
      const kinds: string[] = []
      let filled = 0
      glyph.traverse((obj) => {
        if (obj.userData.cargoCube) {
          kinds.push(String(obj.userData.cargoCube))
          expect(obj.userData.cargoFigure).toBe(CARGO_FIGURE[obj.userData.cargoCube as keyof typeof CARGO_FIGURE])
          expect(obj.userData.vx).not.toBeUndefined()
          expect(obj.userData.vz).not.toBeUndefined()
        }
        if (obj.userData.cargoCube && obj instanceof THREE.Mesh) filled += 1
      })
      expect(kinds.length).toBeGreaterThanOrEqual(2)
      expect(kinds.length).toBeLessThanOrEqual(3)
      expect(new Set(kinds).size).toBe(kinds.length)
      expect(kinds.every((kind) => CARGO.has(kind))).toBe(true)
      expect(filled).toBe(0)
    }
  })

  it('spins the black hole', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['black-hole-1'])
    let spins = 0
    glyph.traverse((obj) => {
      if (obj.userData.animate === 'spin') spins += 1
    })
    expect(spins).toBe(1)
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
    expect(repair).toBe(0)
    expect(digits).toBe(6)
    expect(EDGE_DIGIT_INSET).toBeCloseTo(0.05)
    eva.updateMatrixWorld(true)
    eva.traverse((obj) => {
      if (!obj.userData.edgeDigit) return
      expect(obj.userData.edgeTop).toBe(true)
      expect(obj.userData.edgeWall).toBeUndefined()
      expect(obj.rotation.x).toBeCloseTo(-Math.PI / 2)
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion()))
      expect(Math.abs(normal.y)).toBeGreaterThan(0.98)
      expect(Math.abs(normal.x)).toBeLessThan(0.15)
      expect(Math.abs(normal.z)).toBeLessThan(0.15)
      expect(obj.userData.digitColor).toBe(palette.paper)
      expect(obj).not.toBeInstanceOf(THREE.Sprite)
    })
    const rock = createTileGlyph(TILE_DEFINITIONS['asteroid-1'])
    let chance = 0
    rock.traverse((obj) => {
      if (obj.userData.collisionChance) chance += 1
    })
    expect(chance).toBe(1)
    const vortex = createTileGlyph(TILE_DEFINITIONS['vortex-1'])
    let swirl = 0
    vortex.traverse((obj) => {
      if (obj.userData.vortexGlyph) swirl += 1
    })
    expect(swirl).toBe(1)
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
    threeWay.updateMatrixWorld(true)
    const spins: number[] = []
    threeWay.traverse((obj) => {
      if (obj.userData.straitBlocked) blockedFaces += 1
      if (obj.userData.edgeDigit) {
        const w = new THREE.Vector3()
        obj.getWorldPosition(w)
        digitR.push(Math.hypot(w.x, w.z))
      }
      if (obj.userData.animate === 'asteroid') {
        rockR.push(Math.hypot(obj.position.x, obj.position.z))
        spins.push(Number(obj.userData.spinY))
      }
      if (obj.userData.openChannels) {
        expect(obj.userData.openChannels).toBe(3)
        expect(obj.userData.blockedWalls).toBe(3)
      }
    })
    expect(blockedFaces).toBe(3)
    expect(digitR).toHaveLength(6)
    expect(rockR.length).toBeGreaterThan(60)
    expect(Math.min(...rockR)).toBeGreaterThan(0.32)
    expect(Math.max(...rockR)).toBeLessThan(0.98)
    expect(spins.some((speed) => speed > 0)).toBe(true)
    expect(spins.some((speed) => speed < 0)).toBe(true)
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

  it('gives wreck cargo distinct figures in ink', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['wreck-tanker-1'], palette.paper, 'ink-wreck', false, undefined, true)
    const figures = new Set<string>()
    glyph.traverse((obj) => {
      if (obj.userData.cargoFigure) figures.add(String(obj.userData.cargoFigure))
    })
    expect(figures.size).toBeGreaterThan(1)
    expect([...figures].every((f) => ['cube', 'cone', 'sphere', 'cylinder'].includes(f))).toBe(true)
  })

  it('keeps drifting crates inside the flat-top hex outline', () => {
    const root = new THREE.Group()
    const crate = createCargoFigure('ORE', 0.11, 0xffffff)
    attachCrateMotion(crate, 1.2, 0, 0, 2.4, 0.4, { x: 0, y: 0, z: 0 })
    root.add(crate)
    for (let t = 0; t < 4; t += 1 / 60) tickTileGlyphs(root, t)
    const pad = Number(crate.userData.crateRadius)
    expect(pointInFlatTopHex(crate.position.x, crate.position.z, HEX_SIZE * 0.9 - pad)).toBe(true)
    expect(pointInFlatTopHex(crate.position.x, crate.position.z, HEX_SIZE)).toBe(true)
  })

  it('aligns ink asteroid squares to the marked hex edges', () => {
    const glyph = createTileGlyph(
      TILE_DEFINITIONS['asteroid-1'],
      palette.paper,
      'ink-asteroid',
      false,
      undefined,
      true,
    )
    const yaws: number[] = []
    const faces = new Set<number>()
    glyph.traverse((obj) => {
      if (obj.userData.edgeFace !== undefined) faces.add(Number(obj.userData.edgeFace))
      if (!obj.userData.edgeAligned) return
      yaws.push(Number(obj.userData.edgeYaw))
      expect(obj.rotation.y).toBeCloseTo(Number(obj.userData.edgeYaw))
    })
    expect(faces).toEqual(new Set([0, 2, 4]))
    expect(yaws).toHaveLength(15)
    expect(new Set(yaws.map((y) => y.toFixed(4))).size).toBe(3)
  })
})

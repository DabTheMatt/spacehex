import * as THREE from 'three'
import type { TileType } from '../../game/board/tileRotation'
import type { TileDefinition } from '../../game/board/tileRotation'
import { palette } from '../theme'
import { EVA_DOCK_COUNT, EVA_DOCK_RADIUS, EVA_HUB_SPIN, EVA_PULSE_STEP_S, evaDockAngle } from './evaDocks'
import { RNG } from '../../game/random/RNG'

const Y = 0.012
const PLANET_TINTS = [palette.planetViolet, palette.planetRose, palette.planetSage] as const

export function planetTintForId(id: string): number {
  return PLANET_TINTS[new RNG(`planet-tint:${id}`).nextInt(PLANET_TINTS.length)]
}

function lineMat(color: number, opacity = 1): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
  })
}

function poly(points: Array<[number, number]>, color: number, closed = false, opacity = 1): THREE.Line {
  const pts = points.map(([x, z]) => new THREE.Vector3(x, Y, z))
  if (closed && pts.length) pts.push(pts[0].clone())
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(color, opacity))
}

function circle(radius: number, color: number, segments = 40, opacity = 1): THREE.Line {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Y, Math.sin(a) * radius))
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(color, opacity))
}

function arc(
  radius: number,
  start: number,
  end: number,
  color: number,
  segments = 24,
): THREE.Line {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const a = start + ((end - start) * i) / segments
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Y, Math.sin(a) * radius))
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(color))
}

function evaGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  const core = new THREE.Group()
  const hex: Array<[number, number]> = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6
    hex.push([Math.cos(a) * 0.13, Math.sin(a) * 0.13])
  }
  core.add(poly(hex, color, true))
  core.add(poly([[-0.07, 0], [0.07, 0]], color))
  core.add(poly([[0, -0.07], [0, 0.07]], color))

  const hub = new THREE.Group()
  hub.userData.animate = 'evaHub'
  hub.add(circle(0.4, color, 56))
  hub.add(circle(0.26, color, 40, 0.85))
  hub.add(arc(0.33, 0.4, 2.2, color, 18))
  for (let k = 0; k < EVA_DOCK_COUNT; k++) {
    const a = evaDockAngle(k)
    const inner = 0.26
    const outer = EVA_DOCK_RADIUS
    hub.add(
      poly(
        [
          [Math.cos(a) * inner, Math.sin(a) * inner],
          [Math.cos(a) * outer, Math.sin(a) * outer],
        ],
        color,
      ),
    )
    const dock = new THREE.Group()
    dock.position.set(Math.cos(a) * outer, 0, Math.sin(a) * outer)
    dock.add(circle(0.045, color, 16))
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.0045, 10),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    dot.rotation.x = -Math.PI / 2
    dot.position.y = Y + 0.002
    dot.userData.animate = 'evaPulse'
    dot.userData.pulseIndex = k
    dock.add(dot)
    hub.add(dock)
  }
  g.add(core, hub)
  return g
}

function voidGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(poly([[-0.32, 0], [0.32, 0]], color))
  g.add(poly([[0, -0.32], [0, 0.32]], color))
  g.add(circle(0.08, color, 16))
  return g
}

function planetGlyph(color: number, size: 'L' | 'M' | 'S'): THREE.Group {
  const root = new THREE.Group()
  const spin = new THREE.Group()
  spin.userData.animate = 'spin'
  if (size === 'L') {
    spin.add(circle(0.42, color, 48))
    spin.add(ellipse(0.63, 0.195, color))
    spin.add(ellipse(0.57, 0.15, color))
    spin.add(arc(0.24, -0.5, 2.5, color))
    spin.add(poly([[-0.21, -0.09], [0.24, 0.12]], color))
    spin.add(poly([[-0.12, 0.18], [0.18, 0.27]], color))
    root.add(spin)
  } else if (size === 'M') {
    spin.add(circle(0.3, color, 40))
    spin.add(arc(0.18, 0.2, 3.4, color))
    spin.add(circle(0.07, color, 14))
    const crater = circle(0.05, color, 12)
    crater.position.set(-0.12, 0, 0.1)
    spin.add(crater)
    root.add(spin)
    const moonArm = new THREE.Group()
    moonArm.userData.animate = 'moon'
    const moon = circle(0.055, color, 16)
    moon.position.set(0.4, 0, 0)
    moonArm.add(moon)
    root.add(moonArm)
  } else {
    spin.add(circle(0.22, color, 32))
    spin.add(circle(0.065, color, 14))
    root.add(spin)
  }
  return root
}

function ellipse(rx: number, rz: number, color: number, segments = 48): THREE.Line {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * rx, Y, Math.sin(a) * rz))
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(color))
}

function asteroidGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  const rocks: Array<Array<[number, number]>> = [
    [
      [0.38, 0.02],
      [0.55, 0.14],
      [0.42, 0.32],
      [0.22, 0.22],
      [0.2, 0.06],
    ],
    [
      [0.08, 0.28],
      [0.22, 0.42],
      [0.02, 0.52],
      [-0.16, 0.4],
      [-0.1, 0.24],
    ],
    [
      [-0.28, 0.08],
      [-0.12, 0.18],
      [-0.22, 0.32],
      [-0.42, 0.2],
      [-0.4, 0.04],
    ],
    [
      [-0.48, -0.22],
      [-0.28, -0.12],
      [-0.32, 0.02],
      [-0.55, -0.08],
    ],
    [
      [-0.08, -0.38],
      [0.14, -0.32],
      [0.18, -0.14],
      [-0.02, -0.18],
      [-0.16, -0.28],
    ],
    [
      [0.28, -0.28],
      [0.42, -0.22],
      [0.36, -0.08],
      [0.18, -0.16],
    ],
  ]
  const spins = [0.37, -0.22, -0.41, 0.53, -0.29, 0.18]
  rocks.forEach((rock, index) => {
    g.add(spinningRock(rock, color, spins[index] ?? 0.2))
  })
  return g
}

function spinningRock(points: Array<[number, number]>, color: number, spinY: number): THREE.Group {
  let cx = 0
  let cz = 0
  for (const [x, z] of points) {
    cx += x
    cz += z
  }
  cx /= points.length
  cz /= points.length
  const local = points.map(([x, z]) => [x - cx, z - cz] as [number, number])
  const g = new THREE.Group()
  g.position.set(cx, 0, cz)
  g.add(poly(local, color, true))
  g.userData.animate = 'asteroid'
  g.userData.spinY = spinY
  return g
}

function shadowBaseGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(poly([[-0.38, -0.32], [0.22, -0.32], [0.22, 0.32], [-0.38, 0.32]], color, true))
  g.add(poly([[-0.22, -0.18], [0.08, -0.18], [0.08, 0.18], [-0.22, 0.18]], color, true))
  g.add(poly([[0.22, -0.12], [0.5, 0], [0.22, 0.12]], color))
  return g
}

function tankerGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(poly([[-0.5, -0.12], [0.32, -0.12], [0.55, 0], [0.32, 0.12], [-0.5, 0.12]], color, true))
  g.add(poly([[-0.28, -0.12], [-0.28, 0.12]], color))
  g.add(poly([[0.02, -0.12], [0.02, 0.12]], color))
  return g
}

function crateGlyph(color: number, sx: number, sy: number, sz: number): THREE.Group {
  const g = new THREE.Group()
  const geom = new THREE.BoxGeometry(sx, sy, sz)
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), lineMat(color))
  g.add(edges)
  return g
}

function transportGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(poly([[-0.18, -0.28], [0.18, -0.28], [0.18, 0.08], [-0.18, 0.08]], color, true))
  g.add(poly([[-0.1, -0.18], [0.1, -0.18], [0.1, -0.02], [-0.1, -0.02]], color, true))
  g.add(poly([[-0.48, 0.08], [-0.18, 0.08], [-0.18, 0.28], [-0.48, 0.22]], color, true))
  g.add(poly([[0.18, 0.08], [0.5, 0.14], [0.48, 0.3], [0.18, 0.28]], color, true))
  g.add(poly([[-0.08, 0.08], [-0.02, 0.22]], color))
  g.add(poly([[0.06, 0.08], [0.14, 0.2]], color))
  g.add(poly([[-0.12, -0.28], [-0.2, -0.42]], color))
  g.add(poly([[0.12, -0.28], [0.22, -0.4]], color))

  const crates: Array<{ x: number; z: number; spinY: number; sx: number; sy: number; sz: number }> = [
    { x: -0.34, z: -0.14, spinY: 0.62, sx: 0.09, sy: 0.07, sz: 0.11 },
    { x: 0.3, z: -0.2, spinY: -0.48, sx: 0.08, sy: 0.06, sz: 0.09 },
    { x: 0.02, z: 0.34, spinY: 0.84, sx: 0.07, sy: 0.07, sz: 0.08 },
  ]
  for (const crate of crates) {
    const box = crateGlyph(color, crate.sx, crate.sy, crate.sz)
    box.position.set(crate.x, Y + 0.04, crate.z)
    box.userData.animate = 'crate'
    box.userData.spinY = crate.spinY
    g.add(box)
  }
  return g
}

function blackHoleGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(circle(0.18, color))
  g.add(circle(0.34, color, 40, 0.7))
  const spiral: Array<[number, number]> = []
  for (let i = 0; i <= 28; i++) {
    const t = i / 28
    const a = t * Math.PI * 1.7
    const r = 0.12 + t * 0.42
    spiral.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  g.add(poly(spiral, color))
  return g
}

export function createTileGlyph(def: TileDefinition, color = palette.paper, salt = def.id): THREE.Group {
  const root = new THREE.Group()
  const type: TileType = def.type
  const planetColor = planetTintForId(salt)
  switch (type) {
    case 'EVA_1':
      root.add(evaGlyph(color))
      break
    case 'VOID':
      root.add(voidGlyph(color))
      break
    case 'PLANET_LARGE':
      root.add(planetGlyph(planetColor, 'L'))
      break
    case 'PLANET_MEDIUM':
      root.add(planetGlyph(planetColor, 'M'))
      break
    case 'PLANET_SMALL':
      root.add(planetGlyph(planetColor, 'S'))
      break
    case 'ASTEROID':
      root.add(asteroidGlyph(color))
      break
    case 'SHADOW_BASE':
      root.add(shadowBaseGlyph(color))
      break
    case 'WRECK_TANKER':
      root.add(tankerGlyph(color))
      break
    case 'WRECK_TRANSPORT':
      root.add(transportGlyph(color))
      break
    case 'BLACK_HOLE':
      root.add(blackHoleGlyph(color))
      break
    default:
      root.add(voidGlyph(color))
  }
  return root
}

export function tickTileGlyphs(root: THREE.Object3D, time: number): void {
  root.traverse((obj) => {
    if (obj.userData.animate === 'asteroid') {
      obj.rotation.x = 0
      obj.rotation.z = 0
      obj.rotation.y = time * Number(obj.userData.spinY || 0)
    }
    if (obj.userData.animate === 'crate') {
      obj.rotation.x = 0.18
      obj.rotation.z = 0
      obj.rotation.y = time * Number(obj.userData.spinY || 0.5)
    }
    if (obj.userData.animate === 'spin') {
      obj.rotation.y = time * 0.12
    }
    if (obj.userData.animate === 'moon') {
      obj.rotation.y = (time / 12) * Math.PI * 2
    }
    if (obj.userData.animate === 'evaHub') {
      obj.rotation.y = time * EVA_HUB_SPIN
    }
    if (obj.userData.animate === 'evaPulse' && obj instanceof THREE.Mesh) {
      const mat = obj.material
      if (!Array.isArray(mat) && 'opacity' in mat) {
        const count = 3
        const index = Number(obj.userData.pulseIndex) || 0
        const chase = Math.floor(time / EVA_PULSE_STEP_S) % count
        mat.transparent = true
        mat.opacity = index === chase ? 1 : 0.1
      }
    }
    if (obj.userData.animate === 'pulse' && obj instanceof THREE.Mesh) {
      const mat = obj.material
      if (!Array.isArray(mat) && 'opacity' in mat) {
        mat.transparent = true
        mat.opacity = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(time * 1.35))
      }
    }
    if (obj.userData.animate === 'runway' && obj instanceof THREE.Mesh) {
      const mat = obj.material
      if (!Array.isArray(mat) && 'opacity' in mat) {
        const count = Number(obj.userData.runwayCount) || 5
        const index = Number(obj.userData.runwayIndex) || 0
        const chase = Math.floor(time * 2) % count
        const prev = (chase + count - 1) % count
        mat.transparent = true
        mat.opacity = index === chase ? 1 : index === prev ? 0.4 : 0.12
      }
    }
  })
}

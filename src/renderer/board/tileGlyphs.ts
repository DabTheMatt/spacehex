import * as THREE from 'three'
import type { TileType } from '../../game/board/tileRotation'
import type { TileDefinition } from '../../game/board/tileRotation'
import { palette } from '../theme'

const Y = 0.012

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
  g.add(poly([[-0.42, -0.28], [0.38, -0.28], [0.52, 0], [0.38, 0.28], [-0.42, 0.28]], color, true))
  g.add(poly([[-0.22, -0.16], [-0.22, 0.16]], color))
  g.add(poly([[-0.22, 0], [0.18, 0]], color))

  const count = 5
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const x = -0.22 + t * 0.5
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(
        new THREE.CircleGeometry(0.022, 10),
        new THREE.MeshBasicMaterial({
          color: palette.ochre,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      )
      lamp.rotation.x = -Math.PI / 2
      lamp.position.set(x, Y + 0.004, side * 0.09)
      lamp.userData.animate = 'runway'
      lamp.userData.runwayIndex = i
      lamp.userData.runwayCount = count
      g.add(lamp)
    }
  }
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
  const spin = new THREE.Group()
  spin.userData.animate = 'spin'
  if (size === 'L') {
    // Keep the spinning graphic inside the hex apothem (~0.83 at HEX_SIZE 1).
    spin.add(circle(0.28, color, 48))
    spin.add(ellipse(0.42, 0.13, color))
    spin.add(ellipse(0.38, 0.1, color))
    spin.add(arc(0.16, -0.5, 2.5, color))
    const moon = circle(0.07, color, 20)
    moon.position.set(0.34, 0, 0.12)
    spin.add(moon)
    spin.add(poly([[-0.14, -0.06], [0.16, 0.08]], color))
    spin.add(poly([[-0.08, 0.12], [0.12, 0.18]], color))
  } else if (size === 'M') {
    spin.add(circle(0.3, color, 40))
    spin.add(arc(0.18, 0.2, 3.4, color))
    spin.add(circle(0.07, color, 14))
    const crater = circle(0.05, color, 12)
    crater.position.set(-0.12, 0, 0.1)
    spin.add(crater)
  } else {
    spin.add(circle(0.15, color, 28))
    spin.add(circle(0.045, color, 12))
  }
  return spin
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
  for (const rock of rocks) g.add(poly(rock, color, true))
  g.add(poly([[0.02, 0.02], [0.12, 0.1]], color))
  g.add(poly([[-0.18, -0.06], [-0.08, 0.04]], color))
  g.add(poly([[0.2, -0.06], [0.3, 0]], color))
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

export function createTileGlyph(def: TileDefinition, color = palette.paper): THREE.Group {
  const root = new THREE.Group()
  const type: TileType = def.type
  switch (type) {
    case 'EVA_1':
      root.add(evaGlyph(color))
      break
    case 'VOID':
      root.add(voidGlyph(color))
      break
    case 'PLANET_LARGE':
      root.add(planetGlyph(color, 'L'))
      break
    case 'PLANET_MEDIUM':
      root.add(planetGlyph(color, 'M'))
      break
    case 'PLANET_SMALL':
      root.add(planetGlyph(color, 'S'))
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
    if (obj.userData.animate === 'spin') {
      obj.rotation.y = time * 0.12
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
        const chase = Math.floor(time * 6) % count
        const prev = (chase + count - 1) % count
        mat.transparent = true
        mat.opacity = index === chase ? 1 : index === prev ? 0.4 : 0.12
      }
    }
  })
}

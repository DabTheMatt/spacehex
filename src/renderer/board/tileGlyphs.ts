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

/** Notch at local +X (edge 0) so every rotation is visible. */
function orientationMark(color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(poly([[0.72, 0.08], [0.88, 0], [0.72, -0.08]], color))
  g.add(poly([[0.55, 0], [0.86, 0]], color))
  return g
}

function evaGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(poly([[-0.42, -0.28], [0.38, -0.28], [0.52, 0], [0.38, 0.28], [-0.42, 0.28]], color, true))
  g.add(poly([[-0.22, -0.16], [-0.22, 0.16]], color))
  g.add(poly([[-0.22, 0], [0.18, 0]], color))
  g.add(poly([[0.28, -0.12], [0.48, 0], [0.28, 0.12]], color))
  return g
}

function voidGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(poly([[-0.35, 0], [0.55, 0]], color))
  g.add(poly([[0, -0.28], [0, 0.28]], color))
  g.add(poly([[0.42, -0.1], [0.58, 0], [0.42, 0.1]], color))
  g.add(circle(0.08, color, 16))
  return g
}

function planetGlyph(color: number, radius: number): THREE.Group {
  const g = new THREE.Group()
  g.add(circle(radius, color))
  g.add(arc(radius * 0.55, -0.4, 2.4, color))
  g.add(circle(radius * 0.18, color, 16))
  const moon = circle(radius * 0.22, color, 18)
  moon.position.set(radius * 0.85, 0, -radius * 0.35)
  g.add(moon)
  g.add(poly([[radius * 0.15, 0], [radius * 0.7, 0.08]], color))
  return g
}

function asteroidGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(
    poly(
      [
        [0.28, -0.08],
        [0.48, 0.04],
        [0.3, 0.22],
        [0.12, 0.1],
      ],
      color,
      true,
    ),
  )
  g.add(
    poly(
      [
        [-0.08, 0.18],
        [0.1, 0.32],
        [-0.02, 0.42],
        [-0.2, 0.28],
      ],
      color,
      true,
    ),
  )
  g.add(
    poly(
      [
        [-0.32, -0.28],
        [-0.08, -0.22],
        [-0.14, -0.02],
        [-0.38, -0.1],
      ],
      color,
      true,
    ),
  )
  g.add(poly([[0.05, -0.05], [0.22, 0.02]], color))
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
  g.add(poly([[-0.45, -0.16], [-0.05, -0.1], [-0.08, 0.14], [-0.42, 0.1]], color, true))
  g.add(poly([[0.08, -0.18], [0.42, -0.06], [0.5, 0.08], [0.12, 0.16]], color, true))
  g.add(poly([[-0.02, 0], [0.1, -0.04]], color))
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
  root.add(orientationMark(color))
  const type: TileType = def.type
  switch (type) {
    case 'EVA_1':
      root.add(evaGlyph(color))
      break
    case 'VOID':
      root.add(voidGlyph(color))
      break
    case 'PLANET_LARGE':
      root.add(planetGlyph(color, 0.4))
      break
    case 'PLANET_MEDIUM':
      root.add(planetGlyph(color, 0.3))
      break
    case 'PLANET_SMALL':
      root.add(planetGlyph(color, 0.2))
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

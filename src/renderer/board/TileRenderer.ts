import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { HEX_SIZE } from '../../game/board/hexMath'
import { palette } from '../theme'

export const TILE_THICKNESS = 0.1
/** Incoming tile sits just under the board: its top face is the placed-hex floor (y = 0). */
export const TILE_SLOT_Y = -TILE_THICKNESS
export const TILE_SETTLED_Y = 0

function hexShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    const x = radius * Math.cos(angle)
    const y = -radius * Math.sin(angle)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

export function createHexMesh(options: {
  fill: number
  stroke: number
  opacity?: number
  y?: number
  radius?: number
  dashed?: boolean
}): THREE.Group {
  const group = new THREE.Group()
  const radius = options.radius ?? HEX_SIZE * 0.96
  const opacity = options.opacity ?? 1
  const shape = hexShape(radius)
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: TILE_THICKNESS,
    bevelEnabled: false,
    steps: 1,
  })
  const mat = new THREE.MeshBasicMaterial({
    color: options.fill,
    transparent: opacity < 1 || Boolean(options.dashed),
    opacity: options.dashed ? Math.min(opacity, 0.2) : opacity,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = options.y ?? 0
  group.add(mesh)

  const topY = (options.y ?? 0) + TILE_THICKNESS + 0.002
  const botY = options.y ?? 0
  const strokeOpacity = options.dashed ? 0.95 : Math.min(1, opacity + 0.2)
  group.add(hexRing(radius, topY, options.stroke, strokeOpacity, options.dashed))
  group.add(hexRing(radius, botY, options.stroke, strokeOpacity, options.dashed))
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    const x = radius * Math.cos(angle)
    const z = radius * Math.sin(angle)
    group.add(
      hexLine(
        [new THREE.Vector3(x, botY, z), new THREE.Vector3(x, topY, z)],
        options.stroke,
        options.dashed ? 0.85 : Math.min(1, opacity + 0.15),
        options.dashed,
      ),
    )
  }
  return group
}

function hexRing(
  radius: number,
  y: number,
  color: number,
  opacity: number,
  dashed?: boolean,
): THREE.Line {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 6; i++) {
    const angle = (Math.PI / 3) * (i % 6)
    pts.push(new THREE.Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle)))
  }
  return hexLine(pts, color, opacity, dashed)
}

function hexLine(points: THREE.Vector3[], color: number, opacity: number, dashed?: boolean): THREE.Line {
  const geom = new THREE.BufferGeometry().setFromPoints(points)
  const mat = dashed
    ? new THREE.LineDashedMaterial({
        color,
        dashSize: 0.07,
        gapSize: 0.055,
        transparent: true,
        opacity,
      })
    : new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
      })
  const line = new THREE.Line(geom, mat)
  if (dashed) line.computeLineDistances()
  return line
}

export function makeDebugSprite(lines: string[]): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 512, 512)
    ctx.fillStyle = '#cfc6b4'
    ctx.font = '22px ui-monospace, monospace'
    ctx.textAlign = 'left'
    lines.forEach((line, i) => ctx.fillText(line, 24, 40 + i * 28))
  }
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(2.2, 2.2, 1)
  sprite.position.y = 0.95
  sprite.userData.isDebug = true
  return sprite
}

export function makeEdgeChevron(options: {
  origin: { x: number; z: number }
  target: { x: number; z: number }
  color: number
  kind: 'EXPLORE' | 'MOVE'
  direction: number
}): THREE.Group {
  const g = new THREE.Group()
  const dx = options.target.x - options.origin.x
  const dz = options.target.z - options.origin.z
  const len = Math.hypot(dx, dz) || 1
  const ux = dx / len
  const uz = dz / len
  const px = -uz
  const pz = ux
  const dist = HEX_SIZE * 0.82
  const cx = options.origin.x + ux * dist
  const cz = options.origin.z + uz * dist
  const y = TILE_THICKNESS + 0.04
  const tip = new THREE.Vector3(cx + ux * 0.18, y, cz + uz * 0.18)
  const left = new THREE.Vector3(cx - ux * 0.1 + px * 0.13, y, cz - uz * 0.1 + pz * 0.13)
  const right = new THREE.Vector3(cx - ux * 0.1 - px * 0.13, y, cz - uz * 0.1 - pz * 0.13)

  const shape = new THREE.Shape()
  shape.moveTo(left.x, -left.z)
  shape.lineTo(tip.x, -tip.z)
  shape.lineTo(right.x, -right.z)
  shape.closePath()
  const tri = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color: options.color,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  tri.rotation.x = -Math.PI / 2
  tri.position.y = y
  tri.userData = {
    kind: options.kind,
    direction: options.direction,
    target: options.target,
  }
  g.add(tri)

  const hit = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 20),
    new THREE.MeshBasicMaterial({
      color: options.color,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  hit.rotation.x = -Math.PI / 2
  hit.position.set(cx, y, cz)
  hit.userData = tri.userData
  g.add(hit)
  g.userData = tri.userData
  return g
}

/** Cartographic corner ticks — does not alter hex geometry. */
export function makeSelectionMarks(radius = HEX_SIZE * 0.96): THREE.Group {
  const g = new THREE.Group()
  const y = TILE_THICKNESS + 0.012
  const tick = 0.11
  const mat = new THREE.LineBasicMaterial({ color: palette.ochre })
  for (let i = 0; i < 6; i++) {
    const a0 = (Math.PI / 3) * i
    const a1 = (Math.PI / 3) * ((i + 1) % 6)
    const a2 = (Math.PI / 3) * ((i + 5) % 6)
    const vx = radius * Math.cos(a0)
    const vz = radius * Math.sin(a0)
    const along1 = new THREE.Vector3(Math.cos(a1) * radius - vx, 0, Math.sin(a1) * radius - vz).normalize()
    const along2 = new THREE.Vector3(Math.cos(a2) * radius - vx, 0, Math.sin(a2) * radius - vz).normalize()
    const origin = new THREE.Vector3(vx, y, vz)
    g.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([origin, origin.clone().addScaledVector(along1, tick)]),
        mat,
      ),
    )
    g.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([origin, origin.clone().addScaledVector(along2, tick)]),
        mat,
      ),
    )
  }
  return g
}

/**
 * Legal-destination ghost: a 2px dashed line in screen space.
 * Default WebGL lines are always 1 CSS pixel and vanish on a phone;
 * Line2 keeps a thin, readable stroke at any zoom without filling the hex.
 */
export function makeDashedHexGhost(
  direction: number,
  opacity = 0.72,
  kind: 'EXPLORE' | 'MOVE' = 'EXPLORE',
): THREE.Group {
  const g = new THREE.Group()
  const radius = HEX_SIZE * (kind === 'MOVE' ? 1.02 : 0.96)
  const y = 0.008
  const pick = { kind, direction }
  const positions: number[] = []
  for (let i = 0; i <= 6; i++) {
    const angle = (Math.PI / 3) * (i % 6)
    positions.push(radius * Math.cos(angle), y, radius * Math.sin(angle))
  }
  const geom = new LineGeometry()
  geom.setPositions(positions)
  const mat = new LineMaterial({
    color: palette.preview,
    dashed: true,
    dashSize: 0.12,
    gapSize: 0.07,
    transparent: true,
    opacity: Math.min(1, opacity),
    depthTest: false,
    depthWrite: false,
  })
  mat.linewidth = 2.25
  const line = new Line2(geom, mat)
  line.computeLineDistances()
  line.userData = pick
  g.add(line)

  const hit = new THREE.Mesh(
    new THREE.ShapeGeometry(hexShape(radius)),
    new THREE.MeshBasicMaterial({
      color: palette.preview,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    }),
  )
  hit.rotation.x = -Math.PI / 2
  hit.position.y = y
  hit.userData = pick
  g.add(hit)
  g.userData = pick
  return g
}


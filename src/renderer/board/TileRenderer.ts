import * as THREE from 'three'
import { HEX_SIZE, hexCorner } from '../../game/board/hexMath'
import { palette } from '../theme'

export const TILE_THICKNESS = 0.1
/** Incoming tile sits just under the board: its top face is the placed-hex floor (y = 0). */
export const TILE_SLOT_Y = -TILE_THICKNESS
export const TILE_SETTLED_Y = 0

function hexShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const { x, z } = hexCorner(i, radius)
    if (i === 0) shape.moveTo(x, -z)
    else shape.lineTo(x, -z)
  }
  shape.closePath()
  return shape
}

export function createHexMesh(options: {
  fill: number
  stroke: number
  opacity?: number
  strokeOpacity?: number
  y?: number
  radius?: number
  dashed?: boolean
  flat?: boolean
}): THREE.Group {
  const group = new THREE.Group()
  const radius = options.radius ?? HEX_SIZE * 0.96
  const opacity = options.opacity ?? 1
  const translucent = opacity < 1 || Boolean(options.dashed)
  const skipFill = opacity <= 0 && !options.dashed
  const thickness = options.flat ? 0.012 : TILE_THICKNESS
  if (!skipFill) {
    const shape = hexShape(radius)
    if (options.flat) {
      const mat = new THREE.MeshBasicMaterial({
        color: options.fill,
        transparent: translucent,
        opacity: options.dashed ? Math.min(opacity, 0.2) : opacity,
        side: THREE.DoubleSide,
        depthWrite: !translucent,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = (options.y ?? 0) + thickness
      group.add(mesh)
    } else {
      const geom = new THREE.ExtrudeGeometry(shape, {
        depth: TILE_THICKNESS,
        bevelEnabled: false,
        steps: 1,
      })
      const mat = new THREE.MeshBasicMaterial({
        color: options.fill,
        transparent: translucent,
        opacity: options.dashed ? Math.min(opacity, 0.2) : opacity,
        side: THREE.DoubleSide,
        depthWrite: !translucent,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = options.y ?? 0
      group.add(mesh)
    }
  } else {
    const hit = new THREE.Mesh(
      new THREE.ShapeGeometry(hexShape(radius)),
      new THREE.MeshBasicMaterial({
        color: options.stroke,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      }),
    )
    hit.rotation.x = -Math.PI / 2
    hit.position.y = (options.y ?? 0) + thickness
    group.add(hit)
  }

  const topY = (options.y ?? 0) + thickness + 0.002
  const botY = options.y ?? 0
  const strokeOpacity =
    options.strokeOpacity ?? (options.dashed ? 0.95 : Math.min(1, opacity + 0.2))
  const postOpacity = options.dashed ? 0.85 : Math.min(strokeOpacity, Math.max(opacity, strokeOpacity * 0.85))
  group.add(hexRing(radius, topY, options.stroke, strokeOpacity, options.dashed))
  if (!options.flat) {
    group.add(hexRing(radius, botY, options.stroke, strokeOpacity, options.dashed))
    for (let i = 0; i < 6; i++) {
      const { x, z } = hexCorner(i, radius)
      group.add(
        hexLine(
          [new THREE.Vector3(x, botY, z), new THREE.Vector3(x, topY, z)],
          options.stroke,
          postOpacity,
          options.dashed,
        ),
      )
    }
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
    const { x, z } = hexCorner(i % 6, radius)
    pts.push(new THREE.Vector3(x, y, z))
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
export function makeSelectionMarks(radius = HEX_SIZE * 0.96, color = palette.ochre): THREE.Group {
  const g = new THREE.Group()
  const y = TILE_THICKNESS + 0.012
  const tick = 0.11
  const mat = new THREE.LineBasicMaterial({ color })
  for (let i = 0; i < 6; i++) {
    const { x: vx, z: vz } = hexCorner(i, radius)
    const n1 = hexCorner((i + 1) % 6, radius)
    const n2 = hexCorner((i + 5) % 6, radius)
    const along1 = new THREE.Vector3(n1.x - vx, 0, n1.z - vz).normalize()
    const along2 = new THREE.Vector3(n2.x - vx, 0, n2.z - vz).normalize()
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
 * Legal-destination marker: invisible hit hex only (no frame).
 * Labels on explore ghosts carry the readable cue.
 */
export function makeDashedHexGhost(
  direction: number,
  _opacity = 0.4,
  kind: 'EXPLORE' | 'MOVE' = 'EXPLORE',
  pulse = true,
): THREE.Group {
  const g = new THREE.Group()
  const radius = HEX_SIZE * (kind === 'MOVE' ? 1.02 : 0.96)
  const y = 0.008
  const pick = { kind, direction }
  g.userData.pulse = pulse
  g.userData.pulseRest = 0

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
  g.userData = { ...pick, pulse, pulseRest: 0 }
  return g
}

export function makeHoverHighlight(radius = HEX_SIZE * 0.96, color = palette.ochre): THREE.Group {
  const g = makeSelectionMarks(radius, color)
  g.traverse((obj) => {
    obj.userData.pulse = true
    const mesh = obj as THREE.Line
    const mat = mesh.material as THREE.LineBasicMaterial | undefined
    if (mat && 'opacity' in mat) {
      mat.transparent = true
      mat.opacity = 0.9
    }
  })
  g.userData.pulse = true
  return g
}

/** Pulsing arrow from the occupied hex toward a hovered legal hex. */
export function makeHoverArrow(
  origin: { x: number; z: number },
  target: { x: number; z: number },
  color = palette.ochre,
  manhattan = false,
): THREE.Group {
  const g = new THREE.Group()
  const y = TILE_THICKNESS + 0.05
  const lineMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  })
  if (manhattan) {
    const ax = origin.x
    const az = origin.z
    const bx = target.x
    const bz = target.z
    const elbow = new THREE.Vector3(bx, y, az)
    const start = new THREE.Vector3(ax, y, az)
    const end = new THREE.Vector3(bx, y, bz)
    const shaft = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([start, elbow, end]),
      lineMat,
    )
    shaft.userData.pulse = true
    g.add(shaft)
    const headSize = 0.1
    const towardX = Math.abs(bx - ax) >= Math.abs(bz - az)
    const hx = towardX ? (bx > ax ? -headSize : headSize) : 0
    const hz = towardX ? 0 : bz > az ? -headSize : headSize
    const tip = end
    const left = new THREE.Vector3(bx + hx + (towardX ? 0 : -headSize), y, bz + hz + (towardX ? -headSize : 0))
    const right = new THREE.Vector3(bx + hx + (towardX ? 0 : headSize), y, bz + hz + (towardX ? headSize : 0))
    g.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([left, tip, right]),
        lineMat,
      ),
    )
    g.userData.pulse = true
    return g
  }
  const dx = target.x - origin.x
  const dz = target.z - origin.z
  const len = Math.hypot(dx, dz) || 1
  const ux = dx / len
  const uz = dz / len
  const px = -uz
  const pz = ux
  const start = HEX_SIZE * 0.42
  const end = len - HEX_SIZE * 0.38
  const ax = origin.x + ux * start
  const az = origin.z + uz * start
  const bx = origin.x + ux * end
  const bz = origin.z + uz * end
  const shaft = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(ax, y, az),
      new THREE.Vector3(bx - ux * 0.12, y, bz - uz * 0.12),
    ]),
    lineMat,
  )
  shaft.userData.pulse = true
  g.add(shaft)

  const tip = new THREE.Vector3(bx, y, bz)
  const left = new THREE.Vector3(bx - ux * 0.16 + px * 0.1, y, bz - uz * 0.16 + pz * 0.1)
  const right = new THREE.Vector3(bx - ux * 0.16 - px * 0.1, y, bz - uz * 0.16 - pz * 0.1)
  const shape = new THREE.Shape()
  shape.moveTo(left.x, -left.z)
  shape.lineTo(tip.x, -tip.z)
  shape.lineTo(right.x, -right.z)
  shape.closePath()
  const head = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  )
  head.rotation.x = -Math.PI / 2
  head.position.y = y
  head.userData.pulse = true
  g.add(head)
  g.userData.pulse = true
  return g
}

export function pulseHexGhosts(root: THREE.Object3D, timeSeconds: number): void {
  const wave = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(timeSeconds * 5.2))
  root.traverse((obj) => {
    if (!obj.userData.pulse) return
    const mat = (obj as THREE.Mesh).material as THREE.Material & { opacity?: number }
    if (!mat || Array.isArray(mat) || typeof mat.opacity !== 'number') return
    mat.transparent = true
    mat.opacity = wave
  })
}


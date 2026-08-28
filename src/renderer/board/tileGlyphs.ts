import * as THREE from 'three'
import type { TileType } from '../../game/board/tileRotation'
import type { TileDefinition } from '../../game/board/tileRotation'
import { palette } from '../theme'
import { asteroidCollisionPercent } from '../../game/definitions/tiles'
import type { EdgeNumbers } from '../../game/board/edgeNumbers'
import { HEX_SIZE, hexCorner, hexEdgeCorners, hexEdgeFrame } from '../../game/board/hexMath'
import { EVA_DOCK_COUNT, EVA_DOCK_RADIUS, EVA_HUB_SPIN, EVA_PULSE_STEP_S, evaDockAngle } from './evaDocks'
import { RNG } from '../../game/random/RNG'

/** Inward from the edge midpoint, on the top face (not the side wall). Small so the digit sits on the rim. */
export const EDGE_DIGIT_INSET = 0.05

const CARGO_KINDS = ['ORE', 'BIOMASS', 'ICE', 'FUEL'] as const
export type WreckCargoKind = (typeof CARGO_KINDS)[number]

const CARGO_COLOR: Record<WreckCargoKind, number> = {
  ORE: palette.resourceRed,
  BIOMASS: palette.resourceGreen,
  ICE: palette.resourceBlue,
  FUEL: palette.ochre,
}

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

function planetGlyph(color: number, size: 'L' | 'M' | 'S', salt: string): THREE.Group {
  const root = new THREE.Group()
  const spin = new THREE.Group()
  const rng = new RNG(`planet-spin:${salt}`)
  spin.userData.animate = 'spin'
  spin.userData.spinRate = 0.055 + rng.next() * 0.14
  spin.userData.spinPhase = rng.next() * Math.PI * 2
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
    moonArm.userData.spinRate = 0.28 + rng.next() * 0.7
    moonArm.userData.spinPhase = rng.next() * Math.PI * 2
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

function asteroidGlyph(color: number, edges: TileDefinition['edges'], salt: string): THREE.Group {
  const g = new THREE.Group()
  const rng = new RNG(`asteroid-rim:${salt}`)
  for (let i = 0; i < 6; i++) {
    if (edges[i] !== 'ASTEROID') continue
    const e = hexEdgeFrame(i, HEX_SIZE * 0.72)
    const count = 5
    for (let p = 0; p < count; p++) {
      const u = p / (count - 1)
      const along = (u - 0.5) * e.edgeLen * 0.82
      const cx = e.mx + e.tx * along
      const cz = e.mz + e.tz * along
      const rad = 0.038 + rng.next() * 0.028
      const pts: Array<[number, number]> = []
      const sides = 5 + rng.nextInt(3)
      for (let s = 0; s < sides; s++) {
        const a = (Math.PI * 2 * s) / sides + rng.next() * 0.4
        const rr = rad * (0.55 + rng.next() * 0.55)
        pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr])
      }
      const spinY = (0.18 + i * 0.11 + p * 0.07 + rng.next() * 0.2) * (p % 2 === 0 ? 1 : -1)
      g.add(spinningRock(pts, color, spinY, e.yaw))
    }
  }
  return g
}

function spinningRock(
  points: Array<[number, number]>,
  color: number,
  spinY: number,
  spinBase = 0,
): THREE.Group {
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
  g.rotation.y = spinBase
  g.add(poly(local, color, true))
  g.userData.animate = 'asteroid'
  g.userData.spinY = spinY
  g.userData.spinBase = spinBase
  return g
}

function shadowBaseGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(poly([[-0.38, -0.32], [0.22, -0.32], [0.22, 0.32], [-0.38, 0.32]], color, true))
  g.add(poly([[-0.22, -0.18], [0.08, -0.18], [0.08, 0.18], [-0.22, 0.18]], color, true))
  g.add(poly([[0.22, -0.12], [0.5, 0], [0.22, 0.12]], color))
  return g
}

function tankerGlyph(color: number, salt: string): THREE.Group {
  const g = new THREE.Group()
  g.add(poly([[-0.5, -0.12], [0.32, -0.12], [0.55, 0], [0.32, 0.12], [-0.5, 0.12]], color, true))
  g.add(poly([[-0.28, -0.12], [-0.28, 0.12]], color))
  g.add(poly([[0.02, -0.12], [0.02, 0.12]], color))
  addWreckContainers(g, salt)
  return g
}

function cargoCube(kind: WreckCargoKind, size: number): THREE.Group {
  const g = new THREE.Group()
  const color = CARGO_COLOR[kind]
  const geom = new THREE.BoxGeometry(size, size, size)
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), lineMat(color)))
  g.userData.cargoCube = kind
  g.userData.crateRadius = size * 0.62
  return g
}

function addWreckContainers(g: THREE.Group, salt: string): void {
  const rng = new RNG(`wreck-cargo:${salt}`)
  const count = 2 + rng.nextInt(2)
  const kinds = rng.shuffle(CARGO_KINDS).slice(0, count)
  const slots: Array<[number, number]> = [
    [-0.28, -0.28],
    [0.22, -0.26],
    [0.02, 0.3],
  ]
  kinds.forEach((kind, index) => {
    const size = 0.08
    const box = cargoCube(kind, size)
    const [x, z] = slots[index] ?? slots[0]
    box.position.set(x, Y + size * 0.5, z)
    box.userData.animate = 'crate'
    const speed = 0.12 + rng.next() * 0.1
    const a = rng.next() * Math.PI * 2
    box.userData.vx = Math.cos(a) * speed
    box.userData.vz = Math.sin(a) * speed
    box.userData.spinX = (0.4 + rng.next() * 0.8) * (rng.next() < 0.5 ? -1 : 1)
    box.userData.spinY = (0.5 + rng.next() * 0.9) * (rng.next() < 0.5 ? -1 : 1)
    box.userData.spinZ = (0.3 + rng.next() * 0.7) * (rng.next() < 0.5 ? -1 : 1)
    g.add(box)
  })
}

function transportGlyph(hullColor: number, salt: string): THREE.Group {
  const g = new THREE.Group()
  g.add(poly([[-0.18, -0.28], [0.18, -0.28], [0.18, 0.08], [-0.18, 0.08]], hullColor, true))
  g.add(poly([[-0.1, -0.18], [0.1, -0.18], [0.1, -0.02], [-0.1, -0.02]], hullColor, true))
  g.add(poly([[-0.48, 0.08], [-0.18, 0.08], [-0.18, 0.28], [-0.48, 0.22]], hullColor, true))
  g.add(poly([[0.18, 0.08], [0.5, 0.14], [0.48, 0.3], [0.18, 0.28]], hullColor, true))
  g.add(poly([[-0.08, 0.08], [-0.02, 0.22]], hullColor))
  g.add(poly([[0.06, 0.08], [0.14, 0.2]], hullColor))
  g.add(poly([[-0.12, -0.28], [-0.2, -0.42]], hullColor))
  g.add(poly([[0.12, -0.28], [0.22, -0.4]], hullColor))
  addWreckContainers(g, salt)
  return g
}

function blackHoleGlyph(color: number): THREE.Group {
  const root = new THREE.Group()
  const spin = new THREE.Group()
  spin.userData.animate = 'spin'
  spin.userData.spinRate = 0.42
  spin.userData.spinPhase = 0
  spin.add(circle(0.18, color))
  spin.add(circle(0.34, color, 40, 0.7))
  const spiral: Array<[number, number]> = []
  for (let i = 0; i <= 28; i++) {
    const t = i / 28
    const a = t * Math.PI * 1.7
    const r = 0.12 + t * 0.42
    spiral.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  spin.add(poly(spiral, color))
  root.add(spin)
  return root
}

function fuelHexGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.userData.fuelCell = true
  g.userData.fuelHex = true
  const hex: Array<[number, number]> = []
  const r = 0.072
  for (let i = 0; i < 6; i++) {
    const { x, z } = hexCorner(i, r)
    hex.push([x, z])
  }
  g.add(poly(hex, color, true))
  g.add(circle(0.028, color, 16))
  g.add(
    poly(
      [
        [-0.018, -0.02],
        [0.01, -0.02],
        [0.01, 0.02],
        [-0.018, 0.02],
      ],
      color,
      true,
    ),
  )
  g.add(
    poly(
      [
        [0.01, -0.008],
        [0.02, -0.008],
        [0.02, 0.008],
        [0.01, 0.008],
      ],
      color,
      true,
    ),
  )
  g.position.set(0.52, 0, 0.48)
  return g
}

function vortexGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.userData.vortexGlyph = true
  const ink = color
  g.add(poly(
    Array.from({ length: 6 }, (_, i) => {
      const { x, z } = hexCorner(i, 0.62)
      return [x, z] as [number, number]
    }),
    ink,
    true,
  ))
  const outer = new THREE.Group()
  outer.userData.animate = 'spin'
  outer.userData.spinRate = 0.85
  outer.userData.spinPhase = 0
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i
    const x = Math.cos(a) * 0.38
    const z = Math.sin(a) * 0.38
    const px = -Math.sin(a)
    const pz = Math.cos(a)
    outer.add(
      poly(
        [
          [x - px * 0.1, z - pz * 0.1],
          [x + Math.cos(a) * 0.16, z + Math.sin(a) * 0.16],
          [x + px * 0.1, z + pz * 0.1],
        ],
        ink,
      ),
    )
  }
  g.add(outer)
  const inner = new THREE.Group()
  inner.userData.animate = 'spin'
  inner.userData.spinRate = -1.35
  inner.userData.spinPhase = 0.4
  inner.add(circle(0.16, ink, 6))
  inner.add(circle(0.28, ink, 6, 0.75))
  g.add(inner)
  return g
}

function spaceGateGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  const hex = (r: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = []
    for (let i = 0; i < 6; i++) {
      const { x, z } = hexCorner(i, r)
      pts.push([x, z])
    }
    return pts
  }
  g.add(poly(hex(0.46), color, true))
  g.add(poly(hex(0.28), color, true))
  g.add(poly([[-0.12, 0], [0.12, 0]], color))
  return g
}

function straitGlyph(edges: TileDefinition['edges'], color: number, salt: string): THREE.Group {
  const g = new THREE.Group()
  g.userData.straitGlyph = true
  const rng = new RNG(`strait-rocks:${salt}`)
  let open = 0
  let blocked = 0
  const r = HEX_SIZE * 0.93
  for (let i = 0; i < 6; i++) {
    const [p0, p1] = hexEdgeCorners(i, r)
    if (edges[i] !== 'BLOCKED') {
      open += 1
      continue
    }
    blocked += 1
    const cluster = new THREE.Group()
    cluster.userData.straitBlocked = true
    cluster.userData.blockedFace = i
    const mx = (p0.x + p1.x) / 2
    const mz = (p0.z + p1.z) / 2
    const edgeLen = Math.hypot(p1.x - p0.x, p1.z - p0.z) || 1
    const tx = (p1.x - p0.x) / edgeLen
    const tz = (p1.z - p0.z) / edgeLen
    const inward = Math.hypot(mx, mz) || 1
    const ix = -mx / inward
    const iz = -mz / inward
    const pebbles = 26 + rng.nextInt(8)
    for (let p = 0; p < pebbles; p++) {
      const u = rng.next()
      const along = (u - 0.5) * edgeLen * 0.9
      const mid = 1 - Math.abs(u - 0.5) * 2
      const inset = 0.05 + rng.next() * (0.1 + mid * 0.34)
      const jitter = (rng.next() - 0.5) * 0.04
      const cx = mx + tx * (along + jitter) + ix * inset
      const cz = mz + tz * (along + jitter) + iz * inset
      const rad = 0.012 + rng.next() * 0.016
      const pts: Array<[number, number]> = []
      const sides = 5 + rng.nextInt(3)
      for (let s = 0; s < sides; s++) {
        const a = (Math.PI * 2 * s) / sides + rng.next() * 0.5
        const rr = rad * (0.6 + rng.next() * 0.55)
        pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr])
      }
      const spinY = (0.16 + p * 0.031 + rng.next() * 0.22) * (p % 2 === 0 ? 1 : -1)
      cluster.add(spinningRock(pts, color, spinY, Math.atan2(-tz, tx)))
    }
    g.add(cluster)
  }
  g.userData.openChannels = open
  g.userData.blockedWalls = blocked
  return g
}

function canvasSprite(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  userData: Record<string, unknown>,
): THREE.Object3D {
  if (typeof document === 'undefined') {
    const stub = new THREE.Group()
    Object.assign(stub.userData, userData)
    return stub
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) draw(ctx)
  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthTest: false,
  })
  const sprite = new THREE.Sprite(mat)
  Object.assign(sprite.userData, userData)
  return sprite
}

function chanceLabel(text: string, color: number): THREE.Object3D {
  const sprite = canvasSprite(256, 64, (ctx) => {
    ctx.clearRect(0, 0, 256, 64)
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`
    ctx.font = '600 36px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 34)
  }, { collisionChance: true })
  sprite.scale.set(0.42, 0.1, 1)
  sprite.position.set(0, 0.04, 0.55)
  return sprite
}

function edgeDigitPlane(n: number, color: number): THREE.Object3D {
  const userData = { edgeDigit: n, edgeTop: true }
  if (typeof document === 'undefined') {
    const stub = new THREE.Group()
    Object.assign(stub.userData, userData)
    stub.rotation.x = -Math.PI / 2
    return stub
  }
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64)
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`
    ctx.font = '600 36px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(n), 32, 34)
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.07, 0.07),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 8
  Object.assign(mesh.userData, userData)
  return mesh
}

function edgeNumberMarks(numbers: EdgeNumbers, color: number): THREE.Group {
  const g = new THREE.Group()
  g.userData.edgeNumbers = true
  const r = HEX_SIZE * 0.96
  for (let i = 0; i < 6; i++) {
    const [p0, p1] = hexEdgeCorners(i, r)
    const mx = (p0.x + p1.x) / 2
    const mz = (p0.z + p1.z) / 2
    const len = Math.hypot(mx, mz) || 1
    const x = mx - (mx / len) * EDGE_DIGIT_INSET
    const z = mz - (mz / len) * EDGE_DIGIT_INSET
    const holder = new THREE.Group()
    holder.position.set(x, 0.035, z)
    holder.rotation.y = Math.atan2(mx, mz)
    holder.userData.edgeDigitHolder = true
    const mark = edgeDigitPlane(numbers[i], color)
    mark.userData.digitColor = color
    holder.add(mark)
    g.add(holder)
  }
  return g
}

export function createTileGlyph(
  def: TileDefinition,
  color = palette.paper,
  salt = def.id,
  scan = false,
  edgeNumbers?: EdgeNumbers,
  ink = false,
): THREE.Group {
  if (ink) return createInkTileGlyph(def, color, salt, scan, edgeNumbers)
  const root = new THREE.Group()
  const type: TileType = def.type
  const planetColor = scan ? color : planetTintForId(salt)
  switch (type) {
    case 'EVA_1':
      root.add(evaGlyph(color))
      break
    case 'VOID':
      root.add(voidGlyph(color))
      break
    case 'PLANET_LARGE':
      root.add(planetGlyph(planetColor, 'L', salt))
      break
    case 'PLANET_MEDIUM':
      root.add(planetGlyph(planetColor, 'M', salt))
      break
    case 'PLANET_SMALL':
      root.add(planetGlyph(planetColor, 'S', salt))
      break
    case 'ASTEROID':
      root.add(asteroidGlyph(color, def.edges, salt))
      root.add(chanceLabel(`${asteroidCollisionPercent(def.edges)}%`, color))
      break
    case 'SHADOW_BASE':
      root.add(shadowBaseGlyph(color))
      break
    case 'WRECK_TANKER':
      root.add(tankerGlyph(color, salt))
      break
    case 'WRECK_TRANSPORT':
      root.add(transportGlyph(color, salt))
      break
    case 'BLACK_HOLE':
      root.add(blackHoleGlyph(color))
      break
    case 'VORTEX':
      root.add(vortexGlyph(color))
      break
    case 'SPACE_GATE':
      root.add(spaceGateGlyph(color))
      break
    case 'STRAIT':
      root.add(straitGlyph(def.edges, color, salt))
      break
    default:
      root.add(voidGlyph(color))
  }
  if (type === 'WRECK_TANKER') root.add(fuelHexGlyph(scan ? color : palette.ochre))
  if (edgeNumbers) root.add(edgeNumberMarks(edgeNumbers, color))
  return root
}

function square(cx: number, cz: number, half: number, color: number): THREE.Line {
  return poly(
    [
      [cx - half, cz - half],
      [cx + half, cz - half],
      [cx + half, cz + half],
      [cx - half, cz + half],
    ],
    color,
    true,
  )
}

function plusMark(size: number, color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(poly([[-size, 0], [size, 0]], color))
  g.add(poly([[0, -size], [0, size]], color))
  return g
}

function createInkTileGlyph(
  def: TileDefinition,
  color: number,
  salt: string,
  _scan: boolean,
  edgeNumbers?: EdgeNumbers,
): THREE.Group {
  const root = new THREE.Group()
  root.userData.ink = true
  const c = color
  const type: TileType = def.type
  switch (type) {
    case 'EVA_1': {
      const g = new THREE.Group()
      g.add(square(0, 0, 0.12, c))
      g.add(plusMark(0.07, c))
      g.add(square(0, 0, 0.36, c))
      g.add(square(0, 0, 0.5, c))
      for (let k = 0; k < EVA_DOCK_COUNT; k++) {
        const a = evaDockAngle(k)
        const x = Math.round(Math.cos(a)) * EVA_DOCK_RADIUS
        const z = Math.round(Math.sin(a)) * EVA_DOCK_RADIUS
        g.add(square(x, z, 0.04, c))
      }
      root.add(g)
      break
    }
    case 'VOID':
      root.add(plusMark(0.32, c))
      root.add(square(0, 0, 0.08, c))
      break
    case 'PLANET_LARGE':
      root.add(square(0, 0, 0.42, c))
      root.add(square(0, 0, 0.28, c))
      root.add(square(0, 0, 0.1, c))
      break
    case 'PLANET_MEDIUM':
      root.add(square(0, 0, 0.3, c))
      root.add(square(0, 0, 0.12, c))
      root.add(square(0.38, 0, 0.05, c))
      break
    case 'PLANET_SMALL':
      root.add(square(0, 0, 0.2, c))
      root.add(square(0, 0, 0.06, c))
      break
    case 'ASTEROID':
      root.add(inkEdgeRocks(def.edges, 'ASTEROID', c))
      root.add(chanceLabel(`${asteroidCollisionPercent(def.edges)}%`, c))
      break
    case 'SHADOW_BASE':
      root.add(square(-0.08, 0, 0.32, c))
      root.add(square(-0.08, 0, 0.16, c))
      root.add(poly([[0.24, -0.1], [0.5, 0], [0.24, 0.1], [0.24, -0.1]], c, true))
      break
    case 'WRECK_TANKER':
      root.add(poly([[-0.3, -0.12], [0.28, -0.12], [0.28, 0.12], [-0.3, 0.12]], c, true))
      addInkCrates(root, salt)
      root.add(inkBattery(c))
      break
    case 'WRECK_TRANSPORT':
      root.add(poly([[-0.18, -0.28], [0.18, -0.28], [0.18, 0.22], [-0.18, 0.22]], c, true))
      root.add(square(0, -0.08, 0.08, c))
      addInkCrates(root, salt)
      break
    case 'BLACK_HOLE':
      root.add(square(0, 0, 0.18, c))
      root.add(square(0, 0, 0.34, c))
      root.add(plusMark(0.42, c))
      break
    case 'VORTEX':
      root.add(square(0, 0, 0.16, c))
      root.add(square(0, 0, 0.28, c))
      root.add(square(0, 0, 0.42, c))
      root.add(plusMark(0.1, c))
      break
    case 'SPACE_GATE':
      root.add(square(0, 0, 0.42, c))
      root.add(square(0, 0, 0.24, c))
      root.add(poly([[-0.12, 0], [0.12, 0]], c))
      break
    case 'STRAIT':
      root.add(inkStrait(def.edges, c))
      break
    default:
      root.add(plusMark(0.32, c))
  }
  if (edgeNumbers) root.add(edgeNumberMarks(edgeNumbers, c))
  return root
}

function inkBattery(color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(square(0.52, 0.48, 0.06, color))
  g.add(poly([[0.56, 0.47], [0.6, 0.47], [0.6, 0.49], [0.56, 0.49]], color, true))
  return g
}

function addInkCrates(g: THREE.Group, salt: string): void {
  const rng = new RNG(`wreck-cargo:${salt}`)
  const count = 2 + rng.nextInt(2)
  const kinds = rng.shuffle(CARGO_KINDS).slice(0, count)
  const slots: Array<[number, number]> = [
    [-0.28, -0.28],
    [0.22, -0.26],
    [0.02, 0.3],
  ]
  kinds.forEach((kind, index) => {
    const size = 0.08
    const box = new THREE.Group()
    box.add(square(0, 0, size * 0.5, 0xffffff))
    box.userData.cargoCube = kind
    box.userData.crateRadius = size * 0.62
    const [x, z] = slots[index] ?? slots[0]
    box.position.set(x, Y, z)
    box.userData.animate = 'crate'
    const speed = 0.12 + rng.next() * 0.1
    const axis = rng.next() < 0.5
    box.userData.vx = axis ? speed : 0
    box.userData.vz = axis ? 0 : speed
    box.userData.spinX = 0
    box.userData.spinY = 0
    box.userData.spinZ = 0
    g.add(box)
  })
}

function inkEdgeRocks(
  edges: TileDefinition['edges'],
  mark: 'ASTEROID' | 'BLOCKED',
  color: number,
): THREE.Group {
  const g = new THREE.Group()
  g.userData.straitGlyph = mark === 'BLOCKED'
  const r = HEX_SIZE * 0.78
  for (let i = 0; i < 6; i++) {
    if (edges[i] !== mark) continue
    const e = hexEdgeFrame(i, r)
    const cluster = new THREE.Group()
    cluster.userData.straitBlocked = mark === 'BLOCKED'
    cluster.userData.blockedFace = i
    cluster.userData.edgeRocks = true
    cluster.userData.edgeFace = i
    const count = 5
    const n0 = (count - 1) / 2
    const spacing = (e.edgeLen * 0.72) / Math.max(1, count - 1)
    for (let n = 0; n < count; n++) {
      const along = (n - n0) * spacing
      const tile = new THREE.Group()
      tile.position.set(e.mx + e.tx * along, 0, e.mz + e.tz * along)
      tile.rotation.y = e.yaw
      tile.userData.edgeAligned = true
      tile.userData.edgeYaw = e.yaw
      tile.add(
        poly(
          [
            [-0.04, -0.04],
            [0.04, -0.04],
            [0.04, 0.04],
            [-0.04, 0.04],
          ],
          color,
          true,
        ),
      )
      cluster.add(tile)
    }
    g.add(cluster)
  }
  return g
}

function inkStrait(edges: TileDefinition['edges'], color: number): THREE.Group {
  return inkEdgeRocks(edges, 'BLOCKED', color)
}

function pointInFlatHex(x: number, z: number, radius: number): boolean {
  const q = ((2 / 3) * x) / radius
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * z) / radius
  const s = -q - r
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= 1
}

function bounceInHex(
  x: number,
  z: number,
  vx: number,
  vz: number,
  radius: number,
): { x: number; z: number; vx: number; vz: number } {
  let nx = x
  let nz = z
  let ovx = vx
  let ovz = vz
  if (!pointInFlatHex(nx, nz, radius)) {
    const len = Math.hypot(nx, nz) || 1
    const hx = nx / len
    const hz = nz / len
    const dot = ovx * hx + ovz * hz
    if (dot > 0) {
      ovx -= 2 * dot * hx
      ovz -= 2 * dot * hz
    }
    nx -= hx * 0.02
    nz -= hz * 0.02
  }
  return { x: nx, z: nz, vx: ovx, vz: ovz }
}

function hasInkAncestor(obj: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = obj
  while (node) {
    if (node.userData.ink) return true
    node = node.parent
  }
  return false
}

function tickCrates(root: THREE.Object3D, time: number): void {
  const last = Number(root.userData.crateTime ?? time)
  const dt = Math.min(0.05, Math.max(0, time - last))
  root.userData.crateTime = time
  const crates: THREE.Object3D[] = []
  root.traverse((obj) => {
    if (obj.userData.animate === 'crate') crates.push(obj)
  })
  const limit = HEX_SIZE * 0.72
  for (const crate of crates) {
    if (crate.userData.spinX || crate.userData.spinY || crate.userData.spinZ) {
      crate.rotation.x = time * Number(crate.userData.spinX || 0)
      crate.rotation.y = time * Number(crate.userData.spinY || 0)
      crate.rotation.z = time * Number(crate.userData.spinZ || 0)
    }
    let x = crate.position.x + Number(crate.userData.vx || 0) * dt
    let z = crate.position.z + Number(crate.userData.vz || 0) * dt
    const bounced = bounceInHex(x, z, Number(crate.userData.vx || 0), Number(crate.userData.vz || 0), limit)
    crate.userData.vx = bounced.vx
    crate.userData.vz = bounced.vz
    crate.position.x = bounced.x
    crate.position.z = bounced.z
  }
  for (let i = 0; i < crates.length; i++) {
    for (let j = i + 1; j < crates.length; j++) {
      const a = crates[i]
      const b = crates[j]
      const dx = b.position.x - a.position.x
      const dz = b.position.z - a.position.z
      const dist = Math.hypot(dx, dz) || 0.0001
      const min = Number(a.userData.crateRadius || 0.05) + Number(b.userData.crateRadius || 0.05)
      if (dist >= min) continue
      const nx = dx / dist
      const nz = dz / dist
      const overlap = min - dist
      a.position.x -= nx * overlap * 0.5
      a.position.z -= nz * overlap * 0.5
      b.position.x += nx * overlap * 0.5
      b.position.z += nz * overlap * 0.5
      const avx = Number(a.userData.vx || 0)
      const avz = Number(a.userData.vz || 0)
      const bvx = Number(b.userData.vx || 0)
      const bvz = Number(b.userData.vz || 0)
      const rel = (avx - bvx) * nx + (avz - bvz) * nz
      if (rel > 0) continue
      a.userData.vx = avx - rel * nx
      a.userData.vz = avz - rel * nz
      b.userData.vx = bvx + rel * nx
      b.userData.vz = bvz + rel * nz
    }
  }
}

export function tickTileGlyphs(
  root: THREE.Object3D,
  time: number,
  vortexFlash?: { face: number | null; hold: boolean } | null,
): void {
  tickCrates(root, time)
  root.traverse((obj) => {
    if (hasInkAncestor(obj)) return
    if (obj.userData.animate === 'asteroid') {
      obj.rotation.x = 0
      obj.rotation.z = 0
      obj.rotation.y = Number(obj.userData.spinBase || 0) + time * Number(obj.userData.spinY || 0)
    }
    if (obj.userData.animate === 'spin') {
      const rate = Number(obj.userData.spinRate ?? 0.12)
      const phase = Number(obj.userData.spinPhase ?? 0)
      obj.rotation.y = phase + time * rate
    }
    if (obj.userData.animate === 'moon') {
      const rate = Number(obj.userData.spinRate ?? Math.PI * 2 / 12)
      const phase = Number(obj.userData.spinPhase ?? 0)
      obj.rotation.y = phase + time * rate
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
    if (typeof obj.userData.edgeDigit === 'number' && obj instanceof THREE.Mesh) {
      const mat = obj.material
      if (!Array.isArray(mat) && 'opacity' in mat) {
        mat.transparent = true
        if (!vortexFlash || vortexFlash.face === null) {
          mat.opacity = 1
        } else {
          const on = obj.userData.edgeDigit === vortexFlash.face
          mat.opacity = on ? 1 : vortexFlash.hold ? 0.18 : 0.28
        }
      }
    }
  })
}

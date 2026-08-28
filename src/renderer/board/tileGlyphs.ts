import * as THREE from 'three'
import type { TileType } from '../../game/board/tileRotation'
import type { TileDefinition } from '../../game/board/tileRotation'
import { palette } from '../theme'
import { asteroidCollisionPercent } from '../../game/definitions/tiles'
import type { EdgeNumbers } from '../../game/board/edgeNumbers'
import { HEX_SIZE } from '../../game/board/hexMath'
import { EVA_DOCK_COUNT, EVA_DOCK_RADIUS, EVA_HUB_SPIN, EVA_PULSE_STEP_S, evaDockAngle } from './evaDocks'
import { RNG } from '../../game/random/RNG'

/** Midpoint of each top-face edge, scaled toward the hex center. */
export const EDGE_DIGIT_INSET = 0.78

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

function cargoCube(kind: WreckCargoKind, size: number): THREE.Group {
  const g = new THREE.Group()
  const color = CARGO_COLOR[kind]
  const geom = new THREE.BoxGeometry(size, size, size)
  const fill = new THREE.Mesh(
    geom,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    }),
  )
  g.add(fill)
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), lineMat(color)))
  g.userData.cargoCube = kind
  return g
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

  const rng = new RNG(`wreck-cargo:${salt}`)
  const count = 2 + rng.nextInt(2)
  const kinds = rng.shuffle(CARGO_KINDS).slice(0, count)
  const slots: Array<[number, number]> = [
    [-0.34, -0.14],
    [0.3, -0.2],
    [0.02, 0.34],
  ]
  kinds.forEach((kind, index) => {
    const size = 0.07 + rng.next() * 0.025
    const box = cargoCube(kind, size)
    const [x, z] = slots[index] ?? slots[0]
    box.position.set(x, Y + size * 0.5, z)
    box.userData.animate = 'crate'
    box.userData.spinY = (rng.next() * 1.1 + 0.25) * (rng.next() < 0.5 ? -1 : 1)
    g.add(box)
  })
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

function fuelHexGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.userData.fuelCell = true
  g.userData.fuelHex = true
  const hex: Array<[number, number]> = []
  const r = 0.072
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i
    hex.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  g.add(poly(hex, color, true))
  g.add(circle(0.028, color, 16))
  g.position.set(0.52, 0, 0.48)
  return g
}

function repairGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.userData.repairMark = true
  g.add(poly([[-0.055, -0.01], [0.018, -0.01], [0.018, 0.01], [-0.055, 0.01]], color, true))
  g.add(
    poly(
      [
        [0.018, -0.01],
        [0.05, -0.028],
        [0.062, -0.016],
        [0.034, 0],
        [0.062, 0.016],
        [0.05, 0.028],
        [0.018, 0.01],
      ],
      color,
      true,
    ),
  )
  g.position.set(0.68, 0, 0.48)
  return g
}

function vortexGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  g.add(circle(0.42, color, 40, 0.85))
  const spiral: Array<[number, number]> = []
  for (let i = 0; i <= 32; i++) {
    const t = i / 32
    const a = t * Math.PI * 2.4
    const r = 0.06 + t * 0.38
    spiral.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  g.add(poly(spiral, color))
  return g
}

function spaceGateGlyph(color: number): THREE.Group {
  const g = new THREE.Group()
  const hex = (r: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = []
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i
      pts.push([Math.cos(a) * r, Math.sin(a) * r])
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
  const r = HEX_SIZE * 0.88
  for (let i = 0; i < 6; i++) {
    const a0 = (Math.PI / 3) * i
    const a1 = (Math.PI / 3) * (i + 1)
    const x0 = Math.cos(a0) * r
    const z0 = Math.sin(a0) * r
    const x1 = Math.cos(a1) * r
    const z1 = Math.sin(a1) * r
    if (edges[i] !== 'BLOCKED') {
      open += 1
      continue
    }
    blocked += 1
    const cluster = new THREE.Group()
    cluster.userData.straitBlocked = true
    cluster.userData.blockedFace = i
    const mx = (x0 + x1) / 2
    const mz = (z0 + z1) / 2
    const edgeLen = Math.hypot(x1 - x0, z1 - z0) || 1
    const tx = (x1 - x0) / edgeLen
    const tz = (z1 - z0) / edgeLen
    const inward = Math.hypot(mx, mz) || 1
    const ix = -mx / inward
    const iz = -mz / inward
    const pebbles = 4 + rng.nextInt(3)
    for (let p = 0; p < pebbles; p++) {
      const along = (p / Math.max(1, pebbles - 1) - 0.5) * edgeLen * 0.62
      const inset = 0.1 + rng.next() * 0.08
      const jitter = (rng.next() - 0.5) * 0.04
      const cx = mx + tx * (along + jitter) + ix * inset
      const cz = mz + tz * (along + jitter) + iz * inset
      const rad = 0.028 + rng.next() * 0.03
      const pts: Array<[number, number]> = []
      const sides = 5 + rng.nextInt(2)
      for (let s = 0; s < sides; s++) {
        const a = (Math.PI * 2 * s) / sides + rng.next() * 0.4
        const rr = rad * (0.7 + rng.next() * 0.45)
        pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr])
      }
      cluster.add(spinningRock(pts, color, (0.2 + rng.next() * 0.5) * (rng.next() < 0.5 ? -1 : 1)))
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
    return stub
  }
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64)
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`
    ctx.font = '600 44px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(n), 32, 34)
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.09, 0.09),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  Object.assign(mesh.userData, userData)
  return mesh
}

function edgeNumberMarks(numbers: EdgeNumbers, color: number): THREE.Group {
  const g = new THREE.Group()
  g.userData.edgeNumbers = true
  const r = HEX_SIZE * 0.96
  for (let i = 0; i < 6; i++) {
    const a0 = (Math.PI / 3) * i
    const a1 = (Math.PI / 3) * (i + 1)
    const mx = ((r * Math.cos(a0) + r * Math.cos(a1)) / 2) * EDGE_DIGIT_INSET
    const mz = ((r * Math.sin(a0) + r * Math.sin(a1)) / 2) * EDGE_DIGIT_INSET
    const mark = edgeDigitPlane(numbers[i], color)
    mark.position.set(mx, Y + 0.002, mz)
    mark.rotation.set(-Math.PI / 2, Math.atan2(-mx, -mz), 0)
    mark.userData.digitColor = color
    g.add(mark)
  }
  return g
}

export function createTileGlyph(
  def: TileDefinition,
  color = palette.paper,
  salt = def.id,
  scan = false,
  edgeNumbers?: EdgeNumbers,
): THREE.Group {
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
      root.add(asteroidGlyph(color))
      root.add(chanceLabel(`${asteroidCollisionPercent(def.edges)}%`, color))
      break
    case 'SHADOW_BASE':
      root.add(shadowBaseGlyph(color))
      break
    case 'WRECK_TANKER':
      root.add(tankerGlyph(color))
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
  if (type === 'EVA_1') root.add(repairGlyph(scan ? color : palette.ivory))
  if (edgeNumbers) root.add(edgeNumberMarks(edgeNumbers, color))
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
  })
}

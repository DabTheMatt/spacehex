import * as THREE from 'three'
import { missileSidePoint, missileWorldPos, probeWorldPos, type Vec3 } from './missilePath'
import { clamp01, prefersReducedMotion } from '../motion'
import { palette } from '../theme'

export const MISSILE_SIDE_MS = 280
export const MISSILE_FLY_MS = 520
export const MISSILE_BOOM_MS = 220
export const MISSILE_SHOT_MS = MISSILE_SIDE_MS + MISSILE_FLY_MS + MISSILE_BOOM_MS
export const PROBE_SIDE_MS = 380
export const PROBE_FLY_MS = 2100
export const PROBE_FADE_MS = 220
const TRAIL = 14
const ROCKET_COLOR = 0xc45c4a
const PROBE_COLOR = palette.engine

type ShotKind = 'missile' | 'probe'

type Shot = {
  kind: ShotKind
  origin: Vec3
  side: Vec3
  target: Vec3
  start: number
  rocket: THREE.Mesh
  trail: THREE.Line
  positions: Float32Array
  colors: Float32Array
  boom: THREE.Mesh
  done: boolean
  hit: boolean
  trailArmed: boolean
  onHit?: (target: Vec3) => void
}

type Floater = {
  sprite: THREE.Sprite
  start: number
  origin: Vec3
}

export class CombatFx {
  readonly group = new THREE.Group()
  private shots: Shot[] = []
  private floaters: Floater[] = []

  get idle(): boolean {
    return this.shots.length === 0
  }

  spawnOne(
    origin: Vec3,
    yaw: number,
    target: Vec3,
    now: number,
    sideIndex: number,
    onHit?: (target: Vec3) => void,
  ): void {
    if (prefersReducedMotion()) {
      onHit?.(target)
      this.spawnDamage(target, 1, now)
      return
    }
    this.shots.push(
      this.makeShot('missile', origin, missileSidePoint(origin, yaw, sideIndex), target, now, onHit),
    )
  }

  spawnProbe(
    origin: Vec3,
    yaw: number,
    target: Vec3,
    now: number,
    onHit?: (target: Vec3) => void,
  ): void {
    if (prefersReducedMotion()) {
      onHit?.(target)
      return
    }
    this.shots.push(
      this.makeShot('probe', origin, missileSidePoint(origin, yaw, 0), target, now, onHit),
    )
  }

  spawnDamage(target: Vec3, amount: number, now: number): void {
    const sprite = damageSprite(amount)
    sprite.position.set(target.x, target.y + 0.08, target.z)
    this.group.add(sprite)
    this.floaters.push({ sprite, start: now, origin: { ...target, y: target.y + 0.08 } })
  }

  tick(now: number): void {
    for (const shot of this.shots) {
      if (shot.done) continue
      const elapsed = now - shot.start
      if (elapsed < 0) {
        shot.rocket.visible = false
        shot.trail.visible = false
        continue
      }
      const sideMs = shot.kind === 'probe' ? PROBE_SIDE_MS : MISSILE_SIDE_MS
      const flyMs = shot.kind === 'probe' ? PROBE_FLY_MS : MISSILE_FLY_MS
      if (elapsed <= sideMs + flyMs) {
        const t = elapsed <= sideMs ? elapsed / sideMs : 1 + (elapsed - sideMs) / flyMs
        const p =
          shot.kind === 'probe'
            ? probeWorldPos(shot.origin, shot.side, shot.target, t)
            : missileWorldPos(shot.origin, shot.side, shot.target, t)
        const prev = {
          x: shot.rocket.position.x,
          y: shot.rocket.position.y,
          z: shot.rocket.position.z,
        }
        shot.rocket.visible = true
        const homing = elapsed > sideMs
        shot.trail.visible = homing
        shot.rocket.position.set(p.x, p.y, p.z)
        const dx = p.x - prev.x
        const dy = p.y - prev.y
        const dz = p.z - prev.z
        if (dx * dx + dy * dy + dz * dz > 1e-8) {
          shot.rocket.lookAt(p.x + dx, p.y + dy, p.z + dz)
        }
        if (homing) {
          if (!shot.trailArmed) {
            this.seedTrail(shot, p)
            shot.trailArmed = true
          }
          this.pushTrail(shot, p)
        }
      } else {
        shot.rocket.visible = false
        if (!shot.hit) {
          shot.hit = true
          shot.onHit?.(shot.target)
        }
        if (shot.kind === 'probe') {
          const fadeT = (elapsed - sideMs - flyMs) / PROBE_FADE_MS
          if (fadeT >= 1) {
            shot.done = true
            shot.trail.visible = false
            shot.boom.visible = false
            continue
          }
          this.fadeTrail(shot, 1 - fadeT)
          continue
        }
        const boomT = (elapsed - MISSILE_SIDE_MS - MISSILE_FLY_MS) / MISSILE_BOOM_MS
        if (boomT >= 1) {
          shot.done = true
          shot.trail.visible = false
          shot.boom.visible = false
          continue
        }
        shot.boom.visible = true
        shot.boom.position.set(shot.target.x, shot.target.y, shot.target.z)
        const s = 0.04 + boomT * 0.22
        shot.boom.scale.setScalar(s)
        const mat = shot.boom.material as THREE.MeshBasicMaterial
        mat.opacity = 1 - boomT
        this.fadeTrail(shot, 1 - boomT)
      }
    }
    if (this.shots.some((shot) => shot.done)) {
      for (const shot of this.shots.filter((item) => item.done)) {
        this.group.remove(shot.rocket, shot.trail, shot.boom)
      }
      this.shots = this.shots.filter((shot) => !shot.done)
    }
    this.tickFloaters(now)
  }

  dispose(): void {
    for (const shot of this.shots) {
      this.group.remove(shot.rocket, shot.trail, shot.boom)
    }
    for (const floater of this.floaters) this.group.remove(floater.sprite)
    this.shots = []
    this.floaters = []
    this.group.clear()
  }

  private tickFloaters(now: number): void {
    const keep: Floater[] = []
    for (const floater of this.floaters) {
      const t = clamp01((now - floater.start) / 900)
      floater.sprite.position.set(floater.origin.x, floater.origin.y + t * 0.22, floater.origin.z)
      const mat = floater.sprite.material as THREE.SpriteMaterial
      mat.opacity = 1 - t
      if (t >= 1) {
        this.group.remove(floater.sprite)
        continue
      }
      keep.push(floater)
    }
    this.floaters = keep
  }

  private makeShot(
    kind: ShotKind,
    origin: Vec3,
    side: Vec3,
    target: Vec3,
    start: number,
    onHit?: (target: Vec3) => void,
  ): Shot {
    const positions = new Float32Array(TRAIL * 3)
    const colors = new Float32Array(TRAIL * 3)
    for (let i = 0; i < TRAIL; i++) {
      positions[i * 3] = origin.x
      positions[i * 3 + 1] = origin.y
      positions[i * 3 + 2] = origin.z
    }
    const rocket = kind === 'probe' ? makeProbeDart() : makeRocket()
    rocket.position.set(origin.x, origin.y, origin.z)
    rocket.visible = false
    const trail = makeTrail(positions, colors)
    const boom = makeBoom()
    this.group.add(rocket, trail, boom)
    return {
      kind,
      origin,
      side,
      target,
      start,
      rocket,
      trail,
      positions,
      colors,
      boom,
      done: false,
      hit: false,
      trailArmed: false,
      onHit,
    }
  }

  private seedTrail(shot: Shot, p: Vec3): void {
    for (let i = 0; i < TRAIL; i++) {
      shot.positions[i * 3] = p.x
      shot.positions[i * 3 + 1] = p.y
      shot.positions[i * 3 + 2] = p.z
    }
  }

  private pushTrail(shot: Shot, p: Vec3): void {
    for (let i = TRAIL - 1; i > 0; i--) {
      shot.positions[i * 3] = shot.positions[(i - 1) * 3]
      shot.positions[i * 3 + 1] = shot.positions[(i - 1) * 3 + 1]
      shot.positions[i * 3 + 2] = shot.positions[(i - 1) * 3 + 2]
    }
    shot.positions[0] = p.x
    shot.positions[1] = p.y
    shot.positions[2] = p.z
    for (let i = 0; i < TRAIL; i++) {
      const a = 1 - i / (TRAIL - 1)
      const tint = shot.kind === 'probe' ? [0.49, 0.78, 1] : [0.85, 0.18, 0.16]
      shot.colors[i * 3] = tint[0] * a
      shot.colors[i * 3 + 1] = tint[1] * a
      shot.colors[i * 3 + 2] = tint[2] * a
    }
    const geo = shot.trail.geometry as THREE.BufferGeometry
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  }

  private fadeTrail(shot: Shot, opacity: number): void {
    for (let i = 0; i < TRAIL; i++) {
      const a = (1 - i / (TRAIL - 1)) * opacity
      const tint = shot.kind === 'probe' ? [0.49, 0.78, 1] : [0.85, 0.18, 0.16]
      shot.colors[i * 3] = tint[0] * a
      shot.colors[i * 3 + 1] = tint[1] * a
      shot.colors[i * 3 + 2] = tint[2] * a
    }
    const geo = shot.trail.geometry as THREE.BufferGeometry
    geo.attributes.color.needsUpdate = true
  }
}

function damageSprite(amount: number): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128)
    ctx.fillStyle = '#C45C4A'
    ctx.font = '700 72px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`-${amount}`, 64, 70)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(0.28, 0.28, 0.28)
  sprite.renderOrder = 14
  return sprite
}

function makeRocket(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.012, 0.046, 5),
    new THREE.MeshBasicMaterial({
      color: ROCKET_COLOR,
      depthWrite: false,
      depthTest: true,
    }),
  )
  mesh.rotation.x = Math.PI / 2
  mesh.renderOrder = 12
  return mesh
}

function makeProbeDart(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.01, 0.042, 5),
    new THREE.MeshBasicMaterial({
      color: PROBE_COLOR,
      depthWrite: false,
      depthTest: true,
    }),
  )
  mesh.rotation.x = Math.PI / 2
  mesh.renderOrder = 12
  return mesh
}

function makeTrail(positions: Float32Array, colors: Float32Array): THREE.Line {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const line = new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  line.renderOrder = 11
  line.visible = false
  return line
}

function makeBoom(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff6a4a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  mesh.visible = false
  mesh.renderOrder = 13
  return mesh
}

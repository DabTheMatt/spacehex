import * as THREE from 'three'
import { missileSidePoint, missileWorldPos, type Vec3 } from './missilePath'
import { prefersReducedMotion } from '../motion'

const TRAIL = 14
const SIDE_MS = 280
const FLY_MS = 520
const BOOM_MS = 220
const STAGGER_MS = 55
const ROCKET_COLOR = 0xc45c4a

type Shot = {
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
}

export class CombatFx {
  readonly group = new THREE.Group()
  private shots: Shot[] = []

  spawnVolley(origin: Vec3, yaw: number, target: Vec3, count: number, now: number): void {
    const n = Math.max(0, Math.floor(count))
    if (n === 0) return
    if (prefersReducedMotion()) {
      this.spawnBoom(target, now)
      return
    }
    for (let i = 0; i < n; i++) {
      this.shots.push(this.makeShot(origin, missileSidePoint(origin, yaw, i), target, now + i * STAGGER_MS))
    }
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
      if (elapsed <= SIDE_MS + FLY_MS) {
        const t = elapsed <= SIDE_MS ? elapsed / SIDE_MS : 1 + (elapsed - SIDE_MS) / FLY_MS
        const p = missileWorldPos(shot.origin, shot.side, shot.target, t)
        const prev = {
          x: shot.rocket.position.x,
          y: shot.rocket.position.y,
          z: shot.rocket.position.z,
        }
        shot.rocket.visible = true
        shot.trail.visible = true
        shot.rocket.position.set(p.x, p.y, p.z)
        const dx = p.x - prev.x
        const dy = p.y - prev.y
        const dz = p.z - prev.z
        if (dx * dx + dy * dy + dz * dz > 1e-8) {
          shot.rocket.lookAt(p.x + dx, p.y + dy, p.z + dz)
        }
        this.pushTrail(shot, p)
      } else {
        shot.rocket.visible = false
        const boomT = (elapsed - SIDE_MS - FLY_MS) / BOOM_MS
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
  }

  dispose(): void {
    for (const shot of this.shots) {
      this.group.remove(shot.rocket, shot.trail, shot.boom)
    }
    this.shots = []
    this.group.clear()
  }

  private spawnBoom(target: Vec3, _now: number): void {
    const boom = makeBoom()
    boom.position.set(target.x, target.y, target.z)
    boom.visible = true
    const dummy: Shot = {
      origin: target,
      side: target,
      target,
      start: performance.now() - SIDE_MS - FLY_MS,
      rocket: makeRocket(),
      trail: makeTrail(new Float32Array(TRAIL * 3), new Float32Array(TRAIL * 3)),
      positions: new Float32Array(TRAIL * 3),
      colors: new Float32Array(TRAIL * 3),
      boom,
      done: false,
    }
    dummy.rocket.visible = false
    dummy.trail.visible = false
    this.group.add(dummy.rocket, dummy.trail, dummy.boom)
    this.shots.push(dummy)
  }

  private makeShot(origin: Vec3, side: Vec3, target: Vec3, start: number): Shot {
    const positions = new Float32Array(TRAIL * 3)
    const colors = new Float32Array(TRAIL * 3)
    for (let i = 0; i < TRAIL; i++) {
      positions[i * 3] = origin.x
      positions[i * 3 + 1] = origin.y
      positions[i * 3 + 2] = origin.z
    }
    const rocket = makeRocket()
    rocket.position.set(origin.x, origin.y, origin.z)
    rocket.visible = false
    const trail = makeTrail(positions, colors)
    const boom = makeBoom()
    this.group.add(rocket, trail, boom)
    return { origin, side, target, start, rocket, trail, positions, colors, boom, done: false }
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
      shot.colors[i * 3] = 0.85 * a
      shot.colors[i * 3 + 1] = 0.18 * a
      shot.colors[i * 3 + 2] = 0.16 * a
    }
    const geo = shot.trail.geometry as THREE.BufferGeometry
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  }

  private fadeTrail(shot: Shot, opacity: number): void {
    for (let i = 0; i < TRAIL; i++) {
      const a = (1 - i / (TRAIL - 1)) * opacity
      shot.colors[i * 3] = 0.85 * a
      shot.colors[i * 3 + 1] = 0.18 * a
      shot.colors[i * 3 + 2] = 0.16 * a
    }
    const geo = shot.trail.geometry as THREE.BufferGeometry
    geo.attributes.color.needsUpdate = true
  }
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

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getWorldPosition, HEX_SIZE } from '../../game/board/hexMath'
import type { HexCoord } from '../../game/board/HexCoord'
import { palette } from '../theme'
import { isTypingTarget } from '../../ui/actionHotkeys'
import { clamp01, easeInOutSmooth, lerp, prefersReducedMotion, CAMERA_FOCUS_MS, shortestAngleDelta } from '../motion'

const WASD_SPEED = 6
const MAP_ROTATE_SPEED = 1.15

export class CameraController {
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  private readonly canvas: HTMLCanvasElement
  private panX = 0
  private panY = 0
  private grabbing = false
  private panAnim: {
    start: number
    duration: number
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
    fromPos: THREE.Vector3
    toPos: THREE.Vector3
  } | null = null
  private orbitAnim: {
    start: number
    duration: number
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
    fromRadius: number
    toRadius: number
    fromPhi: number
    toPhi: number
    fromTheta: number
    thetaDelta: number
  } | null = null
  private follow: { x: number; z: number } | null = null
  private followReleased = false
  private inspectLimits = false
  private overview = false
  private overviewRestore: {
    target: THREE.Vector3
    radius: number
    phi: number
    theta: number
  } | null = null
  onBreakInspect: (() => void) | null = null
  mapRotateEnabled = true
  private keys = { w: false, a: false, s: false, d: false, q: false, e: false }
  private lastTick = performance.now()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.08, 500)
    this.camera.position.set(0, 8, 10)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 2.4
    this.controls.maxDistance = 400
    this.controls.minPolarAngle = 0.04
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06
    this.controls.zoomSpeed = 1.35
    this.controls.target.set(0, 0, 0)
    this.controls.enablePan = false
    this.controls.mouseButtons.LEFT = null
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE
    this.controls.touches.ONE = THREE.TOUCH.PAN
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE
    this.controls.enableRotate = true
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    this.controls.addEventListener('start', this.releaseFollow)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
  }

  focus(coord: HexCoord): void {
    this.panTo(coord)
  }

  /** Keep current angle and distance; ease the look-at toward a world XZ. */
  setFollow(point: { x: number; z: number } | null): void {
    if (!point) {
      this.follow = null
      this.followReleased = false
      return
    }
    if (this.followReleased || this.grabbing) return
    this.follow = point
    this.panAnim = null
  }

  /** Keep current angle and distance; glide the look-at to a hex. */
  panTo(coord: HexCoord): void {
    this.clearInspectLimits()
    const { x, z } = getWorldPosition(coord)
    this.glideLookAt(x, z)
  }

  /**
   * Top-down inspect: tile fills ~60% of the view, title edge toward screen-bottom.
   * `nameTheta` is OrbitControls azimuth so the camera sits on the name edge.
   */
  inspectPlanet(coord: HexCoord, nameTheta: number): void {
    this.beginInspect(coord, nameTheta, 0.14)
  }

  /** Same framing as a name inspect, at half the polar angle (45° instead of near-vertical). */
  inspectCombat(coord: HexCoord, theta = 0): void {
    this.beginInspect(coord, theta, Math.PI / 4)
  }

  private beginInspect(coord: HexCoord, theta: number, toPhi: number): void {
    this.overview = false
    this.overviewRestore = null
    const { x, z } = getWorldPosition(coord)
    const toTarget = new THREE.Vector3(x, 0, z)
    const fromTarget = this.controls.target.clone()
    const offset = this.camera.position.clone().sub(fromTarget)
    const from = new THREE.Spherical().setFromVector3(offset)
    const toRadius = this.inspectDistance()
    this.follow = null
    this.followReleased = true
    this.panAnim = null
    this.inspectLimits = true
    const instant = prefersReducedMotion()
    this.orbitAnim = {
      start: performance.now(),
      duration: instant ? 0 : CAMERA_FOCUS_MS,
      fromTarget,
      toTarget,
      fromRadius: from.radius,
      toRadius,
      fromPhi: from.phi,
      toPhi,
      fromTheta: from.theta,
      thetaDelta: shortestAngleDelta(from.theta, theta),
    }
  }

  get isOverview(): boolean {
    return this.overview
  }

  toggleBoardOverview(coords: HexCoord[]): boolean {
    if (this.overview) {
      this.exitOverview()
      return false
    }
    this.showBoardOverview(coords)
    return true
  }

  showBoardOverview(coords: HexCoord[]): void {
    this.clearInspectLimits()
    this.onBreakInspect?.()
    this.follow = null
    this.followReleased = true
    this.panAnim = null
    const offset = this.camera.position.clone().sub(this.controls.target)
    const from = new THREE.Spherical().setFromVector3(offset)
    if (!this.overview) {
      this.overviewRestore = {
        target: this.controls.target.clone(),
        radius: from.radius,
        phi: from.phi,
        theta: from.theta,
      }
    }
    this.overview = true
    const pads = coords.length ? coords : [{ q: 0, r: 0 }]
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const coord of pads) {
      const p = getWorldPosition(coord)
      minX = Math.min(minX, p.x - HEX_SIZE)
      maxX = Math.max(maxX, p.x + HEX_SIZE)
      minZ = Math.min(minZ, p.z - HEX_SIZE)
      maxZ = Math.max(maxZ, p.z + HEX_SIZE)
    }
    const width = Math.max(2.4, maxX - minX)
    const depth = Math.max(2.4, maxZ - minZ)
    const vFov = (this.camera.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(0.35, this.camera.aspect))
    const dist = Math.max(depth / 2 / Math.tan(vFov / 2), width / 2 / Math.tan(hFov / 2)) * 1.22
    const phi = 0.07
    const instant = prefersReducedMotion()
    this.orbitAnim = {
      start: performance.now(),
      duration: instant ? 0 : CAMERA_FOCUS_MS,
      fromTarget: this.controls.target.clone(),
      toTarget: new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2),
      fromRadius: from.radius,
      toRadius: dist / Math.cos(phi),
      fromPhi: from.phi,
      toPhi: phi,
      fromTheta: from.theta,
      thetaDelta: shortestAngleDelta(from.theta, 0),
    }
  }

  exitOverview(): void {
    if (!this.overview) return
    this.overview = false
    const saved = this.overviewRestore
    this.overviewRestore = null
    if (!saved) return
    const offset = this.camera.position.clone().sub(this.controls.target)
    const from = new THREE.Spherical().setFromVector3(offset)
    const instant = prefersReducedMotion()
    this.orbitAnim = {
      start: performance.now(),
      duration: instant ? 0 : CAMERA_FOCUS_MS,
      fromTarget: this.controls.target.clone(),
      toTarget: saved.target.clone(),
      fromRadius: from.radius,
      toRadius: saved.radius,
      fromPhi: from.phi,
      toPhi: saved.phi,
      fromTheta: from.theta,
      thetaDelta: shortestAngleDelta(from.theta, saved.theta),
    }
  }

  clearInspectLimits(): void {
    if (!this.inspectLimits) return
    this.inspectLimits = false
    this.controls.minPolarAngle = 0.04
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06
    this.controls.minDistance = 2.4
  }

  private inspectDistance(): number {
    const vFov = (this.camera.fov * Math.PI) / 180
    const diameter = HEX_SIZE * 2
    const visibleMinFactor = Math.min(1, this.camera.aspect)
    const visibleHeight = diameter / 0.6 / visibleMinFactor
    return visibleHeight / (2 * Math.tan(vFov / 2))
  }

  focusPair(a: HexCoord, b: HexCoord): void {
    const pa = getWorldPosition(a)
    const pb = getWorldPosition(b)
    this.glideLookAt((pa.x + pb.x) / 2, (pa.z + pb.z) / 2)
  }

  private glideLookAt(x: number, z: number): void {
    this.follow = null
    this.orbitAnim = null
    const toTarget = new THREE.Vector3(x, 0, z)
    const offset = this.camera.position.clone().sub(this.controls.target)
    const toPos = toTarget.clone().add(offset)
    if (this.controls.target.distanceTo(toTarget) < 0.04) return
    const instant = prefersReducedMotion()
    this.panAnim = {
      start: performance.now(),
      duration: instant ? 0 : CAMERA_FOCUS_MS,
      fromTarget: this.controls.target.clone(),
      toTarget,
      fromPos: this.camera.position.clone(),
      toPos,
    }
  }

  beginPan(clientX: number, clientY: number): void {
    this.releaseFollow()
    this.breakInspect()
    this.grabbing = true
    this.panX = clientX
    this.panY = clientY
    this.controls.enableRotate = false
    this.canvas.style.cursor = 'grabbing'
  }

  updatePan(clientX: number, clientY: number): void {
    if (!this.grabbing) return
    const dx = clientX - this.panX
    const dy = clientY - this.panY
    this.panX = clientX
    this.panY = clientY
    const dist = this.camera.position.distanceTo(this.controls.target)
    const vFov = (this.camera.fov * Math.PI) / 180
    const worldPerPx = (2 * dist * Math.tan(vFov / 2)) / Math.max(1, this.canvas.clientHeight)
    const forward = new THREE.Vector3()
    this.camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1)
    else forward.normalize()
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
    const move = right.multiplyScalar(-dx * worldPerPx).addScaledVector(forward, dy * worldPerPx)
    this.camera.position.add(move)
    this.controls.target.add(move)
  }

  endPan(): void {
    this.grabbing = false
    this.controls.enableRotate = true
    this.canvas.style.cursor = 'grab'
  }

  get panning(): boolean {
    return this.grabbing
  }

  setOrbitEnabled(enabled: boolean): void {
    this.controls.enableRotate = enabled
  }

  tick(): void {
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.lastTick) / 1000)
    this.lastTick = now
    if (this.keys.w || this.keys.a || this.keys.s || this.keys.d || this.keys.q || this.keys.e) {
      this.releaseFollow()
      this.breakInspect()
    }
    this.applyFocusPan(now)
    this.applyOrbit(now)
    this.applyWasd(dt)
    this.applyMapRotate(dt)
    this.applyFollow(dt)
    if (!this.grabbing && !this.panAnim && !this.orbitAnim && !this.follow) this.controls.update()
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.controls.removeEventListener('start', this.releaseFollow)
    this.controls.dispose()
  }

  private releaseFollow = (): void => {
    this.followReleased = true
    this.follow = null
    this.panAnim = null
    this.orbitAnim = null
  }

  private breakInspect(): void {
    if (!this.inspectLimits) return
    this.clearInspectLimits()
    this.onBreakInspect?.()
  }

  private applyFollow(dt: number): void {
    const point = this.follow
    if (!point || this.grabbing || this.orbitAnim) return
    const target = this.controls.target
    const offset = this.camera.position.clone().sub(target)
    const dx = point.x - target.x
    const dz = point.z - target.z
    const dist = Math.hypot(dx, dz)
    const rate = dist > 0.45 ? 5.5 : 11
    const k = 1 - Math.exp(-rate * dt)
    target.x += dx * k
    target.z += dz * k
    target.y = 0
    this.camera.position.copy(target).add(offset)
  }

  private applyFocusPan(now: number): void {
    const anim = this.panAnim
    if (!anim || this.grabbing) return
    const t = anim.duration <= 0 ? 1 : clamp01((now - anim.start) / anim.duration)
    const e = easeInOutSmooth(t)
    this.controls.target.set(
      lerp(anim.fromTarget.x, anim.toTarget.x, e),
      lerp(anim.fromTarget.y, anim.toTarget.y, e),
      lerp(anim.fromTarget.z, anim.toTarget.z, e),
    )
    this.camera.position.set(
      lerp(anim.fromPos.x, anim.toPos.x, e),
      lerp(anim.fromPos.y, anim.toPos.y, e),
      lerp(anim.fromPos.z, anim.toPos.z, e),
    )
    if (t >= 1) this.panAnim = null
  }

  private applyOrbit(now: number): void {
    const anim = this.orbitAnim
    if (!anim || this.grabbing) return
    const t = anim.duration <= 0 ? 1 : clamp01((now - anim.start) / anim.duration)
    const e = easeInOutSmooth(t)
    const target = new THREE.Vector3(
      lerp(anim.fromTarget.x, anim.toTarget.x, e),
      lerp(anim.fromTarget.y, anim.toTarget.y, e),
      lerp(anim.fromTarget.z, anim.toTarget.z, e),
    )
    const radius = lerp(anim.fromRadius, anim.toRadius, e)
    const phi = lerp(anim.fromPhi, anim.toPhi, e)
    const theta = anim.fromTheta + anim.thetaDelta * e
    const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, theta))
    this.controls.target.copy(target)
    this.camera.position.copy(target).add(offset)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(target)
    if (t < 1) return
    this.orbitAnim = null
  }

  private applyWasd(dt: number): void {
    const x = (this.keys.d ? 1 : 0) - (this.keys.a ? 1 : 0)
    const z = (this.keys.w ? 1 : 0) - (this.keys.s ? 1 : 0)
    if (!x && !z) return
    const forward = new THREE.Vector3()
    this.camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() < 1e-6) {
      forward.set(0, 0, -1)
    } else {
      forward.normalize()
    }
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
    const move = right
      .multiplyScalar(x)
      .addScaledVector(forward, z)
      .multiplyScalar(WASD_SPEED * dt)
    this.camera.position.add(move)
    this.controls.target.add(move)
  }

  /** Turn the look direction in place — not around the board origin. */
  private applyMapRotate(dt: number): void {
    if (!this.mapRotateEnabled) return
    const dir = (this.keys.q ? 1 : 0) - (this.keys.e ? 1 : 0)
    if (!dir) return
    const angle = dir * MAP_ROTATE_SPEED * dt
    const eye = this.camera.position
    const offset = this.controls.target.clone().sub(eye)
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
    this.controls.target.copy(eye).add(offset)
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target)) return
    if (
      event.code === 'KeyW' ||
      event.code === 'KeyA' ||
      event.code === 'KeyS' ||
      event.code === 'KeyD' ||
      ((event.code === 'KeyQ' || event.code === 'KeyE') && this.mapRotateEnabled)
    ) {
      event.preventDefault()
    }
    this.setKey(event.code, true)
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.setKey(event.code, false)
  }

  private setKey(code: string, down: boolean): void {
    if (code === 'KeyW') this.keys.w = down
    if (code === 'KeyA') this.keys.a = down
    if (code === 'KeyS') this.keys.s = down
    if (code === 'KeyD') this.keys.d = down
    if (code === 'KeyQ') this.keys.q = down
    if (code === 'KeyE') this.keys.e = down
  }
}

export function makeLights(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(palette.ivory, 0.55))
  const dir = new THREE.DirectionalLight(palette.paper, 0.55)
  dir.position.set(4, 10, 6)
  scene.add(dir)
}

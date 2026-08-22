import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getWorldPosition } from '../../game/board/hexMath'
import type { HexCoord } from '../../game/board/HexCoord'
import { palette } from '../theme'
import { isTypingTarget } from '../../ui/actionHotkeys'
import { clamp01, easeInOutSmooth, lerp, prefersReducedMotion, CAMERA_FOCUS_MS } from '../motion'

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
    this.controls.maxDistance = 140
    this.controls.minPolarAngle = 0.04
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06
    this.controls.zoomSpeed = 1.35
    this.controls.target.set(0, 0, 0)
    this.controls.enablePan = false
    this.controls.mouseButtons.LEFT = null
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE
    this.controls.enableRotate = true
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
  }

  focus(coord: HexCoord, height = 7): void {
    this.panAnim = null
    const { x, z } = getWorldPosition(coord)
    this.controls.target.set(x, 0, z)
    const offset = new THREE.Vector3(0, height, height * 1.1)
    this.camera.position.copy(this.controls.target).add(offset)
  }

  /** Keep current angle and distance; glide the look-at to a hex. */
  panTo(coord: HexCoord): void {
    const { x, z } = getWorldPosition(coord)
    const toTarget = new THREE.Vector3(x, 0, z)
    const offset = this.camera.position.clone().sub(this.controls.target)
    const toPos = toTarget.clone().add(offset)
    if (this.controls.target.distanceTo(toTarget) < 0.12) return
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

  focusPair(a: HexCoord, b: HexCoord): void {
    const pa = getWorldPosition(a)
    const pb = getWorldPosition(b)
    const mx = (pa.x + pb.x) / 2
    const mz = (pa.z + pb.z) / 2
    this.controls.target.set(mx, 0, mz)
    this.camera.position.set(mx, 8, mz + 9)
  }

  beginPan(clientX: number, clientY: number): void {
    this.panAnim = null
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
      this.panAnim = null
    }
    this.applyFocusPan(now)
    this.applyWasd(dt)
    this.applyMapRotate(dt)
    if (!this.grabbing && !this.panAnim) this.controls.update()
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.controls.dispose()
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

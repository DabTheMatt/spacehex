import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getWorldPosition } from '../../game/board/hexMath'
import type { HexCoord } from '../../game/board/HexCoord'
import { palette } from '../theme'
import { isTypingTarget } from '../../ui/actionHotkeys'

const WASD_SPEED = 6
const MAP_ROTATE_SPEED = 1.15

export class CameraController {
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  private readonly canvas: HTMLCanvasElement
  private readonly raycaster = new THREE.Raycaster()
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private grab: THREE.Vector3 | null = null
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
    this.controls.minDistance = 1.2
    this.controls.maxDistance = 140
    this.controls.minPolarAngle = 0.04
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06
    this.controls.zoomSpeed = 1.35
    this.controls.target.set(0, 0, 0)
    this.controls.enablePan = false
    this.controls.mouseButtons.LEFT = null
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
  }

  focus(coord: HexCoord, height = 7): void {
    const { x, z } = getWorldPosition(coord)
    this.controls.target.set(x, 0, z)
    const offset = new THREE.Vector3(0, height, height * 1.1)
    this.camera.position.copy(this.controls.target).add(offset)
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
    this.grab = this.groundPoint(clientX, clientY)
    if (this.grab) this.canvas.style.cursor = 'grabbing'
  }

  updatePan(clientX: number, clientY: number): void {
    if (!this.grab) return
    const now = this.groundPoint(clientX, clientY)
    if (!now) return
    const delta = this.grab.clone().sub(now)
    this.camera.position.add(delta)
    this.controls.target.add(delta)
  }

  endPan(): void {
    this.grab = null
    this.canvas.style.cursor = 'grab'
  }

  get panning(): boolean {
    return this.grab !== null
  }

  tick(): void {
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.lastTick) / 1000)
    this.lastTick = now
    this.applyWasd(dt)
    this.applyMapRotate(dt)
    this.controls.update()
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.controls.dispose()
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

  private groundPoint(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const hit = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return null
    return hit
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

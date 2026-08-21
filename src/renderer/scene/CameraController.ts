import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getWorldPosition } from '../../game/board/hexMath'
import type { HexCoord } from '../../game/board/HexCoord'
import { palette } from '../theme'

export class CameraController {
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
    this.camera.position.set(0, 8, 10)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 4
    this.controls.maxDistance = 40
    this.controls.maxPolarAngle = Math.PI / 2 - 0.08
    this.controls.target.set(0, 0, 0)
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

  tick(): void {
    this.controls.update()
  }
}

export function makeLights(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(palette.ivory, 0.55))
  const dir = new THREE.DirectionalLight(palette.paper, 0.55)
  dir.position.set(4, 10, 6)
  scene.add(dir)
}

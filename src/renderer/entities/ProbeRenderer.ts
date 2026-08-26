import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getWorldPosition, HEX_SIZE } from '../../game/board/hexMath'
import { palette } from '../theme'
import { TILE_THICKNESS } from '../board/TileRenderer'
import { prefersReducedMotion } from '../motion'

const RING_COUNT = 2
const HEX_SCANS = 4
const BLUE = palette.engine
/** No fill slab — wireframe hologram only. */
export const PROBE_TILE_OPACITY = 0
export const PROBE_STROKE_OPACITY = 0.34
export const PROBE_SCAN_OPACITY = 0.11

export class ProbeRenderer {
  readonly group = new THREE.Group()

  sync(state: GameState, inflightKeys?: Set<string>): void {
    this.group.clear()
    for (const probe of Object.values(state.probes)) {
      const key = `${probe.coord.q},${probe.coord.r}`
      if (inflightKeys?.has(key)) continue
      this.group.add(makeProbeSite(probe.coord.q, probe.coord.r))
    }
  }

  tick(time: number): void {
    const reduced = prefersReducedMotion()
    const wave = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * ((Math.PI * 2) / 2.4))
    this.group.traverse((obj) => {
      if (obj.userData.hexScan) {
        const mat = (obj as THREE.Line).material as THREE.LineBasicMaterial
        mat.opacity = PROBE_SCAN_OPACITY + 0.05 * wave
      }
      if (obj.userData.hexSweep) {
        const cycle = reduced ? 0.45 : (time * 0.12) % 1
        const scale = 0.18 + cycle * 0.82
        obj.scale.set(scale, 1, scale)
        const mat = (obj as THREE.Line).material as THREE.LineBasicMaterial
        mat.opacity = (1 - cycle) * 0.16
      }
      if (obj.userData.probeBody) {
        obj.position.y = TILE_THICKNESS + 0.07 + wave * 0.012
        obj.rotation.y = time * 0.55
      }
      if (typeof obj.userData.ringPhase === 'number') {
        const cycle = reduced ? 0.35 : (time * 0.16 + obj.userData.ringPhase) % 1
        const scale = 0.06 + cycle * 0.18
        obj.scale.set(scale, 1, scale)
        const mat = (obj as THREE.Line).material as THREE.LineBasicMaterial
        mat.opacity = (1 - cycle) * 0.22
      }
    })
  }
}

function makeProbeSite(q: number, r: number): THREE.Group {
  const g = new THREE.Group()
  const pos = getWorldPosition({ q, r })
  g.position.set(pos.x, 0, pos.z)

  const radius = HEX_SIZE * 0.96
  for (let i = 1; i <= HEX_SCANS; i++) {
    const scan = hexLine(radius * (i / HEX_SCANS), PROBE_SCAN_OPACITY)
    scan.userData.hexScan = true
    g.add(scan)
  }

  const sweep = hexLine(radius, 0.16)
  sweep.userData.hexSweep = true
  g.add(sweep)

  const body = makeProbeMesh()
  body.userData.probeBody = true
  body.position.y = TILE_THICKNESS + 0.07
  g.add(body)

  for (let i = 0; i < RING_COUNT; i++) {
    const ringPts: THREE.Vector3[] = []
    for (let s = 0; s <= 32; s++) {
      const a = (s / 32) * Math.PI * 2
      ringPts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)))
    }
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineBasicMaterial({
        color: BLUE,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    )
    ring.position.y = TILE_THICKNESS + 0.03
    ring.userData.ringPhase = i / RING_COUNT
    g.add(ring)
  }
  return g
}

function hexLine(radius: number, opacity: number): THREE.Line {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 6; i++) {
    const angle = (Math.PI / 3) * (i % 6)
    pts.push(
      new THREE.Vector3(radius * Math.cos(angle), TILE_THICKNESS + 0.018, radius * Math.sin(angle)),
    )
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({
      color: BLUE,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  )
}

function makeProbeMesh(): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({
    color: BLUE,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.038, 5), mat)
  needle.rotation.x = Math.PI
  needle.position.y = 0.042
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.022, 5), mat)
  body.position.y = 0.016
  g.add(body, needle)
  return g
}

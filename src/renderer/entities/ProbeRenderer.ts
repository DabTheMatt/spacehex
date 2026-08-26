import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getWorldPosition, HEX_SIZE } from '../../game/board/hexMath'
import { palette } from '../theme'
import { TILE_THICKNESS } from '../board/TileRenderer'
import { prefersReducedMotion } from '../motion'

const RING_COUNT = 2
const BLUE = palette.engine
const RIM = HEX_SIZE * 0.4

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
      if (obj.userData.probeBody) {
        obj.position.y = TILE_THICKNESS + 0.06 + wave * 0.012
        obj.rotation.y = time * 0.55
      }
      if (typeof obj.userData.ringPhase === 'number') {
        const cycle = reduced ? 0.35 : (time * 0.16 + obj.userData.ringPhase) % 1
        const scale = 0.05 + cycle * 0.2
        obj.scale.set(scale, 1, scale)
        const mat = (obj as THREE.Line).material as THREE.LineBasicMaterial
        mat.opacity = (1 - cycle) * 0.7
      }
    })
  }
}

function makeProbeSite(q: number, r: number): THREE.Group {
  const g = new THREE.Group()
  const pos = getWorldPosition({ q, r })
  g.position.set(pos.x + RIM * 0.55, 0, pos.z + RIM * 0.22)

  const body = makeProbeMesh()
  body.userData.probeBody = true
  body.position.y = TILE_THICKNESS + 0.06
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
        opacity: 0.4,
        depthWrite: false,
      }),
    )
    ring.position.y = TILE_THICKNESS + 0.02
    ring.userData.ringPhase = i / RING_COUNT
    g.add(ring)
  }
  return g
}

function makeProbeMesh(): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({ color: BLUE })
  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.038, 5), mat)
  needle.rotation.x = Math.PI
  needle.position.y = 0.042
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.022, 5), mat)
  body.position.y = 0.016
  g.add(body, needle)
  return g
}

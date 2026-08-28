import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getWorldPosition, HEX_SIZE } from '../../game/board/hexMath'
import { palette } from '../theme'
import type { GraphicMode } from '../graphicMode'
import { TILE_THICKNESS } from '../board/TileRenderer'
import { prefersReducedMotion } from '../motion'

const RING_COUNT = 2
const HEX_SCANS = 2
const BLUE = palette.engine
/** No fill slab — wireframe hologram only. Tile glyph still shows the find. */
export const PROBE_TILE_OPACITY = 0
export const PROBE_STROKE_OPACITY = 0.4
export const PROBE_SCAN_OPACITY = 0.12
export const PROBE_LED_HZ = 0.55
export const PROBE_LED_ON = 0.5
export const PROBE_LED_GLOW_ON = 0.275

export function probeOwnerColor(playerId: string): number {
  return playerId === 'player-2' ? palette.player2 : palette.player1
}

export class ProbeRenderer {
  readonly group = new THREE.Group()
  private graphicMode: GraphicMode = 'space'

  setGraphicMode(mode: GraphicMode): void {
    this.graphicMode = mode
  }

  sync(state: GameState, inflightKeys?: Set<string>): void {
    this.group.clear()
    for (const probe of Object.values(state.probes)) {
      const key = `${probe.coord.q},${probe.coord.r}`
      if (inflightKeys?.has(key)) continue
      this.group.add(makeProbeSite(probe.coord.q, probe.coord.r, probe.ownerPlayerId, this.graphicMode === 'ink'))
    }
  }

  tick(time: number): void {
    const reduced = prefersReducedMotion()
    const wave = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * ((Math.PI * 2) / 2.4))
    const ledOn = reduced ? true : (time * PROBE_LED_HZ) % 1 < 0.48
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
        obj.position.y = TILE_THICKNESS + 0.08 + wave * 0.01
        if (!this.graphicMode || this.graphicMode !== 'ink') obj.rotation.y = time * 0.55
      }
      if (obj.userData.probeLed) {
        const mat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial
        mat.opacity = ledOn ? PROBE_LED_ON : PROBE_LED_ON * 0.08
      }
      if (obj.userData.probeLedGlow) {
        const mat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial
        mat.opacity = ledOn ? PROBE_LED_GLOW_ON : PROBE_LED_GLOW_ON * 0.1
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

function makeProbeSite(q: number, r: number, ownerPlayerId: string, ink = false): THREE.Group {
  const g = new THREE.Group()
  const pos = getWorldPosition({ q, r })
  g.position.set(pos.x, 0, pos.z)
  const stroke = ink ? 0xffffff : BLUE

  const radius = HEX_SIZE * 0.96
  for (let i = 1; i <= HEX_SCANS; i++) {
    const scan = ink ? squareLine(radius * (i / HEX_SCANS), PROBE_SCAN_OPACITY, stroke) : hexLine(radius * (i / HEX_SCANS), PROBE_SCAN_OPACITY, stroke)
    scan.userData.hexScan = true
    g.add(scan)
  }

  const sweep = ink ? squareLine(radius, 0.16, stroke) : hexLine(radius, 0.16, stroke)
  sweep.userData.hexSweep = true
  g.add(sweep)

  const body = ink ? makeInkProbeMesh() : makeProbeMesh(probeOwnerColor(ownerPlayerId))
  body.userData.probeBody = true
  body.position.y = TILE_THICKNESS + 0.08
  g.add(body)

  for (let i = 0; i < RING_COUNT; i++) {
    const ring = ink
      ? squareLine(1, 0.16, stroke)
      : (() => {
          const ringPts: THREE.Vector3[] = []
          for (let s = 0; s <= 32; s++) {
            const a = (s / 32) * Math.PI * 2
            ringPts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)))
          }
          return new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(ringPts),
            new THREE.LineBasicMaterial({
              color: stroke,
              transparent: true,
              opacity: 0.16,
              depthWrite: false,
            }),
          )
        })()
    ring.position.y = TILE_THICKNESS + 0.03
    ring.userData.ringPhase = i / RING_COUNT
    g.add(ring)
  }
  return g
}

function squareLine(radius: number, opacity: number, color: number): THREE.Line {
  const h = radius
  const pts = [
    new THREE.Vector3(-h, TILE_THICKNESS + 0.018, -h),
    new THREE.Vector3(h, TILE_THICKNESS + 0.018, -h),
    new THREE.Vector3(h, TILE_THICKNESS + 0.018, h),
    new THREE.Vector3(-h, TILE_THICKNESS + 0.018, h),
    new THREE.Vector3(-h, TILE_THICKNESS + 0.018, -h),
  ]
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  )
}

function makeInkProbeMesh(): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  const body = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.08), mat)
  body.rotation.x = -Math.PI / 2
  g.add(body)
  const led = new THREE.Mesh(
    new THREE.PlaneGeometry(0.02, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: PROBE_LED_ON, depthWrite: false }),
  )
  led.rotation.x = -Math.PI / 2
  led.position.y = 0.01
  led.userData.probeLed = true
  g.add(led)
  return g
}

function hexLine(radius: number, opacity: number, color = BLUE): THREE.Line {
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
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  )
}

function makeProbeMesh(ledColor: number): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({
    color: BLUE,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  })
  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.055, 5), mat)
  needle.rotation.x = Math.PI
  needle.position.y = 0.058
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.032, 5), mat)
  body.position.y = 0.022
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 12, 10),
    new THREE.MeshBasicMaterial({
      color: ledColor,
      transparent: true,
      opacity: PROBE_LED_GLOW_ON,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  glow.position.y = 0.098
  glow.renderOrder = 12
  glow.userData.probeLedGlow = true
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.011, 12, 10),
    new THREE.MeshBasicMaterial({
      color: ledColor,
      transparent: true,
      opacity: PROBE_LED_ON,
      depthWrite: false,
      depthTest: false,
    }),
  )
  led.position.y = 0.098
  led.renderOrder = 13
  led.userData.probeLed = true
  g.add(body, needle, glow, led)
  return g
}

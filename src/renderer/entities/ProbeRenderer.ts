import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getWorldPosition, HEX_SIZE } from '../../game/board/hexMath'
import { palette } from '../theme'
import { TILE_THICKNESS } from '../board/TileRenderer'
import { prefersReducedMotion } from '../motion'

const RING_COUNT = 2
const BLUE = palette.engine
const CRT_LINES = 18

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
    const scroll = reduced ? 0 : (time * 0.07) % 1
    this.group.traverse((obj) => {
      if (obj.userData.probeFill) {
        const mat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial
        mat.opacity = 0.42 + 0.08 * wave
      }
      if (obj.userData.crt) {
        const mat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial
        if (mat.map) mat.map.offset.y = scroll
        mat.opacity = 0.38 + 0.1 * wave
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
        mat.opacity = (1 - cycle) * 0.55
      }
    })
  }
}

function makeProbeSite(q: number, r: number): THREE.Group {
  const g = new THREE.Group()
  const pos = getWorldPosition({ q, r })
  g.position.set(pos.x, 0, pos.z)

  const radius = HEX_SIZE * 0.96
  const shape = hexShape(radius)
  const fill = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color: BLUE,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  fill.rotation.x = -Math.PI / 2
  fill.position.y = TILE_THICKNESS + 0.012
  fill.userData.probeFill = true
  g.add(fill)

  const crt = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      map: crtScanTexture(),
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  crt.rotation.x = -Math.PI / 2
  crt.position.y = TILE_THICKNESS + 0.016
  crt.userData.crt = true
  g.add(crt)

  const edge: THREE.Vector3[] = []
  for (let i = 0; i <= 6; i++) {
    const angle = (Math.PI / 3) * (i % 6)
    edge.push(new THREE.Vector3(radius * Math.cos(angle), TILE_THICKNESS + 0.018, radius * Math.sin(angle)))
  }
  g.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(edge),
      new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.85 }),
    ),
  )

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
        opacity: 0.35,
        depthWrite: false,
      }),
    )
    ring.position.y = TILE_THICKNESS + 0.03
    ring.userData.ringPhase = i / RING_COUNT
    g.add(ring)
  }
  return g
}

function hexShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    const x = radius * Math.cos(angle)
    const y = -radius * Math.sin(angle)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

let crtTex: THREE.CanvasTexture | null = null

function crtScanTexture(): THREE.CanvasTexture {
  if (crtTex) return crtTex
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, size, size)
    const pitch = size / CRT_LINES
    for (let i = 0; i < CRT_LINES; i++) {
      const y = i * pitch
      ctx.fillStyle = 'rgba(0, 12, 28, 0.72)'
      ctx.fillRect(0, y, size, pitch * 0.45)
      ctx.fillStyle = 'rgba(126, 200, 255, 0.22)'
      ctx.fillRect(0, y + pitch * 0.45, size, pitch * 0.55)
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 1)
  tex.needsUpdate = true
  crtTex = tex
  return tex
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

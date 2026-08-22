import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import type { GameEvent } from '../../game/engine/events'
import type { ShipState } from '../../game/state/GameState'
import { getWorldPosition } from '../../game/board/hexMath'
import type { HexCoord } from '../../game/board/HexCoord'
import { coordKey } from '../../game/board/HexCoord'
import { SHIP_DEFINITIONS } from '../../game/definitions/ships'
import { palette, css } from '../theme'
import { TILE_THICKNESS } from '../board/TileRenderer'
import {
  clamp01,
  easeInOutCubic,
  easeInOutSmooth,
  lerp,
  lerpAngle,
  prefersReducedMotion,
  shipEngineBurn,
  shortestAngleDelta,
  SHIP_BRAKE_MS,
  SHIP_FLIGHT_MS,
  SHIP_MAIN_IGNITE_MS,
  SHIP_SLIDE_MS,
  SHIP_TURN_MS,
} from '../motion'

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const ENGINES_OFF = { main: 0, port: 0, starboard: 0, brakePort: 0, brakeStarboard: 0 }
const SHIP_SPACING = 0.46
const HULL_HEIGHT = 0.11
const BASE_HOVER = TILE_THICKNESS + 0.08

type HoldMotion = { kind: 'hold'; coord: HexCoord }
type FlyMotion = {
  kind: 'fly'
  from: HexCoord
  to: HexCoord
  fromX: number
  fromZ: number
  toX: number
  toZ: number
  startYaw: number
  endYaw: number
  yawDelta: number
  start: number
  turnMs: number
  igniteMs: number
  moveMs: number
}
type SlideMotion = {
  kind: 'slide'
  fromX: number
  fromZ: number
  toX: number
  toZ: number
  start: number
  duration: number
}
type ShipMotion = HoldMotion | FlyMotion | SlideMotion

export class ShipRenderer {
  readonly group = new THREE.Group()
  private motion = new Map<string, ShipMotion>()
  private facing = new Map<string, number>()
  private lastXZ = new Map<string, { x: number; z: number }>()

  isBusy(shipId: string): boolean {
    const motion = this.motion.get(shipId)
    return motion?.kind === 'hold' || motion?.kind === 'fly'
  }

  anyBusy(): boolean {
    for (const motion of this.motion.values()) {
      if (motion.kind === 'hold' || motion.kind === 'fly') return true
    }
    return false
  }

  /** World XZ of a ship currently in flight, if any. */
  flyingWorld(): { x: number; z: number } | null {
    for (const child of this.group.children) {
      const shipId = child.userData.shipId as string
      if (this.motion.get(shipId)?.kind !== 'fly') continue
      return { x: child.position.x, z: child.position.z }
    }
    return null
  }

  hold(shipId: string, coord: HexCoord): void {
    this.motion.set(shipId, { kind: 'hold', coord })
  }

  fly(shipId: string, from: HexCoord, to: HexCoord): void {
    const fromW = getWorldPosition(from)
    const toW = getWorldPosition(to)
    const last = this.lastXZ.get(shipId)
    const endYaw = Math.atan2(toW.x - fromW.x, toW.z - fromW.z)
    const startYaw = this.facing.get(shipId) ?? lastMoveYaw([], shipId, from)
    const yawDelta = shortestAngleDelta(startYaw, endYaw)
    const instant = prefersReducedMotion()
    this.motion.set(shipId, {
      kind: 'fly',
      from,
      to,
      fromX: last?.x ?? fromW.x,
      fromZ: last?.z ?? fromW.z,
      toX: toW.x,
      toZ: toW.z,
      startYaw,
      endYaw,
      yawDelta,
      start: performance.now(),
      turnMs: instant ? 0 : SHIP_TURN_MS,
      igniteMs: instant ? 0 : SHIP_MAIN_IGNITE_MS,
      moveMs: instant ? 0 : SHIP_FLIGHT_MS,
    })
  }

  sync(state: GameState): void {
    const parked = new Map<string, ShipState[]>()
    const flying: ShipState[] = []
    for (const ship of Object.values(state.ships)) {
      const coord = this.parkedCoord(ship)
      if (!coord) {
        flying.push(ship)
        continue
      }
      const key = coordKey(coord)
      const list = parked.get(key) ?? []
      list.push(ship)
      parked.set(key, list)
    }
    for (const list of parked.values()) {
      list.sort((a, b) => a.id.localeCompare(b.id))
    }

    const targets = new Map<string, { x: number; z: number }>()
    for (const list of parked.values()) {
      const coord = list[0] ? this.parkedCoord(list[0]) : null
      if (!coord) continue
      const yaw = this.stackYaw(state, list, coord)
      list.forEach((ship, index) => {
        targets.set(ship.id, stackWorld(coord, list.length, index, yaw))
      })
    }
    for (const ship of flying) {
      const motion = this.motion.get(ship.id)
      if (!motion || motion.kind !== 'fly') continue
      const destKey = coordKey(motion.to)
      const mates = [...(parked.get(destKey) ?? []), ...flying.filter((other) => {
        const otherMotion = this.motion.get(other.id)
        return otherMotion?.kind === 'fly' && coordKey(otherMotion.to) === destKey
      })]
      mates.sort((a, b) => a.id.localeCompare(b.id))
      const index = Math.max(0, mates.findIndex((mate) => mate.id === ship.id))
      const destYaw = motion.endYaw
      const slot = stackWorld(motion.to, mates.length, index, destYaw)
      motion.toX = slot.x
      motion.toZ = slot.z
      targets.set(ship.id, slot)
    }

    this.group.clear()
    for (const ship of Object.values(state.ships)) {
      const coord = this.parkedCoord(ship) ?? ship.coord
      const target = targets.get(ship.id) ?? getWorldPosition(coord)
      const last = this.lastXZ.get(ship.id) ?? target
      const yaw = this.visualYaw(state.log, ship.id, coord)
      if (this.motion.get(ship.id)?.kind !== 'fly') this.facing.set(ship.id, yaw)
      const playerNo = Number(ship.playerId.replace(/\D/g, '')) || 1
      const active = state.players[state.activePlayerId]?.shipId === ship.id
      const wrapper = new THREE.Group()
      const marker = createNavMarker(ship.class, playerNo, active, `SG-${playerNo}`)
      wrapper.add(marker)
      wrapper.userData.engines = marker.userData.engines
      wrapper.quaternion.setFromAxisAngle(Y_AXIS, yaw)
      wrapper.position.set(last.x, BASE_HOVER, last.z)
      wrapper.userData.shipId = ship.id
      wrapper.userData.hullHeight = HULL_HEIGHT
      const player = state.players[ship.playerId]
      if (active && player) {
        const callout = createActiveCallout(
          `SG-${playerNo}`,
          playerNo === 1 ? css.player1 : css.player2,
          playerNo === 1 ? palette.player1 : palette.player2,
          player.fuel,
          ship.hull,
          ship.maxHull,
          player.glory,
        )
        wrapper.add(callout)
        wrapper.userData.callout = callout
      }
      wrapper.userData.shipCoord = coord
      this.group.add(wrapper)
      this.maybeSlide(ship.id, last, target)
    }
    this.applyMotion(performance.now())
  }

  tick(camera: THREE.Camera): boolean {
    const settled = this.applyMotion(performance.now())
    for (const child of this.group.children) {
      const callout = child.userData.callout as THREE.Group | undefined
      if (callout) layoutCallout(child, callout, camera)
    }
    return settled
  }

  pickables(): THREE.Object3D[] {
    return this.group.children
  }

  private parkedCoord(ship: ShipState): HexCoord | null {
    const motion = this.motion.get(ship.id)
    if (motion?.kind === 'fly') return null
    if (motion?.kind === 'hold') return motion.coord
    return ship.coord
  }

  private stackYaw(state: GameState, group: ShipState[], coord: HexCoord): number {
    return this.visualYaw(state.log, group[0]?.id ?? '', coord)
  }

  private maybeSlide(
    shipId: string,
    from: { x: number; z: number },
    to: { x: number; z: number },
  ): void {
    const motion = this.motion.get(shipId)
    if (motion?.kind === 'fly' || motion?.kind === 'hold') return
    const dist = Math.hypot(to.x - from.x, to.z - from.z)
    if (dist < 0.02) return
    if (
      motion?.kind === 'slide' &&
      Math.hypot(motion.toX - to.x, motion.toZ - to.z) < 0.02
    ) {
      return
    }
    this.motion.set(shipId, {
      kind: 'slide',
      fromX: from.x,
      fromZ: from.z,
      toX: to.x,
      toZ: to.z,
      start: performance.now(),
      duration: prefersReducedMotion() ? 0 : SHIP_SLIDE_MS,
    })
  }

  private visualYaw(log: GameEvent[], shipId: string, fallbackCoord: HexCoord): number {
    const motion = this.motion.get(shipId)
    if (motion?.kind === 'fly') {
      const elapsed = performance.now() - motion.start
      const turnT = motion.turnMs <= 0 ? 1 : clamp01(elapsed / motion.turnMs)
      return lerpAngle(motion.startYaw, motion.endYaw, easeInOutCubic(turnT))
    }
    const stored = this.facing.get(shipId)
    if (stored !== undefined) return stored
    return lastMoveYaw(log, shipId, fallbackCoord)
  }

  /** @returns true when a flight just finished and meshes should be rebuilt. */
  private applyMotion(now: number): boolean {
    let settled = false
    for (const child of this.group.children) {
      const shipId = child.userData.shipId as string
      const motion = this.motion.get(shipId)
      if (!motion) {
        applyEngineBurn(child, ENGINES_OFF)
        this.remember(child)
        continue
      }
      if (motion.kind === 'hold') {
        applyEngineBurn(child, ENGINES_OFF)
        this.remember(child)
        continue
      }
      if (motion.kind === 'slide') {
        const t = motion.duration <= 0 ? 1 : clamp01((now - motion.start) / motion.duration)
        const e = easeInOutSmooth(t)
        child.position.x = lerp(motion.fromX, motion.toX, e)
        child.position.z = lerp(motion.fromZ, motion.toZ, e)
        child.position.y = BASE_HOVER
        this.remember(child)
        if (t >= 1) {
          this.motion.delete(shipId)
          settled = true
        }
        continue
      }
      const elapsed = now - motion.start
      const turnT = motion.turnMs <= 0 ? 1 : clamp01(elapsed / motion.turnMs)
      const yaw = lerpAngle(motion.startYaw, motion.endYaw, easeInOutCubic(turnT))
      child.quaternion.setFromAxisAngle(Y_AXIS, yaw)
      this.facing.set(shipId, yaw)
      child.position.y = BASE_HOVER

      const burn = shipEngineBurn({
        elapsed,
        turnMs: motion.turnMs,
        igniteMs: motion.igniteMs,
        moveMs: motion.moveMs,
        yawDelta: motion.yawDelta,
        brakeMs: SHIP_BRAKE_MS,
      })
      applyEngineBurn(child, burn)

      if (turnT < 1) {
        child.position.x = motion.fromX
        child.position.z = motion.fromZ
        this.remember(child)
        continue
      }

      const afterTurn = elapsed - motion.turnMs
      if (afterTurn < motion.igniteMs) {
        child.position.x = motion.fromX
        child.position.z = motion.fromZ
        child.quaternion.setFromAxisAngle(Y_AXIS, motion.endYaw)
        this.facing.set(shipId, motion.endYaw)
        this.remember(child)
        continue
      }

      const moveT = motion.moveMs <= 0 ? 1 : clamp01((afterTurn - motion.igniteMs) / motion.moveMs)
      const e = easeInOutSmooth(moveT)
      child.position.x = lerp(motion.fromX, motion.toX, e)
      child.position.z = lerp(motion.fromZ, motion.toZ, e)
      child.quaternion.setFromAxisAngle(Y_AXIS, motion.endYaw)
      this.facing.set(shipId, motion.endYaw)
      this.remember(child)
      if (moveT >= 1) {
        applyEngineBurn(child, ENGINES_OFF)
        this.motion.delete(shipId)
        settled = true
      }
    }
    return settled
  }

  private remember(child: THREE.Object3D): void {
    const shipId = child.userData.shipId as string
    this.lastXZ.set(shipId, { x: child.position.x, z: child.position.z })
  }
}

function stackWorld(
  coord: HexCoord,
  count: number,
  index: number,
  yaw: number,
): { x: number; z: number } {
  const pos = getWorldPosition(coord)
  const side = index - (count - 1) / 2
  return {
    x: pos.x - Math.sin(yaw) * side * SHIP_SPACING,
    z: pos.z + Math.cos(yaw) * side * SHIP_SPACING,
  }
}

function lastMoveYaw(log: GameEvent[], shipId: string, fallback: HexCoord): number {
  for (let i = log.length - 1; i >= 0; i--) {
    const event = log[i]
    if (event.type === 'SHIP_MOVED' && event.shipId === shipId) {
      const from = getWorldPosition(event.from)
      const to = getWorldPosition(event.to)
      return Math.atan2(to.x - from.x, to.z - from.z)
    }
  }
  const east = getWorldPosition({ q: fallback.q + 1, r: fallback.r })
  const here = getWorldPosition(fallback)
  return Math.atan2(east.x - here.x, east.z - here.z)
}

function createNavMarker(
  shipClass: keyof typeof SHIP_DEFINITIONS,
  playerNo: number,
  active: boolean,
  label: string,
): THREE.Group {
  const color = hullColor(playerNo, active)
  const g = new THREE.Group()
  const length = shipClass === 'DRZAZGA' ? 0.34 : 0.42
  const half = shipClass === 'DRZAZGA' ? 0.1 : 0.12
  const shape = new THREE.Shape()
  shape.moveTo(0, -length * 0.5)
  shape.lineTo(-half, length * 0.5)
  shape.lineTo(half, length * 0.5)
  shape.closePath()
  const hull = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: HULL_HEIGHT, bevelEnabled: false, steps: 1 }),
    new THREE.MeshBasicMaterial({ color }),
  )
  hull.rotation.x = -Math.PI / 2
  g.add(hull)

  g.add(hullMark(label, length, half, true))
  g.add(hullMark(label, length, half, false))

  const y = HULL_HEIGHT * 0.55
  const main = makeEnginePlume(
    0.032,
    0.16,
    new THREE.Vector3(0, y, -length * 0.5 - 0.02),
    new THREE.Vector3(0, 0, -1),
  )
  g.add(main)

  const port = makeEnginePlume(
    0.014,
    0.07,
    new THREE.Vector3(-half * 0.92, y, 0.02),
    new THREE.Vector3(-1, 0, 0),
  )
  g.add(port)

  const starboard = makeEnginePlume(
    0.014,
    0.07,
    new THREE.Vector3(half * 0.92, y, 0.02),
    new THREE.Vector3(1, 0, 0),
  )
  g.add(starboard)

  const s = Math.SQRT1_2
  const brakePort = makeEnginePlume(
    0.03,
    0.15,
    new THREE.Vector3(-half * 0.55, y, length * 0.42),
    new THREE.Vector3(-s, 0, s),
  )
  g.add(brakePort)

  const brakeStarboard = makeEnginePlume(
    0.03,
    0.15,
    new THREE.Vector3(half * 0.55, y, length * 0.42),
    new THREE.Vector3(s, 0, s),
  )
  g.add(brakeStarboard)

  g.userData.engines = { main, port, starboard, brakePort, brakeStarboard }
  applyEngineBurn(g, ENGINES_OFF)
  return g
}

function hullColor(playerNo: number, active: boolean): number {
  if (playerNo === 1) return active ? palette.player1 : 0x8a6a38
  return active ? palette.player2 : 0x4f6070
}

function makeEnginePlume(
  radius: number,
  length: number,
  attach: THREE.Vector3,
  exhaust: THREE.Vector3,
): THREE.Group {
  const group = new THREE.Group()
  group.position.copy(attach)
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), exhaust.clone().normalize())

  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.55, radius * 0.9, radius * 1.4, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x2c2c28,
      side: THREE.DoubleSide,
    }),
  )
  nozzle.position.y = -radius * 0.2
  group.add(nozzle)

  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(radius, length, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: palette.engine,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  )
  mesh.position.y = length * 0.5
  mesh.renderOrder = 4
  group.add(mesh)

  const core = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.4, length * 0.7, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xdeffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  )
  core.position.y = length * 0.28
  core.renderOrder = 5
  group.add(core)

  group.userData.plumeMesh = mesh
  group.userData.plumeCore = core
  group.visible = true
  return group
}

function applyEngineBurn(
  root: THREE.Object3D,
  burn: {
    main: number
    port: number
    starboard: number
    brakePort: number
    brakeStarboard: number
  },
): void {
  const engines = root.userData.engines as
    | {
        main: THREE.Group
        port: THREE.Group
        starboard: THREE.Group
        brakePort: THREE.Group
        brakeStarboard: THREE.Group
      }
    | undefined
  if (!engines) return
  setPlume(engines.main, burn.main, 1.45)
  setPlume(engines.port, burn.port, 1.15)
  setPlume(engines.starboard, burn.starboard, 1.15)
  setPlume(engines.brakePort, burn.brakePort, 1.7)
  setPlume(engines.brakeStarboard, burn.brakeStarboard, 1.7)
}

function setPlume(group: THREE.Group, intensity: number, lengthScale: number): void {
  const mesh = group.userData.plumeMesh as THREE.Mesh | undefined
  const core = group.userData.plumeCore as THREE.Mesh | undefined
  if (!mesh) return
  const mat = mesh.material
  if (Array.isArray(mat) || !('opacity' in mat)) return
  const lit = clamp01(intensity)
  mat.opacity = lit * 0.95
  if (core && !Array.isArray(core.material) && 'opacity' in core.material) {
    core.material.opacity = lit * 0.85
    core.visible = lit > 0.03
  }
  const sx = 0.75 + lit * 0.55
  const sy = 0.6 + lit * lengthScale
  mesh.scale.set(sx, sy, sx)
  group.visible = true
}

function hullMark(label: string, length: number, half: number, port: boolean): THREE.Mesh {
  const y = HULL_HEIGHT * 0.5
  const nose = new THREE.Vector3(0, y, length * 0.5)
  const stern = new THREE.Vector3(port ? -half : half, y, -length * 0.5)
  const mid = nose.clone().add(stern).multiplyScalar(0.5)
  const along = stern.clone().sub(nose).normalize()
  const up = new THREE.Vector3(0, 1, 0)
  const outward = new THREE.Vector3().crossVectors(along, up).normalize()
  if ((port && outward.x > 0) || (!port && outward.x < 0)) outward.negate()
  mid.addScaledVector(outward, 0.006)

  const edge = Math.hypot(half, length)
  const width = Math.min(0.2, edge * 0.42)
  const height = HULL_HEIGHT * 0.7
  const mesh = createHullNumber(label, width, height)
  const xAxis = new THREE.Vector3().crossVectors(up, outward).normalize()
  const yAxis = new THREE.Vector3().crossVectors(outward, xAxis).normalize()
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, outward))
  mesh.position.copy(mid)
  return mesh
}

function createHullNumber(label: string, width: number, height: number): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 96)
    ctx.fillStyle = css.ink
    ctx.font = '700 52px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 128, 50)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  )
}

function createActiveCallout(
  label: string,
  ink: string,
  accent: number,
  fuel: number,
  hull: number,
  maxHull: number,
  glory: number,
): THREE.Group {
  const g = new THREE.Group()
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeCalloutTexture(label, ink, fuel, hull, maxHull, glory),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  )
  sprite.center.set(0, 0)
  sprite.scale.set(0.84, 0.46, 1)
  g.add(sprite)

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0.4, 0.5, 0)]),
    new THREE.LineBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.55,
      depthTest: false,
    }),
  )
  g.add(line)
  g.userData.calloutSprite = sprite
  g.userData.calloutLine = line
  return g
}

function layoutCallout(ship: THREE.Object3D, callout: THREE.Group, camera: THREE.Camera): void {
  const sprite = callout.userData.calloutSprite as THREE.Sprite
  const line = callout.userData.calloutLine as THREE.Line
  if (!sprite || !line) return
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).setY(0)
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0)
  else right.normalize()
  const localRight = right.clone().applyQuaternion(ship.quaternion.clone().invert())
  const localUp = new THREE.Vector3(0, 1, 0)
  const origin = new THREE.Vector3(0, HULL_HEIGHT + 0.02, 0)
  const card = origin.clone().addScaledVector(localRight, 0.55).addScaledVector(localUp, 0.48)
  sprite.position.copy(card)
  const geom = line.geometry as THREE.BufferGeometry
  geom.setFromPoints([origin, card])
  geom.computeBoundingSphere()
}

function makeCalloutTexture(
  label: string,
  ink: string,
  fuel: number,
  hull: number,
  maxHull: number,
  glory: number,
): THREE.CanvasTexture {
  const w = 280
  const h = 156
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = ink
    ctx.lineWidth = 1
    ctx.setLineDash([5, 4])
    ctx.strokeRect(12.5, 12.5, w - 25, h - 25)
    ctx.setLineDash([])
    ctx.fillStyle = ink
    ctx.globalAlpha = 0.12
    for (let y = 16; y < h - 16; y += 3) {
      ctx.fillRect(14, y, w - 28, 1)
    }
    ctx.globalAlpha = 1
    ctx.font = '600 26px "IBM Plex Mono", monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 24, 36)
    ctx.font = '500 16px "IBM Plex Mono", monospace'
    drawStatRow(ctx, ink, 24, 68, 'FUEL', 6, fuel, 12, 5)
    drawStatRow(ctx, ink, 24, 92, 'HULL', Math.max(1, maxHull), hull, 12, 5)
    drawStatRow(ctx, ink, 24, 116, 'GLORY', Math.max(glory, 4), glory, 10, 4)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function drawStatRow(
  ctx: CanvasRenderingContext2D,
  ink: string,
  x: number,
  y: number,
  name: string,
  count: number,
  filled: number,
  size: number,
  gap: number,
): void {
  ctx.fillStyle = ink
  ctx.fillText(name, x, y)
  drawPips(ctx, ink, x + 70, y, count, filled, size, gap)
}

function drawPips(
  ctx: CanvasRenderingContext2D,
  ink: string,
  x: number,
  y: number,
  count: number,
  filled: number,
  size: number,
  gap: number,
): void {
  for (let i = 0; i < count; i++) {
    const px = x + i * (size + gap)
    ctx.beginPath()
    ctx.rect(px, y - size / 2, size, size * 0.35)
    if (i < filled) {
      ctx.fillStyle = ink
      ctx.fill()
    } else {
      ctx.strokeStyle = ink
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
}

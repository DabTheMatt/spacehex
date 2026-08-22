import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import type { GameEvent } from '../../game/engine/events'
import type { ShipState } from '../../game/state/GameState'
import { getWorldPosition, HEX_SIZE } from '../../game/board/hexMath'
import type { HexCoord } from '../../game/board/HexCoord'
import { coordKey } from '../../game/board/HexCoord'
import { SHIP_DEFINITIONS } from '../../game/definitions/ships'
import { palette, css } from '../theme'
import { TILE_THICKNESS } from '../board/TileRenderer'
import { evaDockIndexForPlayer, evaDockWorldOffset, evaHubAngleAt, isEvaCoord } from '../board/evaDocks'
import {
  clamp01,
  easeInOutCubic,
  easeInOutSmooth,
  lerp,
  lerpAngle,
  prefersReducedMotion,
  shipEngineBurn,
  shipsTooClose,
  yieldOffSegment,
  SHIP_CLEARANCE,
  shortestAngleDelta,
  SHIP_BRAKE_MS,
  SHIP_FLIGHT_MS,
  SHIP_MAIN_IGNITE_MS,
  SHIP_SLIDE_MS,
  SHIP_TURN_MS,
} from '../motion'

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const ENGINES_OFF = { main: 0, port: 0, starboard: 0, brakePort: 0, brakeStarboard: 0 }
const RIM = HEX_SIZE * 0.28
const HULL_HEIGHT = 0.11
const BASE_HOVER = TILE_THICKNESS + 0.14

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
  pauseAccum: number
  lastTick: number
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
  private visualPark = new Map<string, HexCoord>()
  private landed: HexCoord[] = []
  private hubTime = 0

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

  consumeLanded(): HexCoord[] {
    const list = this.landed
    this.landed = []
    return list
  }

  reset(): void {
    this.motion.clear()
    this.facing.clear()
    this.lastXZ.clear()
    this.visualPark.clear()
    this.landed = []
    this.group.clear()
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

  isFlyingTo(shipId: string, coord: HexCoord): boolean {
    const motion = this.motion.get(shipId)
    return motion?.kind === 'fly' && coordKey(motion.to) === coordKey(coord)
  }

  isParkedAt(shipId: string, coord: HexCoord): boolean {
    const parked = this.visualPark.get(shipId)
    return parked ? coordKey(parked) === coordKey(coord) : false
  }

  fly(shipId: string, from: HexCoord, to: HexCoord): void {
    const fromW = getWorldPosition(from)
    const toW = getWorldPosition(to)
    const last = this.lastXZ.get(shipId)
    const endYaw = Math.atan2(
      toW.x - (last?.x ?? fromW.x),
      toW.z - (last?.z ?? fromW.z),
    )
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
      pauseAccum: 0,
      lastTick: performance.now(),
      turnMs: instant ? 0 : SHIP_TURN_MS,
      igniteMs: instant ? 0 : SHIP_MAIN_IGNITE_MS,
      moveMs: instant ? 0 : SHIP_FLIGHT_MS,
    })
  }

  sync(state: GameState): void {
    for (const ship of Object.values(state.ships)) {
      const parked = this.visualPark.get(ship.id)
      if (parked && coordKey(parked) === coordKey(ship.coord)) this.visualPark.delete(ship.id)
    }

    const groups = new Map<string, { coord: HexCoord; ships: ShipState[]; yaw: number }>()
    for (const ship of Object.values(state.ships)) {
      const motion = this.motion.get(ship.id)
      const coord = motion?.kind === 'fly' ? motion.to : this.parkedCoord(ship) ?? ship.coord
      const key = coordKey(coord)
      const flyerYaw = motion?.kind === 'fly' ? motion.endYaw : null
      const existing = groups.get(key)
      if (existing) {
        existing.ships.push(ship)
        if (flyerYaw !== null) existing.yaw = flyerYaw
      } else {
        groups.set(key, {
          coord,
          ships: [ship],
          yaw: flyerYaw ?? this.visualYaw(state.log, ship.id, coord),
        })
      }
    }
    for (const group of groups.values()) {
      group.ships.sort((a, b) => a.id.localeCompare(b.id))
    }

    const targets = new Map<string, { x: number; z: number }>()
    for (const group of groups.values()) {
      group.ships.forEach((ship) => {
        const slot = parkWorld(group.coord, ship, group.ships, group.yaw, this.hubTime)
        targets.set(ship.id, slot)
      })
    }

    this.group.clear()
    for (const ship of Object.values(state.ships)) {
      const coord = this.parkedCoord(ship) ?? ship.coord
      const target = targets.get(ship.id) ?? getWorldPosition(coord)
      const last = this.lastXZ.get(ship.id) ?? target
      const flying = this.motion.get(ship.id)?.kind === 'fly'
      let yaw = this.visualYaw(state.log, ship.id, coord)
      if (!flying && isEvaCoord(coord)) {
        yaw = evaDockWorldOffset(evaDockIndexForPlayer(ship.playerId), evaHubAngleAt(this.hubTime)).yaw
      }
      if (!flying) this.facing.set(ship.id, yaw)
      const playerNo = Number(ship.playerId.replace(/\D/g, '')) || 1
      const active = state.players[state.activePlayerId]?.shipId === ship.id
      const wrapper = new THREE.Group()
      const marker = createNavMarker(ship.class, playerNo, active, `SG-${playerNo}`)
      wrapper.add(marker)
      wrapper.userData.engines = marker.userData.engines
      wrapper.userData.beacon = marker.userData.beacon
      wrapper.quaternion.setFromAxisAngle(Y_AXIS, yaw)
      wrapper.position.set(last.x, BASE_HOVER, last.z)
      wrapper.userData.shipId = ship.id
      wrapper.userData.playerId = ship.playerId
      wrapper.userData.hullHeight = HULL_HEIGHT
      wrapper.userData.shipCoord = coord
      this.group.add(wrapper)
      if (flying || !isEvaCoord(coord)) {
        this.maybeSlide(ship.id, last, target)
      } else {
        wrapper.position.set(target.x, BASE_HOVER, target.z)
        this.lastXZ.set(ship.id, { x: target.x, z: target.z })
        if (this.motion.get(ship.id)?.kind === 'slide') this.motion.delete(ship.id)
      }
    }
    this.applyMotion(performance.now())
  }

  tick(_camera: THREE.Camera, time = 0): boolean {
    this.hubTime = time
    const settled = this.applyMotion(performance.now())
    for (const child of this.group.children) {
      const shipId = child.userData.shipId as string
      const coord = child.userData.shipCoord as HexCoord | undefined
      const playerId = child.userData.playerId as string | undefined
      const motion = this.motion.get(shipId)
      if (coord && playerId && isEvaCoord(coord) && motion?.kind !== 'fly' && motion?.kind !== 'hold' && motion?.kind !== 'slide') {
        const pos = getWorldPosition(coord)
        const dock = evaDockWorldOffset(evaDockIndexForPlayer(playerId), evaHubAngleAt(time))
        child.position.set(pos.x + dock.x, BASE_HOVER, pos.z + dock.z)
        child.quaternion.setFromAxisAngle(Y_AXIS, dock.yaw)
        this.facing.set(shipId, dock.yaw)
        this.lastXZ.set(shipId, { x: child.position.x, z: child.position.z })
      }
      const beacon = child.userData.beacon as THREE.Mesh | undefined
      if (!beacon) continue
      const mat = beacon.material
      if (Array.isArray(mat) || !('opacity' in mat)) continue
      const on = (time * 2) % 1 < 0.5
      mat.opacity = on ? 1 : 0.12
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
    return this.visualPark.get(ship.id) ?? ship.coord
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
      const elapsed = performance.now() - motion.start - motion.pauseAccum
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
        applyEngineBurn(child, slideBurn(this.facing.get(shipId) ?? 0, motion, t))
        this.remember(child)
        if (t >= 1) {
          applyEngineBurn(child, ENGINES_OFF)
          this.motion.delete(shipId)
          settled = true
        }
        continue
      }
      motion.lastTick = motion.lastTick || now
      const elapsed = now - motion.start - motion.pauseAccum
      const turnT = motion.turnMs <= 0 ? 1 : clamp01(elapsed / motion.turnMs)
      const playerId = child.userData.playerId as string | undefined
      if (isEvaCoord(motion.from) && playerId && turnT < 1) {
        const pos = getWorldPosition(motion.from)
        const dock = evaDockWorldOffset(evaDockIndexForPlayer(playerId), evaHubAngleAt(this.hubTime))
        motion.fromX = pos.x + dock.x
        motion.fromZ = pos.z + dock.z
      }
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
        motion.lastTick = now
        this.remember(child)
        continue
      }

      const afterTurn = elapsed - motion.turnMs
      if (afterTurn < motion.igniteMs) {
        if (isEvaCoord(motion.from) && playerId) {
          const pos = getWorldPosition(motion.from)
          const dock = evaDockWorldOffset(evaDockIndexForPlayer(playerId), evaHubAngleAt(this.hubTime))
          motion.fromX = pos.x + dock.x
          motion.fromZ = pos.z + dock.z
        }
        child.position.x = motion.fromX
        child.position.z = motion.fromZ
        child.quaternion.setFromAxisAngle(Y_AXIS, motion.endYaw)
        this.facing.set(shipId, motion.endYaw)
        motion.lastTick = now
        this.remember(child)
        continue
      }

      const moveElapsed = afterTurn - motion.igniteMs
      const moveT = motion.moveMs <= 0 ? 1 : clamp01(moveElapsed / motion.moveMs)
      const e = easeInOutSmooth(moveT)
      const nextX = lerp(motion.fromX, motion.toX, e)
      const nextZ = lerp(motion.fromZ, motion.toZ, e)
      if (this.blockedAt(shipId, nextX, nextZ, motion)) {
        if (motion.pauseAccum > 2800) {
          child.position.x = nextX
          child.position.z = nextZ
        } else {
          this.yieldBlockers(shipId, nextX, nextZ, motion)
          motion.pauseAccum += now - motion.lastTick
          motion.lastTick = now
          applyEngineBurn(child, ENGINES_OFF)
          this.remember(child)
          continue
        }
      }
      child.position.x = nextX
      child.position.z = nextZ
      child.quaternion.setFromAxisAngle(Y_AXIS, motion.endYaw)
      this.facing.set(shipId, motion.endYaw)
      motion.lastTick = now
      this.remember(child)
      if (moveT >= 1) {
        applyEngineBurn(child, ENGINES_OFF)
        this.landed.push({ ...motion.to })
        this.visualPark.set(shipId, { ...motion.to })
        this.motion.delete(shipId)
        settled = true
      }
    }
    return settled
  }

  private blockedAt(shipId: string, x: number, z: number, flyer: FlyMotion): boolean {
    for (const other of this.group.children) {
      const otherId = other.userData.shipId as string
      if (otherId === shipId) continue
      if (!shipsTooClose(x, z, other.position.x, other.position.z)) continue
      const otherMotion = this.motion.get(otherId)
      if (otherMotion?.kind === 'slide') continue
      const otherCoord = other.userData.shipCoord as HexCoord | undefined
      if (otherCoord && coordKey(otherCoord) === coordKey(flyer.from)) continue
      if (otherMotion?.kind === 'hold') continue
      if (otherMotion?.kind !== 'fly') {
        this.yieldAside(otherId, flyer, other.position)
        continue
      }
      return true
    }
    return false
  }

  private yieldBlockers(shipId: string, x: number, z: number, flyer: FlyMotion): void {
    for (const other of this.group.children) {
      const otherId = other.userData.shipId as string
      if (otherId === shipId) continue
      if (!shipsTooClose(x, z, other.position.x, other.position.z, SHIP_CLEARANCE + 0.04)) continue
      const otherMotion = this.motion.get(otherId)
      if (otherMotion?.kind === 'fly' || otherMotion?.kind === 'hold') continue
      this.yieldAside(otherId, flyer, other.position)
    }
  }

  private yieldAside(
    shipId: string,
    flyer: FlyMotion,
    pos: { x: number; z: number },
  ): void {
    const to = yieldOffSegment(pos.x, pos.z, flyer.fromX, flyer.fromZ, flyer.toX, flyer.toZ)
    this.maybeSlide(shipId, pos, to)
  }

  private remember(child: THREE.Object3D): void {
    const shipId = child.userData.shipId as string
    this.lastXZ.set(shipId, { x: child.position.x, z: child.position.z })
  }
}

function slideBurn(
  yaw: number,
  motion: SlideMotion,
  t: number,
): { main: number; port: number; starboard: number; brakePort: number; brakeStarboard: number } {
  if (t >= 1) return ENGINES_OFF
  const rightX = Math.cos(yaw)
  const rightZ = -Math.sin(yaw)
  const alongRight = (motion.toX - motion.fromX) * rightX + (motion.toZ - motion.fromZ) * rightZ
  if (Math.abs(alongRight) < 0.01) return ENGINES_OFF
  const braking = t > 0.62
  if (alongRight > 0) {
    return braking ? { ...ENGINES_OFF, starboard: 0.85 } : { ...ENGINES_OFF, port: 0.95 }
  }
  return braking ? { ...ENGINES_OFF, port: 0.85 } : { ...ENGINES_OFF, starboard: 0.95 }
}

function parkWorld(
  coord: HexCoord,
  ship: ShipState,
  group: ShipState[],
  yaw: number,
  time: number,
): { x: number; z: number } {
  const pos = getWorldPosition(coord)
  if (isEvaCoord(coord)) {
    const dock = evaDockWorldOffset(evaDockIndexForPlayer(ship.playerId), evaHubAngleAt(time))
    return { x: pos.x + dock.x, z: pos.z + dock.z }
  }
  const index = group.findIndex((item) => item.id === ship.id)
  const count = group.length
  const sideX = Math.cos(yaw)
  const sideZ = -Math.sin(yaw)
  if (count <= 1) {
    return { x: pos.x + sideX * RIM, z: pos.z + sideZ * RIM }
  }
  const side = index === 0 ? -1 : 1
  return { x: pos.x + sideX * side * RIM, z: pos.z + sideZ * side * RIM }
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
    new THREE.MeshBasicMaterial({ color, depthWrite: true, depthTest: true }),
  )
  hull.rotation.x = -Math.PI / 2
  hull.renderOrder = 3
  g.add(hull)

  g.add(hullMark(label, length, half, true))
  g.add(hullMark(label, length, half, false))

  const y = HULL_HEIGHT * 0.5
  const main = makeThruster(
    new THREE.Vector3(0, y, -length * 0.5),
    new THREE.Vector3(0, 0, -1),
    'main',
  )
  g.add(main)

  const port = makeThruster(
    new THREE.Vector3(-half, y, 0.04),
    new THREE.Vector3(-1, 0, 0),
    'rcs',
  )
  g.add(port)

  const starboard = makeThruster(
    new THREE.Vector3(half, y, 0.04),
    new THREE.Vector3(1, 0, 0),
    'rcs',
  )
  g.add(starboard)

  const s = Math.SQRT1_2
  const brakePort = makeThruster(
    new THREE.Vector3(-half * 0.42, y, length * 0.48),
    new THREE.Vector3(-s, 0, s),
    'rcs',
  )
  g.add(brakePort)

  const brakeStarboard = makeThruster(
    new THREE.Vector3(half * 0.42, y, length * 0.48),
    new THREE.Vector3(s, 0, s),
    'rcs',
  )
  g.add(brakeStarboard)

  g.userData.engines = { main, port, starboard, brakePort, brakeStarboard }
  if (active) {
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 8, 6),
      new THREE.MeshBasicMaterial({
        color: 0xf4f1e8,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    beacon.position.set(-half * 0.38, HULL_HEIGHT + 0.018, length * 0.2)
    beacon.renderOrder = 10
    g.add(beacon)
    g.userData.beacon = beacon
  }
  applyEngineBurn(g, ENGINES_OFF)
  return g
}

function hullColor(playerNo: number, active: boolean): number {
  if (playerNo === 1) return active ? palette.player1 : 0x8a6a38
  return active ? palette.player2 : 0x4f6070
}

function makeThruster(
  hullPoint: THREE.Vector3,
  exhaust: THREE.Vector3,
  kind: 'main' | 'rcs',
): THREE.Group {
  const dir = exhaust.clone().normalize()
  const standoff = kind === 'main' ? 0.09 : 0.055
  const plumeRadius = kind === 'main' ? 0.055 : 0.012
  const plumeLen = kind === 'main' ? 0.2 : 0.06

  const group = new THREE.Group()
  group.position.copy(hullPoint).addScaledVector(dir, standoff)
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)

  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(plumeRadius, plumeLen, 10, 1, true),
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
  mesh.position.y = plumeLen * 0.5
  mesh.renderOrder = 8
  group.add(mesh)

  const core = new THREE.Mesh(
    new THREE.ConeGeometry(plumeRadius * 0.38, plumeLen * 0.65, 8, 1, true),
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
  core.position.y = plumeLen * 0.28
  core.renderOrder = 9
  group.add(core)

  group.userData.plumeMesh = mesh
  group.userData.plumeCore = core
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
  setPlume(engines.main, burn.main, 1.55)
  setPlume(engines.port, burn.port, 1.2)
  setPlume(engines.starboard, burn.starboard, 1.2)
  setPlume(engines.brakePort, burn.brakePort, 1.2)
  setPlume(engines.brakeStarboard, burn.brakeStarboard, 1.2)
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
  mesh.visible = lit > 0.03
}

function hullMark(label: string, length: number, half: number, port: boolean): THREE.Mesh {
  const midY = HULL_HEIGHT * 0.52
  const nose = new THREE.Vector3(0, midY, length * 0.5)
  const stern = new THREE.Vector3(port ? -half : half, midY, -length * 0.5)
  const along = stern.clone().sub(nose)
  const edgeLen = along.length()
  along.normalize()
  const pos = nose.clone().addScaledVector(along, edgeLen * 0.3)
  const up = new THREE.Vector3(0, 1, 0)
  const outward = new THREE.Vector3().crossVectors(along, up).normalize()
  if ((port && outward.x > 0) || (!port && outward.x < 0)) outward.negate()
  pos.addScaledVector(outward, 0.004)

  const width = Math.min(0.16, edgeLen * 0.4)
  const height = HULL_HEIGHT * 0.86
  const mesh = createHullNumber(label, width, height)
  const xAxis = new THREE.Vector3().crossVectors(up, outward).normalize()
  const yAxis = new THREE.Vector3().crossVectors(outward, xAxis).normalize()
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, outward))
  mesh.position.copy(pos)
  mesh.renderOrder = 4
  return mesh
}

function createHullNumber(label: string, width: number, height: number): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 96)
    ctx.font = '700 62px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = css.hullMark
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
      side: THREE.DoubleSide,
    }),
  )
}

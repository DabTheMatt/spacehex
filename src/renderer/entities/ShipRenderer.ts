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
  lerp,
  lerpAngle,
  prefersReducedMotion,
  SHIP_FLIGHT_MS,
  SHIP_SLIDE_MS,
  SHIP_TURN_MS,
} from '../motion'

const SHIP_SPACING = 0.46
const HULL_HEIGHT = 0.055
const BASE_HOVER = TILE_THICKNESS + 0.12

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
  start: number
  turnMs: number
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

  hold(shipId: string, coord: HexCoord): void {
    this.motion.set(shipId, { kind: 'hold', coord })
  }

  fly(shipId: string, from: HexCoord, to: HexCoord): void {
    const fromW = getWorldPosition(from)
    const toW = getWorldPosition(to)
    const last = this.lastXZ.get(shipId)
    const endYaw = Math.atan2(toW.x - fromW.x, toW.z - fromW.z)
    const startYaw = this.facing.get(shipId) ?? endYaw
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
      start: performance.now(),
      turnMs: instant ? 0 : SHIP_TURN_MS,
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
      const playerNo = Number(ship.playerId.replace(/\D/g, '')) || 1
      const active = state.players[state.activePlayerId]?.shipId === ship.id
      const wrapper = new THREE.Group()
      wrapper.add(createNavMarker(ship.class, active, String(playerNo)))
      wrapper.rotation.y = yaw
      wrapper.position.set(last.x, BASE_HOVER, last.z)
      wrapper.userData.bob = { baseY: BASE_HOVER, phase: playerNo * 1.7 }
      wrapper.userData.shipId = ship.id
      wrapper.userData.shipCoord = coord
      this.group.add(wrapper)
      this.maybeSlide(ship.id, last, target)
    }
    this.applyMotion(performance.now())
  }

  tick(time: number): boolean {
    const settled = this.applyMotion(performance.now())
    const reduce = prefersReducedMotion()
    for (const child of this.group.children) {
      const moving = this.motion.get(child.userData.shipId as string)
      if (moving?.kind === 'fly' || moving?.kind === 'slide') continue
      const bob = child.userData.bob as { baseY: number; phase: number } | undefined
      if (!bob) continue
      child.position.y = reduce ? bob.baseY : bob.baseY + Math.sin(time * 0.4 + bob.phase) * 0.028
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
    if (motion?.kind === 'fly') return motion.startYaw
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
        this.remember(child)
        continue
      }
      if (motion.kind === 'hold') {
        this.remember(child)
        continue
      }
      if (motion.kind === 'slide') {
        const t = motion.duration <= 0 ? 1 : clamp01((now - motion.start) / motion.duration)
        const e = easeInOutCubic(t)
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
      child.rotation.y = lerpAngle(motion.startYaw, motion.endYaw, easeInOutCubic(turnT))
      this.facing.set(shipId, child.rotation.y)
      child.position.y = BASE_HOVER
      const bob = child.userData.bob as { baseY: number; phase: number } | undefined
      if (bob) bob.baseY = BASE_HOVER

      if (turnT < 1) {
        child.position.x = motion.fromX
        child.position.z = motion.fromZ
        this.remember(child)
        continue
      }

      const moveT = motion.moveMs <= 0 ? 1 : clamp01((elapsed - motion.turnMs) / motion.moveMs)
      const e = easeInOutCubic(moveT)
      child.position.x = lerp(motion.fromX, motion.toX, e)
      child.position.z = lerp(motion.fromZ, motion.toZ, e)
      child.rotation.y = motion.endYaw
      this.facing.set(shipId, motion.endYaw)
      this.remember(child)
      if (moveT >= 1) {
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
  active: boolean,
  label: string,
): THREE.Group {
  const color = active ? palette.ochre : palette.ivory
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

  const number = createDeckNumber(label)
  number.position.set(0, HULL_HEIGHT + 0.0015, 0.02)
  g.add(number)
  return g
}

function createDeckNumber(label: string): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64)
    ctx.fillStyle = css.ink
    ctx.font = '600 48px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 32, 36)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.09, 0.09),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

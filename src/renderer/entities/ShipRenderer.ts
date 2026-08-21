import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import type { GameEvent } from '../../game/engine/events'
import type { ShipState } from '../../game/state/GameState'
import { getWorldPosition } from '../../game/board/hexMath'
import type { HexCoord } from '../../game/board/HexCoord'
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
type ShipMotion = HoldMotion | FlyMotion

export class ShipRenderer {
  readonly group = new THREE.Group()
  private motion = new Map<string, ShipMotion>()

  hold(shipId: string, coord: HexCoord): void {
    this.motion.set(shipId, { kind: 'hold', coord })
  }

  fly(shipId: string, from: HexCoord, to: HexCoord): void {
    const fromW = getWorldPosition(from)
    const toW = getWorldPosition(to)
    const child = this.group.children.find((node) => node.userData.shipId === shipId)
    const startYaw = child?.rotation.y ?? Math.atan2(toW.x - fromW.x, toW.z - fromW.z)
    const instant = prefersReducedMotion()
    this.motion.set(shipId, {
      kind: 'fly',
      from,
      to,
      fromX: child?.position.x ?? fromW.x,
      fromZ: child?.position.z ?? fromW.z,
      toX: toW.x,
      toZ: toW.z,
      startYaw,
      endYaw: Math.atan2(toW.x - fromW.x, toW.z - fromW.z),
      start: performance.now(),
      turnMs: instant ? 0 : SHIP_TURN_MS,
      moveMs: instant ? 0 : SHIP_FLIGHT_MS,
    })
  }

  sync(state: GameState): void {
    this.group.clear()
    const byTile = new Map<string, ShipState[]>()
    for (const ship of Object.values(state.ships)) {
      const coord = this.layoutCoord(ship)
      const key = `${coord.q},${coord.r}`
      const list = byTile.get(key) ?? []
      list.push(ship)
      byTile.set(key, list)
    }

    for (const group of byTile.values()) {
      const n = group.length
      group.forEach((ship, index) => {
        const coord = this.layoutCoord(ship)
        const pos = getWorldPosition(coord)
        const yaw = this.visualYaw(state.log, ship.id, coord)
        const side = index - (n - 1) / 2
        const px = -Math.sin(yaw)
        const pz = Math.cos(yaw)
        const wrapper = new THREE.Group()
        const playerNo = Number(ship.playerId.replace(/\D/g, '')) || index + 1
        const active = state.players[state.activePlayerId]?.shipId === ship.id
        wrapper.add(createNavMarker(ship.class, active, String(playerNo)))
        wrapper.rotation.y = yaw
        wrapper.position.set(
          pos.x + px * side * SHIP_SPACING,
          BASE_HOVER,
          pos.z + pz * side * SHIP_SPACING,
        )
        wrapper.userData.bob = {
          baseY: BASE_HOVER,
          phase: playerNo * 1.7 + index,
        }
        wrapper.userData.shipId = ship.id
        wrapper.userData.shipCoord = coord
        this.group.add(wrapper)
      })
    }
    this.applyMotion(performance.now())
  }

  tick(time: number): boolean {
    const settled = this.applyMotion(performance.now())
    const reduce = prefersReducedMotion()
    for (const child of this.group.children) {
      const flying = this.motion.get(child.userData.shipId as string)?.kind === 'fly'
      if (flying) continue
      const bob = child.userData.bob as { baseY: number; phase: number } | undefined
      if (!bob) continue
      child.position.y = reduce ? bob.baseY : bob.baseY + Math.sin(time * 0.4 + bob.phase) * 0.028
    }
    return settled
  }

  pickables(): THREE.Object3D[] {
    return this.group.children
  }

  private layoutCoord(ship: ShipState): HexCoord {
    const motion = this.motion.get(ship.id)
    if (motion?.kind === 'hold') return motion.coord
    if (motion?.kind === 'fly') return motion.from
    return ship.coord
  }

  private visualYaw(log: GameEvent[], shipId: string, fallbackCoord: HexCoord): number {
    const motion = this.motion.get(shipId)
    if (motion?.kind === 'fly') return motion.startYaw
    return lastMoveYaw(log, shipId, fallbackCoord)
  }

  /** @returns true when a flight just finished and meshes should be rebuilt. */
  private applyMotion(now: number): boolean {
    let settled = false
    for (const child of this.group.children) {
      const shipId = child.userData.shipId as string
      const motion = this.motion.get(shipId)
      if (!motion || motion.kind !== 'fly') continue
      const elapsed = now - motion.start
      const turnT = motion.turnMs <= 0 ? 1 : clamp01(elapsed / motion.turnMs)
      child.rotation.y = lerpAngle(motion.startYaw, motion.endYaw, easeInOutCubic(turnT))
      child.position.y = BASE_HOVER
      const bob = child.userData.bob as { baseY: number; phase: number } | undefined
      if (bob) bob.baseY = BASE_HOVER

      if (turnT < 1) {
        child.position.x = motion.fromX
        child.position.z = motion.fromZ
        continue
      }

      const moveT = motion.moveMs <= 0 ? 1 : clamp01((elapsed - motion.turnMs) / motion.moveMs)
      const e = easeInOutCubic(moveT)
      child.position.x = lerp(motion.fromX, motion.toX, e)
      child.position.z = lerp(motion.fromZ, motion.toZ, e)
      child.rotation.y = motion.endYaw
      if (moveT >= 1) {
        this.motion.delete(shipId)
        settled = true
      }
    }
    return settled
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

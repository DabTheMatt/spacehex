import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import type { GameEvent } from '../../game/engine/events'
import type { ShipState } from '../../game/state/GameState'
import { getWorldPosition } from '../../game/board/hexMath'
import { SHIP_DEFINITIONS } from '../../game/definitions/ships'
import { palette, css } from '../theme'
import { TILE_THICKNESS } from '../board/TileRenderer'

const SHIP_SPACING = 0.46
const HULL_HEIGHT = 0.055
const BASE_HOVER = TILE_THICKNESS + 0.12

export class ShipRenderer {
  readonly group = new THREE.Group()

  sync(state: GameState): void {
    this.group.clear()
    const byTile = new Map<string, ShipState[]>()
    for (const ship of Object.values(state.ships)) {
      const key = `${ship.coord.q},${ship.coord.r}`
      const list = byTile.get(key) ?? []
      list.push(ship)
      byTile.set(key, list)
    }

    for (const group of byTile.values()) {
      const n = group.length
      group.forEach((ship, index) => {
        const pos = getWorldPosition(ship.coord)
        const yaw = lastMoveYaw(state.log, ship.id)
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
        this.group.add(wrapper)
      })
    }
  }

  tick(time: number): void {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    for (const child of this.group.children) {
      const bob = child.userData.bob as { baseY: number; phase: number } | undefined
      if (!bob) continue
      child.position.y = reduce
        ? bob.baseY
        : bob.baseY + Math.sin(time * 0.4 + bob.phase) * 0.028
    }
  }
}

function lastMoveYaw(log: GameEvent[], shipId: string): number {
  for (let i = log.length - 1; i >= 0; i--) {
    const event = log[i]
    if (event.type === 'SHIP_MOVED' && event.shipId === shipId) {
      const from = getWorldPosition(event.from)
      const to = getWorldPosition(event.to)
      return Math.atan2(to.x - from.x, to.z - from.z)
    }
  }
  const east = getWorldPosition({ q: 1, r: 0 })
  return Math.atan2(east.x, east.z)
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

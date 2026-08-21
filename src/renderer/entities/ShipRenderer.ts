import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import type { GameEvent } from '../../game/engine/events'
import type { ShipState } from '../../game/state/GameState'
import { getWorldPosition } from '../../game/board/hexMath'
import { SHIP_DEFINITIONS } from '../../game/definitions/ships'
import { palette, css } from '../theme'
import { TILE_THICKNESS } from '../board/TileRenderer'

const SHIP_SPACING = 0.46
const BASE_HOVER = TILE_THICKNESS + 0.2

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
        wrapper.add(createShipMesh(ship.class, active))
        wrapper.add(createHullNumber(String(playerNo)))
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
    for (const child of this.group.children) {
      const bob = child.userData.bob as { baseY: number; phase: number } | undefined
      if (!bob) continue
      child.position.y = bob.baseY + Math.sin(time * 1.15 + bob.phase) * 0.045
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

function createShipMesh(shipClass: keyof typeof SHIP_DEFINITIONS, active: boolean): THREE.Mesh {
  const color = active ? palette.ochre : palette.ivory
  if (shipClass === 'MEWA') {
    const geom = new THREE.ConeGeometry(0.14, 0.42, 3)
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color }))
    mesh.rotation.x = Math.PI / 2
    return mesh
  }
  if (shipClass === 'CIERN') {
    return new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshBasicMaterial({ color }),
    )
  }
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.34, 3),
    new THREE.MeshBasicMaterial({ color }),
  )
  mesh.rotation.x = Math.PI / 2
  return mesh
}

function createHullNumber(label: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128)
    ctx.fillStyle = css.paper
    ctx.font = 'bold 72px Palatino, Times New Roman, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 64, 68)
  }
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }),
  )
  sprite.scale.set(0.28, 0.28, 1)
  sprite.position.set(0, 0.22, 0)
  return sprite
}

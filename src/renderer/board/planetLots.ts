import * as THREE from 'three'
import type { PlanetMarket, ResourceId } from '../../game/definitions/resources'
import { RESOURCE_IDS } from '../../game/definitions/resources'
import { palette, css } from '../theme'
import { TILE_THICKNESS } from './TileRenderer'
import { HEX_SIZE } from '../../game/board/hexMath'
import type { HexCoord } from '../../game/board/HexCoord'

const RESOURCE_COLOR: Record<ResourceId, number> = {
  RED: palette.resourceRed,
  GREEN: palette.resourceGreen,
  BLUE: palette.resourceBlue,
}

const RESOURCE_CSS: Record<ResourceId, string> = {
  RED: css.resourceRed,
  GREEN: css.resourceGreen,
  BLUE: css.resourceBlue,
}

/** Edge mid-angles in XZ (cos, sin). Name sits on +Z so inspect can put that edge at screen-bottom. */
const NAME_ANGLE = Math.PI / 2
const STOCK_ANGLES: Record<ResourceId, number> = {
  RED: (150 * Math.PI) / 180,
  GREEN: (210 * Math.PI) / 180,
  BLUE: (330 * Math.PI) / 180,
}

const EDGE_R = HEX_SIZE * 0.78

export function planetInspectTheta(tileRotation: number): number {
  return tileRotation * (Math.PI / 3)
}

export function createPlanetOverlay(
  market: PlanetMarket,
  coord: HexCoord,
  options: { showPrices: boolean; buyPrice: Record<ResourceId, number> },
): THREE.Group {
  const g = new THREE.Group()
  g.add(planetName(market.designation, coord))
  for (const id of RESOURCE_IDS) {
    const lot = market.lots.find((item) => item.id === id)
    const amount = lot?.amount ?? 0
    const angle = STOCK_ANGLES[id]
    const cluster = new THREE.Group()
    cluster.position.set(Math.cos(angle) * EDGE_R, TILE_THICKNESS + 0.035, Math.sin(angle) * EDGE_R)
    cluster.add(stockHex(id, amount))
    if (options.showPrices) {
      const price = options.buyPrice[id]
      const tag = priceTag(`${price}CR`, RESOURCE_CSS[id])
      tag.position.set(0, 0.01, 0.16)
      cluster.add(tag)
      if (amount > 0) {
        const hit = new THREE.Mesh(
          new THREE.CircleGeometry(0.16, 12),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        )
        hit.rotation.x = -Math.PI / 2
        hit.position.y = 0.02
        hit.userData.buyLot = { coord, resource: id }
        hit.userData.pickOnly = true
        cluster.add(hit)
      }
    }
    g.add(cluster)
  }
  return g
}

function planetName(text: string, coord: HexCoord): THREE.Group {
  const g = new THREE.Group()
  g.position.set(Math.cos(NAME_ANGLE) * EDGE_R, TILE_THICKNESS + 0.04, Math.sin(NAME_ANGLE) * EDGE_R)
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 80
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 640, 80)
    ctx.fillStyle = css.ivory
    ctx.font = '600 36px "IBM Plex Mono", "Noto Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 320, 42)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.09),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 8
  mesh.userData.planetName = coord
  const hit = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.14),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  hit.rotation.x = -Math.PI / 2
  hit.position.y = 0.01
  hit.userData.planetName = coord
  hit.userData.pickOnly = true
  g.add(mesh, hit)
  return g
}

function stockHex(id: ResourceId, amount: number): THREE.Group {
  const g = new THREE.Group()
  const color = RESOURCE_COLOR[id]
  const shape = new THREE.Shape()
  const r = 0.09
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i
    const x = r * Math.cos(a)
    const y = r * Math.sin(a)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const hex = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color: palette.graphite,
      side: THREE.DoubleSide,
      depthWrite: false,
      transparent: true,
      opacity: amount > 0 ? 0.92 : 0.4,
    }),
  )
  hex.rotation.x = -Math.PI / 2
  g.add(hex)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.82, r, 6),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.002
  g.add(ring)

  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128)
    ctx.fillStyle = RESOURCE_CSS[id]
    ctx.font = '700 78px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(amount), 64, 70)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const digit = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.14),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  )
  digit.rotation.x = -Math.PI / 2
  digit.position.y = 0.012
  digit.renderOrder = 7
  g.add(digit)
  return g
}

function priceTag(text: string, color: string): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64)
    ctx.fillStyle = color
    ctx.font = '600 28px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 34)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.07),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 8
  return mesh
}

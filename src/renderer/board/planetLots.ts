import * as THREE from 'three'
import type { PlanetMarket, ResourceId } from '../../game/definitions/resources'
import { RESOURCE_LABEL } from '../../game/definitions/resources'
import { palette, css } from '../theme'
import { TILE_THICKNESS } from './TileRenderer'
import type { HexCoord } from '../../game/board/HexCoord'

const ICON: Record<ResourceId, number> = {
  ORE: palette.planetRose,
  ICE: palette.planetSage,
  RARE: palette.planetViolet,
}

export function createPlanetLots(market: PlanetMarket, coord: HexCoord): THREE.Group {
  const g = new THREE.Group()
  const n = market.lots.length
  market.lots.forEach((lot, index) => {
    const x = (index - (n - 1) / 2) * 0.34
    const z = 0.46
    const cluster = new THREE.Group()
    cluster.position.set(x, TILE_THICKNESS + 0.04, z)
    cluster.userData.buyLot = { coord, resource: lot.id }

    const icon = resourceIcon(lot.id)
    cluster.add(icon)

    const caption = lotCaption(`${RESOURCE_LABEL[lot.id]}  ×${lot.amount}  ${lot.price}CR`)
    caption.position.set(0, 0.02, 0.12)
    cluster.add(caption)

    const hit = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 12),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    hit.rotation.x = -Math.PI / 2
    hit.position.y = 0.01
    hit.userData.buyLot = { coord, resource: lot.id }
    cluster.add(hit)
    g.add(cluster)
  })
  return g
}

function resourceIcon(id: ResourceId): THREE.Object3D {
  const color = ICON[id]
  if (id === 'ICE') {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.045, 16),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthWrite: false }),
    )
    mesh.rotation.x = -Math.PI / 2
    return mesh
  }
  if (id === 'RARE') {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0.05)
    shape.lineTo(0.04, 0)
    shape.lineTo(0, -0.05)
    shape.lineTo(-0.04, 0)
    shape.closePath()
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthWrite: false }),
    )
    mesh.rotation.x = -Math.PI / 2
    return mesh
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.08),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthWrite: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

function lotCaption(text: string): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 384, 64)
    ctx.fillStyle = css.ivory
    ctx.font = '500 22px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 192, 34)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.07),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 6
  return mesh
}

import * as THREE from 'three'
import type { PlanetMarket, ResourceId } from '../../game/definitions/resources'
import { RESOURCE_IDS, RESOURCE_LABEL } from '../../game/definitions/resources'
import { palette, css } from '../theme'
import { TILE_THICKNESS } from './TileRenderer'
import { HEX_SIZE } from '../../game/board/hexMath'
import type { HexCoord } from '../../game/board/HexCoord'
import { clamp01 } from '../motion'

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

/** Name sits on +Z so inspect can put that edge at screen-bottom. */
const NAME_ANGLE = Math.PI / 2
const NAME_PLANE_H = 0.08
const TILE_RADIUS = HEX_SIZE * 0.96
const FLAT_EDGE = TILE_RADIUS * (Math.sqrt(3) / 2)
/** Gap from the tile edge to the name equals one name-row height. */
const NAME_R = FLAT_EDGE - NAME_PLANE_H * 0.45
const TOP_Z = -HEX_SIZE * 0.68
const HEX_SPACING = 0.2
const CLOSE_DIST = 4.2
const FAR_DIST = 6.0

export function planetInspectTheta(tileRotation: number): number {
  return tileRotation * (Math.PI / 3)
}

/** Classic d6 pip layout for 0–6 (higher amounts clamp to 6). */
export function dicePips(amount: number): Array<{ x: number; z: number }> {
  const n = Math.max(0, Math.min(6, Math.floor(amount)))
  const d = 0.026
  const c = { x: 0, z: 0 }
  const tl = { x: -d, z: -d }
  const tr = { x: d, z: -d }
  const ml = { x: -d, z: 0 }
  const mr = { x: d, z: 0 }
  const bl = { x: -d, z: d }
  const br = { x: d, z: d }
  switch (n) {
    case 1:
      return [c]
    case 2:
      return [tl, br]
    case 3:
      return [tl, c, br]
    case 4:
      return [tl, tr, bl, br]
    case 5:
      return [tl, tr, c, bl, br]
    case 6:
      return [tl, ml, bl, tr, mr, br]
    default:
      return []
  }
}

export function createPlanetOverlay(
  market: PlanetMarket,
  coord: HexCoord,
  buyPrice: Record<ResourceId, number>,
): THREE.Group {
  const g = new THREE.Group()
  g.userData.planetOverlay = true
  g.add(planetName(market.designation, coord))

  const close = new THREE.Group()
  close.userData.lod = 'close'
  const far = new THREE.Group()
  far.userData.lod = 'far'

  RESOURCE_IDS.forEach((id, index) => {
    const lot = market.lots.find((item) => item.id === id)
    const amount = lot?.amount ?? 0
    const x = (index - 1) * HEX_SPACING
    const cluster = new THREE.Group()
    cluster.position.set(x, TILE_THICKNESS + 0.035, TOP_Z)
    cluster.add(stockHex(id, amount))
    const name = caption(RESOURCE_LABEL[id], RESOURCE_CSS[id])
    name.position.set(0, 0.01, -0.11)
    cluster.add(name)
    const tag = priceTag(`${buyPrice[id]}CR`, css.priceYellow)
    tag.position.set(0, 0.01, 0.088)
    cluster.add(tag)
    if (amount > 0) {
      const hit = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 12),
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
    close.add(cluster)
    far.add(diceCluster(id, amount, x))
  })

  g.add(close, far)
  g.userData.closeLod = close
  g.userData.farLod = far
  return g
}

export function tickPlanetLod(root: THREE.Object3D, camera: THREE.Camera): void {
  const world = new THREE.Vector3()
  root.traverse((obj) => {
    if (!obj.userData.planetOverlay) return
    if (isOverlayHidden(obj)) {
      setLodOpacity(obj.userData.closeLod as THREE.Object3D | undefined, 0)
      setLodOpacity(obj.userData.farLod as THREE.Object3D | undefined, 0)
      return
    }
    obj.getWorldPosition(world)
    const dist = camera.position.distanceTo(world)
    const close = clamp01((FAR_DIST - dist) / (FAR_DIST - CLOSE_DIST))
    setLodOpacity(obj.userData.closeLod as THREE.Object3D | undefined, close)
    setLodOpacity(obj.userData.farLod as THREE.Object3D | undefined, 1 - close)
  })
}

function isOverlayHidden(obj: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = obj
  while (node) {
    if (node.userData.overlayHidden) return true
    node = node.parent
  }
  return false
}

function setLodOpacity(root: THREE.Object3D | undefined, opacity: number): void {
  if (!root) return
  root.visible = opacity > 0.02
  root.traverse((obj) => {
    if (obj.userData.pickOnly) {
      obj.visible = opacity > 0.45
      return
    }
    const mesh = obj as THREE.Mesh
    const mat = mesh.material
    if (!mat) return
    const list = Array.isArray(mat) ? mat : [mat]
    for (const item of list) {
      const material = item as THREE.Material & { opacity?: number }
      material.transparent = true
      material.depthWrite = false
      if (typeof material.opacity === 'number') material.opacity = opacity
    }
  })
}

function planetName(text: string, coord: HexCoord): THREE.Group {
  return createEdgeLabel(text, { coord, clickable: true })
}

export function createEdgeLabel(
  text: string,
  options: { coord?: HexCoord; clickable?: boolean; width?: number } = {},
): THREE.Group {
  const g = new THREE.Group()
  g.position.set(Math.cos(NAME_ANGLE) * NAME_R, TILE_THICKNESS + 0.04, Math.sin(NAME_ANGLE) * NAME_R)
  const width = options.width ?? 0.7
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 80
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 768, 80)
    ctx.fillStyle = css.ivory
    ctx.font = '400 26px "IBM Plex Mono", "Noto Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 384, 42)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, NAME_PLANE_H),
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
  if (options.clickable && options.coord) mesh.userData.planetName = options.coord
  const hit = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.06, NAME_PLANE_H + 0.05),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  hit.rotation.x = -Math.PI / 2
  hit.position.y = 0.01
  if (options.clickable && options.coord) {
    hit.userData.planetName = options.coord
    hit.userData.pickOnly = true
  } else {
    hit.userData.pickOnly = true
  }
  g.add(mesh, hit)
  return g
}

function stockHex(id: ResourceId, amount: number): THREE.Group {
  const g = new THREE.Group()
  const color = RESOURCE_COLOR[id]
  const shape = new THREE.Shape()
  const r = 0.072
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
    new THREE.RingGeometry(r * 0.94, r, 6),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      depthWrite: false,
      transparent: true,
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
    ctx.font = '500 72px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(amount), 64, 70)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const digit = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.12),
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

function diceCluster(id: ResourceId, amount: number, x: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, TILE_THICKNESS + 0.04, TOP_Z)
  const color = RESOURCE_COLOR[id]
  for (const pip of dicePips(amount)) {
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.012, 10),
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        depthWrite: false,
        transparent: true,
      }),
    )
    dot.rotation.x = -Math.PI / 2
    dot.position.set(pip.x, 0.004, pip.z)
    g.add(dot)
  }
  return g
}

function caption(text: string, color: string): THREE.Mesh {
  return textPlane(text, color, 0.18, 0.045)
}

function priceTag(text: string, color: string): THREE.Mesh {
  return textPlane(text, color, 0.2, 0.05)
}

function textPlane(text: string, color: string, width: number, height: number): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64)
    ctx.fillStyle = color
    ctx.font = '500 22px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 34)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
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

import * as THREE from 'three'
import type { PlanetMarket, ResourceId } from '../../game/definitions/resources'
import { RESOURCE_IDS } from '../../game/definitions/resources'
import { FUEL_BUY_PRICE, REPAIR_PRICE } from '../../game/definitions/constants'
import { palette, css } from '../theme'
import { HEX_SIZE, hexEdgeCorners } from '../../game/board/hexMath'
import type { HexCoord } from '../../game/board/HexCoord'
import { clamp01 } from '../motion'
import { createCargoFigure } from './cargoMesh'
import { CARGO_FIGURE } from '../../game/definitions/cargoFigures'

const RESOURCE_COLOR: Record<ResourceId, number> = {
  ORE: palette.resourceRed,
  BIOMASS: palette.resourceGreen,
  ICE: palette.resourceBlue,
}

const RESOURCE_CSS: Record<ResourceId, string> = {
  ORE: css.resourceRed,
  BIOMASS: css.resourceGreen,
  ICE: css.resourceBlue,
}

/** Stroke/text on INK overlays — paper color, so INK REV stays black on white. */
export function inkMarkCss(mark: number): string {
  return mark === 0 ? '#000000' : '#FFFFFF'
}

/** Pad fill opposite the ink stroke. */
export function inkPadFill(mark: number): number {
  return mark === 0 ? 0xffffff : 0x000000
}

/** Name sits on +Z so inspect can put that edge at screen-bottom. */
const NAME_ANGLE = Math.PI / 2
const NAME_PLANE_H = 0.08
const TILE_RADIUS = HEX_SIZE * 0.96
const FLAT_EDGE = TILE_RADIUS * (Math.sqrt(3) / 2)
/** Shared inset from the hex flat for names, resource lots, and EVA sell pads. */
export const EDGE_MARGIN = 0.12
const NAME_R = FLAT_EDGE - EDGE_MARGIN
export const LOT_Z = -(FLAT_EDGE - EDGE_MARGIN)
/** Toward hex center from the icon — under the top-row lots, not past the rim. */
export const PRICE_BELOW_Z = 0.13
const HEX_SPACING = 0.18
const SERVICE_GAP = 0.28
/** SE slant (axial dir 0). Bottom-right on screen when the name sits on +Z. */
export const SERVICE_EDGE_DIR = 0

export function overlayLotX(index: number, count = RESOURCE_IDS.length): number {
  return (index - (count - 1) / 2) * HEX_SPACING
}

export function servicePadPosition(slot: number, slots: number): { x: number; z: number } {
  const [a, b] = hexEdgeCorners(SERVICE_EDGE_DIR, TILE_RADIUS)
  const mx = (a.x + b.x) / 2
  const mz = (a.z + b.z) / 2
  const out = Math.hypot(mx, mz) || 1
  const tx = b.x - a.x
  const tz = b.z - a.z
  const tlen = Math.hypot(tx, tz) || 1
  const along = slots <= 1 ? 0 : (slot - (slots - 1) / 2) * SERVICE_GAP
  return {
    x: mx - (mx / out) * EDGE_MARGIN - (tx / tlen) * along,
    z: mz - (mz / out) * EDGE_MARGIN - (tz / tlen) * along,
  }
}

export function priceInwardOffset(fromX: number, fromZ: number): { x: number; z: number } {
  const len = Math.hypot(fromX, fromZ) || 1
  return { x: (-fromX / len) * PRICE_BELOW_Z, z: (-fromZ / len) * PRICE_BELOW_Z }
}
const CLOSE_DIST = 4.2
const FAR_DIST = 6.0
/** Quarter of ship hover: 50% closer to the tile than the previous mid-height overlays. */
export const OVERLAY_HOVER = 0.06

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
  ink = false,
  mark = 0xffffff,
): THREE.Group {
  const g = new THREE.Group()
  g.userData.planetOverlay = true
  g.userData.marketIcons = true

  const close = new THREE.Group()
  close.userData.lod = 'close'
  const far = new THREE.Group()
  far.userData.lod = 'far'

  RESOURCE_IDS.forEach((id, index) => {
    const lot = market.lots.find((item) => item.id === id)
    const amount = lot?.amount ?? 0
    const x = overlayLotX(index)
    const cluster = new THREE.Group()
    cluster.position.set(x, OVERLAY_HOVER, LOT_Z)
    cluster.add(ink ? stockSquare(id, amount, true, mark) : stockHex(id, amount))
    const tag = priceTag(`${buyPrice[id]}CR`, ink ? inkMarkCss(mark) : css.priceYellow)
    const inward = priceInwardOffset(x, LOT_Z)
    tag.position.set(inward.x, 0.01, inward.z)
    cluster.add(tag)
    if (amount > 0) cluster.add(buyHit(coord, id))
    close.add(cluster)
    const farCluster = diceCluster(id, amount, x, ink, mark)
    if (amount > 0) farCluster.add(buyHit(coord, id))
    far.add(farCluster)
  })

  const fuelPad = servicePadPosition(0, 1)
  const fuelCluster = new THREE.Group()
  fuelCluster.position.set(fuelPad.x, OVERLAY_HOVER, fuelPad.z)
  fuelCluster.add(stockHexFuel(ink, mark))
  const fuelTag = priceTag(`${FUEL_BUY_PRICE}CR`, ink ? inkMarkCss(mark) : css.ochre)
  const fuelIn = priceInwardOffset(fuelPad.x, fuelPad.z)
  fuelTag.position.set(fuelIn.x, 0.01, fuelIn.z)
  fuelCluster.add(fuelTag)
  const fuelHit = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 12),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  fuelHit.rotation.x = -Math.PI / 2
  fuelHit.position.y = 0.02
  fuelHit.userData.buyFuel = { coord }
  fuelHit.userData.pickOnly = true
  fuelCluster.add(fuelHit)
  close.add(fuelCluster)
  far.add(diceClusterFuel(fuelPad.x, fuelPad.z, ink, mark))

  g.add(close, far)
  g.userData.closeLod = close
  g.userData.farLod = far
  return g
}

export function createEvaOverlay(
  coord: HexCoord,
  cargo: Record<ResourceId, number>,
  canSell: boolean,
  ink = false,
  mark = 0xffffff,
): THREE.Group {
  const g = new THREE.Group()
  g.userData.evaOverlay = true
  g.userData.marketIcons = true
  const close = new THREE.Group()
  close.userData.lod = 'close'
  const far = new THREE.Group()
  far.userData.lod = 'far'
  RESOURCE_IDS.forEach((id, index) => {
    const x = overlayLotX(index)
    const cluster = new THREE.Group()
    cluster.position.set(x, OVERLAY_HOVER, LOT_Z)
    const qty = cargo[id] ?? 0
    cluster.add(stockSellIcon(id, qty, ink, mark))
    if (canSell && qty > 0) {
      const hit = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.16),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      )
      hit.rotation.x = -Math.PI / 2
      hit.position.y = 0.02
      hit.userData.sellLot = { resource: id }
      hit.userData.pickOnly = true
      cluster.add(hit)
    }
    close.add(cluster)
    far.add(sellFarMark(id, qty, x, ink, mark))
  })
  const exchange = caption('SELL CONTAINERS', ink ? inkMarkCss(mark) : css.priceYellow, 0.72, 0.055)
  const sellIn = priceInwardOffset(0, LOT_Z)
  exchange.position.set(sellIn.x, OVERLAY_HOVER + 0.01, LOT_Z + sellIn.z)
  close.add(exchange)

  const fuelPad = servicePadPosition(0, 2)
  const fuelCluster = new THREE.Group()
  fuelCluster.position.set(fuelPad.x, OVERLAY_HOVER, fuelPad.z)
  fuelCluster.add(stockHexFuel(ink, mark))
  const fuelTag = priceTag(`${FUEL_BUY_PRICE}CR`, ink ? inkMarkCss(mark) : css.ochre)
  const fuelIn = priceInwardOffset(fuelPad.x, fuelPad.z)
  fuelTag.position.set(fuelIn.x, 0.01, fuelIn.z)
  fuelCluster.add(fuelTag)
  const fuelHit = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 12),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  fuelHit.rotation.x = -Math.PI / 2
  fuelHit.position.y = 0.02
  fuelHit.userData.buyFuel = { coord }
  fuelHit.userData.pickOnly = true
  fuelCluster.add(fuelHit)
  close.add(fuelCluster)

  const repairPad = servicePadPosition(1, 2)
  const repairCluster = new THREE.Group()
  repairCluster.position.set(repairPad.x, OVERLAY_HOVER, repairPad.z)
  repairCluster.add(stockRepair(ink, mark))
  const repairTag = priceTag(`${REPAIR_PRICE}CR`, ink ? inkMarkCss(mark) : css.ivory)
  const repairIn = priceInwardOffset(repairPad.x, repairPad.z)
  repairTag.position.set(repairIn.x, 0.01, repairIn.z)
  repairCluster.add(repairTag)
  const repairHit = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 12),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  repairHit.rotation.x = -Math.PI / 2
  repairHit.position.y = 0.02
  repairHit.userData.repairHull = true
  repairHit.userData.pickOnly = true
  repairCluster.add(repairHit)
  close.add(repairCluster)
  g.add(close, far)
  g.userData.closeLod = close
  g.userData.farLod = far
  return g
}

export function tickPlanetLod(root: THREE.Object3D, camera: THREE.Camera): void {
  const world = new THREE.Vector3()
  root.traverse((obj) => {
    if (!obj.userData.planetOverlay && !obj.userData.evaOverlay) return
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

export function createEdgeLabel(
  text: string,
  options: { coord?: HexCoord; clickable?: boolean; width?: number; color?: string } = {},
): THREE.Group {
  const g = new THREE.Group()
  g.userData.tileName = true
  g.position.set(Math.cos(NAME_ANGLE) * NAME_R, OVERLAY_HOVER, Math.sin(NAME_ANGLE) * NAME_R)
  const width = options.width ?? 0.7
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 80
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 768, 80)
    ctx.fillStyle = options.color ?? css.ivory
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

function stockSellIcon(id: ResourceId, amount: number, ink = false, mark = 0xffffff): THREE.Group {
  const g = new THREE.Group()
  const color = ink ? mark : RESOURCE_COLOR[id]
  const fig = createCargoFigure(id, 0.1, color)
  fig.position.y = 0.045
  fig.rotation.set(0.42, 0.62, 0.18)
  g.add(fig)
  g.userData.sellIcon = id
  g.userData.cargoFigure = CARGO_FIGURE[id]
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128)
    ctx.fillStyle = ink ? inkMarkCss(mark) : RESOURCE_CSS[id]
    ctx.font = '500 56px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(amount), 64, 70)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const digit = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.08),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  )
  digit.rotation.x = -Math.PI / 2
  digit.position.set(0.07, 0.014, 0.06)
  digit.renderOrder = 7
  g.add(digit)
  return g
}

function sellFarMark(id: ResourceId, amount: number, x: number, ink = false, mark = 0xffffff): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, OVERLAY_HOVER, LOT_Z)
  if (amount <= 0) return g
  const fig = createCargoFigure(id, 0.055, ink ? mark : RESOURCE_COLOR[id])
  fig.position.y = 0.03
  fig.rotation.set(0.4, 0.5, 0.12)
  g.add(fig)
  return g
}

function buyHit(coord: HexCoord, id: ResourceId): THREE.Mesh {
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
  return hit
}

function stockSquare(id: ResourceId, amount: number, ink = false, mark = 0xffffff): THREE.Group {
  const g = new THREE.Group()
  const color = ink ? mark : RESOURCE_COLOR[id]
  const half = 0.055
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2, half * 2),
    new THREE.MeshBasicMaterial({
      color: ink ? inkPadFill(mark) : palette.graphite,
      side: THREE.DoubleSide,
      depthWrite: false,
      transparent: true,
      opacity: amount > 0 ? 0.92 : 0.4,
    }),
  )
  fill.rotation.x = -Math.PI / 2
  g.add(fill)
  const pts = [
    new THREE.Vector3(-half, 0.002, -half),
    new THREE.Vector3(half, 0.002, -half),
    new THREE.Vector3(half, 0.002, half),
    new THREE.Vector3(-half, 0.002, half),
    new THREE.Vector3(-half, 0.002, -half),
  ]
  const ring = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false }),
  )
  g.add(ring)
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128)
    ctx.fillStyle = ink ? inkMarkCss(mark) : RESOURCE_CSS[id]
    ctx.font = '500 72px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(amount), 64, 70)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const digit = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, 0.1),
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

function overlaySquarePad(ring: number, half = 0.07): THREE.Group {
  const g = new THREE.Group()
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2, half * 2),
    new THREE.MeshBasicMaterial({
      color: inkPadFill(ring),
      side: THREE.DoubleSide,
      depthWrite: false,
      transparent: true,
      opacity: 0.92,
    }),
  )
  fill.rotation.x = -Math.PI / 2
  g.add(fill)
  const pts = [
    new THREE.Vector3(-half, 0.002, -half),
    new THREE.Vector3(half, 0.002, -half),
    new THREE.Vector3(half, 0.002, half),
    new THREE.Vector3(-half, 0.002, half),
    new THREE.Vector3(-half, 0.002, -half),
  ]
  g.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: ring, depthWrite: false }),
    ),
  )
  return g
}

function overlayHexPad(ring: number, radius = 0.072): THREE.Group {
  const g = new THREE.Group()
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i
    const x = radius * Math.cos(a)
    const y = radius * Math.sin(a)
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
      opacity: 0.92,
    }),
  )
  hex.rotation.x = -Math.PI / 2
  g.add(hex)
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.94, radius, 6),
    new THREE.MeshBasicMaterial({
      color: ring,
      side: THREE.DoubleSide,
      depthWrite: false,
      transparent: true,
    }),
  )
  rim.rotation.x = -Math.PI / 2
  rim.position.y = 0.002
  g.add(rim)
  return g
}

function overlayLine(points: Array<[number, number]>, color: number, y = 0.008): THREE.Line {
  const pts = points.map(([x, z]) => new THREE.Vector3(x, y, z))
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, depthWrite: false, transparent: true }),
  )
}

function stockHexFuel(ink = false, mark = 0xffffff): THREE.Group {
  const c = ink ? mark : palette.ochre
  const g = ink ? overlaySquarePad(c) : overlayHexPad(c)
  g.userData.fuelHex = true
  g.add(
    overlayLine(
      [
        [-0.018, -0.022],
        [0.012, -0.022],
        [0.012, 0.022],
        [-0.018, 0.022],
        [-0.018, -0.022],
      ],
      c,
    ),
  )
  g.add(
    overlayLine(
      [
        [0.012, -0.009],
        [0.022, -0.009],
        [0.022, 0.009],
        [0.012, 0.009],
        [0.012, -0.009],
      ],
      c,
    ),
  )
  g.add(overlayLine([[-0.01, -0.008], [0.004, -0.008]], c))
  g.add(overlayLine([[-0.01, 0.004], [0.004, 0.004]], c))
  g.userData.fuelBattery = true
  return g
}

function stockRepair(ink = false, mark = 0xffffff): THREE.Group {
  const c = ink ? mark : palette.repairPink
  const g = ink ? overlaySquarePad(c) : overlayHexPad(c)
  g.userData.repairMark = true
  g.userData.repairHex = true
  const mat = new THREE.MeshBasicMaterial({
    color: c,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const handle = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.012), mat)
  handle.rotation.x = -Math.PI / 2
  handle.position.set(-0.01, 0.006, 0)
  g.add(handle)
  const collar = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.032), mat)
  collar.rotation.x = -Math.PI / 2
  collar.position.set(0.022, 0.006, 0)
  g.add(collar)
  const jawT = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.01), mat)
  jawT.rotation.x = -Math.PI / 2
  jawT.position.set(0.036, 0.006, 0.014)
  g.add(jawT)
  const jawB = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.01), mat)
  jawB.rotation.x = -Math.PI / 2
  jawB.position.set(0.036, 0.006, -0.014)
  g.add(jawB)
  return g
}

function diceClusterFuel(x: number, z = LOT_Z, ink = false, mark = 0xffffff): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, OVERLAY_HOVER, z)
  const half = 0.014
  if (ink) {
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2, half * 2),
      new THREE.MeshBasicMaterial({
        color: mark,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    fill.rotation.x = -Math.PI / 2
    fill.position.set(0, 0.004, 0)
    g.add(fill)
    return g
  }
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.014, 10),
    new THREE.MeshBasicMaterial({
      color: palette.ochre,
      side: THREE.DoubleSide,
      depthWrite: false,
      transparent: true,
    }),
  )
  dot.rotation.x = -Math.PI / 2
  dot.position.set(0, 0.004, 0)
  g.add(dot)
  return g
}

function diceCluster(id: ResourceId, amount: number, x: number, ink = false, mark = 0xffffff): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, OVERLAY_HOVER, LOT_Z)
  if (ink) {
    if (amount <= 0) return g
    const fig = createCargoFigure(id, 0.072, mark)
    fig.position.y = 0.03
    fig.rotation.set(0.4, 0.5, 0.12)
    g.add(fig)
    g.userData.cargoFigure = CARGO_FIGURE[id]
    g.userData.inkMark = mark
    return g
  }
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

function caption(text: string, color: string, width = 0.24, height = 0.058): THREE.Mesh {
  return textPlane(text, color, width, height, 28)
}

export const PRICE_TAG_WIDTH = 0.34
export const PRICE_TAG_HEIGHT = 0.08

function priceTag(text: string, color: string): THREE.Mesh {
  return textPlane(text, color, PRICE_TAG_WIDTH, PRICE_TAG_HEIGHT, 40)
}

function textPlane(
  text: string,
  color: string,
  width: number,
  height: number,
  fontSize = 22,
): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 80
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 512, 80)
    ctx.fillStyle = color
    ctx.font = `600 ${fontSize}px "IBM Plex Mono", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 42)
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

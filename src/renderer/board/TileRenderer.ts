import * as THREE from 'three'
import { HEX_SIZE } from '../../game/board/hexMath'

export function createHexMesh(options: {
  fill: number
  stroke: number
  opacity?: number
  y?: number
  radius?: number
}): THREE.Group {
  const group = new THREE.Group()
  const radius = options.radius ?? HEX_SIZE * 0.96
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    const x = radius * Math.cos(angle)
    const z = radius * Math.sin(angle)
    if (i === 0) shape.moveTo(x, -z)
    else shape.lineTo(x, -z)
  }
  shape.closePath()

  const geom = new THREE.ShapeGeometry(shape)
  const mat = new THREE.MeshBasicMaterial({
    color: options.fill,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geom, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = options.y ?? 0
  group.add(mesh)

  const points: THREE.Vector3[] = []
  for (let i = 0; i <= 6; i++) {
    const angle = (Math.PI / 3) * (i % 6)
    points.push(
      new THREE.Vector3(radius * Math.cos(angle), options.y ?? 0.01, radius * Math.sin(angle)),
    )
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color: options.stroke,
      transparent: (options.opacity ?? 1) < 1,
      opacity: Math.min(1, (options.opacity ?? 1) + 0.25),
    }),
  )
  group.add(line)
  return group
}

export function makeSymbolSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256)
    ctx.fillStyle = color
    ctx.font = '48px Palatino, Times New Roman, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 128)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(1.6, 1.6, 1)
  sprite.position.y = 0.12
  sprite.userData.isSymbol = true
  return sprite
}

export function makeDebugSprite(lines: string[]): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 512, 512)
    ctx.fillStyle = '#cfc6b4'
    ctx.font = '22px ui-monospace, monospace'
    ctx.textAlign = 'left'
    lines.forEach((line, i) => ctx.fillText(line, 24, 40 + i * 28))
  }
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(2.2, 2.2, 1)
  sprite.position.y = 0.8
  sprite.userData.isDebug = true
  return sprite
}

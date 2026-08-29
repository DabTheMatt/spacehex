import * as THREE from 'three'
import { CARGO_FIGURE, type CargoKind } from '../../game/definitions/cargoFigures'
import { palette } from '../theme'

export const CARGO_COLOR: Record<CargoKind, number> = {
  ORE: palette.resourceRed,
  BIOMASS: palette.resourceGreen,
  ICE: palette.resourceBlue,
  FUEL: palette.ochre,
}

function lineMat(color: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    transparent: false,
    depthWrite: false,
  })
}

export function cargoGeometry(kind: CargoKind, size: number): THREE.BufferGeometry {
  const figure = CARGO_FIGURE[kind]
  if (figure === 'cube') return new THREE.BoxGeometry(size, size, size)
  if (figure === 'cone') return new THREE.ConeGeometry(size * 0.5, size, 7)
  if (figure === 'sphere') return new THREE.SphereGeometry(size * 0.48, 9, 7)
  return new THREE.CylinderGeometry(size * 0.34, size * 0.34, size, 10)
}

export function createCargoFigure(kind: CargoKind, size: number, color: number): THREE.Group {
  const g = new THREE.Group()
  const geom = cargoGeometry(kind, size)
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), lineMat(color)))
  g.userData.cargoCube = kind
  g.userData.cargoFigure = CARGO_FIGURE[kind]
  g.userData.crateRadius = size * 0.52
  return g
}

function svgToXz(px: number, py: number, size: number): THREE.Vector3 {
  const s = size / 16
  return new THREE.Vector3((px - 8) * s, 0.008, (py - 8) * s)
}

function addLoop(g: THREE.Group, color: number, pts: THREE.Vector3[], closed = true): void {
  const ring = closed ? [...pts, pts[0]] : pts
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), lineMat(color)))
}

/** Top-down 2D silhouettes, axis-aligned on the hex face (same box for every kind). */
export function createFlatCargoMark(kind: CargoKind, size: number, color: number): THREE.Group {
  const g = new THREE.Group()
  g.userData.flatCargo = kind
  g.userData.cargoFigure = CARGO_FIGURE[kind]
  const p = (x: number, y: number) => svgToXz(x, y, size)
  if (kind === 'ORE') {
    addLoop(g, color, [p(3.2, 6.2), p(8, 3.4), p(12.8, 6.2), p(12.8, 10.8), p(8, 13.6), p(3.2, 10.8)])
    addLoop(g, color, [p(3.2, 6.2), p(8, 8.8), p(12.8, 6.2)], false)
    addLoop(g, color, [p(8, 8.8), p(8, 13.6)], false)
  } else if (kind === 'BIOMASS') {
    addLoop(g, color, [p(8, 2.4), p(13.2, 13.2), p(2.8, 13.2)])
    addLoop(g, color, [p(8, 6.2), p(8, 13.2)], false)
  } else if (kind === 'ICE') {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2
      pts.push(p(8 + Math.cos(a) * 5.2, 8 + Math.sin(a) * 5.2))
    }
    addLoop(g, color, pts, false)
    addLoop(g, color, [p(8, 3.4), p(8, 12.6)], false)
    addLoop(g, color, [p(3.6, 8), p(12.4, 8)], false)
  } else {
    addLoop(g, color, [p(4.4, 4.2), p(11.6, 4.2), p(11.6, 11.8), p(4.4, 11.8)])
    addLoop(g, color, [p(4.4, 4.2), p(8, 3.2), p(11.6, 4.2)], false)
    addLoop(g, color, [p(4.4, 11.8), p(8, 12.8), p(11.6, 11.8)], false)
  }
  return g
}

export function attachCrateMotion(
  box: THREE.Object3D,
  x: number,
  z: number,
  y: number,
  vx: number,
  vz: number,
  spin: { x: number; y: number; z: number },
): void {
  box.position.set(x, y, z)
  box.userData.animate = 'crate'
  box.userData.vx = vx
  box.userData.vz = vz
  box.userData.spinX = spin.x
  box.userData.spinY = spin.y
  box.userData.spinZ = spin.z
}

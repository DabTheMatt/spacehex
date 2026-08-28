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

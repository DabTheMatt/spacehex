import { RNG } from '../random/RNG'
import type { Rotation } from './tileRotation'

export type EdgeNumbers = [number, number, number, number, number, number]

export function rollEdgeNumbers(seed: string, tileId: string, salt: string): EdgeNumbers {
  const faces = new RNG(`${seed}:edges:${tileId}:${salt}`).shuffle([1, 2, 3, 4, 5, 6])
  return faces as EdgeNumbers
}

/** World direction 0–5 whose local numbered face equals `face` (1–6). */
export function worldDirectionForFace(
  edgeNumbers: EdgeNumbers,
  rotation: Rotation | number,
  face: number,
): number | null {
  const local = edgeNumbers.indexOf(face)
  if (local < 0) return null
  return (((local + rotation) % 6) + 6) % 6
}

export function faceOnWorldEdge(
  edgeNumbers: EdgeNumbers,
  rotation: Rotation | number,
  worldDirection: number,
): number {
  const local = (((worldDirection - rotation) % 6) + 6) % 6
  return edgeNumbers[local]
}

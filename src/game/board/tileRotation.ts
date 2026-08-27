export type EdgeType = 'OPEN' | 'BLOCKED' | 'ASTEROID' | 'GATE' | 'SPECIAL'

export type Rotation = 0 | 1 | 2 | 3 | 4 | 5

export type TileType =
  | 'EVA_1'
  | 'VOID'
  | 'PLANET_LARGE'
  | 'PLANET_MEDIUM'
  | 'PLANET_SMALL'
  | 'ASTEROID'
  | 'SHADOW_BASE'
  | 'WRECK_TANKER'
  | 'WRECK_TRANSPORT'
  | 'BLACK_HOLE'
  | 'VORTEX'
  | 'SPACE_GATE'
  | 'STRAIT'

export interface TileDefinition {
  id: string
  type: TileType
  label: string
  symbol: string
  edges: [EdgeType, EdgeType, EdgeType, EdgeType, EdgeType, EdgeType]
}

export function rotateEdgeIndex(edge: number, rotation: number): number {
  return (((edge + rotation) % 6) + 6) % 6
}

export function getRotatedEdges(
  tile: TileDefinition,
  rotation: number,
): [EdgeType, EdgeType, EdgeType, EdgeType, EdgeType, EdgeType] {
  const r = ((rotation % 6) + 6) % 6
  return [0, 1, 2, 3, 4, 5].map(
    (world) => tile.edges[(((world - r) % 6) + 6) % 6],
  ) as [EdgeType, EdgeType, EdgeType, EdgeType, EdgeType, EdgeType]
}

export function getRotatedEdge(
  tile: TileDefinition,
  worldDirection: number,
  rotation: number,
): EdgeType {
  const r = ((rotation % 6) + 6) % 6
  const dir = ((worldDirection % 6) + 6) % 6
  return tile.edges[(((dir - r) % 6) + 6) % 6]
}

export function wrapRotation(value: number): Rotation {
  return ((((value % 6) + 6) % 6) as Rotation)
}

import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getTileDefinition } from '../../game/definitions/tiles'
import { getRotatedEdges } from '../../game/board/tileRotation'
import { getWorldPosition, getNeighbor } from '../../game/board/hexMath'
import { isTilePlaced } from '../../game/board/HexMap'
import { createHexMesh, makeDebugSprite, makeEdgeChevron, makeSelectionMarks, TILE_THICKNESS } from './TileRenderer'
import { createTileGlyph, tickTileGlyphs } from './tileGlyphs'
import { palette } from '../theme'
import { coordKey } from '../../game/board/HexCoord'

export class BoardRenderer {
  readonly group = new THREE.Group()
  private tiles = new THREE.Group()
  private markers = new THREE.Group()

  constructor() {
    this.group.add(this.tiles)
    this.group.add(this.markers)
  }

  sync(
    state: GameState,
    options: {
      showDebug: boolean
      showCoords: boolean
      showEdges: boolean
      selectedKey?: string | null
    },
  ): void {
    this.tiles.clear()
    this.markers.clear()

    for (const tile of Object.values(state.board.tiles)) {
      const def = getTileDefinition(tile.definitionId)
      const pos = getWorldPosition(tile.coord)
      const mesh = createHexMesh({ fill: palette.tileFill, stroke: palette.ivory, y: 0 })
      mesh.position.set(pos.x, 0, pos.z)
      mesh.rotation.y = tile.rotation * (Math.PI / 3)
      mesh.userData.tileCoord = tile.coord
      mesh.userData.tileKey = coordKey(tile.coord)
      const glyph = createTileGlyph(def)
      glyph.position.y = TILE_THICKNESS
      mesh.add(glyph)
      if (options.selectedKey === coordKey(tile.coord)) {
        mesh.add(makeSelectionMarks())
      }
      if (options.showDebug || options.showCoords || options.showEdges) {
        const edges = getRotatedEdges(def, tile.rotation)
        const lines = [
          options.showCoords ? `${coordKey(tile.coord)}` : '',
          options.showDebug ? tile.id : '',
          options.showDebug ? `rot ${tile.rotation} (${tile.rotation * 60}°)` : '',
          ...(options.showEdges ? edges.map((e, i) => `${i}:${e}`) : []),
        ].filter(Boolean)
        mesh.add(makeDebugSprite(lines))
      }
      this.tiles.add(mesh)
    }

    this.drawActionMarkers(state)
  }

  tick(time: number): void {
    tickTileGlyphs(this.tiles, time)
  }

  private drawActionMarkers(state: GameState): void {
    const origin = state.exploration.origin
    if (!origin) return
    const selectingExplore = state.exploration.status === 'SELECTING_DIRECTION'
    const selectingMove = state.exploration.status === 'SELECTING_MOVE'
    if (!selectingExplore && !selectingMove) return

    for (let dir = 0; dir < 6; dir++) {
      const target = getNeighbor(origin, dir)
      const occupied = isTilePlaced(state.board, target)
      if (selectingExplore && occupied) continue
      if (selectingMove && !occupied) continue
      this.markers.add(
        makeEdgeChevron({
          origin: getWorldPosition(origin),
          target: getWorldPosition(target),
          color: occupied ? palette.dusk : palette.ochre,
          kind: occupied ? 'MOVE' : 'EXPLORE',
          direction: dir,
        }),
      )
    }
  }

  pickables(): THREE.Object3D[] {
    return this.markers.children
  }

  tileMeshes(): THREE.Object3D[] {
    return this.tiles.children
  }
}

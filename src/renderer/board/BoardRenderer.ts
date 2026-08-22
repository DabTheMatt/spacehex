import * as THREE from 'three'
import type { GameState } from '../../game/state/GameState'
import { getTileDefinition } from '../../game/definitions/tiles'
import { getRotatedEdges } from '../../game/board/tileRotation'
import { getWorldPosition, getNeighbor } from '../../game/board/hexMath'
import { isTilePlaced } from '../../game/board/HexMap'
import {
  createHexMesh,
  makeDebugSprite,
  makeEdgeChevron,
  makeSelectionMarks,
  makeDashedHexGhost,
  TILE_SETTLED_Y,
  TILE_THICKNESS,
} from './TileRenderer'
import { createTileGlyph, tickTileGlyphs } from './tileGlyphs'
import { palette } from '../theme'
import { coordKey } from '../../game/board/HexCoord'
import { canExploreDirection } from '../../game/rules/exploration'
import { canMoveTo } from '../../game/rules/movement'
import { activeShip } from '../../game/rules/fuel'
import type { BoardHover } from '../../ui/boardHover'

export class BoardRenderer {
  readonly group = new THREE.Group()
  private tiles = new THREE.Group()
  private markers = new THREE.Group()
  private tileCache = new Map<string, { mesh: THREE.Group; sig: string }>()

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
      showExploreGhosts?: boolean
      tileY?: Record<string, number>
      hover?: BoardHover | null
      hideGlyphKeys?: Set<string>
    },
  ): void {
    this.syncTiles(state, options)
    this.markers.clear()
    this.drawActionMarkers(state)
    this.drawExploreGhosts(state, options.hover)
    this.drawMoveGhosts(state, options.hover)
    if (options.hover?.kind === 'STAY') {
      this.drawHoverGhost(-1, options.hover.coord, 0.85, TILE_THICKNESS)
    }
  }

  tick(time: number): void {
    tickTileGlyphs(this.tiles, time)
  }

  setTileY(key: string, y: number): void {
    const cached = this.tileCache.get(key)
    if (cached) cached.mesh.position.y = y
  }

  private syncTiles(
    state: GameState,
    options: {
      showDebug: boolean
      showCoords: boolean
      showEdges: boolean
      selectedKey?: string | null
      tileY?: Record<string, number>
      hideGlyphKeys?: Set<string>
    },
  ): void {
    const keep = new Set<string>()
    for (const tile of Object.values(state.board.tiles)) {
      const key = coordKey(tile.coord)
      keep.add(key)
      const selected = options.selectedKey === key
      const hideGlyph = options.hideGlyphKeys?.has(key) === true
      const sig = [
        tile.id,
        tile.definitionId,
        tile.rotation,
        selected ? '1' : '0',
        hideGlyph ? 'h' : '',
        options.showDebug ? 'd' : '',
        options.showCoords ? 'c' : '',
        options.showEdges ? 'e' : '',
      ].join('|')
      const existing = this.tileCache.get(key)
      if (existing?.sig === sig) {
        const pos = getWorldPosition(tile.coord)
        existing.mesh.position.set(pos.x, options.tileY?.[key] ?? TILE_SETTLED_Y, pos.z)
        continue
      }
      if (existing) {
        this.tiles.remove(existing.mesh)
      }
      const def = getTileDefinition(tile.definitionId)
      const pos = getWorldPosition(tile.coord)
      const mesh = createHexMesh({ fill: palette.tileFill, stroke: palette.ivory, y: TILE_SETTLED_Y })
      mesh.position.set(pos.x, options.tileY?.[key] ?? TILE_SETTLED_Y, pos.z)
      mesh.rotation.y = tile.rotation * (Math.PI / 3)
      mesh.userData.tileCoord = tile.coord
      mesh.userData.tileKey = key
      if (!hideGlyph) {
        const glyph = createTileGlyph(def)
        glyph.position.y = TILE_THICKNESS
        mesh.add(glyph)
      }
      if (selected) mesh.add(makeSelectionMarks())
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
      this.tileCache.set(key, { mesh, sig })
    }
    for (const [key, entry] of this.tileCache) {
      if (keep.has(key)) continue
      this.tiles.remove(entry.mesh)
      this.tileCache.delete(key)
    }
  }

  private drawActionMarkers(state: GameState): void {
    const origin = state.exploration.origin
    if (!origin || state.exploration.status !== 'SELECTING_MOVE') return

    for (let dir = 0; dir < 6; dir++) {
      const target = getNeighbor(origin, dir)
      if (!isTilePlaced(state.board, target)) continue
      this.markers.add(
        makeEdgeChevron({
          origin: getWorldPosition(origin),
          target: getWorldPosition(target),
          color: palette.dusk,
          kind: 'MOVE',
          direction: dir,
        }),
      )
    }
  }

  private drawHoverGhost(
    direction: number,
    coord: { q: number; r: number },
    opacity: number,
    y = TILE_SETTLED_Y,
  ): void {
    const ghost = makeDashedHexGhost(direction, opacity)
    const pos = getWorldPosition(coord)
    ghost.position.set(pos.x, y, pos.z)
    this.markers.add(ghost)
  }

  private drawExploreGhosts(state: GameState, hover: BoardHover | null | undefined): void {
    if (state.phase !== 'PLAYER_TURN' || state.movementSpent) return
    const origin = activeShip(state).coord
    for (let dir = 0; dir < 6; dir++) {
      if (!canExploreDirection(state, dir)) continue
      const target = getNeighbor(origin, dir)
      const hot =
        hover?.kind === 'EXPLORE' && hover.coord.q === target.q && hover.coord.r === target.r
      this.drawHoverGhost(dir, target, hot ? 0.92 : 0.16)
    }
  }

  private drawMoveGhosts(state: GameState, hover: BoardHover | null | undefined): void {
    if (state.phase !== 'PLAYER_TURN' || state.movementSpent) return
    const origin = activeShip(state).coord
    for (let dir = 0; dir < 6; dir++) {
      const target = getNeighbor(origin, dir)
      if (!canMoveTo(state, target)) continue
      const hot = hover?.kind === 'MOVE' && hover.coord.q === target.q && hover.coord.r === target.r
      this.drawHoverGhost(dir, target, hot ? 0.92 : 0.16, TILE_THICKNESS)
    }
  }

  pickables(): THREE.Object3D[] {
    return this.markers.children
  }

  tileMeshes(): THREE.Object3D[] {
    return this.tiles.children
  }
}

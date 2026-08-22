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
import { createPlanetOverlay } from './planetLots'
import { buyPrice } from '../../game/rules/planetMarket'
import { RESOURCE_IDS } from '../../game/definitions/resources'
import { palette } from '../theme'
import { coordKey } from '../../game/board/HexCoord'
import { canExploreDirection } from '../../game/rules/exploration'
import { canMoveTo } from '../../game/rules/movement'
import { activeShip } from '../../game/rules/fuel'
import type { BoardHover } from '../../ui/boardHover'
import { clamp01, easeOutCubic, prefersReducedMotion, TILE_GLYPH_FADE_MS } from '../motion'

export class BoardRenderer {
  readonly group = new THREE.Group()
  private tiles = new THREE.Group()
  private markers = new THREE.Group()
  private tileCache = new Map<string, { mesh: THREE.Group; sig: string }>()
  private glyphFade = new Map<string, { start: number; duration: number }>()

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
      inspectKey?: string | null
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
    this.advanceGlyphFades(performance.now())
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
      inspectKey?: string | null
    },
  ): void {
    const keep = new Set<string>()
    for (const tile of Object.values(state.board.tiles)) {
      const key = coordKey(tile.coord)
      keep.add(key)
      const selected = options.selectedKey === key
      const hideGlyph = options.hideGlyphKeys?.has(key) === true
      const market = state.planetMarkets[key]
      const inspecting = options.inspectKey === key
      const marketSig = market
        ? [
            market.designation,
            inspecting ? 'i' : '',
            market.lots.map((lot) => `${lot.id}:${lot.amount}:${buyPrice(state, lot.id)}`).join(','),
          ].join(':')
        : ''
      const sig = [
        tile.id,
        tile.definitionId,
        tile.rotation,
        selected ? '1' : '0',
        options.showDebug ? 'd' : '',
        options.showCoords ? 'c' : '',
        options.showEdges ? 'e' : '',
        marketSig,
      ].join('|')
      const existing = this.tileCache.get(key)
      if (existing?.sig === sig) {
        const pos = getWorldPosition(tile.coord)
        existing.mesh.position.set(pos.x, options.tileY?.[key] ?? TILE_SETTLED_Y, pos.z)
        this.syncGlyphFade(key, existing.mesh, hideGlyph)
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
      const glyph = createTileGlyph(def, palette.paper, tile.id)
      glyph.position.y = TILE_THICKNESS
      if (market) {
        const prices = Object.fromEntries(
          RESOURCE_IDS.map((id) => [id, buyPrice(state, id)]),
        ) as Record<(typeof RESOURCE_IDS)[number], number>
        glyph.add(
          createPlanetOverlay(market, tile.coord, {
            showPrices: inspecting,
            buyPrice: prices,
          }),
        )
      }
      mesh.userData.glyph = glyph
      mesh.add(glyph)
      this.syncGlyphFade(key, mesh, hideGlyph, true)
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
      this.glyphFade.delete(key)
    }
  }

  private syncGlyphFade(key: string, mesh: THREE.Group, hide: boolean, created = false): void {
    const glyph = mesh.userData.glyph as THREE.Object3D | undefined
    if (!glyph) return
    if (hide) {
      this.glyphFade.delete(key)
      mesh.userData.glyphReady = false
      setGlyphOpacity(glyph, 0)
      return
    }
    if (mesh.userData.glyphReady) {
      setGlyphOpacity(glyph, 1)
      return
    }
    if (created && !this.glyphFade.has(key)) {
      mesh.userData.glyphReady = true
      setGlyphOpacity(glyph, 1)
      return
    }
    if (!this.glyphFade.has(key)) {
      this.glyphFade.set(key, {
        start: performance.now(),
        duration: prefersReducedMotion() ? 0 : TILE_GLYPH_FADE_MS,
      })
      setGlyphOpacity(glyph, 0)
    }
  }

  private advanceGlyphFades(now: number): void {
    for (const [key, fade] of [...this.glyphFade.entries()]) {
      const mesh = this.tileCache.get(key)?.mesh
      const glyph = mesh?.userData.glyph as THREE.Object3D | undefined
      if (!mesh || !glyph) {
        this.glyphFade.delete(key)
        continue
      }
      const t = fade.duration <= 0 ? 1 : clamp01((now - fade.start) / fade.duration)
      setGlyphOpacity(glyph, easeOutCubic(t))
      if (t < 1) continue
      mesh.userData.glyphReady = true
      this.glyphFade.delete(key)
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

function setGlyphOpacity(root: THREE.Object3D, opacity: number): void {
  root.traverse((obj) => {
    if (obj.userData.pickOnly) return
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

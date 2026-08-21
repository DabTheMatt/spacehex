export interface ExplorationDeck {
  drawPile: string[]
  discardedTiles: string[]
}

export function drawFromDeck(deck: ExplorationDeck): { tileId: string; deck: ExplorationDeck } | null {
  if (deck.drawPile.length === 0) return null
  const [tileId, ...rest] = deck.drawPile
  return {
    tileId,
    deck: { drawPile: rest, discardedTiles: deck.discardedTiles },
  }
}

export function forceNextTile(deck: ExplorationDeck, tileId: string): ExplorationDeck {
  const without = deck.drawPile.filter((id) => id !== tileId)
  if (without.length === deck.drawPile.length) {
    return { ...deck, drawPile: [tileId, ...deck.drawPile] }
  }
  return { ...deck, drawPile: [tileId, ...without] }
}

export type ShipClass = 'MEWA' | 'CIERN' | 'DRZAZGA'

export interface ShipDefinition {
  id: ShipClass
  label: string
  symbol: string
  hull: number
  /** Base combat ability; fight strength is this plus a d6. */
  attack: number
}

export const SHIP_DEFINITIONS: Record<ShipClass, ShipDefinition> = {
  MEWA: { id: 'MEWA', label: 'Mewa', symbol: '△', hull: 3, attack: 3 },
  CIERN: { id: 'CIERN', label: 'Thorn', symbol: '◆', hull: 3, attack: 3 },
  DRZAZGA: { id: 'DRZAZGA', label: 'Splinter', symbol: '▲', hull: 2, attack: 2 },
}

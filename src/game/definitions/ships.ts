export type ShipClass = 'MEWA' | 'CIERN' | 'DRZAZGA'

export interface ShipDefinition {
  id: ShipClass
  label: string
  symbol: string
  hull: number
}

export const SHIP_DEFINITIONS: Record<ShipClass, ShipDefinition> = {
  MEWA: { id: 'MEWA', label: 'Mewa', symbol: '△', hull: 3 },
  CIERN: { id: 'CIERN', label: 'Cierń', symbol: '◆', hull: 3 },
  DRZAZGA: { id: 'DRZAZGA', label: 'Drzazga', symbol: '▲', hull: 2 },
}

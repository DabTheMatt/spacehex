/** Container silhouettes used on the board and in the HUD. */
export const CARGO_KINDS = ['ORE', 'BIOMASS', 'ICE', 'FUEL'] as const
export type CargoKind = (typeof CARGO_KINDS)[number]

export type CargoFigure = 'cube' | 'cone' | 'sphere' | 'cylinder'

export const CARGO_FIGURE: Record<CargoKind, CargoFigure> = {
  ORE: 'cube',
  BIOMASS: 'cone',
  ICE: 'sphere',
  FUEL: 'cylinder',
}

export const GRAPHIC_MODES = ['space', 'ink'] as const
export type GraphicMode = (typeof GRAPHIC_MODES)[number]

export const GRAPHIC_MODE_STORAGE_KEY = 'spacehex-graphic-mode'

export function parseGraphicMode(value: string | null | undefined): GraphicMode {
  return value === 'ink' ? 'ink' : 'space'
}

export function readStoredGraphicMode(): GraphicMode {
  try {
    return parseGraphicMode(localStorage.getItem(GRAPHIC_MODE_STORAGE_KEY))
  } catch {
    return 'space'
  }
}

export function writeStoredGraphicMode(mode: GraphicMode): void {
  try {
    localStorage.setItem(GRAPHIC_MODE_STORAGE_KEY, mode)
  } catch {
    /* ignore quota / private mode */
  }
}

export function isInk(mode: GraphicMode | undefined): boolean {
  return mode === 'ink'
}

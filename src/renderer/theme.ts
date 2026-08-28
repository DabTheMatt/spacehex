import type { GraphicMode } from './graphicMode'

export const palette = {
  void: 0x0b0c0c,
  graphite: 0x1c1c19,
  tileFill: 0x141412,
  ivory: 0xd8d0bd,
  paper: 0xd8d0bd,
  blood: 0x6e1f1f,
  dusk: 0x77756e,
  ochre: 0xb58a4b,
  preview: 0x8a8374,
  ink: 0x0b0c0c,
  engine: 0x7ec8ff,
  player1: 0xb58a4b,
  player2: 0x6d8398,
  /** Soft resource tints for planets (purple / red / green). */
  planetViolet: 0xa898b0,
  planetRose: 0xb8948c,
  planetSage: 0x8f9a8a,
  resourceRed: 0xc45c4a,
  resourceGreen: 0x6a9a62,
  resourceBlue: 0x5a7ea8,
  repairPink: 0xc48a96,
}

export const css = {
  void: '#0B0C0C',
  ivory: '#D8D0BD',
  paper: '#D8D0BD',
  blood: '#8a2a2a',
  dusk: '#77756E',
  ochre: '#B58A4B',
  graphite: '#1c1c19',
  ink: '#0B0C0C',
  engine: '#7EC8FF',
  player1: '#B58A4B',
  player2: '#6D8398',
  resourceRed: '#C45C4A',
  resourceGreen: '#6A9A62',
  resourceBlue: '#5A7EA8',
  repairPink: '#C48A96',
  hullMark: '#141412',
  priceYellow: '#E2D06A',
}

/** Strict black/white skin — no ochre, cyan, or resource tints. */
export const inkPalette = {
  void: 0x000000,
  graphite: 0x000000,
  tileFill: 0x000000,
  ivory: 0xffffff,
  paper: 0xffffff,
  blood: 0xffffff,
  dusk: 0xffffff,
  ochre: 0xffffff,
  preview: 0xffffff,
  ink: 0x000000,
  engine: 0xffffff,
  player1: 0xffffff,
  player2: 0xffffff,
  planetViolet: 0xffffff,
  planetRose: 0xffffff,
  planetSage: 0xffffff,
  resourceRed: 0xffffff,
  resourceGreen: 0xffffff,
  resourceBlue: 0xffffff,
  repairPink: 0xffffff,
}

export const inkCss = {
  void: '#000000',
  ivory: '#FFFFFF',
  paper: '#FFFFFF',
  blood: '#FFFFFF',
  dusk: '#FFFFFF',
  ochre: '#FFFFFF',
  graphite: '#000000',
  ink: '#000000',
  engine: '#FFFFFF',
  player1: '#FFFFFF',
  player2: '#FFFFFF',
  resourceRed: '#FFFFFF',
  resourceGreen: '#FFFFFF',
  resourceBlue: '#FFFFFF',
  repairPink: '#FFFFFF',
  hullMark: '#000000',
  priceYellow: '#FFFFFF',
}

export function scenePalette(mode: GraphicMode) {
  return mode === 'ink' ? inkPalette : palette
}

export function sceneCss(mode: GraphicMode) {
  return mode === 'ink' ? inkCss : css
}

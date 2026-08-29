import type { GameEvent } from '@/game/engine/events'

export const SOUND_STORAGE_KEY = 'spacehex-sound'

export type ToneCue = {
  freq: number
  dur: number
  type: OscillatorType
  gain: number
  slide?: number
}

export function parseSoundEnabled(value: string | null | undefined): boolean {
  return value !== 'off'
}

export function readSoundEnabled(): boolean {
  try {
    return parseSoundEnabled(localStorage.getItem(SOUND_STORAGE_KEY))
  } catch {
    return true
  }
}

export function writeSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    /* ignore quota / private mode */
  }
}

export function cueForEvent(type: GameEvent['type']): ToneCue | null {
  switch (type) {
    case 'SHIP_MOVED':
      return { freq: 220, dur: 0.09, type: 'triangle', gain: 0.05, slide: 160 }
    case 'TILE_PLACED':
    case 'HEX_DISCOVERED':
      return { freq: 480, dur: 0.06, type: 'square', gain: 0.035 }
    case 'TILE_ROTATED':
      return { freq: 360, dur: 0.03, type: 'square', gain: 0.025 }
    case 'RESOURCE_BOUGHT':
    case 'FUEL_BOUGHT':
    case 'HULL_REPAIRED':
      return { freq: 660, dur: 0.07, type: 'triangle', gain: 0.045, slide: 880 }
    case 'RESOURCE_SOLD':
      return { freq: 520, dur: 0.08, type: 'triangle', gain: 0.045, slide: 320 }
    case 'PROBE_LAUNCHED':
      return { freq: 740, dur: 0.1, type: 'sine', gain: 0.04, slide: 420 }
    case 'COMBAT_SHOT':
    case 'SHIP_DAMAGED':
    case 'ASTEROID_STRIKE':
      return { freq: 140, dur: 0.12, type: 'sawtooth', gain: 0.05, slide: 70 }
    case 'SHIP_DESTROYED':
      return { freq: 90, dur: 0.22, type: 'sawtooth', gain: 0.06, slide: 40 }
    case 'TURN_ENDED':
      return { freq: 300, dur: 0.05, type: 'sine', gain: 0.03 }
    case 'COMMAND_REJECTED':
      return { freq: 110, dur: 0.08, type: 'square', gain: 0.04 }
    default:
      return null
  }
}

let enabled = readSoundEnabled()
let ctx: AudioContext | null = null

export function isSoundEnabled(): boolean {
  return enabled
}

export function setSoundEnabled(on: boolean): void {
  enabled = on
  writeSoundEnabled(on)
  if (on) unlockSound()
}

export function unlockSound(): void {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return
  if (!ctx) ctx = new AudioCtx()
  if (ctx.state === 'suspended') void ctx.resume()
}

function playCue(cue: ToneCue): void {
  if (!enabled || !ctx) return
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = cue.type
  osc.frequency.setValueAtTime(cue.freq, ctx.currentTime)
  if (cue.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, cue.slide), ctx.currentTime + cue.dur)
  amp.gain.setValueAtTime(cue.gain, ctx.currentTime)
  amp.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + cue.dur)
  osc.connect(amp)
  amp.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + cue.dur + 0.02)
}

export function playToggleCue(on: boolean): void {
  const was = enabled
  enabled = true
  unlockSound()
  playCue(on ? { freq: 640, dur: 0.05, type: 'sine', gain: 0.04 } : { freq: 180, dur: 0.06, type: 'sine', gain: 0.03 })
  enabled = was
}

const PLAYED = new Set<GameEvent['type']>([
  'SHIP_MOVED',
  'TILE_PLACED',
  'HEX_DISCOVERED',
  'TILE_ROTATED',
  'RESOURCE_BOUGHT',
  'FUEL_BOUGHT',
  'HULL_REPAIRED',
  'RESOURCE_SOLD',
  'PROBE_LAUNCHED',
  'COMBAT_SHOT',
  'SHIP_DAMAGED',
  'ASTEROID_STRIKE',
  'SHIP_DESTROYED',
  'TURN_ENDED',
  'COMMAND_REJECTED',
])

export function playGameEvents(events: GameEvent[]): void {
  if (!enabled) return
  unlockSound()
  const seen = new Set<GameEvent['type']>()
  for (const event of events) {
    if (!PLAYED.has(event.type) || seen.has(event.type)) continue
    seen.add(event.type)
    const cue = cueForEvent(event.type)
    if (cue) playCue(cue)
  }
}

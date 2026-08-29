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
      return { freq: 220, dur: 0.1, type: 'triangle', gain: 0.28, slide: 160 }
    case 'TILE_PLACED':
    case 'HEX_DISCOVERED':
      return { freq: 480, dur: 0.07, type: 'square', gain: 0.2 }
    case 'TILE_ROTATED':
      return { freq: 360, dur: 0.04, type: 'square', gain: 0.18 }
    case 'RESOURCE_BOUGHT':
    case 'FUEL_BOUGHT':
    case 'HULL_REPAIRED':
      return { freq: 660, dur: 0.08, type: 'triangle', gain: 0.24, slide: 880 }
    case 'RESOURCE_SOLD':
      return { freq: 520, dur: 0.09, type: 'triangle', gain: 0.24, slide: 320 }
    case 'PROBE_LAUNCHED':
      return { freq: 740, dur: 0.11, type: 'sine', gain: 0.22, slide: 420 }
    case 'COMBAT_SHOT':
    case 'SHIP_DAMAGED':
    case 'ASTEROID_STRIKE':
      return { freq: 140, dur: 0.14, type: 'sawtooth', gain: 0.3, slide: 70 }
    case 'SHIP_DESTROYED':
      return { freq: 90, dur: 0.24, type: 'sawtooth', gain: 0.32, slide: 40 }
    case 'TURN_ENDED':
      return { freq: 300, dur: 0.06, type: 'sine', gain: 0.2 }
    case 'COMMAND_REJECTED':
      return { freq: 110, dur: 0.09, type: 'square', gain: 0.26 }
    default:
      return null
  }
}

let enabled = readSoundEnabled()
let ctx: AudioContext | null = null
let primed = false
const wavCache = new Map<string, string>()
let silentUri: string | null = null

export function isSoundEnabled(): boolean {
  return enabled
}

export function setSoundEnabled(on: boolean): void {
  enabled = on
  writeSoundEnabled(on)
  if (on) unlockSound()
}

function canUseDomAudio(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined'
}

function cueKey(cue: ToneCue): string {
  return `${cue.type}:${cue.freq}:${cue.dur}:${cue.gain}:${cue.slide ?? ''}`
}

function sampleWave(type: OscillatorType, phase: number): number {
  const p = phase - Math.floor(phase)
  if (type === 'square') return p < 0.5 ? 1 : -1
  if (type === 'sawtooth') return 2 * p - 1
  if (type === 'triangle') return p < 0.5 ? 4 * p - 1 : 3 - 4 * p
  return Math.sin(2 * Math.PI * p)
}

export function renderCueSamples(cue: ToneCue, sampleRate = 22050): Float32Array {
  const n = Math.max(16, Math.floor(sampleRate * (cue.dur + 0.03)))
  const samples = new Float32Array(n)
  let phase = 0
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const u = Math.min(1, t / Math.max(0.001, cue.dur))
    const freq = cue.slide ? cue.freq + (cue.slide - cue.freq) * u : cue.freq
    phase += freq / sampleRate
    const attack = Math.min(1, t / 0.01)
    const release = t >= cue.dur ? Math.max(0, 1 - (t - cue.dur) / 0.03) : 1
    samples[i] = sampleWave(cue.type, phase) * cue.gain * attack * release
  }
  return samples
}

export function pcmWavDataUri(samples: Float32Array, sampleRate = 22050): string {
  const n = samples.length
  const bytes = new Uint8Array(44 + n * 2)
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i)
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + n * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, n * 2, true)
  let o = 44
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(o, Math.round(x * 32767), true)
    o += 2
  }
  return `data:audio/wav;base64,${bytesToBase64(bytes)}`
}

function bytesToBase64(bytes: Uint8Array): string {
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0
    const triple = (a << 16) | (b << 8) | c
    out += table[(triple >> 18) & 63]
    out += table[(triple >> 12) & 63]
    out += i + 1 < bytes.length ? table[(triple >> 6) & 63] : '='
    out += i + 2 < bytes.length ? table[triple & 63] : '='
  }
  return out
}

function wavForCue(cue: ToneCue): string {
  const key = cueKey(cue)
  const hit = wavCache.get(key)
  if (hit) return hit
  const uri = pcmWavDataUri(renderCueSamples(cue))
  wavCache.set(key, uri)
  return uri
}

function silentWav(): string {
  if (!silentUri) silentUri = pcmWavDataUri(new Float32Array(32))
  return silentUri
}

function playUri(uri: string, volume = 1): void {
  if (!canUseDomAudio()) return
  const node = new Audio(uri)
  node.volume = volume
  const run = node.play()
  if (run && typeof run.catch === 'function') void run.catch(() => {})
}

function audioCtor(): (typeof AudioContext) | undefined {
  if (typeof window === 'undefined') return undefined
  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  )
}

export function unlockSound(): void {
  if (!canUseDomAudio()) return
  if (!primed) {
    primed = true
    playUri(silentWav(), 0.01)
  }
  const AudioCtx = audioCtor()
  if (!AudioCtx) return
  if (!ctx) ctx = new AudioCtx()
  if (ctx.state === 'suspended') void ctx.resume()
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.start(0)
  } catch {
    /* already started / autoplay blocked */
  }
}

function playCue(cue: ToneCue): void {
  if (!enabled) return
  unlockSound()
  playUri(wavForCue(cue))
}

export function playToggleCue(on: boolean): void {
  const was = enabled
  enabled = true
  playCue(on ? { freq: 640, dur: 0.06, type: 'sine', gain: 0.26 } : { freq: 180, dur: 0.07, type: 'sine', gain: 0.22 })
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
  const seen = new Set<GameEvent['type']>()
  for (const event of events) {
    if (!PLAYED.has(event.type) || seen.has(event.type)) continue
    seen.add(event.type)
    const cue = cueForEvent(event.type)
    if (cue) playCue(cue)
  }
}

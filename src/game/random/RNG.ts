/**
 * Seeded RNG. Game logic must never call Math.random().
 */
export class RNG {
  private state: number

  constructor(seed: string) {
    this.state = hashString(seed) >>> 0
  }

  /** [0, 1) */
  next(): number {
    this.state = mulberry32(this.state)
    return this.state / 0x100000000
  }

  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }

  shuffle<T>(items: readonly T[]): T[] {
    const arr = [...items]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1)
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
}

function hashString(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number): number {
  let t = (a + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0)
}

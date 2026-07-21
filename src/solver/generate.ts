import type { LevelInput } from './solver'

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export interface GenParams {
  size: number; grays: number; yellows: number; budget: number; reds: number; mids: number; seed: number
}

export function generateCandidate(p: GenParams): LevelInput | null {
  const rnd = mulberry32(p.seed)
  const grid: string[][] = Array.from({ length: p.size }, () => Array(p.size).fill('.'))
  const cellCount = p.size * p.size
  if (2 + p.grays + p.yellows + p.reds + p.mids > cellCount) return null

  const randCell = () => ({ r: Math.floor(rnd() * p.size), c: Math.floor(rnd() * p.size) })

  // Start and exit far apart (manhattan >= size).
  const start = randCell()
  let exit = randCell()
  for (let i = 0; i < 50; i++) {
    if (Math.abs(start.r - exit.r) + Math.abs(start.c - exit.c) >= p.size) break
    exit = randCell()
  }
  if (Math.abs(start.r - exit.r) + Math.abs(start.c - exit.c) < p.size) return null
  grid[start.r]![start.c] = 'S'
  grid[exit.r]![exit.c] = 'E'

  const place = (ch: string, count: number, ok?: (r: number, c: number) => boolean): boolean => {
    for (let n = 0; n < count; n++) {
      let placed = false
      for (let i = 0; i < 100; i++) {
        const { r, c } = randCell()
        if (grid[r]![c] === '.' && (!ok || ok(r, c))) { grid[r]![c] = ch; placed = true; break }
      }
      if (!placed) return false
    }
    return true
  }
  // A door near the start telegraphs the opening move — keep yellows out of reach.
  const minYellowDist = p.size >= 7 ? 3 : 2
  const yellowOk = (r: number, c: number) =>
    Math.abs(r - start.r) + Math.abs(c - start.c) >= minYellowDist
  if (!place('y', p.yellows, yellowOk) || !place('r', p.reds) || !place('g', p.grays) || !place('M', p.mids)) return null

  return { size: p.size, rows: grid.map((row) => row.join('')), yellowBudget: p.budget }
}

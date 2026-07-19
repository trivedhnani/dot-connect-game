export interface Progress { stars: Record<string, number>; best: Record<string, number>; revealTokens: number }

const KEY = 'dot-connect-progress-v1'
let memory: string | null = null // fallback when localStorage is unavailable (tests, private mode)

function read(): string | null {
  try { return globalThis.localStorage ? localStorage.getItem(KEY) : memory } catch { return memory }
}
function write(v: string): void {
  try { if (globalThis.localStorage) localStorage.setItem(KEY, v); else memory = v } catch { memory = v }
}

export function __resetForTests(): void {
  memory = null
  try { globalThis.localStorage?.removeItem(KEY) } catch { /* ignore */ }
}

export function loadProgress(): Progress {
  const raw = read()
  if (!raw) return { stars: {}, best: {}, revealTokens: 3 }
  try { return JSON.parse(raw) as Progress } catch { return { stars: {}, best: {}, revealTokens: 3 } }
}

function save(p: Progress): Progress { write(JSON.stringify(p)); return p }

export function recordResult(id: string, percent: number, stars: number): Progress {
  const p = loadProgress()
  const firstThreeStar = stars === 3 && (p.stars[id] ?? 0) < 3
  p.stars[id] = Math.max(p.stars[id] ?? 0, stars)
  p.best[id] = Math.max(p.best[id] ?? 0, percent)
  if (firstThreeStar) p.revealTokens += 1
  return save(p)
}

export function spendRevealToken(): boolean {
  const p = loadProgress()
  if (p.revealTokens <= 0) return false
  p.revealTokens -= 1
  save(p)
  return true
}

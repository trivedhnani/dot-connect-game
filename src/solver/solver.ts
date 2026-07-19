import type { CellKind, Pos } from '../engine/types'
import { findCells, parseRows } from '../engine/board'

export interface LevelInput { size: number; rows: string[]; yellowBudget: number }
export interface Solution { grays: number; yellowsSpent: number; path: Pos[] }
export type SolveResult =
  | { kind: 'solved'; solution: Solution }
  | { kind: 'unsolvable' }
  | { kind: 'timeout' }
export interface SolveOptions {
  nodeBudget?: number
  allowedYellows?: Pos[]
  preActivated?: Pos[]
  objective?: 'coverage' | 'shortest'
}

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const
const key = (r: number, c: number) => r * 16 + c

export function solve(input: LevelInput, opts: SolveOptions = {}): SolveResult {
  // key() packs r*16+c — row/col values above 15 would alias; reject early.
  if (input.size > 15) return { kind: 'unsolvable' }
  const { size } = input
  const cells = parseRows(input.rows)
  const nodeBudget = opts.nodeBudget ?? 500_000
  const objective = opts.objective ?? 'coverage'
  const start = findCells(cells, 'start')[0]
  const exit = findCells(cells, 'exit')[0]
  if (!start || !exit) return { kind: 'unsolvable' }
  const startPos = start
  const exitPos = exit
  const mids = findCells(cells, 'mid')
  const preActivated = new Set((opts.preActivated ?? []).map((p) => key(p.r, p.c)))
  const allowed = opts.allowedYellows ? new Set(opts.allowedYellows.map((p) => key(p.r, p.c))) : null

  const kindAt = (r: number, c: number): CellKind => cells[r]![c]!
  const isOpenYellow = (r: number, c: number) => kindAt(r, c) === 'yellow' && preActivated.has(key(r, c))
  const yellowEnterable = (r: number, c: number, budgetLeft: number) =>
    isOpenYellow(r, c) || ((allowed === null || allowed.has(key(r, c))) && budgetLeft > 0)

  let best: Solution | null = null
  let nodes = 0
  let timedOut = false
  const visited: boolean[] = new Array(size * 16).fill(false)
  const path: Pos[] = []

  function better(g: number, y: number, len: number): boolean {
    if (!best) return true
    if (objective === 'shortest') return len < best.path.length
    if (g !== best.grays) return g > best.grays
    if (y !== best.yellowsSpent) return y < best.yellowsSpent
    return len < best.path.length
  }

  // BFS over unvisited cells from `from`: can we still reach exit + all unvisited mids,
  // and how many grays are still collectible? Used for pruning.
  // Yellow-passability is deliberately optimistic (over-estimates reachable grays), keeping the coverage prune admissible.
  function reachability(from: Pos, budgetLeft: number): { exitOk: boolean; midsOk: boolean; grays: number } {
    const seen: boolean[] = new Array(size * 16).fill(false)
    const q: Pos[] = [from]
    seen[key(from.r, from.c)] = true
    let grays = 0
    while (q.length) {
      const p = q.pop()!
      for (const [dr, dc] of DIRS) {
        const r = p.r + dr, c = p.c + dc
        if (r < 0 || r >= size || c < 0 || c >= size) continue
        const k2 = key(r, c)
        if (seen[k2] || visited[k2]) continue
        const kd = kindAt(r, c)
        if (kd === 'red') continue
        // optimistic for yellows: enterable if any budget remains or door open/allowed
        if (kd === 'yellow' && !yellowEnterable(r, c, budgetLeft)) continue
        seen[k2] = true
        if (kd === 'gray') grays++
        q.push({ r, c })
      }
    }
    const exitOk = seen[key(exitPos.r, exitPos.c)] === true || (from.r === exitPos.r && from.c === exitPos.c)
    const midsOk = mids.every((m) => visited[key(m.r, m.c)] || seen[key(m.r, m.c)])
    return { exitOk, midsOk, grays }
  }

  function dfs(tip: Pos, graysSoFar: number, yellowsSpent: number, budgetLeft: number): void {
    if (timedOut) return
    if (++nodes > nodeBudget) { timedOut = true; return }

    if (tip.r === exitPos.r && tip.c === exitPos.c) {
      if (mids.every((m) => visited[key(m.r, m.c)]) && better(graysSoFar, yellowsSpent, path.length)) {
        best = { grays: graysSoFar, yellowsSpent, path: path.map((p) => ({ ...p })) }
      }
      return
    }

    const reach = reachability(tip, budgetLeft)
    if (!reach.exitOk || !reach.midsOk) return
    if (objective === 'coverage' && best && graysSoFar + reach.grays < best.grays) return
    if (objective === 'shortest' && best) {
      const manhattan = Math.abs(tip.r - exitPos.r) + Math.abs(tip.c - exitPos.c)
      if (path.length + manhattan >= best.path.length) return
    }

    for (const [dr, dc] of DIRS) {
      const r = tip.r + dr, c = tip.c + dc
      if (r < 0 || r >= size || c < 0 || c >= size) continue
      const k2 = key(r, c)
      if (visited[k2]) continue
      const kd = kindAt(r, c)
      if (kd === 'red') continue
      let spend = 0
      if (kd === 'yellow' && !isOpenYellow(r, c)) {
        if (!yellowEnterable(r, c, budgetLeft)) continue
        spend = 1
      }
      visited[k2] = true
      path.push({ r, c })
      dfs({ r, c }, graysSoFar + (kd === 'gray' ? 1 : 0), yellowsSpent + spend, budgetLeft - spend)
      path.pop()
      visited[k2] = false
    }
  }

  visited[key(start.r, start.c)] = true
  path.push({ ...start })
  dfs(start, 0, 0, input.yellowBudget)

  if (timedOut && !best) return { kind: 'timeout' }
  if (!best) return { kind: 'unsolvable' }
  return { kind: 'solved', solution: best }
}

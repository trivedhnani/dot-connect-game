import type { Benchmark, Pos } from '../engine/types'
import { findCells, parseRows } from '../engine/board'
import { solve, type LevelInput } from './solver'

export interface ValidationReport { ok: boolean; reasons: string[]; benchmark?: Benchmark }

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const
const pk = (p: Pos) => `${p.r},${p.c}`

/** Cells reachable from start walking only empty/start/exit/mid/gray plus OPEN yellow doors. */
function openRegion(input: LevelInput, open: Set<string>): { region: Set<string>; frontierYellows: Pos[] } {
  const cells = parseRows(input.rows)
  const start = findCells(cells, 'start')[0]!
  const region = new Set<string>([pk(start)])
  const frontier: Pos[] = []
  const q: Pos[] = [start]
  while (q.length) {
    const p = q.pop()!
    for (const [dr, dc] of DIRS) {
      const n = { r: p.r + dr, c: p.c + dc }
      if (n.r < 0 || n.r >= input.size || n.c < 0 || n.c >= input.size) continue
      if (region.has(pk(n))) continue
      const kd = cells[n.r]![n.c]!
      if (kd === 'red') continue
      if (kd === 'yellow' && !open.has(pk(n))) {
        if (!frontier.some((f) => pk(f) === pk(n))) frontier.push(n)
        continue
      }
      region.add(pk(n))
      q.push(n)
    }
  }
  return { region, frontierYellows: frontier }
}

export function reachableActivationSets(input: LevelInput): Pos[][] {
  const seen = new Map<string, Pos[]>()
  const setKey = (s: Pos[]) => s.map(pk).sort().join('|')
  const queue: Pos[][] = [[]]
  seen.set('', [])
  while (queue.length) {
    const A = queue.pop()!
    if (A.length >= input.yellowBudget) continue
    const { frontierYellows } = openRegion(input, new Set(A.map(pk)))
    for (const y of frontierYellows) {
      const next = [...A, y]
      const k = setKey(next)
      if (!seen.has(k)) { seen.set(k, next); queue.push(next) }
    }
  }
  return [...seen.values()]
}

export function validateLevel(input: LevelInput): ValidationReport {
  const reasons: string[] = []
  const cells = parseRows(input.rows)
  const starts = findCells(cells, 'start')
  const exits = findCells(cells, 'exit')
  const yellows = findCells(cells, 'yellow')

  if (starts.length !== 1) reasons.push('need-exactly-one-start')
  if (exits.length !== 1) reasons.push('need-exactly-one-exit')
  if (yellows.length === 0) reasons.push('need-at-least-one-yellow')
  if (reasons.length) return { ok: false, reasons }

  // Invariant 2: solvable within budget; benchmark from the same solve.
  const res = solve(input)
  if (res.kind !== 'solved') { reasons.push(`unsolvable-or-timeout:${res.kind}`); return { ok: false, reasons } }
  const s = res.solution
  const benchmark: Benchmark = {
    grays: s.grays, yellowsSpent: s.yellowsSpent, pathLength: s.path.length, path: s.path,
  }

  // Invariant 3: no yellow-free route (BFS treating yellow and red as walls).
  const { region } = openRegion(input, new Set())  // no doors open
  if (region.has(pk(exits[0]!))) reasons.push('yellow-free-route-exists')

  // Invariant 4: no reachable activation set is a trap.
  for (const A of reachableActivationSets(input)) {
    const rem = input.yellowBudget - A.length
    const check = solve({ ...input, yellowBudget: rem }, { preActivated: A })
    if (check.kind !== 'solved') { reasons.push(`trap:${A.map(pk).join('|') || 'none'}:${check.kind}`) }
  }

  return reasons.length ? { ok: false, reasons } : { ok: true, reasons: [], benchmark }
}

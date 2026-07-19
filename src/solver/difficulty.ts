import type { Benchmark, Pos } from '../engine/types'
import { findCells, parseRows } from '../engine/board'
import { solve, type LevelInput } from './solver'

export interface Assessment { difficulty: number; interesting: boolean; reasons: string[] }

const adjacentTo = (p: Pos, list: Pos[]) =>
  list.some((q) => Math.abs(p.r - q.r) + Math.abs(p.c - q.c) === 1)

export function assess(input: LevelInput, benchmark: Benchmark, tier: number): Assessment {
  const reasons: string[] = []
  const cells = parseRows(input.rows)
  const reds = findCells(cells, 'red')
  const yellows = findCells(cells, 'yellow')

  // Discovery gap: grays the lazy (shortest) win misses vs the optimal.
  const short = solve(input, { objective: 'shortest' })
  const shortGrays = short.kind === 'solved'
    ? short.solution.path.filter((p) => cells[p.r]![p.c]! === 'gray').length
    : 0
  const gap = benchmark.grays === 0 ? 0 : (benchmark.grays - shortGrays) / benchmark.grays

  // Danger on the optimal line.
  const dangerSteps = benchmark.path.filter((p) => adjacentTo(p, reds)).length

  // Decoy: a yellow the optimal path does not open (only meaningful when budget < yellows).
  const opensAll = input.yellowBudget >= yellows.length
  const decoyExists = !opensAll && yellows.some(
    (y) => !benchmark.path.some((p) => p.r === y.r && p.c === y.c))

  let interesting = gap >= 0.15
  if (!interesting) reasons.push(`gap-too-small:${gap.toFixed(2)}`)
  if (tier >= 2 && !decoyExists) { interesting = false; reasons.push('no-decoy-yellow') }
  if (tier >= 2 && dangerSteps < 2) { interesting = false; reasons.push('optimal-path-too-safe') }

  const difficulty = input.size * 3 + gap * 30 + reds.length * 0.5
    + (yellows.length - input.yellowBudget) * 2 + dangerSteps
  return { difficulty, interesting, reasons }
}

import type { RoundState } from './types'

export interface Grade { percent: number; stars: 0 | 1 | 2 | 3; graysCovered: number; hint: string }

export function starsFor(percent: number): 0 | 1 | 2 | 3 {
  if (percent >= 95) return 3
  if (percent >= 80) return 2
  if (percent >= 60) return 1
  return 0
}

export function gradeRound(s: RoundState): Grade {
  if (s.status !== 'won') throw new Error('can only grade a won round')
  const b = s.level.benchmark
  const g = s.path.filter((p) => s.cells[p.r]![p.c]! === 'gray').length
  const y = s.yellowsUsed
  const L = s.path.length

  const graysScore = b.grays === 0 ? 75 : 75 * (g / b.grays)
  const yellowScore = y === 0 ? 0 : 15 * Math.min(1, b.yellowsSpent / y)
  const lengthScore = L === 0 ? 0 : 10 * Math.min(1, b.pathLength / L)
  const percent = Math.max(0, Math.min(100, Math.round(graysScore + yellowScore + lengthScore - 8 * s.redHits)))

  const hints: string[] = []
  if (g < b.grays) hints.push(`+${b.grays - g} grays possible`)
  if (y > b.yellowsSpent) hints.push(`try ${y - b.yellowsSpent} fewer yellow(s)`)
  if (s.redHits > 0) hints.push('avoid red hits')
  const hint = hints.length ? hints.join('; ') : 'perfect line!'

  return { percent, stars: starsFor(percent), graysCovered: g, hint }
}

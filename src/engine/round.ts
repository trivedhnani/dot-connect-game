import type { CellKind, Level, MoveResult, Pos, RoundState } from './types'
import { adjacent, findCells, parseRows, samePos } from './board'

export function createRound(level: Level): RoundState {
  const cells = parseRows(level.rows)
  const start = findCells(cells, 'start')[0]
  if (!start) throw new Error('level has no start cell')
  return {
    level, cells, path: [start],
    yellowsUsed: 0, activatedYellows: [], flipped: false,
    lives: level.lives, redHits: 0, status: 'playing',
  }
}

export function effectiveKind(s: RoundState, p: Pos): CellKind {
  const base = s.cells[p.r]![p.c]!
  if (base === 'yellow') {
    if (s.activatedYellows.some((a) => samePos(a, p))) return 'empty' // opened door
    return s.flipped ? 'red' : 'yellow'
  }
  return base
}

function allMidsOnPath(s: RoundState): boolean {
  return findCells(s.cells, 'mid').every((m) => s.path.some((p) => samePos(p, m)))
}

function redHit(s: RoundState): MoveResult {
  s.redHits++
  s.lives--
  if (s.lives <= 0) { s.status = 'lost'; return { kind: 'lost' } }
  let idx = 0
  for (let i = s.path.length - 1; i > 0; i--) {
    const p = s.path[i]!
    const base = s.cells[p.r]![p.c]!
    const activated = base === 'yellow' && s.activatedYellows.some((a) => samePos(a, p))
    if (activated || base === 'mid') { idx = i; break }
  }
  s.path.length = idx + 1
  return { kind: 'red-hit', rewoundTo: s.path[idx]!, livesLeft: s.lives }
}

export function tryMove(s: RoundState, to: Pos): MoveResult {
  if (s.status !== 'playing') return { kind: 'rejected', reason: 'not-playing' }
  const tip = s.path[s.path.length - 1]!
  if (s.path.length >= 2 && samePos(to, s.path[s.path.length - 2]!)) {
    s.path.pop()
    return { kind: 'retracted' }
  }
  if (!adjacent(tip, to)) return { kind: 'rejected', reason: 'not-adjacent' }
  if (s.path.some((p) => samePos(p, to))) return { kind: 'rejected', reason: 'visited' }

  const kind = effectiveKind(s, to)
  if (kind === 'red') return redHit(s)
  if (kind === 'yellow') {
    s.yellowsUsed++
    s.activatedYellows.push(to)
    s.path.push(to)
    if (s.yellowsUsed >= s.level.yellowBudget) s.flipped = true
    return { kind: 'activated', flipped: s.flipped }
  }
  s.path.push(to)
  if (kind === 'exit') {
    if (allMidsOnPath(s)) { s.status = 'won'; return { kind: 'won' } }
    s.path.pop()
    return { kind: 'rejected', reason: 'mids-remaining' }
  }
  return { kind: 'moved' }
}

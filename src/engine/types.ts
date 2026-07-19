export type CellKind = 'empty' | 'start' | 'exit' | 'mid' | 'gray' | 'yellow' | 'red'
export interface Pos { r: number; c: number }
export interface Benchmark { grays: number; yellowsSpent: number; pathLength: number; path: Pos[] }
export interface Level {
  id: string; size: number; rows: string[]; yellowBudget: number; lives: number
  benchmark: Benchmark; difficulty: number
}
export type RoundStatus = 'playing' | 'won' | 'lost'
export interface RoundState {
  level: Level; cells: CellKind[][]; path: Pos[]
  yellowsUsed: number; activatedYellows: Pos[]; flipped: boolean
  lives: number; redHits: number; status: RoundStatus
}
export type MoveResult =
  | { kind: 'moved' } | { kind: 'retracted' }
  | { kind: 'rejected'; reason: 'not-playing' | 'not-adjacent' | 'visited' | 'mids-remaining' }
  | { kind: 'activated'; flipped: boolean }
  | { kind: 'red-hit'; rewoundTo: Pos; livesLeft: number }
  | { kind: 'won' } | { kind: 'lost' }

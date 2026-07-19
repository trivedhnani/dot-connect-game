# Dot-Connect Game v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the playable web v1 of the dot-connect puzzle: 60 generated levels + daily level, full rule set (yellow doors, flip, lives/rewind), end-of-round grading vs solver benchmark, deployed to GitHub Pages.

**Architecture:** Pure-TypeScript `engine/` (rules) and `solver/` (generator + exact solver, build-time only) with zero Phaser imports, tested with vitest. Thin Phaser 3 `game/` layer renders state and forwards input to the engine. Levels are static JSON emitted by a Node CLI and validated in CI.

**Tech Stack:** TypeScript 5, Vite, Phaser 3, vitest, GitHub Actions + GitHub Pages.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-19-dot-connect-game-design.md` — rules there are authoritative.
- `src/engine/**` and `src/solver/**` MUST NOT import Phaser or any browser API (pure TS; solver runs under Node).
- Yellow = door: entering spends 1 budget point automatically; entry with 0 budget is impossible (cell behaves as red once flipped).
- Grading priority: grays (max) → yellows spent (min) → red hits (penalty) → path length (tiebreak). Stars: ⭐ ≥60%, ⭐⭐ ≥80%, ⭐⭐⭐ ≥95%.
- Levels ship only if the solver proved them: solvable within budget, no yellow-free route, no-trap for every full activation subset, benchmark computed.
- No `Date.now()` in engine/solver logic paths that affect level content; the daily level derives from a `YYYYMMDD` integer passed in.
- Commit after every task (steps include the commands). Commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## File Structure

```
dot-connect-game/
  index.html                    Vite entry
  package.json / tsconfig.json / vite.config.ts / vitest.config.ts
  src/
    engine/types.ts             CellKind, Pos, Level, Benchmark, RoundState, MoveResult
    engine/board.ts             parseRows, findCells, adjacent, samePos, inBounds
    engine/round.ts             createRound, tryMove, effectiveKind (all rules)
    engine/grading.ts           gradeRound, starsFor
    solver/solver.ts            exact search: solve(input, opts) -> Solution | null
    solver/validate.ts          validateLevel: the 4 ship invariants
    solver/generate.ts          mulberry32 RNG, generateCandidate(params)
    solver/difficulty.ts        difficultyScore + interestingness filters
    solver/cli.ts               Node script: emits src/levels/levels.json
    levels/levels.json          60 campaign levels + 30-level daily pool (generated artifact, committed)
    game/main.ts                Phaser boot config
    game/scenes/PlayScene.ts    board render, drag input, HUD, flip/rewind FX
    game/scenes/GradeOverlay.ts grade %, stars, hint, reveal button
    game/scenes/LevelSelect.ts  level grid, locks, stars, daily tile
    game/storage.ts             localStorage progress + reveal tokens
    game/daily.ts               date -> daily pool index
    game/analytics.ts           minimal event wrapper
  tests/engine/board.test.ts
  tests/engine/round.test.ts
  tests/engine/grading.test.ts
  tests/solver/solver.test.ts
  tests/solver/validate.test.ts
  tests/solver/generate.test.ts
  scripts/validate-levels.ts    CI gate: re-validate shipped levels.json
  .github/workflows/deploy.yml  test + validate + build + Pages deploy
```

Shared level notation used by every test (one char per cell): `.` empty, `S` start, `E` exit, `M` mid (must-visit), `g` gray, `y` yellow, `r` red.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `tests/engine/board.test.ts` (placeholder assertion), `.gitignore`

**Interfaces:**
- Produces: working `npm test` (vitest) and `npm run dev` (vite) commands every later task relies on.

- [ ] **Step 1: Write configs**

`package.json`:
```json
{
  "name": "dot-connect-game",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "gen:levels": "tsx src/solver/cli.ts",
    "validate:levels": "tsx scripts/validate-levels.ts"
  },
  "dependencies": {
    "phaser": "^3.85.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0",
    "tsx": "^4.16.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "scripts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
export default defineConfig({ base: './' })
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } })
```

`index.html`:
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <title>dot-connect-game</title>
    <style>html,body{margin:0;padding:0;background:#101018;height:100%}#app{height:100%}</style>
  </head>
  <body><div id="app"></div><script type="module" src="/src/game/main.ts"></script></body>
</html>
```

`.gitignore`:
```
node_modules/
dist/
```

`tests/engine/board.test.ts` (placeholder so vitest passes; replaced in Task 2):
```ts
import { test, expect } from 'vitest'
test('scaffold works', () => { expect(1 + 1).toBe(2) })
```

- [ ] **Step 2: Install and verify**

Run: `npm install && npm test`
Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + vitest + phaser project

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Engine types + board helpers

**Files:**
- Create: `src/engine/types.ts`, `src/engine/board.ts`
- Test: `tests/engine/board.test.ts` (replace placeholder)

**Interfaces:**
- Produces (used by every later task):
```ts
// types.ts
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
// board.ts
export function parseRows(rows: string[]): CellKind[][]
export function rowsFromCells(cells: CellKind[][]): string[]
export function findCells(cells: CellKind[][], kind: CellKind): Pos[]
export function samePos(a: Pos, b: Pos): boolean
export function adjacent(a: Pos, b: Pos): boolean
export function inBounds(size: number, p: Pos): boolean
```

- [ ] **Step 1: Write the failing tests** (replace `tests/engine/board.test.ts`)

```ts
import { test, expect } from 'vitest'
import { parseRows, rowsFromCells, findCells, adjacent, samePos, inBounds } from '../../src/engine/board'

const rows = ['S.g', 'ryE', '.M.']

test('parseRows maps chars to kinds', () => {
  const cells = parseRows(rows)
  expect(cells[0]![0]).toBe('start')
  expect(cells[0]![1]).toBe('empty')
  expect(cells[0]![2]).toBe('gray')
  expect(cells[1]![0]).toBe('red')
  expect(cells[1]![1]).toBe('yellow')
  expect(cells[1]![2]).toBe('exit')
  expect(cells[2]![1]).toBe('mid')
})

test('parseRows rejects unknown chars and ragged rows', () => {
  expect(() => parseRows(['SX'])).toThrow()
  expect(() => parseRows(['S.', 'E'])).toThrow()
})

test('rowsFromCells round-trips', () => {
  expect(rowsFromCells(parseRows(rows))).toEqual(rows)
})

test('findCells locates all of a kind', () => {
  expect(findCells(parseRows(rows), 'start')).toEqual([{ r: 0, c: 0 }])
  expect(findCells(parseRows(rows), 'yellow')).toEqual([{ r: 1, c: 1 }])
})

test('adjacency is orthogonal only', () => {
  expect(adjacent({ r: 0, c: 0 }, { r: 0, c: 1 })).toBe(true)
  expect(adjacent({ r: 0, c: 0 }, { r: 1, c: 1 })).toBe(false)
  expect(adjacent({ r: 0, c: 0 }, { r: 0, c: 0 })).toBe(false)
})

test('samePos and inBounds', () => {
  expect(samePos({ r: 1, c: 2 }, { r: 1, c: 2 })).toBe(true)
  expect(inBounds(3, { r: 2, c: 2 })).toBe(true)
  expect(inBounds(3, { r: 3, c: 0 })).toBe(false)
  expect(inBounds(3, { r: -1, c: 0 })).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `src/engine/board`.

- [ ] **Step 3: Implement**

`src/engine/types.ts`: exactly the block from **Interfaces** above (types only, no logic).

`src/engine/board.ts`:
```ts
import type { CellKind, Pos } from './types'

const CHAR_TO_KIND: Record<string, CellKind> = {
  '.': 'empty', S: 'start', E: 'exit', M: 'mid', g: 'gray', y: 'yellow', r: 'red',
}
const KIND_TO_CHAR: Record<CellKind, string> = {
  empty: '.', start: 'S', exit: 'E', mid: 'M', gray: 'g', yellow: 'y', red: 'r',
}

export function parseRows(rows: string[]): CellKind[][] {
  return rows.map((row) => {
    if (row.length !== rows[0]!.length) throw new Error('ragged rows')
    return [...row].map((ch) => {
      const kind = CHAR_TO_KIND[ch]
      if (!kind) throw new Error(`unknown cell char: ${ch}`)
      return kind
    })
  })
}

export function rowsFromCells(cells: CellKind[][]): string[] {
  return cells.map((row) => row.map((k) => KIND_TO_CHAR[k]).join(''))
}

export function findCells(cells: CellKind[][], kind: CellKind): Pos[] {
  const out: Pos[] = []
  cells.forEach((row, r) => row.forEach((k, c) => { if (k === kind) out.push({ r, c }) }))
  return out
}

export function samePos(a: Pos, b: Pos): boolean { return a.r === b.r && a.c === b.c }
export function adjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1
}
export function inBounds(size: number, p: Pos): boolean {
  return p.r >= 0 && p.r < size && p.c >= 0 && p.c < size
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine tests/engine
git commit -m "feat(engine): cell types and board helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Round core — createRound, movement, retract, win

**Files:**
- Create: `src/engine/round.ts`
- Test: `tests/engine/round.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `board.ts` (Task 2 signatures).
- Produces:
```ts
export function createRound(level: Level): RoundState
export function tryMove(s: RoundState, to: Pos): MoveResult   // mutates s
export function effectiveKind(s: RoundState, p: Pos): CellKind // yellow→empty if activated, →red if flipped
```

- [ ] **Step 1: Write the failing tests** (`tests/engine/round.test.ts`)

```ts
import { test, expect } from 'vitest'
import { createRound, tryMove } from '../../src/engine/round'
import type { Level } from '../../src/engine/types'

export function lvl(rows: string[], yellowBudget = 1, lives = 3): Level {
  return {
    id: 't', size: rows.length, rows, yellowBudget, lives,
    benchmark: { grays: 0, yellowsSpent: 1, pathLength: 0, path: [] }, difficulty: 0,
  }
}

test('createRound starts path at the start cell with level lives', () => {
  const s = createRound(lvl(['S..', '...', '..E']))
  expect(s.path).toEqual([{ r: 0, c: 0 }])
  expect(s.lives).toBe(3)
  expect(s.status).toBe('playing')
})

test('moves to an adjacent free cell; rejects non-adjacent and visited', () => {
  const s = createRound(lvl(['S..', '...', '..E']))
  expect(tryMove(s, { r: 0, c: 1 })).toEqual({ kind: 'moved' })
  expect(tryMove(s, { r: 2, c: 0 })).toEqual({ kind: 'rejected', reason: 'not-adjacent' })
  expect(tryMove(s, { r: 1, c: 1 })).toEqual({ kind: 'moved' })
  expect(tryMove(s, { r: 1, c: 0 })).toEqual({ kind: 'moved' })
  expect(tryMove(s, { r: 0, c: 0 })).toEqual({ kind: 'rejected', reason: 'visited' })
})

test('stepping back onto the previous cell retracts the tip', () => {
  const s = createRound(lvl(['S..', '...', '..E']))
  tryMove(s, { r: 0, c: 1 })
  tryMove(s, { r: 0, c: 2 })
  expect(tryMove(s, { r: 0, c: 1 })).toEqual({ kind: 'retracted' })
  expect(s.path).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }])
})

test('reaching the exit wins when there are no mids; further moves rejected', () => {
  const s = createRound(lvl(['SE', '..']))
  expect(tryMove(s, { r: 0, c: 1 })).toEqual({ kind: 'won' })
  expect(s.status).toBe('won')
  expect(tryMove(s, { r: 1, c: 1 })).toEqual({ kind: 'rejected', reason: 'not-playing' })
})

test('exit is locked until all mids are on the path', () => {
  const s = createRound(lvl(['S.M', '...', '..E']))
  tryMove(s, { r: 0, c: 1 })
  tryMove(s, { r: 1, c: 1 })
  tryMove(s, { r: 1, c: 2 })
  expect(tryMove(s, { r: 2, c: 2 })).toEqual({ kind: 'rejected', reason: 'mids-remaining' })
  expect(s.path.length).toBe(4) // exit step rolled back
  tryMove(s, { r: 1, c: 1 }) // retract
  tryMove(s, { r: 0, c: 1 }) // retract
  tryMove(s, { r: 0, c: 2 }) // mid
  tryMove(s, { r: 1, c: 2 })
  expect(tryMove(s, { r: 2, c: 2 })).toEqual({ kind: 'won' })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, cannot resolve `src/engine/round`.

- [ ] **Step 3: Implement** (`src/engine/round.ts`)

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/round.ts tests/engine/round.test.ts
git commit -m "feat(engine): round state, movement, retract, mid-gated win

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Yellow doors and the flip

**Files:**
- Modify: none (behavior already in `round.ts`) — this task is the dedicated test coverage that pins the signature mechanic. If any test fails, fix `round.ts` accordingly.
- Test: append to `tests/engine/round.test.ts`

**Interfaces:**
- Consumes: `createRound`, `tryMove`, `effectiveKind`, `lvl` helper from Task 3.

- [ ] **Step 1: Write the tests** (append to `tests/engine/round.test.ts`)

```ts
import { effectiveKind } from '../../src/engine/round'

test('entering a yellow spends budget and activates it (door semantics)', () => {
  const s = createRound(lvl(['Sy.', '...', 'y.E'], 2))
  const res = tryMove(s, { r: 0, c: 1 })
  expect(res).toEqual({ kind: 'activated', flipped: false })
  expect(s.yellowsUsed).toBe(1)
  expect(s.activatedYellows).toEqual([{ r: 0, c: 1 }])
})

test('spending the last budget point flips remaining yellows to red', () => {
  const s = createRound(lvl(['Sy.', '...', 'y.E'], 1))
  const res = tryMove(s, { r: 0, c: 1 })
  expect(res).toEqual({ kind: 'activated', flipped: true })
  expect(s.flipped).toBe(true)
  expect(effectiveKind(s, { r: 2, c: 0 })).toBe('red')     // unspent yellow is now red
  expect(effectiveKind(s, { r: 0, c: 1 })).toBe('empty')   // opened door stays safe
})

test('activation is permanent across retraction; re-entry is free', () => {
  const s = createRound(lvl(['Sy.', '...', 'y.E'], 2))
  tryMove(s, { r: 0, c: 1 })            // activate
  tryMove(s, { r: 0, c: 0 })            // retract off it
  expect(s.yellowsUsed).toBe(1)          // budget NOT refunded
  expect(tryMove(s, { r: 0, c: 1 })).toEqual({ kind: 'moved' }) // re-enter open door: free
  expect(s.yellowsUsed).toBe(1)
})
```

- [ ] **Step 2: Run tests**

Run: `npm test` — Expected: all pass (Task 3 implementation already covers this; if any fail, fix `round.ts` until green).

- [ ] **Step 3: Commit**

```bash
git add tests/engine/round.test.ts
git commit -m "test(engine): pin yellow door + flip semantics

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Red hits, lives, rewind

**Files:**
- Modify: none expected (logic in `round.ts` from Task 3); fix there if tests fail.
- Test: append to `tests/engine/round.test.ts`

- [ ] **Step 1: Write the tests** (append)

```ts
test('touching red costs a life and rewinds to start when no checkpoint', () => {
  const s = createRound(lvl(['S.r', '...', 'y.E'], 1))
  tryMove(s, { r: 0, c: 1 })
  const res = tryMove(s, { r: 0, c: 2 })
  expect(res).toEqual({ kind: 'red-hit', rewoundTo: { r: 0, c: 0 }, livesLeft: 2 })
  expect(s.path).toEqual([{ r: 0, c: 0 }])
  expect(s.redHits).toBe(1)
})

test('rewind returns to the last activated yellow on the path', () => {
  const s = createRound(lvl(['Sy.', '..r', '..E'], 2))
  tryMove(s, { r: 0, c: 1 })   // activate yellow checkpoint
  tryMove(s, { r: 0, c: 2 })
  const res = tryMove(s, { r: 1, c: 2 })  // red
  expect(res).toEqual({ kind: 'red-hit', rewoundTo: { r: 0, c: 1 }, livesLeft: 2 })
  expect(s.path).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }])
})

test('cells freed by rewind can be re-entered', () => {
  const s = createRound(lvl(['S.r', '...', '..E'], 1))
  tryMove(s, { r: 0, c: 1 })
  tryMove(s, { r: 0, c: 2 })            // red-hit, rewound to start
  expect(tryMove(s, { r: 0, c: 1 })).toEqual({ kind: 'moved' })
})

test('losing the last life loses the round', () => {
  const s = createRound(lvl(['Sr', 'yE'], 1, 1))
  const res = tryMove(s, { r: 0, c: 1 })
  expect(res).toEqual({ kind: 'lost' })
  expect(s.status).toBe('lost')
  expect(tryMove(s, { r: 1, c: 0 })).toEqual({ kind: 'rejected', reason: 'not-playing' })
})
```

- [ ] **Step 2: Run tests**

Run: `npm test` — Expected: all pass; fix `round.ts` if not.

- [ ] **Step 3: Commit**

```bash
git add tests/engine/round.test.ts
git commit -m "test(engine): pin red-hit lives and checkpoint rewind

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: End-of-round grading

**Files:**
- Create: `src/engine/grading.ts`
- Test: `tests/engine/grading.test.ts`

**Interfaces:**
- Consumes: `RoundState` (won), `Benchmark`.
- Produces:
```ts
export interface Grade { percent: number; stars: 0 | 1 | 2 | 3; graysCovered: number; hint: string }
export function starsFor(percent: number): 0 | 1 | 2 | 3          // 60/80/95 thresholds
export function gradeRound(s: RoundState): Grade                   // throws unless status === 'won'
```
Formula (constants live here, single source of truth):
`percent = clamp(round(75·g/G + 15·min(1, Y/y) + 10·min(1, L*/L) − 8·redHits), 0, 100)`
where g = grays on final path, G = benchmark.grays (if G is 0, grays term contributes the full 75), y = yellowsUsed, Y = benchmark.yellowsSpent, L = path length, L* = benchmark.pathLength.

- [ ] **Step 1: Write the failing tests** (`tests/engine/grading.test.ts`)

```ts
import { test, expect } from 'vitest'
import { createRound, tryMove } from '../../src/engine/round'
import { gradeRound, starsFor } from '../../src/engine/grading'
import type { Level } from '../../src/engine/types'

function lvlWithBenchmark(rows: string[], budget: number, b: { grays: number; yellowsSpent: number; pathLength: number }): Level {
  return { id: 't', size: rows.length, rows, yellowBudget: budget, lives: 3,
    benchmark: { ...b, path: [] }, difficulty: 0 }
}

// Board: S g y / . r g / . . E   optimal: S→g→y→g(1,2)→E  grays=2, yellows=1, length=5
const ROWS = ['Sgy', '.rg', '..E']

test('perfect run grades 100 with 3 stars', () => {
  const s = createRound(lvlWithBenchmark(ROWS, 2, { grays: 2, yellowsSpent: 1, pathLength: 5 }))
  tryMove(s, { r: 0, c: 1 }); tryMove(s, { r: 0, c: 2 })
  tryMove(s, { r: 1, c: 2 }); tryMove(s, { r: 2, c: 2 })
  const grade = gradeRound(s)
  expect(grade.percent).toBe(100)
  expect(grade.stars).toBe(3)
  expect(grade.graysCovered).toBe(2)
  expect(grade.hint).toBe('perfect line!')
})

test('missing grays and taking longer reduces the grade with a hint', () => {
  const s = createRound(lvlWithBenchmark(ROWS, 2, { grays: 2, yellowsSpent: 1, pathLength: 5 }))
  // Lazy bottom route skipping both grays and the yellow: S→(1,0)→(2,0)→(2,1)→(2,2)E.
  // Expected: grays 0/2 → 0 of 75; y=0 → yellow term 0 (guarded); length 5/5 → 10. Total 10.
  // (The engine doesn't force yellows — that's the validator's job on shipped levels.)
  tryMove(s, { r: 1, c: 0 }); tryMove(s, { r: 2, c: 0 })
  tryMove(s, { r: 2, c: 1 }); tryMove(s, { r: 2, c: 2 })
  const grade = gradeRound(s)
  expect(grade.percent).toBe(10)
  expect(grade.percent).toBeLessThan(60)
  expect(grade.stars).toBe(0)
  expect(grade.hint).toContain('+2 grays possible')
})

test('red hits subtract 8 points each', () => {
  const s = createRound(lvlWithBenchmark(ROWS, 2, { grays: 2, yellowsSpent: 1, pathLength: 5 }))
  tryMove(s, { r: 0, c: 1 }); tryMove(s, { r: 1, c: 1 })      // red hit, rewound to start
  tryMove(s, { r: 0, c: 1 }); tryMove(s, { r: 0, c: 2 })
  tryMove(s, { r: 1, c: 2 }); tryMove(s, { r: 2, c: 2 })
  const grade = gradeRound(s)
  expect(grade.percent).toBe(92)  // 100 − 8
  expect(grade.hint).toContain('avoid red hits')
})

test('starsFor thresholds', () => {
  expect(starsFor(59)).toBe(0); expect(starsFor(60)).toBe(1)
  expect(starsFor(80)).toBe(2); expect(starsFor(95)).toBe(3)
})

test('grading a non-won round throws', () => {
  const s = createRound(lvlWithBenchmark(ROWS, 2, { grays: 2, yellowsSpent: 1, pathLength: 5 }))
  expect(() => gradeRound(s)).toThrow()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, cannot resolve `src/engine/grading`.

- [ ] **Step 3: Implement** (`src/engine/grading.ts`)

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/grading.ts tests/engine/grading.test.ts
git commit -m "feat(engine): end-of-round grading vs benchmark

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Exact solver

**Files:**
- Create: `src/solver/solver.ts`
- Test: `tests/solver/solver.test.ts`

**Interfaces:**
- Consumes: `parseRows`, `findCells`, `adjacent` from `engine/board.ts`; `Pos`, `CellKind` from `engine/types.ts`.
- Produces:
```ts
export interface LevelInput { size: number; rows: string[]; yellowBudget: number }
export interface Solution { grays: number; yellowsSpent: number; path: Pos[] }
export type SolveResult =
  | { kind: 'solved'; solution: Solution }
  | { kind: 'unsolvable' }
  | { kind: 'timeout' }
export interface SolveOptions {
  nodeBudget?: number          // default 500_000 explored nodes
  allowedYellows?: Pos[]       // if set, only these yellows may be entered
  preActivated?: Pos[]         // doors already open (free entry, no budget cost)
  objective?: 'coverage' | 'shortest'  // default 'coverage'
}
export function solve(input: LevelInput, opts?: SolveOptions): SolveResult
```
Semantics: finds the best win (start→exit, all mids visited, self-avoiding orthogonal path). `coverage` = max grays, then min yellows spent, then min length — this produces the shipped benchmark. `shortest` = min length only (used by difficulty assessment). Yellows cost 1 budget on first entry unless pre-activated. Red cells are never enterable by the solver (optimal play never takes a hit).

- [ ] **Step 1: Write the failing tests** (`tests/solver/solver.test.ts`)

```ts
import { test, expect } from 'vitest'
import { solve } from '../../src/solver/solver'

test('finds the max-coverage path', () => {
  const res = solve({ size: 3, rows: ['Sg.', 'gg.', '..E'], yellowBudget: 1 })
  expect(res.kind).toBe('solved')
  if (res.kind !== 'solved') return
  expect(res.solution.grays).toBe(3)      // S→(0,1)g→(1,1)g→(1,0)g→(2,0)→(2,1)→(2,2)E
  expect(res.solution.yellowsSpent).toBe(0)
})

test('routes through a yellow door when forced, respecting budget', () => {
  const input = { size: 3, rows: ['Sy.', 'ry.', '..E'], yellowBudget: 1 }
  const res = solve(input)
  expect(res.kind).toBe('solved')
  if (res.kind !== 'solved') return
  expect(res.solution.yellowsSpent).toBe(1)
  expect(solve({ ...input, yellowBudget: 0 }).kind).toBe('unsolvable')
})

test('respects allowedYellows restriction', () => {
  const input = { size: 3, rows: ['Sy.', 'ry.', '..E'], yellowBudget: 1 }
  expect(solve(input, { allowedYellows: [{ r: 1, c: 1 }] }).kind).toBe('unsolvable') // (1,1) unreachable without (0,1)
  expect(solve(input, { allowedYellows: [{ r: 0, c: 1 }] }).kind).toBe('solved')
})

test('preActivated doors are free', () => {
  const input = { size: 3, rows: ['Sy.', 'ry.', '..E'], yellowBudget: 0 }
  const res = solve(input, { preActivated: [{ r: 0, c: 1 }] })
  expect(res.kind).toBe('solved')
  if (res.kind !== 'solved') return
  expect(res.solution.yellowsSpent).toBe(0)
})

test('mids are mandatory', () => {
  const res = solve({ size: 3, rows: ['S.M', '...', '..E'], yellowBudget: 1 })
  expect(res.kind).toBe('solved')
  if (res.kind !== 'solved') return
  expect(res.solution.path).toContainEqual({ r: 0, c: 2 })
})

test('walled-off exit is unsolvable', () => {
  expect(solve({ size: 2, rows: ['Sr', 'rE'], yellowBudget: 1 }).kind).toBe('unsolvable')
})

test('shortest objective minimizes length', () => {
  const res = solve({ size: 3, rows: ['Sg.', 'gg.', '..E'], yellowBudget: 1 }, { objective: 'shortest' })
  expect(res.kind).toBe('solved')
  if (res.kind !== 'solved') return
  expect(res.solution.path.length).toBe(5)  // S→(1,0)→(2,0)→(2,1)→(2,2) or symmetric
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, cannot resolve `src/solver/solver`.

- [ ] **Step 3: Implement** (`src/solver/solver.ts`)

```ts
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
  const { size } = input
  const cells = parseRows(input.rows)
  const nodeBudget = opts.nodeBudget ?? 500_000
  const objective = opts.objective ?? 'coverage'
  const start = findCells(cells, 'start')[0]
  const exit = findCells(cells, 'exit')[0]
  if (!start || !exit) return { kind: 'unsolvable' }
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
    const exitOk = seen[key(exit.r, exit.c)] === true || (from.r === exit.r && from.c === exit.c)
    const midsOk = mids.every((m) => visited[key(m.r, m.c)] || seen[key(m.r, m.c)])
    return { exitOk, midsOk, grays }
  }

  function dfs(tip: Pos, graysSoFar: number, yellowsSpent: number, budgetLeft: number): void {
    if (timedOut) return
    if (++nodes > nodeBudget) { timedOut = true; return }

    if (tip.r === exit.r && tip.c === exit.c) {
      if (mids.every((m) => visited[key(m.r, m.c)]) && better(graysSoFar, yellowsSpent, path.length)) {
        best = { grays: graysSoFar, yellowsSpent, path: path.map((p) => ({ ...p })) }
      }
      return
    }

    const reach = reachability(tip, budgetLeft)
    if (!reach.exitOk || !reach.midsOk) return
    if (objective === 'coverage' && best && graysSoFar + reach.grays < best.grays) return
    if (objective === 'shortest' && best) {
      const manhattan = Math.abs(tip.r - exit.r) + Math.abs(tip.c - exit.c)
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/solver/solver.ts tests/solver/solver.test.ts
git commit -m "feat(solver): exact coverage/shortest solver with pruning

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Level validation — the ship invariants

**Files:**
- Create: `src/solver/validate.ts`
- Test: `tests/solver/validate.test.ts`

**Interfaces:**
- Consumes: `solve`, `LevelInput`, `SolveResult` (Task 7); `parseRows`, `findCells` (Task 2); `Benchmark` type.
- Produces:
```ts
export interface ValidationReport { ok: boolean; reasons: string[]; benchmark?: Benchmark }
export function validateLevel(input: LevelInput): ValidationReport
export function reachableActivationSets(input: LevelInput): Pos[][]  // exported for tests
```
Invariants checked (spec order):
1. Exactly one start, one exit; ≥1 yellow.
2. Solvable within budget (coverage solve succeeds → also yields the benchmark). Timeout = reject.
3. No yellow-free route: BFS start→exit over non-red, non-yellow cells must FAIL (mids ignored for this check — stricter is fine).
4. No-trap: for EVERY activation set the player can actually reach (computed by BFS over door-sets: from set A, the next openable doors are yellows adjacent to the region reachable through open/free cells), a win must still exist with the remaining budget (`solve` with `preActivated: A` and reduced budget). Uses reachable sets, not all subsets — a yellow that geometry prevents opening first cannot cause a trap.

- [ ] **Step 1: Write the failing tests** (`tests/solver/validate.test.ts`)

```ts
import { test, expect } from 'vitest'
import { validateLevel, reachableActivationSets } from '../../src/solver/validate'

test('accepts a sound level and returns its benchmark', () => {
  const rep = validateLevel({ size: 3, rows: ['Sy.', 'ry.', 'g.E'], yellowBudget: 1 })
  expect(rep.ok).toBe(true)
  expect(rep.benchmark).toBeDefined()
  expect(rep.benchmark!.yellowsSpent).toBe(1)
})

test('rejects a level with a yellow-free route', () => {
  const rep = validateLevel({ size: 3, rows: ['S..', '.y.', '..E'], yellowBudget: 1 })
  expect(rep.ok).toBe(false)
  expect(rep.reasons).toContain('yellow-free-route-exists')
})

test('rejects an unsolvable level', () => {
  const rep = validateLevel({ size: 3, rows: ['Sry', 'rry', 'yyE'], yellowBudget: 1 })
  expect(rep.ok).toBe(false)
  expect(rep.reasons.some((r) => r.startsWith('unsolvable'))).toBe(true)
})

test('reachableActivationSets only includes geometrically reachable orders', () => {
  // (1,1) yellow can only be opened after (0,1): sets are [], [(0,1)] for budget 1
  const sets = reachableActivationSets({ size: 3, rows: ['Sy.', 'ry.', '..E'], yellowBudget: 1 })
  expect(sets).toContainEqual([])
  expect(sets).toContainEqual([{ r: 0, c: 1 }])
  expect(sets).not.toContainEqual([{ r: 1, c: 1 }])
})

test('rejects a trap: opening the decoy first makes the level unwinnable', () => {
  // Budget 1. Two doors openable first: (0,1) leads to the exit via the right column;
  // (1,0) leads into a dead pocket ((2,0), walled by reds). A player who spends the
  // budget on (1,0) flips (0,1) to red -> unwinnable. Validator must reject.
  const rep = validateLevel({ size: 3, rows: ['Sy.', 'yr.', '.rE'], yellowBudget: 1 })
  expect(rep.ok).toBe(false)
  expect(rep.reasons.some((r) => r.startsWith('trap'))).toBe(true)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, cannot resolve `src/solver/validate`.

- [ ] **Step 3: Implement** (`src/solver/validate.ts`)

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/solver/validate.ts tests/solver/validate.test.ts
git commit -m "feat(solver): ship invariants incl. reachable-set trap check

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Generator, difficulty, interestingness, CLI

**Files:**
- Create: `src/solver/generate.ts`, `src/solver/difficulty.ts`, `src/solver/cli.ts`
- Test: `tests/solver/generate.test.ts`

**Interfaces:**
- Consumes: `solve`, `validateLevel`, `LevelInput`, `Benchmark`, board helpers.
- Produces:
```ts
// generate.ts
export function mulberry32(seed: number): () => number   // deterministic [0,1) RNG
export interface GenParams {
  size: number; grays: number; yellows: number; budget: number; reds: number; mids: number; seed: number
}
export function generateCandidate(p: GenParams): LevelInput | null  // null if placement fails
// difficulty.ts
export interface Assessment { difficulty: number; interesting: boolean; reasons: string[] }
export function assess(input: LevelInput, benchmark: Benchmark, tier: number): Assessment
// cli.ts — npm run gen:levels → writes src/levels/levels.json
// JSON shape: { campaign: Level[], daily: Level[] }  (Level from engine/types, ids c01..c60 / d01..d30)
```

- [ ] **Step 1: Write the failing tests** (`tests/solver/generate.test.ts`)

```ts
import { test, expect } from 'vitest'
import { generateCandidate, mulberry32 } from '../../src/solver/generate'
import { assess } from '../../src/solver/difficulty'
import { validateLevel } from '../../src/solver/validate'
import { solve } from '../../src/solver/solver'

test('mulberry32 is deterministic', () => {
  const a = mulberry32(42), b = mulberry32(42)
  expect([a(), a(), a()]).toEqual([b(), b(), b()])
})

test('generateCandidate is reproducible from its seed and respects counts', () => {
  const p = { size: 5, grays: 4, yellows: 2, budget: 1, reds: 3, mids: 0, seed: 7 }
  const a = generateCandidate(p), b = generateCandidate(p)
  expect(a).toEqual(b)
  if (!a) return
  const flat = a.rows.join('')
  expect([...flat].filter((ch) => ch === 'g').length).toBe(4)
  expect([...flat].filter((ch) => ch === 'y').length).toBe(2)
  expect([...flat].filter((ch) => ch === 'r').length).toBe(3)
  expect([...flat].filter((ch) => ch === 'S').length).toBe(1)
  expect([...flat].filter((ch) => ch === 'E').length).toBe(1)
})

test('some seeds yield levels that pass validation (generator is productive)', () => {
  let found = 0
  for (let seed = 0; seed < 500 && found < 1; seed++) {
    const cand = generateCandidate({ size: 5, grays: 4, yellows: 2, budget: 1, reds: 3, mids: 0, seed })
    if (cand && validateLevel(cand).ok) found++
  }
  // Most random boards fail validation (usually a yellow-free route exists) — that is the
  // filter working. We only require that the generator finds SOME valid board in 500 seeds.
  expect(found).toBeGreaterThanOrEqual(1)
})

test('assess computes a positive difficulty from a solved benchmark', () => {
  const input = { size: 3, rows: ['Sy.', 'ry.', 'g.E'], yellowBudget: 1 }
  const res = solve(input)
  expect(res.kind).toBe('solved')
  if (res.kind !== 'solved') return
  const b = { grays: res.solution.grays, yellowsSpent: res.solution.yellowsSpent,
    pathLength: res.solution.path.length, path: res.solution.path }
  const a = assess(input, b, 1)
  expect(a.difficulty).toBeGreaterThan(0)
  expect(typeof a.interesting).toBe('boolean')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, cannot resolve `src/solver/generate`.

- [ ] **Step 3: Implement**

`src/solver/generate.ts`:
```ts
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

  const place = (ch: string, count: number): boolean => {
    for (let n = 0; n < count; n++) {
      let placed = false
      for (let i = 0; i < 100; i++) {
        const { r, c } = randCell()
        if (grid[r]![c] === '.') { grid[r]![c] = ch; placed = true; break }
      }
      if (!placed) return false
    }
    return true
  }
  if (!place('y', p.yellows) || !place('r', p.reds) || !place('g', p.grays) || !place('M', p.mids)) return null

  return { size: p.size, rows: grid.map((row) => row.join('')), yellowBudget: p.budget }
}
```

`src/solver/difficulty.ts`:
```ts
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
```

`src/solver/cli.ts`:
```ts
import { writeFileSync, mkdirSync } from 'node:fs'
import type { Level } from '../engine/types'
import { generateCandidate, type GenParams } from './generate'
import { validateLevel } from './validate'
import { assess } from './difficulty'

interface Tier { tier: number; count: number; params: Omit<GenParams, 'seed'> }

const TIERS: Tier[] = [
  { tier: 1, count: 10, params: { size: 5, grays: 5, yellows: 2, budget: 1, reds: 3, mids: 0 } },
  { tier: 2, count: 20, params: { size: 6, grays: 7, yellows: 3, budget: 2, reds: 6, mids: 0 } },
  { tier: 3, count: 20, params: { size: 7, grays: 9, yellows: 4, budget: 2, reds: 9, mids: 1 } },
  { tier: 4, count: 10, params: { size: 9, grays: 12, yellows: 5, budget: 2, reds: 14, mids: 2 } },
]
const DAILY = { count: 30, tier: 3, params: { size: 7, grays: 8, yellows: 4, budget: 2, reds: 8, mids: 1 } }

function generateBatch(tier: number, params: Omit<GenParams, 'seed'>, count: number, seedBase: number) {
  const out: { level: Omit<Level, 'id'>; difficulty: number }[] = []
  for (let seed = seedBase; out.length < count && seed < seedBase + 200_000; seed++) {
    const cand = generateCandidate({ ...params, seed })
    if (!cand) continue
    const rep = validateLevel(cand)
    if (!rep.ok || !rep.benchmark) continue
    const a = assess(cand, rep.benchmark, tier)
    if (!a.interesting) continue
    out.push({
      level: { size: cand.size, rows: cand.rows, yellowBudget: cand.yellowBudget, lives: 3,
        benchmark: rep.benchmark, difficulty: a.difficulty },
      difficulty: a.difficulty,
    })
  }
  if (out.length < count) throw new Error(`tier ${tier}: only ${out.length}/${count} survivors — loosen filters or raise seed range`)
  out.sort((x, y) => x.difficulty - y.difficulty)
  return out.map((o) => o.level)
}

const campaign: Level[] = []
TIERS.forEach((t, i) => {
  const batch = generateBatch(t.tier, t.params, t.count, (i + 1) * 1_000_000)
  batch.forEach((lvl) => campaign.push({ ...lvl, id: `c${String(campaign.length + 1).padStart(2, '0')}` }))
})
const daily: Level[] = generateBatch(DAILY.tier, DAILY.params, DAILY.count, 9_000_000)
  .map((lvl, i) => ({ ...lvl, id: `d${String(i + 1).padStart(2, '0')}` }))

mkdirSync('src/levels', { recursive: true })
writeFileSync('src/levels/levels.json', JSON.stringify({ campaign, daily }, null, 1))
console.log(`wrote ${campaign.length} campaign + ${daily.length} daily levels`)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/solver tests/solver
git commit -m "feat(solver): seeded generator, difficulty/interestingness, level CLI

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Generate the shipped levels + CI validation script

**Files:**
- Create: `src/levels/levels.json` (generated artifact), `scripts/validate-levels.ts`

**Interfaces:**
- Consumes: `npm run gen:levels` (Task 9), `validateLevel` (Task 8).
- Produces: `src/levels/levels.json` with `{ campaign: Level[60], daily: Level[30] }` — the data every game task loads.

- [ ] **Step 1: Generate**

Run: `npm run gen:levels`
Expected: `wrote 60 campaign + 30 daily levels`. If a tier throws "only N/count survivors", tune that tier's params in `cli.ts` (fewer reds or yellows usually raises the survival rate) and note the change in the commit message. Iterate until all tiers fill.

- [ ] **Step 2: Write the CI gate** (`scripts/validate-levels.ts`)

```ts
import { readFileSync } from 'node:fs'
import type { Level } from '../src/engine/types'
import { validateLevel } from '../src/solver/validate'

const data = JSON.parse(readFileSync('src/levels/levels.json', 'utf-8')) as { campaign: Level[]; daily: Level[] }
const all = [...data.campaign, ...data.daily]
if (data.campaign.length !== 60 || data.daily.length !== 30) {
  console.error(`bad counts: ${data.campaign.length} campaign, ${data.daily.length} daily`)
  process.exit(1)
}
let failed = 0
for (const lvl of all) {
  const rep = validateLevel({ size: lvl.size, rows: lvl.rows, yellowBudget: lvl.yellowBudget })
  if (!rep.ok) { console.error(`${lvl.id}: ${rep.reasons.join(', ')}`); failed++; continue }
  const b = rep.benchmark!
  if (b.grays !== lvl.benchmark.grays || b.yellowsSpent !== lvl.benchmark.yellowsSpent
      || b.pathLength !== lvl.benchmark.pathLength) {
    console.error(`${lvl.id}: benchmark drift (shipped ${JSON.stringify(lvl.benchmark)} vs ${JSON.stringify(b)})`)
    failed++
  }
}
if (failed) { console.error(`${failed} invalid levels`); process.exit(1) }
console.log(`all ${all.length} levels valid`)
```

- [ ] **Step 3: Validate**

Run: `npm run validate:levels`
Expected: `all 90 levels valid`.

- [ ] **Step 4: Commit**

```bash
git add src/levels/levels.json scripts/validate-levels.ts
git commit -m "feat(levels): generate shipped 60+30 levels with CI validation gate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Phaser boot + PlayScene (render, drag input, HUD, FX)

**Files:**
- Create: `src/game/main.ts`, `src/game/scenes/PlayScene.ts`, `src/game/analytics.ts` (stub used by scenes; full wiring in Task 14)

**Interfaces:**
- Consumes: `createRound`, `tryMove`, `effectiveKind`, `gradeRound`, `Level`, `RoundState`, `Pos`, levels JSON.
- Produces:
  - Scene key `'play'`, started with `this.scene.start('play', { level })` where `level: Level`.
  - `PlayScene.showBenchmark(): void` — draws the benchmark path (used by GradeOverlay's reveal).
  - `analytics.track(event, props?)` — no-op console stub for now.
- No unit tests for the Phaser layer — the engine is the tested surface. Verification is manual (steps below).

- [ ] **Step 1: Write the analytics stub** (`src/game/analytics.ts`)

```ts
export type EventName = 'level_start' | 'level_won' | 'level_lost' | 'reveal_used' | 'daily_start'

export function track(event: EventName, props: Record<string, string | number> = {}): void {
  const url = import.meta.env.VITE_ANALYTICS_URL as string | undefined
  const payload = JSON.stringify({ event, props, t: Date.now() })
  if (url) {
    try { navigator.sendBeacon(url, payload) } catch { /* never break the game for analytics */ }
  } else {
    console.debug('[analytics]', payload)
  }
}
```

- [ ] **Step 2: Write the boot** (`src/game/main.ts`)

```ts
import Phaser from 'phaser'
import PlayScene from './scenes/PlayScene'
import levels from '../levels/levels.json'

const first = (levels as { campaign: unknown[] }).campaign[0]

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#101018',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [PlayScene],
})
  .scene.start('play', { level: first })
// NOTE: Task 13 replaces this direct start with the LevelSelect scene.
```

- [ ] **Step 3: Write PlayScene** (`src/game/scenes/PlayScene.ts`)

```ts
import Phaser from 'phaser'
import { createRound, tryMove, effectiveKind } from '../../engine/round'
import { gradeRound } from '../../engine/grading'
import { samePos } from '../../engine/board'
import type { Level, Pos, RoundState } from '../../engine/types'
import { track } from '../analytics'

const C = {
  cellBg: 0x1b1b26, empty: 0x33334a, gray: 0x9aa0b4, yellow: 0xe8c34a,
  red: 0xe14b4b, green: 0x4be18a, mid: 0x4bd6e1, path: 0x4be18a, benchmark: 0xffffff,
}

export default class PlayScene extends Phaser.Scene {
  private level!: Level
  private round!: RoundState
  private g!: Phaser.GameObjects.Graphics
  private hud!: Phaser.GameObjects.Text
  private dragging = false
  private benchmarkShown = false

  constructor() { super('play') }

  init(data: { level: Level }) { this.level = data.level }

  create() {
    this.round = createRound(this.level)
    this.benchmarkShown = false
    this.g = this.add.graphics()
    this.hud = this.add.text(12, 10, '', { fontSize: '16px', color: '#cfd3e0', fontFamily: 'monospace' })
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragging = true; this.onPointer(p) })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (this.dragging) this.onPointer(p) })
    this.input.on('pointerup', () => { this.dragging = false })
    this.scale.on('resize', () => this.redraw())
    track('level_start', { id: this.level.id })
    this.redraw()
  }

  private layout() {
    const { width, height } = this.scale
    const size = this.level.size
    const cell = Math.floor(Math.min(width, height - 60) / (size + 1))
    const ox = Math.floor((width - cell * size) / 2)
    const oy = 50 + Math.floor((height - 50 - cell * size) / 2)
    return { cell, ox, oy, size }
  }

  private posAt(x: number, y: number): Pos | null {
    const { cell, ox, oy, size } = this.layout()
    const c = Math.floor((x - ox) / cell), r = Math.floor((y - oy) / cell)
    return r >= 0 && r < size && c >= 0 && c < size ? { r, c } : null
  }

  private center(p: Pos): [number, number] {
    const { cell, ox, oy } = this.layout()
    return [ox + p.c * cell + cell / 2, oy + p.r * cell + cell / 2]
  }

  private onPointer(pointer: Phaser.Input.Pointer) {
    const pos = this.posAt(pointer.x, pointer.y)
    if (!pos || this.round.status !== 'playing') return
    const tip = this.round.path[this.round.path.length - 1]!
    if (samePos(pos, tip)) return
    const res = tryMove(this.round, pos)
    if (res.kind === 'activated' && res.flipped) this.flipFx()
    if (res.kind === 'red-hit') this.cameras.main.shake(150, 0.01)
    if (res.kind === 'won') this.onWon()
    if (res.kind === 'lost') this.onLost()
    if (res.kind !== 'rejected') this.redraw()
  }

  private onWon() {
    const grade = gradeRound(this.round)
    track('level_won', { id: this.level.id, percent: grade.percent, stars: grade.stars })
    this.scene.launch('grade', { grade, level: this.level, playScene: this })
  }

  private onLost() {
    track('level_lost', { id: this.level.id })
    this.cameras.main.flash(300, 225, 75, 75)
    this.time.delayedCall(700, () => { this.scene.restart({ level: this.level } as never) })
  }

  private flipFx() { this.cameras.main.flash(250, 232, 195, 74) }

  showBenchmark() { this.benchmarkShown = true; this.redraw() }

  private redraw() {
    const { cell, ox, oy, size } = this.layout()
    const g = this.g
    g.clear()
    const dotR = Math.max(6, cell * 0.28)
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      const p = { r, c }
      g.fillStyle(C.cellBg, 1)
      g.fillRoundedRect(ox + c * cell + 2, oy + r * cell + 2, cell - 4, cell - 4, 6)
      const base = this.round.cells[r]![c]!
      const eff = effectiveKind(this.round, p)
      const activated = base === 'yellow' && eff === 'empty'
      const grayTaken = base === 'gray' && this.round.path.some((q) => samePos(q, p))
      const color =
        base === 'start' || base === 'exit' || activated ? C.green
        : base === 'mid' ? C.mid
        : eff === 'red' ? C.red
        : eff === 'yellow' ? C.yellow
        : base === 'gray' ? C.gray
        : C.empty
      const [x, y] = this.center(p)
      g.fillStyle(color, base === 'empty' ? 0.5 : grayTaken ? 0.35 : 1)
      g.fillCircle(x, y, base === 'empty' ? dotR * 0.4 : dotR)
      if (base === 'exit') { g.lineStyle(3, C.green, 1); g.strokeCircle(x, y, dotR + 5) }
    }
    // path
    if (this.round.path.length > 1) {
      g.lineStyle(Math.max(5, cell * 0.16), C.path, 0.9)
      g.beginPath()
      const [sx, sy] = this.center(this.round.path[0]!)
      g.moveTo(sx, sy)
      for (const p of this.round.path.slice(1)) { const [x, y] = this.center(p); g.lineTo(x, y) }
      g.strokePath()
    }
    // benchmark reveal
    if (this.benchmarkShown && this.level.benchmark.path.length > 1) {
      g.lineStyle(3, C.benchmark, 0.8)
      g.beginPath()
      const [bx, by] = this.center(this.level.benchmark.path[0]!)
      g.moveTo(bx, by)
      for (const p of this.level.benchmark.path.slice(1)) { const [x, y] = this.center(p); g.lineTo(x, y) }
      g.strokePath()
    }
    const doorsLeft = this.round.level.yellowBudget - this.round.yellowsUsed
    this.hud.setText(
      `${this.level.id}   lives ${'♥'.repeat(Math.max(0, this.round.lives))}   doors left ${doorsLeft}${this.round.flipped ? '  ⚠ FLIPPED' : ''}`)
  }
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open the printed localhost URL (and once on your phone via the network URL).
Checklist:
- Board renders centered; start/exit green, yellows yellow, reds red, grays gray.
- Drag from the green start draws the path; dragging back retracts it.
- Entering a yellow decrements "doors left"; when it hits 0 the screen flashes amber and remaining yellows turn red.
- Touching red shakes the camera, removes a heart, rewinds the path.
- Losing all hearts flashes red and restarts the level.
- Reaching the exit logs `level_won` in the console (grade overlay arrives in Task 12 — for now a console check is enough: the `scene.launch('grade', ...)` warning about a missing scene is expected and fine).

- [ ] **Step 5: Commit**

```bash
git add src/game
git commit -m "feat(game): Phaser board, drag input, HUD, flip/rewind FX

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Grade overlay, reveal tokens, storage

**Files:**
- Create: `src/game/scenes/GradeOverlay.ts`, `src/game/storage.ts`
- Modify: `src/game/main.ts` (register `GradeOverlay` in `scene: [...]`)
- Test: `tests/game/storage.test.ts`

**Interfaces:**
- Consumes: `Grade` (Task 6), `PlayScene.showBenchmark()` (Task 11).
- Produces:
```ts
// storage.ts — all functions synchronous over localStorage (in-memory fallback for tests/node)
export interface Progress { stars: Record<string, number>; best: Record<string, number>; revealTokens: number }
export function loadProgress(): Progress                       // defaults: {}, {}, 3 tokens
export function recordResult(id: string, percent: number, stars: number): Progress
  // keeps max stars/best %, grants +1 token on FIRST 3-star of a level
export function spendRevealToken(): boolean                    // false if none left
// GradeOverlay: scene key 'grade', launched with { grade, level, playScene }
```

- [ ] **Step 1: Write the failing tests** (`tests/game/storage.test.ts`)

```ts
import { test, expect, beforeEach } from 'vitest'
import { loadProgress, recordResult, spendRevealToken, __resetForTests } from '../../src/game/storage'

beforeEach(() => __resetForTests())

test('defaults: no stars, 3 reveal tokens', () => {
  const p = loadProgress()
  expect(p.revealTokens).toBe(3)
  expect(p.stars).toEqual({})
})

test('recordResult keeps best and grants a token on first 3-star only', () => {
  let p = recordResult('c01', 82, 2)
  expect(p.stars.c01).toBe(2)
  expect(p.revealTokens).toBe(3)
  p = recordResult('c01', 97, 3)
  expect(p.stars.c01).toBe(3)
  expect(p.best.c01).toBe(97)
  expect(p.revealTokens).toBe(4)     // first 3-star bonus
  p = recordResult('c01', 100, 3)
  expect(p.revealTokens).toBe(4)     // not granted twice
  expect(p.best.c01).toBe(100)
  p = recordResult('c01', 61, 1)
  expect(p.stars.c01).toBe(3)        // never regresses
  expect(p.best.c01).toBe(100)
})

test('spendRevealToken decrements and refuses at zero', () => {
  expect(spendRevealToken()).toBe(true)
  expect(spendRevealToken()).toBe(true)
  expect(spendRevealToken()).toBe(true)
  expect(spendRevealToken()).toBe(false)
  expect(loadProgress().revealTokens).toBe(0)
})
```

Also add `tests/game/**` is already matched by the vitest include glob (`tests/**/*.test.ts`) — no config change needed.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, cannot resolve `src/game/storage`.

- [ ] **Step 3: Implement**

`src/game/storage.ts`:
```ts
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
```

`src/game/scenes/GradeOverlay.ts`:
```ts
import Phaser from 'phaser'
import type { Grade } from '../../engine/grading'
import type { Level } from '../../engine/types'
import { loadProgress, recordResult, spendRevealToken } from '../storage'
import { track } from '../analytics'
import type PlayScene from './PlayScene'

export default class GradeOverlay extends Phaser.Scene {
  constructor() { super('grade') }

  create(data: { grade: Grade; level: Level; playScene: PlayScene }) {
    const { grade, level, playScene } = data
    recordResult(level.id, grade.percent, grade.stars)
    const { width, height } = this.scale
    const cx = width / 2

    this.add.rectangle(cx, height / 2, Math.min(360, width - 24), 260, 0x14141f, 0.95)
      .setStrokeStyle(2, 0x4be18a)
    this.add.text(cx, height / 2 - 100, `${grade.percent}%`, { fontSize: '48px', color: '#4be18a' }).setOrigin(0.5)
    this.add.text(cx, height / 2 - 55, '★'.repeat(grade.stars) + '☆'.repeat(3 - grade.stars),
      { fontSize: '32px', color: '#e8c34a' }).setOrigin(0.5)
    this.add.text(cx, height / 2 - 18, grade.hint, { fontSize: '14px', color: '#cfd3e0' }).setOrigin(0.5)

    const freeReveal = grade.percent >= 95
    const tokens = loadProgress().revealTokens
    const revealLabel = freeReveal ? 'Reveal best path (free)' : `Reveal best path (${tokens} left)`
    const mkButton = (y: number, label: string, onClick: () => void) =>
      this.add.text(cx, y, label, { fontSize: '18px', color: '#ffffff', backgroundColor: '#26263a', padding: { x: 12, y: 6 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', onClick)

    mkButton(height / 2 + 20, revealLabel, () => {
      if (freeReveal || spendRevealToken()) {
        track('reveal_used', { id: level.id })
        playScene.showBenchmark()
        this.scene.stop()
      }
    })
    mkButton(height / 2 + 62, 'Replay', () => { this.scene.stop(); playScene.scene.restart({ level } as never) })
    mkButton(height / 2 + 104, 'Level select', () => { this.scene.stop(); playScene.scene.stop(); this.scene.start('select') })
  }
}
```

In `src/game/main.ts`, change the scene list to `scene: [PlayScene, GradeOverlay]` (import it).

- [ ] **Step 4: Run tests + manual verification**

Run: `npm test` — Expected: storage tests pass.
Run: `npm run dev` — finish a level: overlay shows % / stars / hint; Reveal draws the white benchmark line (token count drops unless ≥95%); Replay restarts. ("Level select" errors until Task 13 — expected.)

- [ ] **Step 5: Commit**

```bash
git add src/game tests/game
git commit -m "feat(game): grade overlay, reveal tokens, progress storage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: Level select, unlock progression, daily level

**Files:**
- Create: `src/game/scenes/LevelSelect.ts`, `src/game/daily.ts`
- Modify: `src/game/main.ts` (register scene, boot into `'select'`)
- Test: `tests/game/daily.test.ts`

**Interfaces:**
- Consumes: levels JSON (`{ campaign, daily }`), `loadProgress`.
- Produces:
```ts
// daily.ts (pure — no Date.now() inside the selection logic)
export function todayKey(now: Date): number            // e.g. 20260719 (local time)
export function dailyIndex(dateKey: number, poolSize: number): number  // deterministic hash → [0, poolSize)
// LevelSelect: scene key 'select'; unlock rule: c01 unlocked; cN unlocked when c(N-1) has ≥1 star
```

- [ ] **Step 1: Write the failing tests** (`tests/game/daily.test.ts`)

```ts
import { test, expect } from 'vitest'
import { dailyIndex, todayKey } from '../../src/game/daily'

test('todayKey formats local date as YYYYMMDD', () => {
  expect(todayKey(new Date(2026, 6, 19))).toBe(20260719)  // month is 0-based: 6 = July
})

test('dailyIndex is deterministic and in range', () => {
  const i = dailyIndex(20260719, 30)
  expect(i).toBe(dailyIndex(20260719, 30))
  expect(i).toBeGreaterThanOrEqual(0)
  expect(i).toBeLessThan(30)
  // consecutive days should not all map to the same index
  const days = [20260719, 20260720, 20260721, 20260722]
  expect(new Set(days.map((d) => dailyIndex(d, 30))).size).toBeGreaterThan(1)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, cannot resolve `src/game/daily`.

- [ ] **Step 3: Implement**

`src/game/daily.ts`:
```ts
export function todayKey(now: Date): number {
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
}

export function dailyIndex(dateKey: number, poolSize: number): number {
  let x = dateKey >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  x = (x ^ (x >>> 16)) >>> 0
  return x % poolSize
}
```

`src/game/scenes/LevelSelect.ts`:
```ts
import Phaser from 'phaser'
import levelsJson from '../../levels/levels.json'
import type { Level } from '../../engine/types'
import { loadProgress } from '../storage'
import { dailyIndex, todayKey } from '../daily'
import { track } from '../analytics'

const data = levelsJson as unknown as { campaign: Level[]; daily: Level[] }

export default class LevelSelect extends Phaser.Scene {
  constructor() { super('select') }

  create() {
    const { width } = this.scale
    const progress = loadProgress()
    this.add.text(width / 2, 28, 'DOT CONNECT', { fontSize: '28px', color: '#4be18a' }).setOrigin(0.5)

    // Daily tile
    const idx = dailyIndex(todayKey(new Date()), data.daily.length)
    const dailyLevel = data.daily[idx]!
    this.add.text(width / 2, 70, `▶ Daily level (${new Date().toDateString()})`,
      { fontSize: '18px', color: '#e8c34a', backgroundColor: '#26263a', padding: { x: 10, y: 6 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { track('daily_start', { id: dailyLevel.id }); this.scene.start('play', { level: dailyLevel }) })

    // Campaign grid: 10 per row
    const cols = 10, cell = Math.min(56, (width - 24) / cols)
    data.campaign.forEach((level, i) => {
      const starsEarned = progress.stars[level.id] ?? 0
      const unlocked = i === 0 || (progress.stars[data.campaign[i - 1]!.id] ?? 0) >= 1
      const x = 12 + (i % cols) * cell + cell / 2
      const y = 120 + Math.floor(i / cols) * (cell + 14)
      const label = unlocked ? String(i + 1) : '🔒'
      const t = this.add.text(x, y, label, {
        fontSize: '18px', color: unlocked ? '#ffffff' : '#555566',
        backgroundColor: unlocked ? '#26263a' : '#1a1a24', padding: { x: 10, y: 8 },
      }).setOrigin(0.5)
      if (unlocked) t.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.scene.start('play', { level }))
      if (starsEarned > 0) this.add.text(x, y + 22, '★'.repeat(starsEarned),
        { fontSize: '10px', color: '#e8c34a' }).setOrigin(0.5)
    })
  }
}
```

`src/game/main.ts` (final form):
```ts
import Phaser from 'phaser'
import PlayScene from './scenes/PlayScene'
import GradeOverlay from './scenes/GradeOverlay'
import LevelSelect from './scenes/LevelSelect'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#101018',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [LevelSelect, PlayScene, GradeOverlay],  // first scene auto-starts
})
```

Also add a "back to levels" affordance in `PlayScene.create()` (top-right):
```ts
this.add.text(this.scale.width - 12, 10, '≡', { fontSize: '24px', color: '#cfd3e0' })
  .setOrigin(1, 0).setInteractive({ useHandCursor: true })
  .on('pointerdown', () => { this.scene.stop('grade'); this.scene.start('select') })
```

- [ ] **Step 4: Run tests + manual verification**

Run: `npm test` — Expected: all pass.
Run: `npm run dev` — level select shows the daily tile and the 60-level grid; only level 1 unlocked; earning ≥1 star unlocks level 2; stars display under completed tiles; daily plays.

- [ ] **Step 5: Commit**

```bash
git add src/game tests/game
git commit -m "feat(game): level select, unlock progression, daily level

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: Analytics wiring check + README

**Files:**
- Modify: none expected — `track()` calls were placed in Tasks 11–13 (`level_start`, `level_won`, `level_lost`, `reveal_used`, `daily_start`). This task verifies coverage and documents the project.
- Create: `README.md`

- [ ] **Step 1: Verify event coverage**

Run: `grep -rn "track(" src/game/ | sort`
Expected — exactly these five call sites:
- `PlayScene.create` → `level_start`
- `PlayScene.onWon` → `level_won` (with percent + stars)
- `PlayScene.onLost` → `level_lost`
- `GradeOverlay` reveal button → `reveal_used`
- `LevelSelect` daily tile → `daily_start`
If any are missing, add them per Tasks 11–13 code.

- [ ] **Step 2: Write README.md**

```markdown
# dot-connect-game

Grid path puzzle: draw one line from start to exit, grab optional gray dots,
avoid reds, and spend a tight budget of yellow "door" checkpoints — then get
graded against the solver's best-known path.

## Develop
- `npm install`
- `npm run dev`          # local play at the printed URL
- `npm test`             # engine + solver + game unit tests
- `npm run gen:levels`   # regenerate src/levels/levels.json (deterministic seeds)
- `npm run validate:levels`  # CI gate: re-verify every shipped level

## Analytics
Set `VITE_ANALYTICS_URL` at build time to POST gameplay events
(level_start/won/lost, reveal_used, daily_start) as JSON beacons; unset = console only.

## Deploy
Push to `main` → GitHub Actions runs tests + level validation, builds, and
publishes to GitHub Pages.

Design spec: `docs/superpowers/specs/2026-07-19-dot-connect-game-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README with dev/deploy/analytics instructions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 15: GitHub repo, CI, Pages deploy

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write the workflow** (`.github/workflows/deploy.yml`)

```yaml
name: deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run validate:levels
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Create the GitHub repo and push**

```bash
git branch -M main
gh repo create dot-connect-game --public --source . --push
```
(Public repo: free Pages, and the playtest link is public anyway. If you prefer private, GitHub Pages needs a paid plan.)

- [ ] **Step 3: Enable Pages and verify deploy**

```bash
gh api repos/{owner}/dot-connect-game/pages -X POST -f build_type=workflow || true
gh run watch
```
Expected: workflow green (tests + level validation + build), then the game is live at
`https://<owner>.github.io/dot-connect-game/`. Open it on your phone and play level 1 end-to-end.

- [ ] **Step 4: Commit any local changes and confirm clean tree**

```bash
git status --short   # expect empty
```

- [ ] **Step 5: Playtest gate (v1 exit criterion)**

Send the Pages URL to 5–10 friends. Success signals per the spec: ≥20 levels finished unprompted, somebody replays for 3 stars, somebody asks for more levels. Watch the analytics console/endpoint for level-level fail spikes to reorder the difficulty ramp (swap levels in `cli.ts` tiers and regenerate).

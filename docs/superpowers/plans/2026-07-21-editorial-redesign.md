# Daily Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin and re-animate the live Phaser game to match the finalized Daily Editorial design system (spec: `docs/superpowers/specs/2026-07-21-editorial-redesign-spec.md`).

**Architecture:** Pure additive infrastructure first (theme tokens, settings, synth sound, haptics — all plain TS modules with unit tests), then scene-by-scene rewrites that consume them. Engine (`src/engine/`) and solver are untouched. PlayScene moves from event-driven redraw to a per-frame `update()` render so the line head can spring and moments can animate.

**Tech Stack:** Phaser 3, TypeScript, Vite, vitest. No new dependencies, no binary assets (sounds are WebAudio-synthesized, icons are text glyphs / Graphics).

## Global Constraints

- Colors/typography/markings/motion timings: copy EXACTLY from the spec's tables — they are decided values, not suggestions.
- One hue one job. Green = start only. Exit = ink bullseye. Opened door = hollow + yellow ring. No monospace anywhere.
- Calm flip: no screen shake, no flash overlays anywhere in the game (delete `cameras.main.shake` and `flashOverlay`).
- No moment > 800ms; every sequence skippable by tap; respect `prefers-reduced-motion` (movement→fades).
- Engine API is frozen: `createRound/tryMove/effectiveKind/gradeRound` signatures must not change; `MoveResult` kinds are `moved|retracted|rejected|activated|red-hit|won|lost`.
- Existing mechanics preserved: reveal tokens, star recording, level unlock chain, daily selection, analytics events (plus existing `level_restart`).
- After every task: `npm test` and `npm run typecheck` green. Scene tasks additionally get a browser check on `npm run dev` (working agreement: play it before shipping).
- Commit messages: `feat(skin): …` / `feat(motion): …` etc., with the standard co-author trailer.

---

### Task 1: Theme tokens + settings + paper background

**Files:**
- Create: `src/game/theme.ts`
- Create: `src/game/settings.ts`
- Test: `tests/game/settings.test.ts`
- Modify: `src/game/main.ts` (backgroundColor)

**Interfaces:**
- Consumes: nothing.
- Produces: `C` (numeric colors for Phaser), `CS` (string colors for text), `F` (font families), `T` (timing tokens ms), `REDUCED` (boolean) from `theme.ts`; `getSound(): boolean`, `setSound(v: boolean)`, `getHaptics(): boolean`, `setHaptics(v: boolean)`, `__resetSettingsForTests()` from `settings.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/settings.test.ts
import { test, expect, beforeEach } from 'vitest'
import { getSound, setSound, getHaptics, setHaptics, __resetSettingsForTests } from '../../src/game/settings'

beforeEach(() => __resetSettingsForTests())

test('sound and haptics default to on', () => {
  expect(getSound()).toBe(true)
  expect(getHaptics()).toBe(true)
})

test('setters persist independently', () => {
  setSound(false)
  expect(getSound()).toBe(false)
  expect(getHaptics()).toBe(true)
  setHaptics(false)
  setSound(true)
  expect(getSound()).toBe(true)
  expect(getHaptics()).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/settings.test.ts`
Expected: FAIL — cannot resolve `../../src/game/settings`.

- [ ] **Step 3: Implement settings.ts and theme.ts**

```ts
// src/game/settings.ts — persisted user toggles (mirrors storage.ts fallback style)
interface Settings { sound: boolean; haptics: boolean }
const KEY = 'dot-connect-settings-v1'
let memory: string | null = null

function read(): Settings {
  let raw: string | null = null
  try { raw = globalThis.localStorage ? localStorage.getItem(KEY) : memory } catch { raw = memory }
  if (!raw) return { sound: true, haptics: true }
  try { return { sound: true, haptics: true, ...JSON.parse(raw) as Partial<Settings> } }
  catch { return { sound: true, haptics: true } }
}
function write(s: Settings): void {
  const v = JSON.stringify(s)
  try { if (globalThis.localStorage) localStorage.setItem(KEY, v); else memory = v } catch { memory = v }
}
export function __resetSettingsForTests(): void {
  memory = null
  try { globalThis.localStorage?.removeItem(KEY) } catch { /* ignore */ }
}
export const getSound = (): boolean => read().sound
export const getHaptics = (): boolean => read().haptics
export const setSound = (v: boolean): void => write({ ...read(), sound: v })
export const setHaptics = (v: boolean): void => write({ ...read(), haptics: v })
```

```ts
// src/game/theme.ts — the Daily Editorial design tokens (spec 2026-07-21). Values are decided.
export const C = {
  paper: 0xf3f1ed, card: 0xfffdf9, ink: 0x23211c, sub: 0x6b675f, hair: 0xe2ddd3,
  line: 0x3459e6, door: 0xeab63e, hazard: 0xd94f45, go: 0x2fa36b, loot: 0xa9a49b,
  emptyDot: 0xdcd7cd,
} as const
export const CS = {
  paper: '#f3f1ed', card: '#fffdf9', ink: '#23211c', sub: '#6b675f', hair: '#e2ddd3',
  line: '#3459e6', door: '#eab63e', hazard: '#d94f45', go: '#2fa36b', loot: '#a9a49b',
} as const
export const F = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
} as const
export const T = {
  pop: 140, lootFade: 200, doorDrain: 220, chipDip: 180,
  flipBeat: 250, flipStagger: 110, flipFade: 180, noteFade: 240,
  redPulse: 160, heartFade: 200, rewindPerCell: 60,
  sweep: 500, starStagger: 150, solvedFade: 300,
  introGroup: 140, introWithin: 45, introDot: 220, introLead: 150,
  unwind: 250, headSpringMs: 90,
} as const
export const REDUCED: boolean =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
```

- [ ] **Step 4: Point the game background at paper**

In `src/game/main.ts` change `backgroundColor: '#101018'` → `backgroundColor: '#f3f1ed'`.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/game/settings.test.ts && npm run typecheck`
Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add src/game/theme.ts src/game/settings.ts tests/game/settings.test.ts src/game/main.ts
git commit -m "feat(skin): editorial theme tokens, persisted sound/haptics settings, paper background"
```

---

### Task 2: Synth sound module

**Files:**
- Create: `src/game/sfx.ts`
- Test: `tests/game/sfx.test.ts`

**Interfaces:**
- Consumes: `getSound()` from `settings.ts`.
- Produces: `noteFreq(base: number, semitones: number): number`; `sfx` object with methods `tick(i: number)`, `tickDown(i: number)`, `pip()`, `clunk()`, `sealTick()`, `thud()`, `chord()`, `brush()` — all void, all safe in non-browser env (no AudioContext at import time).

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/sfx.test.ts
import { test, expect } from 'vitest'
import { noteFreq, sfx } from '../../src/game/sfx'

test('noteFreq walks the chromatic scale from a base', () => {
  expect(noteFreq(392, 0)).toBeCloseTo(392)
  expect(noteFreq(392, 12)).toBeCloseTo(784)   // one octave
  expect(noteFreq(440, 3)).toBeCloseTo(523.25, 1)
})

test('sfx methods are callable without an AudioContext (node env)', () => {
  expect(() => { sfx.tick(3); sfx.clunk(); sfx.chord() }).not.toThrow()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/sfx.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/game/sfx.ts — synthesized UI sound; no assets. Volumes stay whisper-quiet (≤ −18dB).
import { getSound } from './settings'

let ctx: AudioContext | null = null
function ac(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}
export function noteFreq(base: number, semitones: number): number {
  return base * Math.pow(2, semitones / 12)
}
function blip(freq: number, dur: number, type: OscillatorType, vol: number): void {
  if (!getSound()) return
  const a = ac(); if (!a) return
  const o = a.createOscillator(), g = a.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(vol, a.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
  o.connect(g).connect(a.destination)
  o.start(); o.stop(a.currentTime + dur + 0.02)
}
export const sfx = {
  tick: (i: number) => blip(noteFreq(392, i), 0.08, 'sine', 0.05),
  tickDown: (i: number) => blip(noteFreq(392, i), 0.07, 'sine', 0.04),
  pip: () => blip(988, 0.1, 'sine', 0.055),
  clunk: () => { blip(130, 0.16, 'triangle', 0.11); blip(98, 0.2, 'sine', 0.08) },
  sealTick: () => blip(220, 0.1, 'square', 0.03),
  thud: () => blip(90, 0.22, 'triangle', 0.12),
  chord: () => [523.25, 659.25, 784].forEach((f, i) => setTimeout(() => blip(f, 0.5, 'sine', 0.05), i * 70)),
  brush: () => { blip(300, 0.2, 'sine', 0.05); blip(200, 0.25, 'sine', 0.04) },
}
```

- [ ] **Step 4: Run tests + typecheck** — `npx vitest run tests/game/sfx.test.ts && npm run typecheck` → PASS.

- [ ] **Step 5: Commit** — `git add src/game/sfx.ts tests/game/sfx.test.ts && git commit -m "feat(motion): synthesized sfx module"`

---

### Task 3: Haptics module

**Files:**
- Create: `src/game/haptics.ts`
- Test: `tests/game/haptics.test.ts`

**Interfaces:**
- Consumes: `getHaptics()` from `settings.ts`.
- Produces: `haptic` object with `cell() intro() door() flip() red() win() restart()` — void, guarded, iOS-silent. (Capacitor later swaps the `buzz` internals only.)

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/haptics.test.ts
import { test, expect, vi, beforeEach } from 'vitest'
import { haptic } from '../../src/game/haptics'
import { setHaptics, __resetSettingsForTests } from '../../src/game/settings'

beforeEach(() => __resetSettingsForTests())

test('fires navigator.vibrate with the mapped pattern when enabled', () => {
  const vib = vi.fn()
  ;(globalThis as { navigator?: unknown }).navigator = { vibrate: vib }
  haptic.door()
  expect(vib).toHaveBeenCalledWith(25)
  haptic.flip()
  expect(vib).toHaveBeenCalledWith([30, 40, 30])
})

test('silent when disabled or when vibrate is missing', () => {
  const vib = vi.fn()
  ;(globalThis as { navigator?: unknown }).navigator = { vibrate: vib }
  setHaptics(false)
  haptic.red()
  expect(vib).not.toHaveBeenCalled()
  ;(globalThis as { navigator?: unknown }).navigator = {}
  setHaptics(true)
  expect(() => haptic.win()).not.toThrow()
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/game/haptics.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/game/haptics.ts — event-mapped vibration. Android web only today; iOS no-ops.
import { getHaptics } from './settings'

function buzz(pattern: number | number[]): void {
  if (!getHaptics()) return
  try {
    const nav = globalThis.navigator as Navigator | undefined
    nav?.vibrate?.(pattern)
  } catch { /* never break the game for haptics */ }
}
export const haptic = {
  cell: () => buzz(8),
  intro: () => buzz(8),
  door: () => buzz(25),
  flip: () => buzz([30, 40, 30]),
  red: () => buzz([60, 40, 60]),
  win: () => buzz([40, 60, 40, 60, 80]),
  restart: () => buzz(15),
}
```

- [ ] **Step 4: Run tests + typecheck** → PASS.
- [ ] **Step 5: Commit** — `git add src/game/haptics.ts tests/game/haptics.test.ts && git commit -m "feat(motion): haptics module with per-event map"`

---

### Task 4: PlayScene editorial board skin (static pass)

**Files:**
- Modify: `src/game/scenes/PlayScene.ts` (replace the `C` const at top and the whole `redraw()`; keep everything else working as-is)

**Interfaces:**
- Consumes: `C`, `T` from `theme.ts`; engine `effectiveKind`.
- Produces: private methods later tasks extend: `drawBoard(now: number)` (the new redraw), `drawDot(gx, gy, r, color, ring?, ringGap?)`. HUD/buttons unchanged in this task.

- [ ] **Step 1: Replace the color table and redraw with editorial rendering**

Delete the `const C = {…}` block at `PlayScene.ts:9-12` and import the theme instead:

```ts
import { C, CS, F, T, REDUCED } from '../theme'
```

Replace `redraw()` (currently the cell/dot/path/benchmark/HUD-text block) with:

```ts
private drawDot(x: number, y: number, r: number, color: number, ring?: number, ringGap = 4, ringAlpha = 1) {
  if (r < 0.4) return
  this.g.fillStyle(color, 1)
  this.g.fillCircle(x, y, r)
  if (ring !== undefined) {
    this.g.lineStyle(2.5, ring, ringAlpha)
    this.g.strokeCircle(x, y, r + ringGap)
  }
}

private redraw() {
  const { cell, ox, oy, size } = this.layout()
  const g = this.g
  g.clear()
  const dotR = Math.max(7, cell * 0.24)
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const p = { r, c }
    // card cell with a faux shadow (Phaser Graphics has no blur — offset ink at low alpha)
    g.fillStyle(C.ink, 0.06)
    g.fillRoundedRect(ox + c * cell + 3, oy + r * cell + 5, cell - 6, cell - 6, 11)
    g.fillStyle(C.card, 1)
    g.fillRoundedRect(ox + c * cell + 3, oy + r * cell + 3, cell - 6, cell - 6, 11)
    const base = this.round.cells[r]![c]!
    const eff = effectiveKind(this.round, p)
    const activated = base === 'yellow' && eff === 'empty'
    const grayTaken = base === 'gray' && this.round.path.some((q) => samePos(q, p))
    const [x, y] = this.center(p)
    if (base === 'start') this.drawDot(x, y, dotR, C.go)
    else if (base === 'exit') { this.drawDot(x, y, dotR * 0.32, C.ink); this.g.lineStyle(2.5, C.ink, 1); this.g.strokeCircle(x, y, dotR * 0.82) }
    else if (activated) this.drawDot(x, y, dotR * 0.75, C.paper, C.door, 3)
    else if (eff === 'yellow') this.drawDot(x, y, dotR, C.door, C.door, 4, 0.45)
    else if (eff === 'red') this.drawDot(x, y, dotR, C.hazard)
    else if (base === 'gray') { g.fillStyle(C.loot, grayTaken ? 0.4 : 1); g.fillCircle(x, y, dotR * 0.85) }
    else { g.fillStyle(C.emptyDot, 1); g.fillCircle(x, y, 3.5) }
  }
  // the line: blue with round joints (circle at every vertex)
  if (this.round.path.length > 1) {
    const w = Math.max(6, cell * 0.16)
    g.lineStyle(w, C.line, 1)
    g.beginPath()
    const [sx, sy] = this.center(this.round.path[0]!)
    g.moveTo(sx, sy)
    for (const p of this.round.path.slice(1)) { const [x, y] = this.center(p); g.lineTo(x, y) }
    g.strokePath()
    for (const p of this.round.path) { const [x, y] = this.center(p); g.fillStyle(C.line, 1); g.fillCircle(x, y, w / 2) }
  }
  // benchmark reveal: quiet ink line
  if (this.benchmarkShown && this.level.benchmark.path.length > 1) {
    g.lineStyle(3, C.ink, 0.35)
    g.beginPath()
    const [bx, by] = this.center(this.level.benchmark.path[0]!)
    g.moveTo(bx, by)
    for (const p of this.level.benchmark.path.slice(1)) { const [x, y] = this.center(p); g.lineTo(x, y) }
    g.strokePath()
  }
  const doorsLeft = this.round.level.yellowBudget - this.round.yellowsUsed
  this.hud.setText(`${this.level.id}   lives ${'♥'.repeat(Math.max(0, this.round.lives))}   doors left ${doorsLeft}${this.round.flipped ? '  DOORS SEALED' : ''}`)
}
```

Also update the old HUD text style (still at `create()`): change `fontFamily: 'monospace'` → `fontFamily: F.sans`, `color: '#cfd3e0'` → `color: CS.ink`; change the `'⌂ levels'` and `'↻ restart'` button styles to `color: CS.ink, backgroundColor: CS.card`. (Full HUD replacement is Task 5 — this keeps the interim readable on paper.)

- [ ] **Step 2: Typecheck + tests** — `npm run typecheck && npm test` → clean, 47 tests pass (44 + Task 1-3 additions).

- [ ] **Step 3: Browser check**

Run `npm run dev`, open a level. Verify against the spec: paper bg, white card cells, green start, ink bullseye exit, yellow ringed doors, entering a door leaves a hollow yellow ring, flip turns other doors plain red, line is blue with round joints, reveal shows a quiet ink line.

- [ ] **Step 4: Commit** — `git commit -am "feat(skin): editorial board rendering with decided marking system"`

---

### Task 5: Play HUD + thumb-zone buttons

**Files:**
- Modify: `src/game/scenes/PlayScene.ts` (`create()` HUD/button section and `layout()`)

**Interfaces:**
- Consumes: theme tokens; `track` analytics.
- Produces: fields `hudLevel/hudHearts/hudChipDot/hudChipText: Phaser.GameObjects.*`, `noteText: Phaser.GameObjects.Text`, method `syncHud()` (replaces the old `hud.setText` line — later tasks call it after every state change), method `iconButton(x, y, glyph, onTap): Phaser.GameObjects.Container`.

- [ ] **Step 1: Replace the HUD text + top-right buttons**

Delete the `this.hud = this.add.text(…)` block, the `'⌂ levels'` and `'↻ restart'` buttons in `create()`. Add:

```ts
private buildHud() {
  const { width, height } = this.scale
  const fs = width < 520 ? 15 : 17
  this.hudLevel = this.add.text(18, 14, `No. ${this.level.id.replace(/^\D+0?/, '')}`, {
    fontFamily: F.serif, fontStyle: 'italic', fontSize: `${fs}px`, color: CS.ink, resolution: TEXT_RESOLUTION,
  })
  this.hudHearts = this.add.text(width / 2, 14, '', { fontSize: `${fs - 2}px`, color: CS.hazard, resolution: TEXT_RESOLUTION }).setOrigin(0.5, 0)
  // chip: hairline pill + yellow ringed dot + count
  const chipX = width - 18
  this.hudChipText = this.add.text(chipX, 15, '× 0', { fontFamily: F.sans, fontSize: `${fs - 4}px`, fontStyle: 'bold', color: CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(1, 0)
  this.hudChipDot = this.add.graphics()
  this.hudRule = this.add.graphics()
  this.hudRule.lineStyle(1, C.hair, 1).lineBetween(0, 44, width, 44)
  this.noteText = this.add.text(width / 2, height - 96, 'DOORS SEALED', {
    fontFamily: F.sans, fontSize: '12px', color: CS.sub, resolution: TEXT_RESOLUTION, letterSpacing: 2,
  }).setOrigin(0.5).setAlpha(0)
  // thumb bar: ? ⌂ ↻
  const by = height - 44
  this.iconButton(46, by, '?', () => this.scene.start('help', { next: 'play', nextData: { level: this.level } }))
  this.iconButton(width / 2, by, '⌂', () => { this.scene.stop('grade'); this.scene.start('select') })
  this.iconButton(width - 46, by, '↻', () => {
    if (this.round.status !== 'playing') return
    track('level_restart', { id: this.level.id })
    sfx.brush(); haptic.restart()
    this.scene.restart({ level: this.level } as never)
  })
  this.syncHud()
}

private iconButton(x: number, y: number, glyph: string, onTap: () => void) {
  const circle = this.add.circle(x, y, 22, C.card).setStrokeStyle(1, C.hair)
  const label = this.add.text(x, y, glyph, { fontFamily: F.sans, fontSize: '18px', color: CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
  circle.setInteractive({ useHandCursor: true }).on('pointerdown', onTap)
  return this.add.container(0, 0, [circle, label])
}

private syncHud() {
  const lives = Math.max(0, this.round.lives)
  this.hudHearts.setText('♥'.repeat(lives) + '♡'.repeat(this.round.level.lives - lives))
  const left = this.round.level.yellowBudget - this.round.yellowsUsed
  this.hudChipText.setText(`× ${Math.max(0, left)}`)
  const dotX = this.hudChipText.getBounds().left - 14, dotY = 15 + this.hudChipText.height / 2
  this.hudChipDot.clear()
  this.hudChipDot.fillStyle(C.door, 1).fillCircle(dotX, dotY, 5.5)
  this.hudChipDot.lineStyle(2, C.door, 0.45).strokeCircle(dotX, dotY, 8)
  this.noteText.setAlpha(this.round.flipped ? 1 : 0)
}
```

Call `this.buildHud()` in `create()` where the old HUD was built; replace the `this.hud.setText(…)` line at the end of `redraw()` with `this.syncHud()`. Update `layout()` top offset from `50` to `56` and bottom margin: `cell = Math.floor(Math.min(width - 28, height - 160) / (size + 1))`, `oy = 56 + Math.floor((height - 146 - cell * size) / 2)` so the board centers between banner and thumb bar. Add imports `sfx`, `haptic`. HowToPlay's `next: 'play'` path already works (`HowToPlay.ts:59` starts `play` with `nextData`).

- [ ] **Step 2: Typecheck + tests** → clean.
- [ ] **Step 3: Browser check** — banner shows *No. 7*-style serif label, hearts, yellow-dot chip that stays yellow at × 0; three circle buttons in the thumb zone; restart still works and fires `level_restart`; flip shows the quiet DOORS SEALED note.
- [ ] **Step 4: Commit** — `git commit -am "feat(skin): editorial play HUD with yellow-dot chip and thumb-zone buttons"`

---

### Task 6: Line feel — per-frame update, springing head, cell pops, per-cell sound/haptics

**Files:**
- Modify: `src/game/scenes/PlayScene.ts`

**Interfaces:**
- Consumes: `sfx`, `haptic`, `T`, `REDUCED`.
- Produces: fields `headX/headY` (visual head), `pops: Map<string, number>` (cellKey→t0), `nudge: {dx,dy,t0}|null`; Phaser `update(time, delta)` that calls `this.redraw(time)`; `redraw` gains a `now` param.

- [ ] **Step 1: Add per-frame rendering + animated head**

In `create()`, after `this.round = createRound(...)`: initialize `const [hx, hy] = this.center(this.round.path[0]!); this.headX = hx; this.headY = hy; this.pops = new Map()`.

Add the scene method:

```ts
update(time: number, delta: number) {
  const tip = this.round.path[this.round.path.length - 1]!
  const [tx, ty] = this.center(tip)
  const k = REDUCED ? 1 : 1 - Math.exp(-delta / T.headSpringMs)
  this.headX += (tx - this.headX) * k
  this.headY += (ty - this.headY) * k
  this.redraw(time)
}
```

In `redraw(now: number)`: cell pop — before drawing each cell rect, check `const popT0 = this.pops.get(r + ',' + c)`; if set and `now - popT0 < T.pop`, scale the rect: `const s = 1 + 0.06 * Math.sin(Math.PI * (now - popT0) / T.pop)` and draw the card rect with `w = (cell-6)*s` centered; delete map entries older than `T.pop`. Line drawing — stroke vertices only up to the second-to-last point, then `lineTo(this.headX, this.headY)` and draw the head cap circle at `(headX, headY)`; this makes the head glide while the logical path stays engine-exact.

In `onPointer`, after `const res = tryMove(this.round, pos)`:

```ts
if (res.kind === 'moved' || res.kind === 'activated') {
  this.pops.set(pos.r + ',' + pos.c, this.time.now)
  sfx.tick(this.round.path.length); haptic.cell()
}
if (res.kind === 'retracted') sfx.tickDown(this.round.path.length)
if (res.kind === 'rejected' && res.reason === 'not-adjacent') { /* silent */ }
if (res.kind === 'rejected' && res.reason === 'visited') {
  // 3px rubber-band on the visual head toward the refused cell
  const [rx, ry] = this.center(pos); const d = Math.hypot(rx - this.headX, ry - this.headY) || 1
  this.headX += 3 * (rx - this.headX) / d; this.headY += 3 * (ry - this.headY) / d
}
```

Remove all direct `this.redraw()` calls from `onPointer` (the update loop renders every frame now); keep the `resize` handler but have it only re-place HUD objects.

- [ ] **Step 2: Typecheck + tests** → clean.
- [ ] **Step 3: Browser check** — drawing feels fluid: head glides behind the finger (never teleports), cells pop softly, rising ticks while drawing and falling on retract. No regressions on win/lose.
- [ ] **Step 4: Commit** — `git commit -am "feat(motion): springing line head, cell pops, per-cell sound and haptics"`

---

### Task 7: Moment sequences — intro, door drain, calm flip, red rewind, restart (delete shake/flash)

**Files:**
- Modify: `src/game/scenes/PlayScene.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: fields `doorDrains: Map<string, number>`, `flipFades: Map<string, number>`, `redPulse: {key: string, t0: number}|null`, `rewindAnim: {cells: Pos[], t0: number}|null`, `intro: {t0: number}|null`, `inputLocked: boolean`; module-level `let dramaCount = 0` (session decay counter).

- [ ] **Step 1: Delete the alarm grammar**

Remove `flipFx()`, `flashOverlay()`, and the `cameras.main.shake` call in `onPointer` (`PlayScene.ts:83` today). Remove the red flash in `onLost()` (keep the delayed scene restart).

- [ ] **Step 2: Level intro**

In `create()` after `buildHud()`:

```ts
this.intro = { t0: this.time.now + T.introLead }
this.inputLocked = true
const groups = [findCells(this.round.cells, 'gray'), findCells(this.round.cells, 'red'),
  findCells(this.round.cells, 'yellow'),
  [...findCells(this.round.cells, 'start'), ...findCells(this.round.cells, 'exit')]]
this.introDelay = new Map<string, number>()
groups.forEach((g, gi) => g.forEach((p, i) => this.introDelay.set(p.r + ',' + p.c, gi * T.introGroup + i * T.introWithin)))
groups.forEach((_, gi) => this.time.delayedCall(T.introLead + gi * T.introGroup, () => { sfx.tick(gi * 4); haptic.intro() }))
const total = T.introLead + 3 * T.introGroup + T.introWithin + T.introDot
this.time.delayedCall(total, () => { this.intro = null; this.inputLocked = false })
this.input.once('pointerdown', () => { this.intro = null; this.inputLocked = false }) // tap skips
```

In `redraw`, per colored dot compute `iScale`: 1 when `intro` null; else `t = (now - intro.t0 - delay)/T.introDot` clamped, `REDUCED ? t : backOut(t)` (add `const backOut = (t:number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t-1)**3 + c1 * (t-1)**2 }` helper at module top), multiply the dot radius. Guard `onPointer` with `if (this.inputLocked) return`.

- [ ] **Step 3: Door drain + chip dip + calm flip**

In `onPointer`, `res.kind === 'activated'`:

```ts
this.doorDrains.set(pos.r + ',' + pos.c, this.time.now)
sfx.clunk(); haptic.door()
this.tweens.add({ targets: this.hudChipText, y: '+=3', duration: T.chipDip / 2, yoyo: true, ease: 'Cubic.easeOut' })
if (res.flipped) {
  dramaCount++
  const beat = dramaCount <= 3 ? T.flipBeat : 0
  const stagger = dramaCount <= 3 ? T.flipStagger : T.flipStagger / 2
  const remaining = findCells(this.round.cells, 'yellow')
    .filter((y) => !this.round.activatedYellows.some((a) => samePos(a, y)))
  haptic.flip()
  remaining.forEach((y, i) => this.time.delayedCall(beat + i * stagger, () => {
    this.flipFades.set(y.r + ',' + y.c, this.time.now); sfx.sealTick()
  }))
  this.time.delayedCall(beat + remaining.length * stagger + T.flipFade, () =>
    this.tweens.add({ targets: this.noteText, alpha: 1, duration: T.noteFade }))
}
```

Rendering: an activated door with drain t0 crossfades fill `door→paper` and shrinks radius `1→0.8` over `T.doorDrain` (Phaser has no color-mix helper for Graphics fills — precompute with `Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(0xea, 0xb6, 0x3e), new Phaser.Display.Color(0xf3, 0xf1, 0xed), 100, t*100)` and `Phaser.Display.Color.GetColor`). A flipped door with a fade t0 crossfades `door→hazard` the same way, ring alpha `0.45→0` — after the fade it renders exactly like a red (the existing `effectiveKind` already reports `red`; the map only drives the 180ms transition). `syncHud()`'s note line changes to no-op (the tween owns noteText alpha now); reset `noteText.alpha = 0` on scene restart.

- [ ] **Step 4: Red hit — pulse, heart fade, animated rewind**

In `onPointer`, replace the shake line for `res.kind === 'red-hit'`:

```ts
sfx.thud(); haptic.red()
this.redPulse = { key: pos.r + ',' + pos.c, t0: this.time.now }
// animate the path the engine already truncated: replay the removed cells backwards
const removed = this.prePathSnapshot.slice(this.round.path.length) // snapshot taken before tryMove
this.rewindAnim = { cells: removed, t0: this.time.now }
this.inputLocked = true
removed.forEach((_, i) => this.time.delayedCall(i * T.rewindPerCell, () => sfx.tickDown(removed.length - i)))
this.time.delayedCall(removed.length * T.rewindPerCell, () => { this.rewindAnim = null; this.inputLocked = false })
```

Take `this.prePathSnapshot = [...this.round.path]` at the top of `onPointer` before `tryMove`. Rendering: while `rewindAnim` is active, draw the line as `round.path + the not-yet-consumed tail of rewindAnim.cells` (consume one cell per `T.rewindPerCell` elapsed), so the line visibly retreats; `redPulse` scales that red dot `×(1 + 0.15·sin(π·t/T.redPulse))` for one pulse. Hearts: `syncHud()` already swaps ♥→♡; wrap the heart text change in a 200ms alpha dip tween for the fade feel.

- [ ] **Step 5: Won/lost hooks**

`onWon()`: play the sweep before launching the overlay —

```ts
private onWon() {
  const grade = gradeRound(this.round)
  track('level_won', { id: this.level.id, percent: grade.percent, stars: grade.stars })
  sfx.chord(); haptic.win()
  this.sweep = { t0: this.time.now }
  this.time.delayedCall(T.sweep, () => this.scene.launch('grade', { grade, level: this.level, playScene: this }))
}
```

Rendering: while `sweep` active, overdraw the path with a white 0.75-alpha segment of length ~1.6 cells whose head travels `t/T.sweep` along the full path (same polyline interpolation as the head). `onLost()` keeps the 700ms delayed restart, no flash.

- [ ] **Step 6: Typecheck + tests + browser check**

`npm run typecheck && npm test` clean. In the browser verify each moment against the spec table: intro order and skip-on-tap; door drain leaves hollow ring; flip is calm and sequential with the note; red hit pulses + audibly rewinds; win sweeps then grades; 4th flip of a session is snappier (decay).

- [ ] **Step 7: Commit** — `git commit -am "feat(motion): level intro, door drain, calm flip, animated rewind, win sweep; remove shake/flash"`

---

### Task 8: GradeOverlay → editorial win card

**Files:**
- Modify: `src/game/scenes/GradeOverlay.ts` (full rewrite of `create()`; keep `recordResult`/reveal-token logic)

**Interfaces:**
- Consumes: theme, `sfx`, `T`; `Grade` (has `percent, stars, graysCovered, hint`); `level.benchmark` for loot total; existing `playScene.showBenchmark()`.
- Produces: same scene key `'grade'`, same launch data shape — PlayScene needs no changes.

- [ ] **Step 1: Rewrite create()**

```ts
create(data: { grade: Grade; level: Level; playScene: PlayScene }) {
  const { grade, level, playScene } = data
  recordResult(level.id, grade.percent, grade.stars)
  const { width, height } = this.scale
  const cx = width / 2
  this.add.rectangle(0, 0, width * 2, height * 2, C.paper, 1).setOrigin(0)  // full paper takeover
  // stars stamp in
  const starY = height * 0.16
  for (let i = 0; i < 3; i++) {
    const earned = i < grade.stars
    const star = this.add.text(cx + (i - 1) * 44, starY, earned ? '★' : '☆', {
      fontSize: '34px', color: earned ? CS.door : CS.hair, resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5).setScale(0.4).setAlpha(0)
    this.time.delayedCall(i * T.starStagger, () => {
      this.tweens.add({ targets: star, alpha: 1, scale: 1, duration: 240, ease: 'Back.easeOut' })
      if (earned) sfx.tick(8 + i * 2)
    })
  }
  const solved = this.add.text(cx, starY + 58, 'Solved.', { fontFamily: F.serif, fontSize: '34px', color: CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(0.5).setAlpha(0)
  this.tweens.add({ targets: solved, alpha: 1, duration: T.solvedFade, delay: 3 * T.starStagger })
  this.add.text(cx, starY + 92, `${grade.percent}% of the best-known route`, { fontFamily: F.sans, fontSize: '14px', color: CS.sub, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
  this.add.text(cx, starY + 112, `${grade.graysCovered} of ${level.benchmark.grays} loot · ${grade.hint}`, { fontFamily: F.sans, fontSize: '12px', color: CS.sub, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
  // route thumbnail: framed card with the player's path
  this.drawThumbnail(cx, starY + 210, Math.min(170, width * 0.45), playScene)
  // buttons
  const pill = (y: number, label: string, primary: boolean, onTap: () => void) => {
    const w = Math.min(300, width - 52)
    const bg = this.add.rectangle(cx, y, w, 44, primary ? C.ink : C.card).setStrokeStyle(1, primary ? C.ink : C.hair)
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', onTap)
    this.add.text(cx, y, label, { fontFamily: F.sans, fontSize: '15px', fontStyle: 'bold', color: primary ? CS.paper : CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
  }
  const freeReveal = grade.percent >= 95
  const tokens = loadProgress().revealTokens
  pill(height - 168, 'Next puzzle', true, () => { this.scene.stop(); playScene.scene.stop(); this.scene.start('select') })
  pill(height - 116, freeReveal ? 'Reveal best path (free)' : `Reveal best path (${tokens} left)`, false, () => {
    if (freeReveal || spendRevealToken()) { track('reveal_used', { id: level.id }); playScene.showBenchmark(); this.scene.stop() }
  })
  pill(height - 64, 'Replay', false, () => { this.scene.stop(); playScene.scene.restart({ level } as never) })
}
```

`drawThumbnail` renders a rounded card rect (`C.card`, hair stroke) and inside it a miniature of the final board: reuse the same dot/line drawing logic at `cellMini = size / level.size` scale by reading `playScene`'s round via a new tiny accessor on PlayScene: `getRound(): RoundState { return this.round }` (one-line addition to `PlayScene.ts`). "Next puzzle" goes to level select (the unlock chain highlights the next level) — no auto-advance logic in v1.

- [ ] **Step 2: Typecheck + tests + browser check** — win a level: paper takeover, stars stamp with sound, Solved. serif, loot substat correct, thumbnail shows your route, all three buttons work, reveal tokens still decrement.
- [ ] **Step 3: Commit** — `git commit -am "feat(skin): editorial win card with star stamps and route thumbnail"`

---

### Task 9: LevelSelect → editorial home (masthead, daily card, tiles, settings popup)

**Files:**
- Modify: `src/game/scenes/LevelSelect.ts` (full rewrite of `create()`)

**Interfaces:**
- Consumes: theme, `getSound/setSound/getHaptics/setHaptics`; existing `loadProgress`, `dailyIndex/todayKey`, `track`.
- Produces: same scene key `'select'`; first-run help redirect preserved.

- [ ] **Step 1: Rewrite create()**

Layout (all centered on `cx = width/2`, `narrow = width < 520`):

```ts
// masthead
this.add.rectangle(cx, 30, 46, 2, C.ink)
this.add.text(cx, 52, 'Dot Connect', { fontFamily: F.serif, fontSize: narrow ? '24px' : '28px', color: CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
const date = new Date()
this.add.text(cx, 78, date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase(),
  { fontFamily: F.sans, fontSize: '11px', color: CS.sub, letterSpacing: 2, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
// daily card
const cardW = Math.min(360, width - 36)
const daily = this.add.rectangle(cx, 122, cardW, 58, C.card).setStrokeStyle(1, C.hair)
this.add.circle(cx - cardW / 2 + 32, 122, 17, C.line)
this.add.text(cx - cardW / 2 + 58, 112, "Today's puzzle", { fontFamily: F.serif, fontSize: '15px', color: CS.ink, resolution: TEXT_RESOLUTION })
this.add.text(cx - cardW / 2 + 58, 131, 'A fresh line, once a day', { fontFamily: F.sans, fontSize: '12px', color: CS.sub, resolution: TEXT_RESOLUTION })
this.add.text(cx + cardW / 2 - 22, 122, '→', { fontSize: '18px', color: CS.line, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
daily.setInteractive({ useHandCursor: true }).on('pointerdown', () => { track('daily_start', { id: dailyLevel.id }); this.scene.start('play', { level: dailyLevel }) })
// campaign eyebrow + 4-col tile grid
this.add.text(20, 164, 'CAMPAIGN', { fontFamily: F.sans, fontSize: '11px', color: CS.sub, letterSpacing: 2, resolution: TEXT_RESOLUTION })
const cols = narrow ? 4 : 8
const tile = Math.min(72, (Math.min(width, 520) - 20 - (cols - 1) * 10) / cols)
data.campaign.forEach((level, i) => {
  const x = cx - ((cols * tile + (cols - 1) * 10) / 2) + (i % cols) * (tile + 10) + tile / 2
  const y = 196 + Math.floor(i / cols) * (tile + 10) + tile / 2
  const starsEarned = progress.stars[level.id] ?? 0
  const unlocked = i === 0 || (progress.stars[data.campaign[i - 1]!.id] ?? 0) >= 1
  const isNext = unlocked && starsEarned === 0
  const rect = this.add.rectangle(x, y, tile, tile, C.card).setStrokeStyle(isNext ? 1.5 : 1, isNext ? C.line : C.hair)
  if (!unlocked) rect.setAlpha(0.45)
  this.add.text(x, y - (starsEarned ? 6 : 0), unlocked ? String(i + 1) : '🔒', {
    fontFamily: F.sans, fontSize: '15px', fontStyle: unlocked ? 'bold' : 'normal',
    color: isNext ? CS.line : unlocked ? CS.ink : CS.sub, resolution: TEXT_RESOLUTION,
  }).setOrigin(0.5).setAlpha(unlocked ? 1 : 0.6)
  if (starsEarned > 0) this.add.text(x, y + 12, '★'.repeat(starsEarned) + '☆'.repeat(3 - starsEarned),
    { fontSize: '9px', color: CS.door, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
  if (unlocked) rect.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('play', { level }))
})
```

Bottom-right cluster: reuse the `iconButton` pattern from Task 5 (duplicate the 8-line helper locally — scenes stay self-contained): `?` opens help; `⚙` toggles a small settings popup — a card rectangle (200×96) above the button with two rows, each `sound  [on/off]` / `vibration  [on/off]` as interactive texts that flip `setSound/setHaptics` and update their own label; tapping outside (a full-screen transparent zone behind the popup) closes it.

Keep the daily-level lookup, first-run help redirect (`dot-connect-seen-help-v1` block), and analytics exactly as today.

- [ ] **Step 2: Typecheck + tests + browser check** — masthead + date render; daily card starts the daily; tiles unlock-chain correctly with stars; current level has the blue border; settings toggles persist across reload (check `localStorage['dot-connect-settings-v1']`).
- [ ] **Step 3: Commit** — `git commit -am "feat(skin): editorial home with masthead, daily card, tile grid, settings popup"`

---

### Task 10: HowToPlay → dot glossary

**Files:**
- Modify: `src/game/scenes/HowToPlay.ts` (replace the rules text block)

**Interfaces:**
- Consumes: theme tokens. Same scene key/data contract (`{ next, nextData }`).

- [ ] **Step 1: Replace the monospace wall of text**

Paper background (`C.paper` rectangle), serif title `How to play` (22px ink), sub-line `One line, start to exit. Your trail is a wall.` (12.5px sub). Then five glossary rows starting y≈150, each 62px tall with a hairline rule between: a 13px-radius Graphics dot on the left (36px from left margin) and two texts (term 13px bold ink; description 12.5px sub, wordWrapped to `min(430, width-110)`):

| dot | term | description |
|---|---|---|
| green solid | Start & exit | Draw from the green dot to the ink ring. Drag back to undo — always free. |
| gray solid | Loot | Never needed to finish — but most of your score. Grab what your route allows; every one is usually impossible. |
| yellow + ring | Doors | Entering one spends a door point, permanently — the door goes hollow and stays open. Spend your last and every other door turns red. |
| red solid | Hazards | Cost a life and rewind you to your last door. A fresh start is always free: ↻. |
| ink bullseye | The grade | Every win is scored against the best-known route. 60% ★ · 80% ★★ · 95% ★★★. |

Draw the exit bullseye for row 5 exactly like the board: small ink dot + ink ring. Bottom: ink pill button `Got it — play` (rectangle `C.ink`, paper text, same pill helper as Task 8) preserving the existing `data.next` navigation.

- [ ] **Step 2: Typecheck + tests + browser check** — glossary legible on a narrow window (390px); button navigates to select and to play (from the play scene's ? button).
- [ ] **Step 3: Commit** — `git commit -am "feat(skin): how-to-play dot glossary"`

---

### Task 11: Final sweep — reduced motion audit, full verification, deploy

**Files:**
- Modify: whichever files the audit flags (expected: none-to-small)

- [ ] **Step 1: Reduced-motion audit** — grep every `tweens.add` / `delayedCall` added by Tasks 6-10; each movement tween must degrade under `REDUCED` (fade instead of move/scale; durations kept). Fix inline where missed.
- [ ] **Step 2: Full checks** — `npm test && npm run typecheck && npm run validate:levels` → all green.
- [ ] **Step 3: Full browser playtest** (the working agreement) — on `npm run dev`, complete one full level start-to-3-stars and one full fail (lives out), plus: intro plays once and is tap-skippable; door/flip/red/win moments match the spec table; win card buttons all navigate; home tiles/daily/settings/help all navigate; sound + vibration toggles silence the right things; layout holds at 390×844 (phone) and desktop.
- [ ] **Step 4: Commit anything from the audit, push, watch CI** —

```bash
git push && gh run watch --exit-status $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: deploy green; then verify the live site on a phone.

---

## Self-review notes

- Spec coverage: palette/typography → T1+T4+T5; markings → T4; play layout → T5; motion table rows map: intro→T7, draw/retract/illegal/loot→T6 (loot fade uses existing `grayTaken` alpha — the 200ms fade rides the card-pop map pattern), door/flip/red/restart→T7, win→T7+T8; win card→T8; home→T9; glossary→T10; sound infra→T2; haptics→T3; settings/toggles→T1+T9; decay→T7 (`dramaCount`); reduced motion→T1 token + T11 audit; no-shake→T7 step 1.
- Types: `Grade.graysCovered` exists (`grading.ts:3`); `level.benchmark.grays` exists (`types.ts` Benchmark); `findCells/samePos` imported from `engine/board` in PlayScene already.
- Out of scope (per spec): Capacitor, share-image generation, music.

import Phaser from 'phaser'
import { createRound, tryMove, effectiveKind } from '../../engine/round'
import { gradeRound } from '../../engine/grading'
import { samePos, findCells } from '../../engine/board'
import type { Level, Pos, RoundState } from '../../engine/types'
import { track } from '../analytics'
import { TEXT_RESOLUTION } from '../ui'
import { C, CS, F, T, REDUCED } from '../theme'
import { sfx } from '../sfx'
import { haptic } from '../haptics'

// session decay: the drama of a flip sequence eases off after the first few
let dramaCount = 0

const backOut = (t: number): number => {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

const doorColor = new Phaser.Display.Color(0xea, 0xb6, 0x3e)
const paperColor = new Phaser.Display.Color(0xf3, 0xf1, 0xed)
const hazardColor = new Phaser.Display.Color(0xd9, 0x4f, 0x45)

function mixColor(a: Phaser.Display.Color, b: Phaser.Display.Color, t: number): number {
  const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, t * 100)
  return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b)
}

export default class PlayScene extends Phaser.Scene {
  private level!: Level
  private round!: RoundState
  private g!: Phaser.GameObjects.Graphics
  private hudLevel!: Phaser.GameObjects.Text
  private hudHearts!: Phaser.GameObjects.Text
  private hudChipText!: Phaser.GameObjects.Text
  private hudChipDot!: Phaser.GameObjects.Graphics
  private hudRule!: Phaser.GameObjects.Graphics
  private noteText!: Phaser.GameObjects.Text
  private dragging = false
  private benchmarkShown = false
  private headX = 0
  private headY = 0
  private pops = new Map<string, number>()
  private lootFades = new Map<string, number>()
  private lastLives = 0
  private doorDrains = new Map<string, number>()
  private flipFades = new Map<string, number>()
  private redPulse: { key: string; t0: number } | null = null
  private rewindAnim: { cells: Pos[]; t0: number } | null = null
  private intro: { t0: number } | null = null
  private introDelay = new Map<string, number>()
  private sweep: { t0: number } | null = null
  private inputLocked = false
  private prePathSnapshot: Pos[] = []
  private unwinding = false
  private unwindT = 0

  constructor() { super('play') }

  init(data: { level: Level }) { this.level = data.level }

  create() {
    this.round = createRound(this.level)
    this.benchmarkShown = false
    const [hx, hy] = this.center(this.round.path[0]!)
    this.headX = hx
    this.headY = hy
    this.pops = new Map()
    this.lootFades = new Map()
    this.lastLives = this.round.lives
    this.doorDrains = new Map()
    this.flipFades = new Map()
    this.redPulse = null
    this.rewindAnim = null
    this.sweep = null
    this.inputLocked = false
    this.prePathSnapshot = []
    this.unwinding = false
    this.unwindT = 0
    this.g = this.add.graphics()
    this.buildHud()
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragging = true; this.onPointer(p) })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (this.dragging) this.onPointer(p) })
    this.input.on('pointerup', () => { this.dragging = false })
    const handler = () => this.redraw(this.time.now)
    this.scale.on('resize', handler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', handler))
    track('level_start', { id: this.level.id })

    // level intro: dots pop in group by group (grays, reds, doors, start/exit); tap skips
    this.intro = { t0: this.time.now + T.introLead }
    this.inputLocked = true
    const groups = [[...findCells(this.round.cells, 'gray'), ...findCells(this.round.cells, 'mid')], findCells(this.round.cells, 'red'),
      findCells(this.round.cells, 'yellow'),
      [...findCells(this.round.cells, 'start'), ...findCells(this.round.cells, 'exit')]]
    this.introDelay = new Map<string, number>()
    groups.forEach((grp, gi) => grp.forEach((p, i) => this.introDelay.set(p.r + ',' + p.c, gi * T.introGroup + i * T.introWithin)))
    groups.forEach((_, gi) => this.time.delayedCall(T.introLead + gi * T.introGroup, () => { if (this.intro) { sfx.tick(gi * 4); haptic.intro() } }))
    const total = T.introLead + 3 * T.introGroup + T.introWithin + T.introDot
    this.time.delayedCall(total, () => { if (this.intro) { this.intro = null; this.inputLocked = false } })
    this.input.once('pointerdown', () => { this.intro = null; this.inputLocked = false }) // tap skips

    this.redraw(this.time.now)
  }

  update(time: number, delta: number) {
    const tip = this.round.path[this.round.path.length - 1]!
    const [tx, ty] = this.center(tip)
    const k = REDUCED ? 1 : 1 - Math.exp(-delta / T.headSpringMs)
    this.headX += (tx - this.headX) * k
    this.headY += (ty - this.headY) * k
    this.redraw(time)
  }

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
      if (this.round.status !== 'playing' || this.unwinding || this.rewindAnim !== null) return
      track('level_restart', { id: this.level.id })
      sfx.brush(); haptic.restart()
      if (REDUCED) { this.scene.restart({ level: this.level } as never); return }
      this.inputLocked = true
      this.unwinding = true
      this.unwindT = 0
      this.tweens.add({
        targets: this,
        unwindT: 1,
        duration: T.unwind,
        ease: 'Cubic.easeIn',
        onComplete: () => this.scene.restart({ level: this.level } as never),
      })
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
    if (lives < this.lastLives) {
      this.tweens.add({ targets: this.hudHearts, alpha: 0.4, duration: T.heartFade / 2, yoyo: true, ease: 'Sine.easeInOut' })
    }
    this.lastLives = lives
    this.hudHearts.setText('♥'.repeat(lives) + '♡'.repeat(this.round.level.lives - lives))
    const left = this.round.level.yellowBudget - this.round.yellowsUsed
    this.hudChipText.setText(`× ${Math.max(0, left)}`)
    const dotX = this.hudChipText.getBounds().left - 14, dotY = 15 + this.hudChipText.height / 2
    this.hudChipDot.clear()
    this.hudChipDot.fillStyle(C.door, 1).fillCircle(dotX, dotY, 5.5)
    this.hudChipDot.lineStyle(2, C.door, 0.45).strokeCircle(dotX, dotY, 8)
  }

  private layout() {
    const { width, height } = this.scale
    const size = this.level.size
    const cell = Math.floor(Math.min(width - 28, height - 160) / (size + 1))
    const ox = Math.floor((width - cell * size) / 2)
    const oy = 56 + Math.floor((height - 146 - cell * size) / 2)
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
    if (this.intro || this.inputLocked) return
    const pos = this.posAt(pointer.x, pointer.y)
    if (!pos || this.round.status !== 'playing') return
    const tip = this.round.path[this.round.path.length - 1]!
    if (samePos(pos, tip)) return
    this.prePathSnapshot = [...this.round.path]
    const res = tryMove(this.round, pos)
    if (res.kind === 'moved' || res.kind === 'activated') {
      this.pops.set(pos.r + ',' + pos.c, this.time.now)
      sfx.tick(this.round.path.length)
      haptic.cell()
      if (this.round.cells[pos.r]![pos.c]! === 'gray') {
        sfx.pip()
        this.lootFades.set(pos.r + ',' + pos.c, this.time.now)
      }
    }
    if (res.kind === 'retracted') sfx.tickDown(this.round.path.length)
    if (res.kind === 'rejected' && res.reason === 'visited') {
      // 3px rubber-band on the visual head toward the refused cell
      const [rx, ry] = this.center(pos)
      const d = Math.hypot(rx - this.headX, ry - this.headY) || 1
      this.headX += 3 * (rx - this.headX) / d
      this.headY += 3 * (ry - this.headY) / d
    }
    if (res.kind === 'activated') {
      this.doorDrains.set(pos.r + ',' + pos.c, this.time.now)
      sfx.clunk(); haptic.door()
      if (!REDUCED) this.tweens.add({ targets: this.hudChipText, y: '+=3', duration: T.chipDip / 2, yoyo: true, ease: 'Cubic.easeOut' })
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
    }
    if (res.kind === 'red-hit') {
      sfx.thud(); haptic.red()
      this.redPulse = { key: pos.r + ',' + pos.c, t0: this.time.now }
      // animate the path the engine already truncated: replay the removed cells backwards
      const removed = this.prePathSnapshot.slice(this.round.path.length)
      this.rewindAnim = { cells: removed, t0: this.time.now }
      this.inputLocked = true
      removed.forEach((_, i) => this.time.delayedCall(i * T.rewindPerCell, () => sfx.tickDown(removed.length - i)))
      this.time.delayedCall(removed.length * T.rewindPerCell, () => { if (this.rewindAnim) { this.rewindAnim = null; this.inputLocked = false } })
      this.dragging = false
    }
    if (res.kind === 'won') this.onWon()
    if (res.kind === 'lost') { this.onLost(); this.dragging = false }
  }

  private onWon() {
    const grade = gradeRound(this.round)
    track('level_won', { id: this.level.id, percent: grade.percent, stars: grade.stars })
    sfx.chord(); haptic.win()
    this.sweep = { t0: this.time.now }
    this.inputLocked = true
    this.time.delayedCall(T.sweep, () => this.scene.launch('grade', { grade, level: this.level, playScene: this }))
  }

  private onLost() {
    track('level_lost', { id: this.level.id })
    this.time.delayedCall(700, () => { this.scene.restart({ level: this.level } as never) })
  }

  showBenchmark() { this.benchmarkShown = true; this.redraw(this.time.now) }

  getRound(): RoundState { return this.round }

  private drawDot(x: number, y: number, r: number, color: number, ring?: number, ringGap = 4, ringAlpha = 1) {
    if (r < 0.4) return
    this.g.fillStyle(color, 1)
    this.g.fillCircle(x, y, r)
    if (ring !== undefined) {
      this.g.lineStyle(2.5, ring, ringAlpha)
      this.g.strokeCircle(x, y, r + ringGap)
    }
  }

  private pointAtT(path: Pos[], t: number): [number, number] {
    const segs = path.length - 1
    if (segs <= 0) return this.center(path[0]!)
    const tt = Math.min(1, Math.max(0, t)) * segs
    const idx = Math.min(segs - 1, Math.floor(tt))
    const frac = tt - idx
    const [ax, ay] = this.center(path[idx]!)
    const [bx, by] = this.center(path[idx + 1]!)
    return [ax + (bx - ax) * frac, ay + (by - ay) * frac]
  }

  private redraw(now: number) {
    const { cell, ox, oy, size } = this.layout()
    const g = this.g
    g.clear()
    const dotR = Math.max(7, cell * 0.24)

    // level intro: per-dot scale, group by group, tap-skippable (see create())
    const iScale = (key: string): number => {
      if (!this.intro) return 1
      const delay = this.introDelay.get(key) ?? 0
      const t = Math.min(1, Math.max(0, (now - this.intro.t0 - delay) / T.introDot))
      return REDUCED ? t : backOut(t)
    }

    // one-shot pulse on the cell that was just hit red
    let redFactor = 1
    let redKey: string | null = null
    if (this.redPulse) {
      const dt = now - this.redPulse.t0
      if (dt < T.redPulse) { redKey = this.redPulse.key; if (!REDUCED) redFactor = 1 + 0.15 * Math.sin(Math.PI * dt / T.redPulse) }
      else this.redPulse = null
    }

    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      const p = { r, c }
      // card cell with a faux shadow (Phaser Graphics has no blur — offset ink at low alpha)
      // cells pop briefly on entry: scale the rect about its own center
      const key = r + ',' + c
      const popT0 = this.pops.get(key)
      let s = 1
      if (popT0 !== undefined) {
        if (now - popT0 < T.pop) { if (!REDUCED) s = 1 + 0.06 * Math.sin(Math.PI * (now - popT0) / T.pop) }
        else this.pops.delete(key)
      }
      const cx = ox + c * cell + cell / 2
      const cardCy = oy + r * cell + cell / 2
      const w = (cell - 6) * s
      g.fillStyle(C.ink, 0.06)
      g.fillRoundedRect(cx - w / 2, cardCy + 2 - w / 2, w, w, 11)
      g.fillStyle(C.card, 1)
      g.fillRoundedRect(cx - w / 2, cardCy - w / 2, w, w, 11)
      const base = this.round.cells[r]![c]!
      const eff = effectiveKind(this.round, p)
      const activated = base === 'yellow' && eff === 'empty'
      const grayTaken = base === 'gray' && this.round.path.some((q) => samePos(q, p))
      const [x, y] = this.center(p)
      const iS = iScale(key)
      if (base === 'start') this.drawDot(x, y, dotR * iS, C.go)
      else if (base === 'exit') { this.drawDot(x, y, dotR * 0.32 * iS, C.ink); this.g.lineStyle(2.5, C.ink, 1); this.g.strokeCircle(x, y, dotR * 0.82 * iS) }
      else if (activated) {
        const drainT0 = this.doorDrains.get(key)
        if (drainT0 !== undefined && now - drainT0 < T.doorDrain) {
          const t = (now - drainT0) / T.doorDrain
          // radius shrink is movement — hold at final size under REDUCED; color mix is a fade, keeps timing
          const rad = REDUCED ? dotR * 0.75 : dotR - t * dotR * 0.25
          this.drawDot(x, y, rad, mixColor(doorColor, paperColor, t), C.door, 3)
        } else {
          if (drainT0 !== undefined) this.doorDrains.delete(key)
          this.drawDot(x, y, dotR * 0.75, C.paper, C.door, 3)
        }
      } else if (eff === 'yellow') this.drawDot(x, y, dotR * iS, C.door, C.door, 4, 0.45)
      else if (eff === 'red') {
        const rScale = key === redKey ? redFactor : 1
        const fadeT0 = this.flipFades.get(key)
        if (fadeT0 !== undefined && now - fadeT0 < T.flipFade) {
          const t = (now - fadeT0) / T.flipFade
          this.drawDot(x, y, dotR * iS * rScale, mixColor(doorColor, hazardColor, t), C.door, 4, 0.45 * (1 - t))
        } else {
          if (fadeT0 !== undefined) this.flipFades.delete(key)
          this.drawDot(x, y, dotR * iS * rScale, C.hazard)
        }
      } else if (base === 'gray') {
        const t0 = this.lootFades.get(key)
        let alpha = grayTaken ? 0.4 : 1
        if (t0 !== undefined) {
          if (grayTaken) alpha = 1 - 0.6 * Math.min(1, (now - t0) / T.lootFade)
          else this.lootFades.delete(key)
        }
        g.fillStyle(C.loot, alpha); g.fillCircle(x, y, dotR * 0.85 * iS)
      } else if (base === 'mid') {
        const midOnPath = this.round.path.some((q) => samePos(q, p))
        this.g.lineStyle(2.5, C.line, midOnPath ? 0.4 : 1)
        this.g.strokeCircle(x, y, dotR * 0.8 * iS)
      }
      else { g.fillStyle(C.emptyDot, 1); g.fillCircle(x, y, 3.5 * iS) }
    }

    // rewind: consume one removed cell per T.rewindPerCell so the tail visibly retreats
    let tail: Pos[] = []
    if (this.rewindAnim) {
      const elapsed = now - this.rewindAnim.t0
      const totalMs = this.rewindAnim.cells.length * T.rewindPerCell
      if (elapsed >= totalMs) this.rewindAnim = null
      // REDUCED: tail retreat is movement — skip it, path shows its final (already-truncated) state
      // immediately while the same-duration tick sounds still play on schedule via onPointer's delayedCalls
      else if (!REDUCED) tail = this.rewindAnim.cells.slice(0, this.rewindAnim.cells.length - Math.floor(elapsed / T.rewindPerCell))
    }

    // the line: blue with round joints (circle at every vertex); the head glides to the tip
    if (this.unwinding) {
      // restart unwind: the line retreats from the tip back to the start (reuses the sweep's partial-polyline interpolation)
      const path = this.round.path
      const t = Math.max(0, 1 - this.unwindT)
      if (path.length > 1 && t > 0) {
        const w = Math.max(6, cell * 0.16)
        const segs = path.length - 1
        const tSegs = t * segs
        const lastIdx = Math.floor(tSegs)
        g.lineStyle(w, C.line, 1)
        g.beginPath()
        const [sx, sy] = this.center(path[0]!)
        g.moveTo(sx, sy)
        for (let i = 1; i <= lastIdx; i++) { const [x, y] = this.center(path[i]!); g.lineTo(x, y) }
        const [ex, ey] = this.pointAtT(path, t)
        g.lineTo(ex, ey)
        g.strokePath()
        for (let i = 0; i <= lastIdx; i++) { const [x, y] = this.center(path[i]!); g.fillStyle(C.line, 1); g.fillCircle(x, y, w / 2) }
        g.fillStyle(C.line, 1)
        g.fillCircle(ex, ey, w / 2)
      }
    } else {
      const pathForLine = [...this.round.path, ...tail]
      if (pathForLine.length > 1) {
        const w = Math.max(6, cell * 0.16)
        g.lineStyle(w, C.line, 1)
        g.beginPath()
        const [sx, sy] = this.center(pathForLine[0]!)
        g.moveTo(sx, sy)
        for (const p of pathForLine.slice(1, -1)) { const [x, y] = this.center(p); g.lineTo(x, y) }
        const [lx, ly] = tail.length > 0 ? this.center(pathForLine[pathForLine.length - 1]!) : [this.headX, this.headY]
        g.lineTo(lx, ly)
        g.strokePath()
        for (const p of pathForLine.slice(0, -1)) { const [x, y] = this.center(p); g.fillStyle(C.line, 1); g.fillCircle(x, y, w / 2) }
        g.fillStyle(C.line, 1)
        g.fillCircle(lx, ly, w / 2)
      }
    }

    // win sweep: a bright segment travels the solved path once before the grade overlay opens
    if (this.sweep) {
      const path = this.round.path
      const t = Math.min(1, (now - this.sweep.t0) / T.sweep)
      if (path.length > 1) {
        const w = Math.max(6, cell * 0.16)
        if (REDUCED) {
          // segment travel is movement — degrade to a whole-path fade-in at the same duration
          g.lineStyle(w, 0xffffff, 0.75 * t)
          g.beginPath()
          const [sx, sy] = this.center(path[0]!)
          g.moveTo(sx, sy)
          for (const p of path.slice(1)) { const [x, y] = this.center(p); g.lineTo(x, y) }
          g.strokePath()
        } else {
          const segs = path.length - 1
          const tailLen = 1.6 / segs
          const tailT = Math.max(0, t - tailLen)
          g.lineStyle(w, 0xffffff, 0.75)
          g.beginPath()
          const [sx, sy] = this.pointAtT(path, tailT)
          g.moveTo(sx, sy)
          for (let i = 0; i < path.length; i++) {
            const paramI = i / segs
            if (paramI > tailT && paramI < t) { const [x, y] = this.center(path[i]!); g.lineTo(x, y) }
          }
          const [ex, ey] = this.pointAtT(path, t)
          g.lineTo(ex, ey)
          g.strokePath()
        }
      }
      if ((now - this.sweep.t0) >= T.sweep) this.sweep = null
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
    this.syncHud()
  }
}

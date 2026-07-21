import Phaser from 'phaser'
import { createRound, tryMove, effectiveKind } from '../../engine/round'
import { gradeRound } from '../../engine/grading'
import { samePos } from '../../engine/board'
import type { Level, Pos, RoundState } from '../../engine/types'
import { track } from '../analytics'
import { TEXT_RESOLUTION } from '../ui'
import { C, CS, F, T, REDUCED } from '../theme'
import { sfx } from '../sfx'
import { haptic } from '../haptics'

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

  constructor() { super('play') }

  init(data: { level: Level }) { this.level = data.level }

  create() {
    this.round = createRound(this.level)
    this.benchmarkShown = false
    this.g = this.add.graphics()
    this.buildHud()
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragging = true; this.onPointer(p) })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (this.dragging) this.onPointer(p) })
    this.input.on('pointerup', () => { this.dragging = false })
    const handler = () => this.redraw()
    this.scale.on('resize', handler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', handler))
    track('level_start', { id: this.level.id })
    this.redraw()
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
    const pos = this.posAt(pointer.x, pointer.y)
    if (!pos || this.round.status !== 'playing') return
    const tip = this.round.path[this.round.path.length - 1]!
    if (samePos(pos, tip)) return
    const res = tryMove(this.round, pos)
    if (res.kind === 'activated' && res.flipped) this.flipFx()
    if (res.kind === 'red-hit') { this.cameras.main.shake(150, 0.01); this.dragging = false }
    if (res.kind === 'won') this.onWon()
    if (res.kind === 'lost') { this.onLost(); this.dragging = false }
    if (res.kind !== 'rejected') this.redraw()
  }

  private onWon() {
    const grade = gradeRound(this.round)
    track('level_won', { id: this.level.id, percent: grade.percent, stars: grade.stars })
    this.scene.launch('grade', { grade, level: this.level, playScene: this })
  }

  private onLost() {
    track('level_lost', { id: this.level.id })
    this.flashOverlay(0xe14b4b, 0.5, 300)
    this.time.delayedCall(700, () => { this.scene.restart({ level: this.level } as never) })
  }

  private flipFx() { this.flashOverlay(0xe8c34a) }

  private flashOverlay(color: number, alpha = 0.45, duration = 250) {
    const rect = this.add.rectangle(0, 0, this.scale.width * 2, this.scale.height * 2, color, alpha)
      .setOrigin(0).setDepth(1000)
    this.tweens.add({ targets: rect, alpha: 0, duration, onComplete: () => rect.destroy() })
  }

  showBenchmark() { this.benchmarkShown = true; this.redraw() }

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
    this.syncHud()
  }
}

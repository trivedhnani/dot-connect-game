import Phaser from 'phaser'
import { createRound, tryMove, effectiveKind } from '../../engine/round'
import { gradeRound } from '../../engine/grading'
import { samePos } from '../../engine/board'
import type { Level, Pos, RoundState } from '../../engine/types'
import { track } from '../analytics'
import { TEXT_RESOLUTION } from '../ui'
import { C, CS, F, T, REDUCED } from '../theme'

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
    const hudFont = this.scale.width < 520 ? 12 : 16
    const home = this.add.text(this.scale.width - 10, 8, '⌂ levels', {
      fontSize: `${hudFont}px`,
      color: CS.ink,
      backgroundColor: CS.card,
      padding: { x: 10, y: 6 },
      resolution: TEXT_RESOLUTION,
    }).setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.scene.stop('grade'); this.scene.start('select') })
    const restart = this.add.text(this.scale.width - 10 - home.displayWidth - 8, 8, '↻ restart', {
      fontSize: `${hudFont}px`,
      color: CS.ink,
      backgroundColor: CS.card,
      padding: { x: 10, y: 6 },
      resolution: TEXT_RESOLUTION,
    }).setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.round.status !== 'playing') return
        track('level_restart', { id: this.level.id })
        this.scene.restart({ level: this.level } as never)
      })
    this.hud = this.add.text(12, 10, '', {
      fontSize: `${hudFont}px`,
      color: CS.ink,
      fontFamily: F.sans,
      wordWrap: { width: restart.getBounds().left - 24 },
      resolution: TEXT_RESOLUTION,
    })
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragging = true; this.onPointer(p) })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (this.dragging) this.onPointer(p) })
    this.input.on('pointerup', () => { this.dragging = false })
    const handler = () => this.redraw()
    this.scale.on('resize', handler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', handler))
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
    const doorsLeft = this.round.level.yellowBudget - this.round.yellowsUsed
    this.hud.setText(`${this.level.id}   lives ${'♥'.repeat(Math.max(0, this.round.lives))}   doors left ${doorsLeft}${this.round.flipped ? '  DOORS SEALED' : ''}`)
  }
}

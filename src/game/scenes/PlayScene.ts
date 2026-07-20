import Phaser from 'phaser'
import { createRound, tryMove, effectiveKind } from '../../engine/round'
import { gradeRound } from '../../engine/grading'
import { samePos } from '../../engine/board'
import type { Level, Pos, RoundState } from '../../engine/types'
import { track } from '../analytics'
import { TEXT_RESOLUTION } from '../ui'

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
    const hudFont = this.scale.width < 520 ? 12 : 16
    this.hud = this.add.text(12, 10, '', {
      fontSize: `${hudFont}px`,
      color: '#cfd3e0',
      fontFamily: 'monospace',
      wordWrap: { width: this.scale.width - 130 },
      resolution: TEXT_RESOLUTION,
    })
    this.add.text(this.scale.width - 10, 8, '⌂ levels', {
      fontSize: `${hudFont}px`,
      color: '#cfd3e0',
      backgroundColor: '#26263a',
      padding: { x: 10, y: 6 },
      resolution: TEXT_RESOLUTION,
    }).setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.scene.stop('grade'); this.scene.start('select') })
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

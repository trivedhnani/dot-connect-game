import Phaser from 'phaser'
import type { Grade } from '../../engine/grading'
import type { Level, Pos } from '../../engine/types'
import { effectiveKind } from '../../engine/round'
import { samePos } from '../../engine/board'
import { loadProgress, recordResult, spendRevealToken } from '../storage'
import { track } from '../analytics'
import type PlayScene from './PlayScene'
import { TEXT_RESOLUTION } from '../ui'
import { C, CS, F, T, REDUCED } from '../theme'
import { sfx } from '../sfx'

export default class GradeOverlay extends Phaser.Scene {
  constructor() { super('grade') }

  create(data: { grade: Grade; level: Level; playScene: PlayScene }) {
    const { grade, level, playScene } = data
    recordResult(level.id, grade.percent, grade.stars)
    const { width, height } = this.scale
    const cx = width / 2

    // full paper takeover; interactive so taps can never fall through to the board underneath
    this.add.rectangle(0, 0, width * 2, height * 2, C.paper, 1).setOrigin(0).setInteractive()

    // stars stamp in, staggered
    const starY = height * 0.16
    for (let i = 0; i < 3; i++) {
      const earned = i < grade.stars
      const star = this.add.text(cx + (i - 1) * 44, starY, earned ? '★' : '☆', {
        fontSize: '34px', color: earned ? CS.door : CS.hair, resolution: TEXT_RESOLUTION,
      }).setOrigin(0.5).setScale(REDUCED ? 1 : 0.4).setAlpha(0)
      this.time.delayedCall(i * T.starStagger, () => {
        this.tweens.add(REDUCED
          ? { targets: star, alpha: 1, duration: 240 }
          : { targets: star, alpha: 1, scale: 1, duration: 240, ease: 'Back.easeOut' })
        if (earned) sfx.tick(8 + i * 2)
      })
    }

    const solved = this.add.text(cx, starY + 58, 'Solved.', {
      fontFamily: F.serif, fontSize: '34px', color: CS.ink, resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5).setAlpha(0)
    this.tweens.add({ targets: solved, alpha: 1, duration: T.solvedFade, delay: 3 * T.starStagger })

    this.add.text(cx, starY + 92, `${grade.percent}% of the best-known route`, {
      fontFamily: F.sans, fontSize: '14px', color: CS.sub, resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5)
    this.add.text(cx, starY + 112, `${grade.graysCovered} of ${level.benchmark.grays} loot · ${grade.hint}`, {
      fontFamily: F.sans, fontSize: '12px', color: CS.sub, resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5)

    // route thumbnail: framed card with a miniature of the finished board and the player's path
    this.drawThumbnail(cx, starY + 210, Math.min(170, width * 0.45), playScene)

    // buttons
    const pill = (y: number, label: string, primary: boolean, onTap: () => void) => {
      const w = Math.min(300, width - 52)
      const bg = this.add.rectangle(cx, y, w, 44, primary ? C.ink : C.card).setStrokeStyle(1, primary ? C.ink : C.hair)
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', onTap)
      this.add.text(cx, y, label, {
        fontFamily: F.sans, fontSize: '15px', fontStyle: 'bold', color: primary ? CS.paper : CS.ink, resolution: TEXT_RESOLUTION,
      }).setOrigin(0.5)
    }

    const freeReveal = grade.percent >= 95
    const tokens = loadProgress().revealTokens
    let canShare = false
    try { canShare = typeof (globalThis.navigator as Navigator | undefined)?.share === 'function' } catch { canShare = false }
    const ys = canShare
      ? [height - 220, height - 168, height - 116, height - 64]
      : [height - 168, height - 116, height - 64]

    pill(ys[0]!, 'Next puzzle', true, () => { this.scene.stop(); playScene.scene.stop(); this.scene.start('select') })
    pill(ys[1]!, freeReveal ? 'Reveal best path (free)' : `Reveal best path (${tokens} left)`, false, () => {
      if (freeReveal || spendRevealToken()) { track('reveal_used', { id: level.id }); playScene.showBenchmark(); this.scene.stop() }
    })
    pill(ys[2]!, 'Replay', false, () => { this.scene.stop(); playScene.scene.restart({ level } as never) })
    if (canShare) {
      pill(ys[3]!, 'Share', false, () => {
        void navigator.share({ text: `Dot Connect ${level.id}: ${grade.percent}% of the best route, ${'★'.repeat(grade.stars)}` }).catch(() => {})
      })
    }
  }

  private drawThumbnail(cx: number, cy: number, size: number, playScene: PlayScene) {
    const round = playScene.getRound()
    const n = round.level.size
    const ox = cx - size / 2
    const oy = cy - size / 2
    const g = this.add.graphics()

    // rounded card with the same faux shadow offset used on the board's own cell cards
    g.fillStyle(C.ink, 0.06)
    g.fillRoundedRect(ox, oy + 2, size, size, 14)
    g.fillStyle(C.card, 1)
    g.fillRoundedRect(ox, oy, size, size, 14)
    g.lineStyle(1, C.hair, 1)
    g.strokeRoundedRect(ox, oy, size, size, 14)

    const cellMini = size / n
    const dotR = cellMini * 0.22
    const center = (p: Pos): [number, number] => [ox + p.c * cellMini + cellMini / 2, oy + p.r * cellMini + cellMini / 2]

    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const p = { r, c }
      const base = round.cells[r]![c]!
      const eff = effectiveKind(round, p)
      const [x, y] = center(p)
      if (base === 'start') { g.fillStyle(C.go, 1); g.fillCircle(x, y, dotR) }
      else if (base === 'exit') {
        g.fillStyle(C.ink, 1); g.fillCircle(x, y, dotR * 0.32)
        g.lineStyle(Math.max(1, dotR * 0.3), C.ink, 1); g.strokeCircle(x, y, dotR * 0.82)
      } else if (base === 'yellow' && eff === 'empty') {
        g.fillStyle(C.paper, 1); g.fillCircle(x, y, dotR * 0.75)
        g.lineStyle(Math.max(1, dotR * 0.3), C.door, 1); g.strokeCircle(x, y, dotR * 0.75)
      } else if (eff === 'yellow') { g.fillStyle(C.door, 0.45); g.fillCircle(x, y, dotR) }
      else if (eff === 'red') { g.fillStyle(C.hazard, 1); g.fillCircle(x, y, dotR) }
      else if (base === 'gray') {
        const onPath = round.path.some((q) => samePos(q, p))
        g.fillStyle(C.loot, onPath ? 0.4 : 1); g.fillCircle(x, y, dotR * 0.85)
      }
      // empty: skip, no dot
    }

    if (round.path.length > 1) {
      const w = cellMini * 0.14
      g.lineStyle(w, C.line, 1)
      g.beginPath()
      const [sx, sy] = center(round.path[0]!)
      g.moveTo(sx, sy)
      for (const p of round.path.slice(1)) { const [x, y] = center(p); g.lineTo(x, y) }
      g.strokePath()
      for (const p of round.path) { const [x, y] = center(p); g.fillStyle(C.line, 1); g.fillCircle(x, y, w / 2) }
    }
  }
}

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

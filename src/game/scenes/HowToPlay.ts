import Phaser from 'phaser'
import { TEXT_RESOLUTION } from '../ui'
import { C, CS, F } from '../theme'

type GlossaryDot = 'go' | 'loot' | 'door' | 'mid' | 'hazard' | 'grade'

interface GlossaryRow {
  dot: GlossaryDot
  term: string
  desc: string
}

const ROWS: GlossaryRow[] = [
  { dot: 'go', term: 'Start & exit', desc: 'Draw from the green dot to the ink ring. Drag back to undo — always free.' },
  { dot: 'loot', term: 'Loot', desc: 'Never needed to finish — but most of your score. Grab what your route allows; every one is usually impossible.' },
  { dot: 'door', term: 'Doors', desc: 'Entering one spends a door point, permanently — the door goes hollow and stays open. Spend your last and every other door turns red.' },
  { dot: 'mid', term: 'Waypoints', desc: 'Your line must pass through every one before the exit opens.' },
  { dot: 'hazard', term: 'Hazards', desc: 'Cost a life and rewind you to your last door. A fresh start is always free: ↻.' },
  { dot: 'grade', term: 'The grade', desc: 'Every win is scored against the best-known route. 60% ★ · 80% ★★ · 95% ★★★.' },
]

export default class HowToPlay extends Phaser.Scene {
  constructor() { super('help') }

  create(data: { next: 'select' | 'play'; nextData?: object }) {
    const { width, height } = this.scale
    const cx = width / 2

    // full paper takeover — guarantees coverage over whatever scene was showing before
    this.add.rectangle(0, 0, width, height, C.paper).setOrigin(0)

    this.add.text(cx, 48, 'How to play', {
      fontFamily: F.serif, fontSize: '22px', color: CS.ink, resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5)
    this.add.text(cx, 76, 'One line, start to exit. Your trail is a wall.', {
      fontFamily: F.sans, fontSize: '12.5px', color: CS.sub, resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5)

    // glossary rows
    const g = this.add.graphics()
    const iconCx = 40
    const textX = 68
    const wrapWidth = Math.min(430, width - 110)
    let y = 150

    for (const row of ROWS) {
      const desc = this.add.text(textX, y + 24, row.desc, {
        fontFamily: F.sans, fontSize: '12.5px', color: CS.sub, wordWrap: { width: wrapWidth }, resolution: TEXT_RESOLUTION,
      })
      const rowH = Math.max(62, desc.height + 24)
      const dotCy = y + rowH / 2

      switch (row.dot) {
        case 'go': g.fillStyle(C.go, 1).fillCircle(iconCx, dotCy, 13); break
        case 'loot': g.fillStyle(C.loot, 1).fillCircle(iconCx, dotCy, 13); break
        case 'door':
          g.fillStyle(C.door, 1).fillCircle(iconCx, dotCy, 13)
          g.lineStyle(2.5, C.door, 0.45).strokeCircle(iconCx, dotCy, 17)
          break
        case 'mid': g.lineStyle(2.5, C.line, 1).strokeCircle(iconCx, dotCy, 13); break
        case 'hazard': g.fillStyle(C.hazard, 1).fillCircle(iconCx, dotCy, 13); break
        case 'grade':
          g.fillStyle(C.ink, 1).fillCircle(iconCx, dotCy, 5)
          g.lineStyle(2.5, C.ink, 1).strokeCircle(iconCx, dotCy, 13)
          break
      }

      this.add.text(textX, y + 6, row.term, {
        fontFamily: F.sans, fontSize: '13px', fontStyle: 'bold', color: CS.ink, resolution: TEXT_RESOLUTION,
      })

      g.lineStyle(1, C.hair, 1).lineBetween(20, y + rowH, width - 20, y + rowH)

      y += rowH
    }

    // "Got it — play" pill
    const pillW = Math.min(300, width - 52)
    const pillY = height - 64
    const pill = this.add.rectangle(cx, pillY, pillW, 44, C.ink)
    this.add.text(cx, pillY, 'Got it — play', {
      fontFamily: F.sans, fontSize: '15px', fontStyle: 'bold', color: CS.paper, resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5)
    pill.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(data.next === 'play' ? 'play' : 'select', data.nextData ?? {}))
  }
}

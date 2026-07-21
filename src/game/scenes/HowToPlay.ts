import Phaser from 'phaser'
import { TEXT_RESOLUTION } from '../ui'
import { C, CS, F, u } from '../theme'

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

    this.add.text(cx, u(48), 'How to play', {
      fontFamily: F.serif, fontSize: `${u(22)}px`, color: CS.ink, resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5)
    this.add.text(cx, u(76), 'One line, start to exit. Your trail is a wall.', {
      fontFamily: F.sans, fontSize: `${u(12.5)}px`, color: CS.sub, resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5)

    // glossary rows
    const g = this.add.graphics()
    const iconCx = u(40)
    const textX = u(68)
    const wrapWidth = Math.min(u(430), width - u(110))
    let y = u(150)

    for (const row of ROWS) {
      const desc = this.add.text(textX, y + u(24), row.desc, {
        fontFamily: F.sans, fontSize: `${u(12.5)}px`, color: CS.sub, wordWrap: { width: wrapWidth }, resolution: TEXT_RESOLUTION,
      })
      const rowH = Math.max(u(62), desc.height + u(24))
      const dotCy = y + rowH / 2

      switch (row.dot) {
        case 'go': g.fillStyle(C.go, 1).fillCircle(iconCx, dotCy, u(13)); break
        case 'loot': g.fillStyle(C.loot, 1).fillCircle(iconCx, dotCy, u(13)); break
        case 'door':
          g.fillStyle(C.door, 1).fillCircle(iconCx, dotCy, u(13))
          g.lineStyle(u(2.5), C.door, 0.45).strokeCircle(iconCx, dotCy, u(17))
          break
        case 'mid': g.lineStyle(u(2.5), C.line, 1).strokeCircle(iconCx, dotCy, u(13)); break
        case 'hazard': g.fillStyle(C.hazard, 1).fillCircle(iconCx, dotCy, u(13)); break
        case 'grade':
          g.fillStyle(C.ink, 1).fillCircle(iconCx, dotCy, u(5))
          g.lineStyle(u(2.5), C.ink, 1).strokeCircle(iconCx, dotCy, u(13))
          break
      }

      this.add.text(textX, y + u(6), row.term, {
        fontFamily: F.sans, fontSize: `${u(13)}px`, fontStyle: 'bold', color: CS.ink, resolution: TEXT_RESOLUTION,
      })

      g.lineStyle(u(1), C.hair, 1).lineBetween(u(20), y + rowH, width - u(20), y + rowH)

      y += rowH
    }

    // "Got it — play" pill
    const pillW = Math.min(u(300), width - u(52))
    const pillY = height - u(64)
    const pill = this.add.rectangle(cx, pillY, pillW, u(44), C.ink)
    this.add.text(cx, pillY, 'Got it — play', {
      fontFamily: F.sans, fontSize: `${u(15)}px`, fontStyle: 'bold', color: CS.paper, resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5)
    pill.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(data.next === 'play' ? 'play' : 'select', data.nextData ?? {}))
  }
}

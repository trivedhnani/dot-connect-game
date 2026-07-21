import Phaser from 'phaser'
import levelsJson from '../../levels/levels.json'
import type { Level } from '../../engine/types'
import { loadProgress } from '../storage'
import { dailyIndex, todayKey } from '../daily'
import { track } from '../analytics'
import { TEXT_RESOLUTION } from '../ui'
import { C, CS, F, u } from '../theme'
import { getSound, setSound, getHaptics, setHaptics } from '../settings'

const data = levelsJson as unknown as { campaign: Level[]; daily: Level[] }

export default class LevelSelect extends Phaser.Scene {
  private settingsPopup?: Phaser.GameObjects.Container

  constructor() { super('select') }

  create() {
    const { width, height } = this.scale
    const progress = loadProgress()
    const narrow = width < u(520)
    const cx = width / 2
    const colW = Math.min(u(440), width - u(24))
    const colX = (width - colW) / 2

    // masthead
    this.add.rectangle(cx, u(30), u(46), u(2), C.ink)
    this.add.text(cx, u(52), 'Dot Connect', { fontFamily: F.serif, fontSize: narrow ? `${u(24)}px` : `${u(28)}px`, color: CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
    const date = new Date()
    this.add.text(cx, u(78), date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase(),
      { fontFamily: F.sans, fontSize: `${u(11)}px`, color: CS.sub, letterSpacing: u(2), resolution: TEXT_RESOLUTION }).setOrigin(0.5)

    // daily card
    const idx = dailyIndex(todayKey(new Date()), data.daily.length)
    const dailyLevel = data.daily[idx]!
    const cardW = Math.min(u(360), width - u(36))
    const daily = this.add.rectangle(cx, u(122), cardW, u(58), C.card).setStrokeStyle(u(1), C.hair)
    this.add.circle(cx - cardW / 2 + u(32), u(122), u(17), C.line)
    this.add.text(cx - cardW / 2 + u(58), u(112), "Today's puzzle", { fontFamily: F.serif, fontSize: `${u(15)}px`, color: CS.ink, resolution: TEXT_RESOLUTION })
    this.add.text(cx - cardW / 2 + u(58), u(131), 'A fresh line, once a day', { fontFamily: F.sans, fontSize: `${u(12)}px`, color: CS.sub, resolution: TEXT_RESOLUTION })
    this.add.text(cx + cardW / 2 - u(22), u(122), '→', { fontSize: `${u(18)}px`, color: CS.line, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
    daily.setInteractive({ useHandCursor: true }).on('pointerdown', () => { track('daily_start', { id: dailyLevel.id }); this.scene.start('play', { level: dailyLevel }) })

    // campaign eyebrow + tile grid — a centered content column, always 4 cols, scrollable
    this.add.text(colX, u(164), 'CAMPAIGN', { fontFamily: F.sans, fontSize: `${u(11)}px`, color: CS.sub, letterSpacing: u(2), resolution: TEXT_RESOLUTION })
    const cols = 4
    const rows = Math.ceil(data.campaign.length / cols)
    const tile = (colW - (cols - 1) * u(10)) / cols
    const gridChildren: Phaser.GameObjects.GameObject[] = []
    const lockG = this.add.graphics()
    lockG.lineStyle(u(2), C.loot, 1)
    lockG.fillStyle(C.loot, 1)
    data.campaign.forEach((level, i) => {
      const x = colX + (i % cols) * (tile + u(10)) + tile / 2
      const y = u(196) + Math.floor(i / cols) * (tile + u(10)) + tile / 2
      const starsEarned = progress.stars[level.id] ?? 0
      const unlocked = i === 0 || (progress.stars[data.campaign[i - 1]!.id] ?? 0) >= 1
      const isCurrent = unlocked && starsEarned === 0
      const shadow = this.add.rectangle(x, y + u(2), tile, tile, C.ink).setAlpha(0.06)
      const rect = this.add.rectangle(x, y, tile, tile, C.card).setStrokeStyle(isCurrent ? u(1.5) : u(1), isCurrent ? C.line : C.hair)
      gridChildren.push(shadow, rect)
      if (!unlocked) rect.setAlpha(0.45)
      if (unlocked) {
        const label = this.add.text(x, y - (starsEarned ? u(6) : 0), String(i + 1), {
          fontFamily: F.sans, fontSize: `${u(15)}px`, fontStyle: 'bold',
          color: isCurrent ? CS.line : CS.ink, resolution: TEXT_RESOLUTION,
        }).setOrigin(0.5)
        gridChildren.push(label)
      } else {
        lockG.beginPath()
        lockG.arc(x, y - tile * 0.045, tile * 0.07, Math.PI, 0, false)
        lockG.strokePath()
        lockG.fillRoundedRect(x - tile * 0.1, y - tile * 0.045, tile * 0.2, tile * 0.15, u(2.5))
      }
      if (starsEarned > 0) {
        const starText = this.add.text(x, y + u(12), '★'.repeat(starsEarned) + '☆'.repeat(3 - starsEarned),
          { fontSize: `${u(11)}px`, color: CS.door, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
        gridChildren.push(starText)
      }
      if (unlocked) rect.setInteractive({ useHandCursor: true }).on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (Math.abs(pointer.y - pointer.downY) < u(8)) this.scene.start('play', { level })
      })
    })
    gridChildren.push(lockG)
    const gridContainer = this.add.container(0, 0, gridChildren)
    const maskShape = this.make.graphics({}, false)
    maskShape.fillStyle(0xffffff)
    maskShape.fillRect(0, u(170), this.scale.width, this.scale.height - u(170))
    gridContainer.setMask(maskShape.createGeometryMask())

    // vertical scroll: drag or wheel over the grid area, clamped so content never scrolls past its bounds
    const contentBottom = u(196) + (rows - 1) * (tile + u(10)) + tile
    const minY = Math.min(0, (height - u(120)) - contentBottom)
    let lastY = 0
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { lastY = pointer.y })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || pointer.downY <= u(170)) return
      gridContainer.y = Phaser.Math.Clamp(gridContainer.y + (pointer.y - lastY), minY, 0)
      lastY = pointer.y
    })
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
      gridContainer.y = Phaser.Math.Clamp(gridContainer.y - dy, minY, 0)
    })

    // bottom-right cluster
    this.iconButton(width - u(104), height - u(44), '?', () => this.scene.start('help', { next: 'select' }))
    this.iconButton(width - u(46), height - u(44), '⚙', () => this.toggleSettingsPopup())

    try {
      if (!localStorage.getItem('dot-connect-seen-help-v1')) {
        localStorage.setItem('dot-connect-seen-help-v1', '1')
        this.scene.start('help', { next: 'select' })
      }
    } catch { /* ignore */ }
  }

  private iconButton(x: number, y: number, glyph: string, onTap: () => void) {
    const circle = this.add.circle(x, y, u(22), C.card).setStrokeStyle(u(1), C.hair)
    const label = this.add.text(x, y, glyph, { fontFamily: F.sans, fontSize: `${u(18)}px`, color: CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
    circle.setInteractive({ useHandCursor: true }).on('pointerdown', onTap)
    return this.add.container(0, 0, [circle, label])
  }

  private toggleSettingsPopup() {
    if (this.settingsPopup) {
      this.settingsPopup.destroy()
      this.settingsPopup = undefined
      return
    }
    const { width, height } = this.scale
    const popupW = u(200), popupH = u(96)
    const px = width - u(46) - popupW / 2, py = height - u(44) - u(24) - popupH / 2

    const shield = this.add.rectangle(0, 0, width, height, 0x000000, 0.001)
      .setOrigin(0).setInteractive().on('pointerdown', () => this.toggleSettingsPopup())

    const bg = this.add.graphics()
    bg.fillStyle(C.card, 1)
    bg.fillRoundedRect(px - popupW / 2, py - popupH / 2, popupW, popupH, u(8))
    bg.lineStyle(u(1), C.hair, 1)
    bg.strokeRoundedRect(px - popupW / 2, py - popupH / 2, popupW, popupH, u(8))

    const soundLabel = this.add.text(px - popupW / 2 + u(14), py - u(24), 'sound', { fontFamily: F.sans, fontSize: `${u(13)}px`, color: CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(0, 0.5)
    const soundToggle = this.add.text(px + popupW / 2 - u(14), py - u(24), getSound() ? '[on]' : '[off]',
      { fontFamily: F.sans, fontSize: `${u(13)}px`, color: CS.line, resolution: TEXT_RESOLUTION }).setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        const next = !getSound()
        setSound(next)
        soundToggle.setText(next ? '[on]' : '[off]')
      })

    const hapticsLabel = this.add.text(px - popupW / 2 + u(14), py + u(24), 'vibration', { fontFamily: F.sans, fontSize: `${u(13)}px`, color: CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(0, 0.5)
    const hapticsToggle = this.add.text(px + popupW / 2 - u(14), py + u(24), getHaptics() ? '[on]' : '[off]',
      { fontFamily: F.sans, fontSize: `${u(13)}px`, color: CS.line, resolution: TEXT_RESOLUTION }).setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        const next = !getHaptics()
        setHaptics(next)
        hapticsToggle.setText(next ? '[on]' : '[off]')
      })

    this.settingsPopup = this.add.container(0, 0, [shield, bg, soundLabel, soundToggle, hapticsLabel, hapticsToggle])
  }
}

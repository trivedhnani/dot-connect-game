import Phaser from 'phaser'
import levelsJson from '../../levels/levels.json'
import type { Level } from '../../engine/types'
import { loadProgress } from '../storage'
import { dailyIndex, todayKey } from '../daily'
import { track } from '../analytics'
import { TEXT_RESOLUTION } from '../ui'
import { C, CS, F } from '../theme'
import { getSound, setSound, getHaptics, setHaptics } from '../settings'

const data = levelsJson as unknown as { campaign: Level[]; daily: Level[] }

export default class LevelSelect extends Phaser.Scene {
  private settingsPopup?: Phaser.GameObjects.Container

  constructor() { super('select') }

  create() {
    const { width, height } = this.scale
    const progress = loadProgress()
    const narrow = width < 520
    const cx = width / 2
    const colW = Math.min(440, width - 24)
    const colX = (width - colW) / 2

    // masthead
    this.add.rectangle(cx, 30, 46, 2, C.ink)
    this.add.text(cx, 52, 'Dot Connect', { fontFamily: F.serif, fontSize: narrow ? '24px' : '28px', color: CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
    const date = new Date()
    this.add.text(cx, 78, date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase(),
      { fontFamily: F.sans, fontSize: '11px', color: CS.sub, letterSpacing: 2, resolution: TEXT_RESOLUTION }).setOrigin(0.5)

    // daily card
    const idx = dailyIndex(todayKey(new Date()), data.daily.length)
    const dailyLevel = data.daily[idx]!
    const cardW = Math.min(360, width - 36)
    const daily = this.add.rectangle(cx, 122, cardW, 58, C.card).setStrokeStyle(1, C.hair)
    this.add.circle(cx - cardW / 2 + 32, 122, 17, C.line)
    this.add.text(cx - cardW / 2 + 58, 112, "Today's puzzle", { fontFamily: F.serif, fontSize: '15px', color: CS.ink, resolution: TEXT_RESOLUTION })
    this.add.text(cx - cardW / 2 + 58, 131, 'A fresh line, once a day', { fontFamily: F.sans, fontSize: '12px', color: CS.sub, resolution: TEXT_RESOLUTION })
    this.add.text(cx + cardW / 2 - 22, 122, '→', { fontSize: '18px', color: CS.line, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
    daily.setInteractive({ useHandCursor: true }).on('pointerdown', () => { track('daily_start', { id: dailyLevel.id }); this.scene.start('play', { level: dailyLevel }) })

    // campaign eyebrow + tile grid — a centered content column, always 4 cols, scrollable
    const eyebrow = this.add.text(colX, 164, 'CAMPAIGN', { fontFamily: F.sans, fontSize: '11px', color: CS.sub, letterSpacing: 2, resolution: TEXT_RESOLUTION })
    const cols = 4
    const rows = Math.ceil(data.campaign.length / cols)
    const tile = (colW - (cols - 1) * 10) / cols
    const gridChildren: Phaser.GameObjects.GameObject[] = [eyebrow]
    const lockG = this.add.graphics()
    lockG.lineStyle(2, C.loot, 1)
    lockG.fillStyle(C.loot, 1)
    data.campaign.forEach((level, i) => {
      const x = colX + (i % cols) * (tile + 10) + tile / 2
      const y = 196 + Math.floor(i / cols) * (tile + 10) + tile / 2
      const starsEarned = progress.stars[level.id] ?? 0
      const unlocked = i === 0 || (progress.stars[data.campaign[i - 1]!.id] ?? 0) >= 1
      const isCurrent = unlocked && starsEarned === 0
      const shadow = this.add.rectangle(x, y + 2, tile, tile, C.ink).setAlpha(0.06)
      const rect = this.add.rectangle(x, y, tile, tile, C.card).setStrokeStyle(isCurrent ? 1.5 : 1, isCurrent ? C.line : C.hair)
      gridChildren.push(shadow, rect)
      if (!unlocked) rect.setAlpha(0.45)
      if (unlocked) {
        const label = this.add.text(x, y - (starsEarned ? 6 : 0), String(i + 1), {
          fontFamily: F.sans, fontSize: '15px', fontStyle: 'bold',
          color: isCurrent ? CS.line : CS.ink, resolution: TEXT_RESOLUTION,
        }).setOrigin(0.5)
        gridChildren.push(label)
      } else {
        lockG.beginPath()
        lockG.arc(x, y - tile * 0.045, tile * 0.07, Math.PI, 0, false)
        lockG.strokePath()
        lockG.fillRoundedRect(x - tile * 0.1, y - tile * 0.045, tile * 0.2, tile * 0.15, 2.5)
      }
      if (starsEarned > 0) {
        const starText = this.add.text(x, y + 12, '★'.repeat(starsEarned) + '☆'.repeat(3 - starsEarned),
          { fontSize: '11px', color: CS.door, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
        gridChildren.push(starText)
      }
      if (unlocked) rect.setInteractive({ useHandCursor: true }).on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (Math.abs(pointer.y - pointer.downY) < 8) this.scene.start('play', { level })
      })
    })
    gridChildren.push(lockG)
    const gridContainer = this.add.container(0, 0, gridChildren)
    const maskShape = this.make.graphics({}, false)
    maskShape.fillStyle(0xffffff)
    maskShape.fillRect(0, 170, this.scale.width, this.scale.height - 170)
    gridContainer.setMask(maskShape.createGeometryMask())

    // vertical scroll: drag or wheel over the grid area, clamped so content never scrolls past its bounds
    const contentBottom = 196 + (rows - 1) * (tile + 10) + tile
    const minY = Math.min(0, (height - 120) - contentBottom)
    let lastY = 0
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { lastY = pointer.y })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || pointer.downY <= 170) return
      gridContainer.y = Phaser.Math.Clamp(gridContainer.y + (pointer.y - lastY), minY, 0)
      lastY = pointer.y
    })
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
      gridContainer.y = Phaser.Math.Clamp(gridContainer.y - dy, minY, 0)
    })

    // bottom-right cluster
    this.iconButton(width - 104, height - 44, '?', () => this.scene.start('help', { next: 'select' }))
    this.iconButton(width - 46, height - 44, '⚙', () => this.toggleSettingsPopup())

    try {
      if (!localStorage.getItem('dot-connect-seen-help-v1')) {
        localStorage.setItem('dot-connect-seen-help-v1', '1')
        this.scene.start('help', { next: 'select' })
      }
    } catch { /* ignore */ }
  }

  private iconButton(x: number, y: number, glyph: string, onTap: () => void) {
    const circle = this.add.circle(x, y, 22, C.card).setStrokeStyle(1, C.hair)
    const label = this.add.text(x, y, glyph, { fontFamily: F.sans, fontSize: '18px', color: CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(0.5)
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
    const popupW = 200, popupH = 96
    const px = width - 46 - popupW / 2, py = height - 44 - 24 - popupH / 2

    const shield = this.add.rectangle(0, 0, width, height, 0x000000, 0.001)
      .setOrigin(0).setInteractive().on('pointerdown', () => this.toggleSettingsPopup())

    const bg = this.add.graphics()
    bg.fillStyle(C.card, 1)
    bg.fillRoundedRect(px - popupW / 2, py - popupH / 2, popupW, popupH, 8)
    bg.lineStyle(1, C.hair, 1)
    bg.strokeRoundedRect(px - popupW / 2, py - popupH / 2, popupW, popupH, 8)

    const soundLabel = this.add.text(px - popupW / 2 + 14, py - 24, 'sound', { fontFamily: F.sans, fontSize: '13px', color: CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(0, 0.5)
    const soundToggle = this.add.text(px + popupW / 2 - 14, py - 24, getSound() ? '[on]' : '[off]',
      { fontFamily: F.sans, fontSize: '13px', color: CS.line, resolution: TEXT_RESOLUTION }).setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        const next = !getSound()
        setSound(next)
        soundToggle.setText(next ? '[on]' : '[off]')
      })

    const hapticsLabel = this.add.text(px - popupW / 2 + 14, py + 24, 'vibration', { fontFamily: F.sans, fontSize: '13px', color: CS.ink, resolution: TEXT_RESOLUTION }).setOrigin(0, 0.5)
    const hapticsToggle = this.add.text(px + popupW / 2 - 14, py + 24, getHaptics() ? '[on]' : '[off]',
      { fontFamily: F.sans, fontSize: '13px', color: CS.line, resolution: TEXT_RESOLUTION }).setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        const next = !getHaptics()
        setHaptics(next)
        hapticsToggle.setText(next ? '[on]' : '[off]')
      })

    this.settingsPopup = this.add.container(0, 0, [shield, bg, soundLabel, soundToggle, hapticsLabel, hapticsToggle])
  }
}

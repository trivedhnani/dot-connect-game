import Phaser from 'phaser'
import levelsJson from '../../levels/levels.json'
import type { Level } from '../../engine/types'
import { loadProgress } from '../storage'
import { dailyIndex, todayKey } from '../daily'
import { track } from '../analytics'
import { TEXT_RESOLUTION } from '../ui'

const data = levelsJson as unknown as { campaign: Level[]; daily: Level[] }

export default class LevelSelect extends Phaser.Scene {
  constructor() { super('select') }

  create() {
    const { width } = this.scale
    const progress = loadProgress()
    const narrow = width < 520
    const titleFont = narrow ? '20px' : '28px'
    const dailyFont = narrow ? '14px' : '18px'
    const helpFont = narrow ? '13px' : '16px'
    this.add.text(width / 2, 28, 'DOT CONNECT', { fontSize: titleFont, color: '#4be18a', resolution: TEXT_RESOLUTION }).setOrigin(0.5)

    // Daily tile
    const idx = dailyIndex(todayKey(new Date()), data.daily.length)
    const dailyLevel = data.daily[idx]!
    this.add.text(width / 2, 70, `▶ Daily level (${new Date().toDateString()})`,
      { fontSize: dailyFont, color: '#e8c34a', backgroundColor: '#26263a', padding: { x: 10, y: 6 }, resolution: TEXT_RESOLUTION })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { track('daily_start', { id: dailyLevel.id }); this.scene.start('play', { level: dailyLevel }) })

    this.add.text(width - 12, 8, '? How to play', {
      fontSize: helpFont, color: '#4be18a',
      backgroundColor: '#26263a', padding: { x: 8, y: 4 },
      resolution: TEXT_RESOLUTION,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('help', { next: 'select' }))

    // Campaign grid: 10 per row
    const cols = 10, cell = Math.min(56, (width - 24) / cols)
    data.campaign.forEach((level, i) => {
      const starsEarned = progress.stars[level.id] ?? 0
      const unlocked = i === 0 || (progress.stars[data.campaign[i - 1]!.id] ?? 0) >= 1
      const x = 12 + (i % cols) * cell + cell / 2
      const y = 120 + Math.floor(i / cols) * (cell + 14)
      const label = unlocked ? String(i + 1) : '🔒'
      const t = this.add.text(x, y, label, {
        fontSize: '18px', color: unlocked ? '#ffffff' : '#555566',
        backgroundColor: unlocked ? '#26263a' : '#1a1a24', padding: { x: 10, y: 8 },
        resolution: TEXT_RESOLUTION,
      }).setOrigin(0.5)
      if (unlocked) t.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.scene.start('play', { level }))
      if (starsEarned > 0) this.add.text(x, y + 22, '★'.repeat(starsEarned),
        { fontSize: '10px', color: '#e8c34a', resolution: TEXT_RESOLUTION }).setOrigin(0.5)
    })

    try {
      if (!localStorage.getItem('dot-connect-seen-help-v1')) {
        localStorage.setItem('dot-connect-seen-help-v1', '1')
        this.scene.start('help', { next: 'select' })
      }
    } catch { /* ignore */ }
  }
}

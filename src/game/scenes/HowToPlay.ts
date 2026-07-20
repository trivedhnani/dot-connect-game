import Phaser from 'phaser'
import { TEXT_RESOLUTION } from '../ui'

export default class HowToPlay extends Phaser.Scene {
  constructor() { super('help') }

  create(data: { next: 'select' | 'play'; nextData?: object }) {
    const { width, height } = this.scale
    const cx = width / 2

    // Full-screen dark panel
    this.add.rectangle(0, 0, width, height, 0x14141f).setOrigin(0)

    // Title
    this.add.text(cx, 40, 'HOW TO PLAY', {
      fontSize: '22px',
      color: '#4be18a',
      resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5)

    // Rules text block
    const wrapWidth = Math.min(520, width - 40)
    this.add.text(cx, 80, [
      'Draw ONE line from the green dot to the ringed exit.',
      'Drag to draw; drag backwards to undo. Undoing is always free.',
      '',
      'Gray dots are optional loot — cover as many as you can.',
      'Heads up: covering EVERY gray is usually impossible — reds, doors and your own line get in the way. Chase the best haul, not perfection.',
      '',
      'YELLOW dots are DOORS: entering one spends a door point, permanently. When your LAST door point is spent, all remaining yellows turn RED.',
      '',
      'RED dots cost a life and rewind you to your last door (or the start). Out of lives = the level resets.',
      '',
      'CYAN dots (later levels) must all be visited before the exit opens.',
      '',
      'SCORING: graded against the best-known path — more grays, fewer doors, no red hits, shorter line.',
      '  60% * unlocks the next level',
      '  80% **',
      '  95% *** + the best path revealed free',
      '',
      'Reveal tokens show you the best path after a win.',
      'Earn +1 for each first-time ***.',
    ].join('\n'), {
      fontSize: '15px',
      fontFamily: 'monospace',
      color: '#cfd3e0',
      wordWrap: { width: wrapWidth },
      resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5, 0)

    // "Got it — play!" button
    this.add.text(cx, height - 60, 'Got it — play!', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#26263a',
      padding: { x: 12, y: 6 },
      resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(data.next === 'play' ? 'play' : 'select', data.nextData ?? {}))
  }
}

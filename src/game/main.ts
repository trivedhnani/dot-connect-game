import Phaser from 'phaser'
import PlayScene from './scenes/PlayScene'
import levels from '../levels/levels.json'

const first = (levels as { campaign: unknown[] }).campaign[0]

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#101018',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [PlayScene],
})
  .scene.start('play', { level: first })
// NOTE: Task 13 replaces this direct start with the LevelSelect scene.

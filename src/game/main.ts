import Phaser from 'phaser'
import PlayScene from './scenes/PlayScene'
import GradeOverlay from './scenes/GradeOverlay'
import LevelSelect from './scenes/LevelSelect'
import HowToPlay from './scenes/HowToPlay'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#101018',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [LevelSelect, PlayScene, GradeOverlay, HowToPlay],  // first scene auto-starts
})

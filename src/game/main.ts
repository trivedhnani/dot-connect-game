import Phaser from 'phaser'
import PlayScene from './scenes/PlayScene'
import GradeOverlay from './scenes/GradeOverlay'
import LevelSelect from './scenes/LevelSelect'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#101018',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [LevelSelect, PlayScene, GradeOverlay],  // first scene auto-starts
})

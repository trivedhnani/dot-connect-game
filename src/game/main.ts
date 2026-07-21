import Phaser from 'phaser'
import PlayScene from './scenes/PlayScene'
import GradeOverlay from './scenes/GradeOverlay'
import LevelSelect from './scenes/LevelSelect'
import HowToPlay from './scenes/HowToPlay'

const DPR = Math.min(window.devicePixelRatio || 1, 3)
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#f3f1ed',
  scale: {
    mode: Phaser.Scale.NONE,
    width: window.innerWidth * DPR,
    height: window.innerHeight * DPR,
    zoom: 1 / DPR,
  },
  scene: [LevelSelect, PlayScene, GradeOverlay, HowToPlay],  // first scene auto-starts
})
window.addEventListener('resize', () =>
  game.scale.resize(window.innerWidth * DPR, window.innerHeight * DPR))

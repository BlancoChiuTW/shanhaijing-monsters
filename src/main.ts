import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { IntroScene } from './scenes/IntroScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { OverworldScene } from './scenes/OverworldScene';
import { BattleScene } from './scenes/BattleScene';
import { EndingScene } from './scenes/EndingScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 640,
  height: 480,
  parent: document.body,
  backgroundColor: '#000000',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, IntroScene, MainMenuScene, OverworldScene, BattleScene, EndingScene],
};

new Phaser.Game(config);

import Phaser from 'phaser';
import { MONSTERS } from '../data/monsters';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload(): void {
    const { width, height } = this.scale;

    // 載入進度條
    const bar = this.add.rectangle(width / 2, height / 2, 300, 20, 0x222222);
    const fill = this.add.rectangle(width / 2 - 148, height / 2, 0, 16, 0xffcc44).setOrigin(0, 0.5);
    this.add.text(width / 2, height / 2 - 30, '載入中...', {
      fontSize: '16px', color: '#ffcc44', fontFamily: 'serif',
    }).setOrigin(0.5);

    this.load.on('progress', (p: number) => {
      fill.width = 296 * p;
    });

    // 載入磁磚
    this.load.image('tile_grass', 'assets/tiles/grass.png');
    this.load.image('tile_wall', 'assets/tiles/wall.png');
    this.load.image('tile_tall_grass', 'assets/tiles/tall_grass.png');
    this.load.image('tile_water', 'assets/tiles/water.png');
    this.load.image('tile_exit', 'assets/tiles/exit.png');
    this.load.image('tile_path', 'assets/tiles/path.png');
    this.load.image('tile_flower', 'assets/tiles/flower.png');

    // 載入靈獸
    for (const m of MONSTERS) {
      this.load.image(`monster_${m.id}`, `assets/monsters/${m.id}.png`);
    }

    // 載入角色精靈
    this.load.image('player', 'assets/characters/player.png');
    this.load.image('npc_healer', 'assets/characters/npc_healer.png');
    this.load.image('npc_fusion', 'assets/characters/npc_fusion.png');
    this.load.image('npc_trainer', 'assets/characters/npc_trainer.png');
    this.load.image('npc_default', 'assets/characters/npc_default.png');

    // 載入 UI 圖示 (game-icons.net CC BY 3.0)
    const icons = ['skill', 'swap', 'capture', 'run', 'backpack', 'absorb', 'pokedex', 'heal', 'save', 'close', 'npc_heal', 'npc_fusion', 'npc_battle'];
    for (const ic of icons) {
      this.load.image(`icon_${ic}`, `assets/icons/${ic}.png`);
    }
  }

  create(): void {
    // 生成靈符材質
    this.generateCatchBall();
    this.scene.start('MainMenu');
  }

  private generateCatchBall(): void {
    const c = this.make.graphics({ x: 0, y: 0 });
    c.fillStyle(0xffdd44);
    c.fillCircle(8, 8, 7);
    c.lineStyle(1, 0xcc9900);
    c.strokeCircle(8, 8, 7);
    c.fillStyle(0xff4444);
    c.fillCircle(8, 8, 3);
    c.fillStyle(0xffffff);
    c.fillCircle(8, 8, 1);
    c.lineStyle(1, 0xcc9900);
    c.lineBetween(1, 8, 15, 8);
    c.generateTexture('catch_ball', 16, 16);
    c.destroy();
  }
}

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

    // 載入靈獸
    for (const m of MONSTERS) {
      this.load.image(`monster_${m.id}`, `assets/monsters/${m.id}.png`);
    }
  }

  create(): void {
    // 生成角色精靈（程式產生，因為只是簡單小人）
    this.generateCharacterSprites();
    this.scene.start('MainMenu');
  }

  private generateCharacterSprites(): void {
    // 玩家 - 藍色小人 16x16
    const p = this.make.graphics({ x: 0, y: 0 });
    p.fillStyle(0x3399ff);
    p.fillRoundedRect(4, 1, 8, 7, 2);
    p.fillStyle(0x2277cc);
    p.fillRect(5, 8, 6, 5);
    p.fillStyle(0x1155aa);
    p.fillRect(5, 13, 2, 2); p.fillRect(9, 13, 2, 2);
    p.fillStyle(0xffffff);
    p.fillRect(5, 3, 2, 2); p.fillRect(9, 3, 2, 2);
    p.fillStyle(0x000000);
    p.fillRect(6, 4, 1, 1); p.fillRect(10, 4, 1, 1);
    p.generateTexture('player', 16, 16);
    p.destroy();

    // NPC - 綠色小人
    const n = this.make.graphics({ x: 0, y: 0 });
    n.fillStyle(0x33cc66);
    n.fillRoundedRect(4, 1, 8, 7, 2);
    n.fillStyle(0x22aa55);
    n.fillRect(5, 8, 6, 5);
    n.fillStyle(0x118844);
    n.fillRect(5, 13, 2, 2); n.fillRect(9, 13, 2, 2);
    n.fillStyle(0xffffff);
    n.fillRect(5, 3, 2, 2); n.fillRect(9, 3, 2, 2);
    n.fillStyle(0x000000);
    n.fillRect(6, 4, 1, 1); n.fillRect(10, 4, 1, 1);
    n.generateTexture('npc', 16, 16);
    n.destroy();

    // 靈符
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

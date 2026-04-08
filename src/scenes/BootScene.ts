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

    // 載入磁磚 (SVG，渲染更清晰)
    const tileNames = ['grass', 'wall', 'tall_grass', 'water', 'exit', 'path', 'flower'];
    for (const t of tileNames) {
      this.load.svg(`tile_${t}`, `assets/tiles/${t}.svg`, { width: 64, height: 64 });
    }

    // 載入靈獸
    for (const m of MONSTERS) {
      this.load.image(`monster_${m.id}`, `assets/monsters/${m.id}.png`);
    }

    // 載入角色精靈 (SVG，渲染更清晰)
    const chars = ['player', 'npc_healer', 'npc_fusion', 'npc_trainer', 'npc_default'];
    for (const ch of chars) {
      this.load.svg(ch, `assets/characters/${ch}.svg`, { width: 64, height: 64 });
    }

    // 載入 UI 圖示 (SVG，修復灰階破圖問題；game-icons.net CC BY 3.0)
    const icons = ['skill', 'swap', 'capture', 'run', 'backpack', 'absorb', 'pokedex', 'heal', 'save', 'close', 'npc_heal', 'npc_fusion', 'npc_battle'];
    for (const ic of icons) {
      this.load.svg(`icon_${ic}`, `assets/icons/${ic}.svg`, { width: 32, height: 32 });
    }

    // 載入 VFX 特效
    const vfxTypes = ['impact', 'arcane', 'star', 'grow', 'light', 'aura'];
    for (const type of vfxTypes) {
      for (let i = 0; i < 6; i++) {
        this.load.image(`vfx_${type}_${i}`, `assets/vfx/vfx_${type}_${i}.png`);
      }
    }

    // 載入 BGM
    this.load.audio('bgm_battle', 'assets/bgm/bgm_battle.mp3');
    this.load.audio('bgm_overworld', 'assets/bgm/bgm_overworld.mp3');

    // 載入 UI 音效 (JDSherbert CC0)
    const sfxNames = ['cursor', 'select', 'cancel', 'error', 'popup_open', 'popup_close'];
    for (const sfx of sfxNames) {
      this.load.audio(`sfx_${sfx}`, `assets/sfx/sfx_${sfx}.ogg`);
    }
  }

  create(): void {
    // 生成靈符材質
    this.generateCatchBall();
    this.scene.start('Intro');
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

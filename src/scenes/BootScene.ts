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
      fontSize: '22px', color: '#ffcc44', fontFamily: 'serif',
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

    // 載入角色精靈
    // player: spritesheet (8幀×4方向，每格 64×64)
    this.load.spritesheet('player', 'assets/characters/player_walk.png', {
      frameWidth: 64, frameHeight: 64,
    });
    const npcChars = ['npc_healer', 'npc_fusion', 'npc_trainer', 'npc_default', 'npc_boss'];
    for (const ch of npcChars) {
      this.load.image(ch, `assets/characters/${ch}.png`);
    }
    this.load.image('boss_dialogue', 'assets/characters/boss_dialogue.png');

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

    // 建立玩家行走動畫 (spritesheet: 8幀×4排, 下/上/左/右)
    this.anims.create({ key: 'player_walk_down', frames: this.anims.generateFrameNumbers('player', { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'player_walk_up', frames: this.anims.generateFrameNumbers('player', { start: 8, end: 15 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'player_walk_left', frames: this.anims.generateFrameNumbers('player', { start: 16, end: 23 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'player_walk_right', frames: this.anims.generateFrameNumbers('player', { start: 24, end: 31 }), frameRate: 10, repeat: -1 });
    // 靜止幀（各方向第一幀）
    this.anims.create({ key: 'player_idle_down', frames: [{ key: 'player', frame: 0 }], frameRate: 1 });
    this.anims.create({ key: 'player_idle_up', frames: [{ key: 'player', frame: 8 }], frameRate: 1 });
    this.anims.create({ key: 'player_idle_left', frames: [{ key: 'player', frame: 16 }], frameRate: 1 });
    this.anims.create({ key: 'player_idle_right', frames: [{ key: 'player', frame: 24 }], frameRate: 1 });

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

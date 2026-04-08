import Phaser from 'phaser';
import { MONSTERS } from '../data/monsters';
import { initNewGame, loadGame, hasSave } from '../utils/gameState';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenu' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Background
    this.cameras.main.setBackgroundColor(0x0a0a1a);

    // Title
    this.add.text(width / 2, 80, '山海經', {
      fontSize: '64px',
      fontFamily: 'serif',
      color: '#ffcc44',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, 140, '— 靈 獸 錄 —', {
      fontSize: '28px',
      fontFamily: 'serif',
      color: '#aabbcc',
    }).setOrigin(0.5);

    this.add.text(width / 2, 180, 'Classic of Mountains & Seas: Monster Chronicle', {
      fontSize: '14px',
      color: '#667788',
    }).setOrigin(0.5);

    // Menu options
    const menuY = 260;

    // New Game
    const newGameBtn = this.add.text(width / 2, menuY, '【 新遊戲 】', {
      fontSize: '24px',
      fontFamily: 'serif',
      color: '#ffffff',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    newGameBtn.on('pointerover', () => newGameBtn.setColor('#ffcc44'));
    newGameBtn.on('pointerout', () => newGameBtn.setColor('#ffffff'));
    newGameBtn.on('pointerdown', () => this.showStarterSelect());

    // Continue
    if (hasSave()) {
      const continueBtn = this.add.text(width / 2, menuY + 50, '【 繼續遊戲 】', {
        fontSize: '24px',
        fontFamily: 'serif',
        color: '#ffffff',
        padding: { x: 20, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      continueBtn.on('pointerover', () => continueBtn.setColor('#ffcc44'));
      continueBtn.on('pointerout', () => continueBtn.setColor('#ffffff'));
      continueBtn.on('pointerdown', () => {
        const state = loadGame();
        if (state) {
          this.scene.start('Overworld');
        }
      });
    }

    // 操作說明
    this.add.text(width / 2, height - 65, '操作：方向鍵/WASD 移動 ｜ Z/Space/Enter 對話 ｜ M/ESC 選單', {
      fontSize: '10px',
      color: '#556677',
    }).setOrigin(0.5);

    // Credits
    this.add.text(width / 2, height - 30, 'v0.3 Demo — BlancoChiuTW | Icons: game-icons.net (CC BY 3.0)', {
      fontSize: '12px',
      color: '#445566',
    }).setOrigin(0.5);
  }

  private showStarterSelect(): void {
    // Clear current scene content
    this.children.removeAll();

    const { width } = this.scale;

    this.add.text(width / 2, 40, '選擇你的初始靈獸', {
      fontSize: '28px',
      fontFamily: 'serif',
      color: '#ffcc44',
    }).setOrigin(0.5);

    // 3 starters: 窮奇(風), 畢方(火), 鯤(水)
    const starters = ['qiongqi', 'bifang', 'kun'];
    const starterData = starters.map(id => MONSTERS.find(m => m.id === id)!);

    starterData.forEach((monster, i) => {
      const x = width / 2 + (i - 1) * 200;
      const y = 200;

      // Monster preview box
      const box = this.add.rectangle(x, y, 160, 200, 0x1a1a2e, 0.8);
      box.setStrokeStyle(2, 0x334455);
      box.setInteractive({ useHandCursor: true });

      // Monster color block
      this.add.rectangle(x, y - 40, 60, 60, monster.color);

      // Name
      this.add.text(x, y + 20, monster.name, {
        fontSize: '22px',
        fontFamily: 'serif',
        color: '#ffffff',
      }).setOrigin(0.5);

      // Element
      this.add.text(x, y + 48, `屬性：${monster.element}`, {
        fontSize: '14px',
        color: '#aabbcc',
      }).setOrigin(0.5);

      // Stats
      this.add.text(x, y + 70, `HP:${monster.baseHp} 攻:${monster.baseAtk}\n防:${monster.baseDef} 速:${monster.baseSpd}`, {
        fontSize: '12px',
        color: '#889999',
        align: 'center',
      }).setOrigin(0.5);

      box.on('pointerover', () => box.setStrokeStyle(2, 0xffcc44));
      box.on('pointerout', () => box.setStrokeStyle(2, 0x334455));
      box.on('pointerdown', () => {
        initNewGame(monster.id);
        this.scene.start('Overworld');
      });
    });

    // Back button
    const backBtn = this.add.text(width / 2, 380, '[返回]', {
      fontSize: '16px',
      color: '#667788',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.children.removeAll();
      this.create();
    });
  }
}

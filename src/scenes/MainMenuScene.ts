import Phaser from 'phaser';
import { MONSTERS, type CultivationMethod } from '../data/monsters';
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
    this.add.text(width / 2, 90, '山海經', {
      fontSize: '64px',
      fontFamily: 'serif',
      color: '#ffcc44',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, 140, '— 靈 獸 錄 —', {
      fontSize: '30px',
      fontFamily: 'serif',
      color: '#aabbcc',
    }).setOrigin(0.5);

    this.add.text(width / 2, 170, 'Classic of Mountains & Seas: Monster Chronicle', {
      fontSize: '15px',
      color: '#667788',
    }).setOrigin(0.5);

    // Menu options
    const menuY = 240;

    // New Game
    const newGameBtn = this.add.text(width / 2, menuY, '【 新遊戲 】', {
      fontSize: '28px',
      fontFamily: 'serif',
      color: '#ffffff',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    newGameBtn.on('pointerover', () => newGameBtn.setColor('#ffcc44'));
    newGameBtn.on('pointerout', () => newGameBtn.setColor('#ffffff'));
    newGameBtn.on('pointerdown', () => this.showCultivationSelect());

    // Continue
    if (hasSave()) {
      const continueBtn = this.add.text(width / 2, menuY + 45, '【 繼續遊戲 】', {
        fontSize: '28px',
        fontFamily: 'serif',
        color: '#ffffff',
        padding: { x: 16, y: 8 },
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
    this.add.text(width / 2, height - 55, '操作：方向鍵/WASD 移動 ｜ Shift 加速 ｜ Z/Space 對話 ｜ M 地圖 ｜ B 選單', {
      fontSize: '13px',
      color: '#556677',
    }).setOrigin(0.5);

    // Credits
    this.add.text(width / 2, height - 30, 'v0.4 Demo — BlancoChiuTW × Claude | Icons: game-icons.net (CC BY 3.0)', {
      fontSize: '14px',
      color: '#445566',
    }).setOrigin(0.5);
  }

  private showCultivationSelect(): void {
    this.children.removeAll();
    const { width, height } = this.scale;

    this.add.text(width / 2, 25, '選擇修煉功法', {
      fontSize: '30px', fontFamily: 'serif', color: '#ffcc44',
    }).setOrigin(0.5);

    this.add.text(width / 2, 52, '功法決定你的戰鬥風格，同時獲得三隻初始靈獸', {
      fontSize: '14px', color: '#667788',
    }).setOrigin(0.5);

    const methods: { id: CultivationMethod; name: string; color: number; desc: string; detail: string }[] = [
      {
        id: '御獸神訣', name: '御獸神訣', color: 0xffcc44,
        desc: '本命靈寵',
        detail: '選擇一隻本命靈寵\n全能力 ×1.5 倍\n專注培養最強一寵',
      },
      {
        id: '萬靈化型變', name: '萬靈化型變', color: 0xcc66ff,
        desc: '變身戰鬥',
        detail: '變身為見過的靈獸出戰\n全能力 ×1.1 倍\n可自由切換變身形態',
      },
      {
        id: '煉天大法', name: '煉天大法', color: 0xff4444,
        desc: '煉化吞噬',
        detail: '親自上場戰鬥\n煉化吸收敵方(HP<15%)\n可煉化靈獸與人類',
      },
    ];

    const boxSpacing = Math.min(190, (width - 40) / 3);
    methods.forEach((method, i) => {
      const x = width / 2 + (i - 1) * boxSpacing;
      const y = 190;
      const boxW = boxSpacing - 10;

      const box = this.add.rectangle(x, y, boxW, 190, 0x1a1a2e, 0.8);
      box.setStrokeStyle(2, 0x334455);
      box.setInteractive({ useHandCursor: true });

      this.add.rectangle(x, y - 55, 36, 36, method.color, 0.8);

      this.add.text(x, y - 20, method.name, {
        fontSize: '18px', fontFamily: 'serif', color: '#ffffff',
      }).setOrigin(0.5);

      this.add.text(x, y + 2, method.desc, {
        fontSize: '15px', color: '#aabbcc',
      }).setOrigin(0.5);

      this.add.text(x, y + 30, method.detail, {
        fontSize: '13px', color: '#889999', align: 'center', lineSpacing: 2,
        wordWrap: { width: boxW - 16 },
      }).setOrigin(0.5);

      box.on('pointerover', () => box.setStrokeStyle(2, method.color));
      box.on('pointerout', () => box.setStrokeStyle(2, 0x334455));
      box.on('pointerdown', () => {
        if (method.id === '御獸神訣') {
          this.showSoulBoundSelect();
        } else {
          initNewGame(method.id);
          this.scene.start('Overworld');
        }
      });
    });

    const backBtn = this.add.text(width / 2, height - 35, '[返回]', {
      fontSize: '18px', color: '#667788',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => { this.children.removeAll(); this.create(); });
  }

  private showSoulBoundSelect(): void {
    this.children.removeAll();
    const { width, height } = this.scale;

    this.add.text(width / 2, 30, '選擇本命靈寵', {
      fontSize: '30px', fontFamily: 'serif', color: '#ffcc44',
    }).setOrigin(0.5);

    this.add.text(width / 2, 60, '本命靈寵全能力 ×1.5 倍，三隻都會加入隊伍', {
      fontSize: '14px', color: '#667788',
    }).setOrigin(0.5);

    const starters = ['qiongqi', 'bifang', 'kun'];
    const starterData = starters.map(id => MONSTERS.find(m => m.id === id)!);

    const boxSpacing = Math.min(190, (width - 40) / 3);
    starterData.forEach((monster, i) => {
      const x = width / 2 + (i - 1) * boxSpacing;
      const y = 200;
      const boxW = boxSpacing - 10;

      const box = this.add.rectangle(x, y, boxW, 190, 0x1a1a2e, 0.8);
      box.setStrokeStyle(2, 0x334455);
      box.setInteractive({ useHandCursor: true });

      this.add.rectangle(x, y - 40, 50, 50, monster.color);

      this.add.text(x, y + 15, monster.name, {
        fontSize: '24px', fontFamily: 'serif', color: '#ffffff',
      }).setOrigin(0.5);

      this.add.text(x, y + 40, `屬性：${monster.element}`, {
        fontSize: '15px', color: '#aabbcc',
      }).setOrigin(0.5);

      this.add.text(x, y + 60, `HP:${Math.floor(monster.baseHp * 1.5)} 攻:${Math.floor(monster.baseAtk * 1.5)}\n防:${Math.floor(monster.baseDef * 1.5)} 速:${Math.floor(monster.baseSpd * 1.5)}`, {
        fontSize: '14px', color: '#ffcc44', align: 'center',
      }).setOrigin(0.5);

      box.on('pointerover', () => box.setStrokeStyle(2, 0xffcc44));
      box.on('pointerout', () => box.setStrokeStyle(2, 0x334455));
      box.on('pointerdown', () => {
        initNewGame('御獸神訣', monster.id);
        this.scene.start('Overworld');
      });
    });

    const backBtn = this.add.text(width / 2, height - 35, '[返回選功法]', {
      fontSize: '18px', color: '#667788',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.showCultivationSelect());
  }
}

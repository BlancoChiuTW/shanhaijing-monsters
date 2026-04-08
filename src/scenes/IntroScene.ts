import Phaser from 'phaser';

/**
 * 開場動畫 + 劇情簡介
 * BootScene → IntroScene → MainMenuScene
 */
export class IntroScene extends Phaser.Scene {
  private storyLines: { text: string; delay: number; style?: Partial<Phaser.Types.GameObjects.Text.TextStyle> }[] = [];
  private currentLine = 0;
  private canSkip = false;

  constructor() {
    super({ key: 'Intro' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x000000);

    // 劇情文字
    this.storyLines = [
      {
        text: '太古之初，天地未分，混沌之中孕育萬靈...',
        delay: 0,
        style: { fontSize: '16px', color: '#667788', fontFamily: 'serif' },
      },
      {
        text: '盤古開天，女媧造人，靈獸與人共居於世。',
        delay: 0,
        style: { fontSize: '16px', color: '#8899aa', fontFamily: 'serif' },
      },
      {
        text: '《山海經》記載了四百餘種奇獸異靈——\n窮奇噬惡、畢方司火、鯤鵬化翼...',
        delay: 0,
        style: { fontSize: '15px', color: '#aabbcc', fontFamily: 'serif' },
      },
      {
        text: '然而千年之後，靈脈漸衰，靈獸與人之間的契約逐漸被遺忘。',
        delay: 0,
        style: { fontSize: '15px', color: '#8899aa', fontFamily: 'serif' },
      },
      {
        text: '直到——冥界之門再度開啟，\n幽羅冥王率眾魔侵入人間。',
        delay: 0,
        style: { fontSize: '16px', color: '#ff6655', fontFamily: 'serif' },
      },
      {
        text: '唯有重新喚醒山海之力，\n以靈獸師之名，踏上征途。',
        delay: 0,
        style: { fontSize: '16px', color: '#ffcc44', fontFamily: 'serif' },
      },
      {
        text: '你，便是最後的靈獸師。',
        delay: 0,
        style: { fontSize: '20px', color: '#ffffff', fontFamily: 'serif', fontStyle: 'bold' },
      },
    ];

    // 跳過提示
    const skipText = this.add.text(width - 20, height - 20, '按任意鍵跳過', {
      fontSize: '10px', color: '#445566',
    }).setOrigin(1, 1).setAlpha(0);

    this.tweens.add({
      targets: skipText, alpha: 0.8, duration: 2000, delay: 1000,
    });

    // 開場：山海經書卷展開動畫
    const scrollTop = this.add.rectangle(width / 2, 0, width, height / 2, 0x0a0a1a);
    const scrollBot = this.add.rectangle(width / 2, height, width, height / 2, 0x0a0a1a);
    scrollTop.setOrigin(0.5, 1).setDepth(10);
    scrollBot.setOrigin(0.5, 0).setDepth(10);

    // 書卷打開效果
    this.tweens.add({
      targets: scrollTop, y: -height / 4,
      duration: 1500, ease: 'Power2',
    });
    this.tweens.add({
      targets: scrollBot, y: height + height / 4,
      duration: 1500, ease: 'Power2',
      onComplete: () => {
        scrollTop.destroy();
        scrollBot.destroy();
        this.startStory();
      },
    });

    // 粒子點綴：漂浮的靈氣光點
    this.createFloatingParticles();

    // 輸入跳過
    this.time.delayedCall(500, () => {
      this.canSkip = true;
    });

    this.input.keyboard?.on('keydown', () => {
      if (this.canSkip) this.skipToMenu();
    });
    this.input.on('pointerdown', () => {
      if (this.canSkip) this.advanceOrSkip();
    });
  }

  private createFloatingParticles(): void {
    const { width, height } = this.scale;
    const colors = [0xffcc44, 0x44ccff, 0xcc66ff, 0xff6644, 0x44ff88];

    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const dot = this.add.circle(x, y, 1 + Math.random() * 2, color, 0.3 + Math.random() * 0.4);
      dot.setDepth(1);

      this.tweens.add({
        targets: dot,
        y: y - 30 - Math.random() * 50,
        x: x + (Math.random() - 0.5) * 40,
        alpha: 0,
        duration: 3000 + Math.random() * 4000,
        delay: Math.random() * 5000,
        repeat: -1,
        onRepeat: () => {
          dot.setPosition(Math.random() * width, height + 10);
          dot.setAlpha(0.3 + Math.random() * 0.4);
        },
      });
    }
  }

  private startStory(): void {
    this.showLine(0);
  }

  private showLine(index: number): void {
    if (index >= this.storyLines.length) {
      this.transitionToMenu();
      return;
    }

    this.currentLine = index;
    const { width, height } = this.scale;
    const line = this.storyLines[index];

    const textObj = this.add.text(width / 2, height / 2, line.text, {
      fontSize: '16px',
      color: '#aabbcc',
      fontFamily: 'serif',
      align: 'center',
      lineSpacing: 8,
      ...line.style,
    }).setOrigin(0.5).setAlpha(0).setDepth(5);

    // 淡入
    this.tweens.add({
      targets: textObj, alpha: 1, duration: 800, ease: 'Power1',
      onComplete: () => {
        // 停留後淡出
        this.time.delayedCall(2200, () => {
          this.tweens.add({
            targets: textObj, alpha: 0, duration: 600,
            onComplete: () => {
              textObj.destroy();
              this.showLine(index + 1);
            },
          });
        });
      },
    });
  }

  private advanceOrSkip(): void {
    // 點擊加速：跳到下一句
    if (this.currentLine < this.storyLines.length - 1) {
      this.tweens.killAll();
      this.children.getAll().forEach(child => {
        if (child instanceof Phaser.GameObjects.Text && child.depth === 5) {
          child.destroy();
        }
      });
      this.showLine(this.currentLine + 1);
    } else {
      this.skipToMenu();
    }
  }

  private skipToMenu(): void {
    this.tweens.killAll();
    this.transitionToMenu();
  }

  private transitionToMenu(): void {
    this.canSkip = false;
    const { width, height } = this.scale;

    // 標題閃現
    const title = this.add.text(width / 2, height / 2 - 20, '山海經', {
      fontSize: '48px', fontFamily: 'serif', color: '#ffcc44', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0).setDepth(20);

    const subtitle = this.add.text(width / 2, height / 2 + 30, '靈 獸 錄', {
      fontSize: '24px', fontFamily: 'serif', color: '#aabbcc',
    }).setOrigin(0.5).setAlpha(0).setDepth(20);

    this.tweens.add({
      targets: title, alpha: 1, duration: 1000, ease: 'Power2',
    });
    this.tweens.add({
      targets: subtitle, alpha: 1, duration: 1000, delay: 500, ease: 'Power2',
    });

    this.time.delayedCall(2500, () => {
      this.cameras.main.fadeOut(800, 0, 0, 0);
      this.time.delayedCall(900, () => {
        this.scene.start('MainMenu');
      });
    });
  }
}

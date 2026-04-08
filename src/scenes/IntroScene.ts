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
        text: '太古紀元，混沌值：∞。\n天地未分，萬靈胚胎沉眠其中。',
        delay: 0,
        style: { fontSize: '15px', color: '#667788', fontFamily: 'serif' },
      },
      {
        text: '盤古斬開天地，女媧摶土造人。\n靈獸與人立下第一契約——共生協議，效力：永久。',
        delay: 0,
        style: { fontSize: '14px', color: '#8899aa', fontFamily: 'serif' },
      },
      {
        text: '《山海經》存檔四百餘種靈獸數據：\n窮奇【噬惡係數S級】、畢方【火靈親和度99】、\n鯤鵬【形態解放需求：境界突破×3】……',
        delay: 0,
        style: { fontSize: '13px', color: '#aabbcc', fontFamily: 'serif' },
      },
      {
        text: '千年侵蝕。靈脈衰退值每紀上升17%。\n契約鏈逐條斷裂，靈獸退化，人間遺忘。',
        delay: 0,
        style: { fontSize: '14px', color: '#8899aa', fontFamily: 'serif' },
      },
      {
        text: '冥界封印：第九重破除。\n幽羅冥王降臨——初階討伐成功率：0.3%。',
        delay: 0,
        style: { fontSize: '15px', color: '#ff6655', fontFamily: 'serif' },
      },
      {
        text: '唯一解法：山海之力全解鎖。\n路徑：靈獸師主線，難度：地獄。',
        delay: 0,
        style: { fontSize: '15px', color: '#ffcc44', fontFamily: 'serif' },
      },
      {
        text: '你，便是最後的靈獸師。\n\n【不。是第二次了。】',
        delay: 0,
        style: { fontSize: '18px', color: '#ffffff', fontFamily: 'serif', fontStyle: 'bold' },
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

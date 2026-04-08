import Phaser from 'phaser';
import { MONSTERS, getCultivation } from '../data/monsters';
import { getState } from '../utils/gameState';

type EndingType = 'true' | 'normal' | 'bad';

const ENDING_CONFIG: Record<EndingType, {
  bg: number;
  title: string;
  subtitle: string;
  titleColor: string;
  subtitleColor: string;
  starAlpha: number;
  narratives: string[];
}> = {
  true: {
    bg: 0x0a0a2a,
    title: '— TRUE END —',
    subtitle: '靈獸之絆',
    titleColor: '#ffcc44',
    subtitleColor: '#88ccff',
    starAlpha: 0.6,
    narratives: [
      '你以壓倒性的實力擊敗了冥王·幽羅。',
      '你與靈寵們的羈絆化為最強的力量，',
      '守護了這片山海大地的安寧。',
      '',
      '從此，你的名號響徹五域——',
      '「山海靈獸師」。',
    ],
  },
  normal: {
    bg: 0x1a0a0a,
    title: '— NORMAL END —',
    subtitle: '孤獨的勝利',
    titleColor: '#cc8844',
    subtitleColor: '#aa7766',
    starAlpha: 0.3,
    narratives: [
      '你犧牲了所有靈寵的力量，擊敗了冥王·幽羅。',
      '曾與你並肩作戰的夥伴們，化為了你體內的力量...',
      '',
      '你贏了，但代價是失去了一切。',
      '站在幽都的廢墟上，你握緊了空蕩蕩的拳頭。',
      '',
      '也許...還有別的方式。',
    ],
  },
  bad: {
    bg: 0x0a0008,
    title: '— BAD END —',
    subtitle: '沉淪',
    titleColor: '#882222',
    subtitleColor: '#664444',
    starAlpha: 0.15,
    narratives: [
      '你在冥王·幽羅的力量面前倒下了。',
      '你的靈魂永遠沉淪於幽都深處，',
      '成為冥界的一縷亡魂...',
      '',
      '下次...一定能贏。',
    ],
  },
};

export class EndingScene extends Phaser.Scene {
  private endingType: EndingType = 'true';

  constructor() {
    super({ key: 'Ending' });
  }

  init(data: { endingType?: string }): void {
    const t = data.endingType;
    this.endingType = (t === 'true' || t === 'normal' || t === 'bad') ? t : 'true';
  }

  create(): void {
    const { width, height } = this.scale;
    const state = getState();
    const cfg = ENDING_CONFIG[this.endingType];

    this.cameras.main.setBackgroundColor(cfg.bg);
    this.cameras.main.fadeIn(1000);

    // 星空背景
    for (let i = 0; i < 60; i++) {
      const star = this.add.circle(
        Math.random() * width,
        Math.random() * height,
        0.5 + Math.random() * 1.5,
        0xffffff,
        cfg.starAlpha * (0.3 + Math.random() * 0.7),
      );
      this.tweens.add({
        targets: star,
        alpha: 0.05,
        duration: 1000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
      });
    }

    // 標題
    const title = this.add.text(width / 2, 40, '山海靈獸師', {
      fontSize: '38px', fontFamily: 'serif', color: cfg.titleColor, fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, duration: 1500 });

    // 結局類型副標題
    const endLabel = this.add.text(width / 2, 80, cfg.title, {
      fontSize: '22px', fontFamily: 'serif', color: cfg.subtitleColor,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: endLabel, alpha: 1, duration: 1500, delay: 300 });

    const endSubLabel = this.add.text(width / 2, 105, cfg.subtitle, {
      fontSize: '14px', fontFamily: 'serif', color: cfg.subtitleColor,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: endSubLabel, alpha: 1, duration: 1200, delay: 600 });

    // 敘事文字
    let delay = 1500;
    cfg.narratives.forEach((line, i) => {
      const txt = this.add.text(width / 2, 135 + i * 18, line, {
        fontSize: '11px', color: '#cccccc', align: 'center',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: txt, alpha: 1, duration: 600, delay });
      delay += 300;
    });

    delay += 200;

    // 隊伍展示（bad end 不展示詳情）
    if (this.endingType !== 'bad') {
      const teamLabel = this.add.text(width / 2, 135 + cfg.narratives.length * 18 + 10, '— 你的隊伍 —', {
        fontSize: '12px', color: '#888888',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: teamLabel, alpha: 1, duration: 600, delay });
      delay += 300;

      const teamStartY = 135 + cfg.narratives.length * 18 + 30;
      state.team.forEach((m, i) => {
        const y = teamStartY + i * 32;
        const cult = getCultivation(m.level);
        const shinyTag = m.isShiny ? '[異] ' : '';
        const fusedTag = m.isFused ? '[融] ' : '';
        const deadTag = this.endingType === 'normal' ? ' (已煉化)' : '';

        const sprite = this.add.image(65, y + 8, `monster_${m.templateId}`);
        sprite.setDisplaySize(24, 24).setAlpha(0);
        if (m.isShiny) sprite.setTint(0xffdd88);
        if (this.endingType === 'normal') sprite.setTint(0x555555);

        const info = this.add.text(85, y, `${shinyTag}${fusedTag}${m.nickname}${deadTag}`, {
          fontSize: '11px', color: this.endingType === 'normal' ? '#666666' : '#ffffff', fontStyle: 'bold',
        }).setAlpha(0);

        const cultText = this.add.text(85, y + 14, `${cult.displayName}  HP:${m.maxHp} 攻:${m.atk} 防:${m.def} 速:${m.spd}`, {
          fontSize: '8px', color: this.endingType === 'normal' ? '#555555' : cult.color,
        }).setAlpha(0);

        this.tweens.add({ targets: [sprite, info, cultText], alpha: 1, duration: 500, delay });
        delay += 200;
      });
    }

    delay += 300;

    // 圖鑑完成度
    const caught = state.caughtIds.size;
    const total = MONSTERS.length;
    const dexText = this.add.text(width / 2, height - 80, `靈獸圖鑑：${caught}/${total}`, {
      fontSize: '14px', color: '#ffcc44',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: dexText, alpha: 1, duration: 800, delay });

    // 製作人員
    const credits = this.add.text(width / 2, height - 55, 'v0.3 Demo — BlancoChiuTW x Claude | Icons: game-icons.net (CC BY 3.0)', {
      fontSize: '9px', color: '#445566',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: credits, alpha: 1, duration: 800, delay: delay + 300 });

    // 返回按鈕
    const backBtn = this.add.text(width / 2, height - 25, '【 返回主選單 】', {
      fontSize: '14px', color: '#667788',
    }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#ffcc44'));
    backBtn.on('pointerout', () => backBtn.setColor('#667788'));
    backBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(500);
      this.time.delayedCall(500, () => this.scene.start('MainMenu'));
    });

    this.tweens.add({ targets: backBtn, alpha: 1, duration: 800, delay: delay + 600 });
  }
}

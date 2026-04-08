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
      '冥王·幽羅，隕。',
      '【數據已核驗。與前世記憶偏差：零。】',
      '羈絆值臨界——轟。',
      '五道意志同頻共振，撕碎了神祇的防禦層。',
      '',
      '五域之名，自此刻起，刻入山海本源。',
      '「山海靈獸師」。',
      '【不過是遲到了五百年的結局。】',
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
      '幽羅倒下了。',
      '代價——五道意志，盡數煉化入骨。',
      '',
      '【勝率達成。但此路線，前世我亦走過。】',
      '【結果是：贏了術法，輸了一切能稱之為「我」的東西。】',
      '',
      '拳握緊。空蕩蕩的。',
      '「……還有別的算法。」',
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
      '噗。落地。',
      '【推算失誤點在第三階段——高估了本體恢復速率。】',
      '',
      '幽羅的術法漫過來，不急，像潮。',
      '靈魂沉降。一縷。再一縷。',
      '',
      '【下次。這一世的數據，留著用。】',
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
    const title = this.add.text(width / 2, 35, '山海靈獸師', {
      fontSize: '28px', fontFamily: 'serif', color: cfg.titleColor, fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, duration: 1500 });

    // 結局類型副標題
    const endLabel = this.add.text(width / 2, 65, cfg.title, {
      fontSize: '18px', fontFamily: 'serif', color: cfg.subtitleColor,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: endLabel, alpha: 1, duration: 1500, delay: 300 });

    const endSubLabel = this.add.text(width / 2, 88, cfg.subtitle, {
      fontSize: '12px', fontFamily: 'serif', color: cfg.subtitleColor,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: endSubLabel, alpha: 1, duration: 1200, delay: 600 });

    // 敘事文字
    let delay = 1500;
    cfg.narratives.forEach((line, i) => {
      const txt = this.add.text(width / 2, 110 + i * 16, line, {
        fontSize: '10px', color: '#cccccc', align: 'center',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: txt, alpha: 1, duration: 600, delay });
      delay += 300;
    });

    delay += 200;

    // 隊伍展示（bad end 不展示詳情）
    if (this.endingType !== 'bad') {
      const teamLabelY = 110 + cfg.narratives.length * 16 + 8;
      const teamLabel = this.add.text(width / 2, teamLabelY, '— 你的隊伍 —', {
        fontSize: '10px', color: '#888888',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: teamLabel, alpha: 1, duration: 600, delay });
      delay += 300;

      const teamStartY = teamLabelY + 18;
      state.team.forEach((m, i) => {
        const y = teamStartY + i * 28;
        const cult = getCultivation(m.level);
        const shinyTag = m.isShiny ? '[異] ' : '';
        const fusedTag = m.isFused ? '[融] ' : '';
        const deadTag = this.endingType === 'normal' ? ' (已煉化)' : '';

        const sprite = this.add.image(55, y + 6, `monster_${m.templateId}`);
        sprite.setDisplaySize(20, 20).setAlpha(0);
        if (m.isShiny) sprite.setTint(0xffdd88);
        if (this.endingType === 'normal') sprite.setTint(0x555555);

        const info = this.add.text(72, y, `${shinyTag}${fusedTag}${m.nickname}${deadTag}`, {
          fontSize: '10px', color: this.endingType === 'normal' ? '#666666' : '#ffffff', fontStyle: 'bold',
        }).setAlpha(0);

        const cultText = this.add.text(72, y + 13, `${cult.displayName}  HP:${m.maxHp} 攻:${m.atk} 防:${m.def} 速:${m.spd}`, {
          fontSize: '7px', color: this.endingType === 'normal' ? '#555555' : cult.color,
        }).setAlpha(0);

        this.tweens.add({ targets: [sprite, info, cultText], alpha: 1, duration: 500, delay });
        delay += 200;
      });
    }

    delay += 300;

    // 圖鑑完成度
    const caught = state.caughtIds.size;
    const total = MONSTERS.length;
    const dexText = this.add.text(width / 2, height - 65, `靈獸圖鑑：${caught}/${total}`, {
      fontSize: '12px', color: '#ffcc44',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: dexText, alpha: 1, duration: 800, delay });

    // 製作人員
    const credits = this.add.text(width / 2, height - 45, 'v0.4 Demo — BlancoChiuTW × Claude | Icons: game-icons.net (CC BY 3.0)', {
      fontSize: '8px', color: '#445566',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: credits, alpha: 1, duration: 800, delay: delay + 300 });

    // 返回按鈕
    const backBtn = this.add.text(width / 2, height - 22, '【 返回主選單 】', {
      fontSize: '12px', color: '#667788',
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

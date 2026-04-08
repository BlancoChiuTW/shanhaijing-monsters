import Phaser from 'phaser';
import { MONSTERS, getCultivation } from '../data/monsters';
import { getState } from '../utils/gameState';

export class EndingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Ending' });
  }

  create(): void {
    const { width, height } = this.scale;
    const state = getState();

    this.cameras.main.setBackgroundColor(0x0a0a1a);
    this.cameras.main.fadeIn(1000);

    // 星空背景
    for (let i = 0; i < 60; i++) {
      const star = this.add.circle(
        Math.random() * width,
        Math.random() * height,
        0.5 + Math.random() * 1.5,
        0xffffff,
        0.3 + Math.random() * 0.5,
      );
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: 1000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
      });
    }

    // 標題
    const title = this.add.text(width / 2, 60, '山海靈獸師', {
      fontSize: '42px', fontFamily: 'serif', color: '#ffcc44', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 1500,
    });

    // 副標題
    const subtitle = this.add.text(width / 2, 110, '— 通 關 —', {
      fontSize: '24px', fontFamily: 'serif', color: '#aabbcc',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      duration: 1500,
      delay: 500,
    });

    // 隊伍展示
    let delay = 1500;
    state.team.forEach((m, i) => {
      const y = 160 + i * 42;
      const cult = getCultivation(m.level);
      const shinyTag = m.isShiny ? '[異] ' : '';
      const fusedTag = m.isFused ? '[融] ' : '';

      // 靈獸圖片
      const sprite = this.add.image(80, y + 10, `monster_${m.templateId}`);
      sprite.setDisplaySize(32, 32).setAlpha(0);
      if (m.isShiny) sprite.setTint(0xffdd88);

      // 名稱與境界
      const info = this.add.text(105, y, `${shinyTag}${fusedTag}${m.nickname}`, {
        fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
      }).setAlpha(0);

      const cultText = this.add.text(105, y + 18, `${cult.displayName}  HP:${m.maxHp} 攻:${m.atk} 防:${m.def} 速:${m.spd}`, {
        fontSize: '9px', color: cult.color,
      }).setAlpha(0);

      this.tweens.add({ targets: [sprite, info, cultText], alpha: 1, duration: 600, delay });
      delay += 300;
    });

    // 圖鑑完成度
    const caught = state.caughtIds.size;
    const total = MONSTERS.length;
    const dexText = this.add.text(width / 2, height - 120, `靈獸圖鑑：${caught}/${total}`, {
      fontSize: '16px', color: '#ffcc44',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: dexText,
      alpha: 1,
      duration: 800,
      delay: delay + 500,
    });

    // 結語
    const ending = caught >= total
      ? '你已收集了所有山海靈獸，成為真正的山海靈獸師！'
      : '你打敗了冥王，成為最強的靈獸師！\n繼續探索，收集所有靈獸吧！';

    const endText = this.add.text(width / 2, height - 80, ending, {
      fontSize: '12px', color: '#aabbcc', align: 'center',
      wordWrap: { width: width - 60 },
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: endText,
      alpha: 1,
      duration: 800,
      delay: delay + 800,
    });

    // 製作人員
    const credits = this.add.text(width / 2, height - 40, 'v0.3 Demo — BlancoChiuTW x Claude | Icons: game-icons.net (CC BY 3.0)', {
      fontSize: '10px', color: '#445566',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: credits,
      alpha: 1,
      duration: 800,
      delay: delay + 1000,
    });

    // 返回按鈕
    const backBtn = this.add.text(width / 2, height - 15, '【 返回主選單 】', {
      fontSize: '14px', color: '#667788',
    }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#ffcc44'));
    backBtn.on('pointerout', () => backBtn.setColor('#667788'));
    backBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(500);
      this.time.delayedCall(500, () => this.scene.start('MainMenu'));
    });

    this.tweens.add({
      targets: backBtn,
      alpha: 1,
      duration: 800,
      delay: delay + 1200,
    });
  }
}

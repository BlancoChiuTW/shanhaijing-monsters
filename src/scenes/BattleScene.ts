import Phaser from 'phaser';
import { type MonsterInstance, type Skill, type Element, getTemplate } from '../data/monsters';
import { calculateDamage, calculateCatchRate, getExpReward, applyExp, enemyChooseAction } from '../utils/battle';
import { getState, addMonsterToTeam, getFirstAliveIndex } from '../utils/gameState';

interface BattleData {
  type: 'wild' | 'trainer';
  enemies: MonsterInstance[];
  trainerName?: string;
  trainerId?: string;
  onEnd?: () => void;
}

// 屬性特效顏色
const ELEMENT_COLORS: Record<Element, number> = {
  '風': 0x88ccff,
  '水': 0x3388dd,
  '火': 0xff4422,
  '光': 0xffee44,
  '幻': 0xcc66ff,
  '土': 0xaa8844,
  '毒': 0x66cc22,
};

export class BattleScene extends Phaser.Scene {
  private playerMonster!: MonsterInstance;
  private playerMonsterIndex = 0;
  private enemyMonster!: MonsterInstance;
  private enemyTeam: MonsterInstance[] = [];
  private enemyIndex = 0;
  private battleType: 'wild' | 'trainer' = 'wild';
  private trainerName = '';
  private trainerId = '';
  private onEnd?: () => void;

  // UI elements
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpBg!: Phaser.GameObjects.Rectangle;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBg!: Phaser.GameObjects.Rectangle;
  private playerInfoText!: Phaser.GameObjects.Text;
  private enemyInfoText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;
  private actionButtons: Phaser.GameObjects.Text[] = [];
  private skillButtons: Phaser.GameObjects.Text[] = [];
  private isAnimating = false;
  private playerSpriteOriginX = 0;
  private playerSpriteOriginY = 0;
  private enemySpriteOriginX = 0;
  private enemySpriteOriginY = 0;

  constructor() {
    super({ key: 'Battle' });
  }

  init(data: BattleData): void {
    // 重置所有狀態
    this.isAnimating = false;
    this.actionButtons = [];
    this.skillButtons = [];

    this.battleType = data.type;
    this.enemyTeam = data.enemies;
    this.enemyIndex = 0;
    this.enemyMonster = this.enemyTeam[0];
    this.trainerName = data.trainerName || '';
    this.trainerId = data.trainerId || '';
    this.onEnd = data.onEnd;

    const state = getState();
    this.playerMonsterIndex = getFirstAliveIndex();
    this.playerMonster = state.team[this.playerMonsterIndex];
  }

  create(): void {
    // 停止殘留的 tween
    this.tweens.killAll();

    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Battle arena
    this.add.rectangle(width / 2, height / 2 - 20, width - 40, height - 140, 0x0a0a1a, 0.5)
      .setStrokeStyle(1, 0x334455);

    // Enemy monster (top right)
    this.enemySpriteOriginX = width * 0.7;
    this.enemySpriteOriginY = height * 0.25;
    this.enemySprite = this.add.image(this.enemySpriteOriginX, this.enemySpriteOriginY, `monster_${this.enemyMonster.templateId}`);
    this.enemySprite.setDisplaySize(100, 100);

    // Player monster (bottom left)
    this.playerSpriteOriginX = width * 0.3;
    this.playerSpriteOriginY = height * 0.5;
    this.playerSprite = this.add.image(this.playerSpriteOriginX, this.playerSpriteOriginY, `monster_${this.playerMonster.templateId}`);
    this.playerSprite.setDisplaySize(120, 120);

    // Enemy info panel
    this.add.rectangle(width * 0.25, 30, 200, 50, 0x000000, 0.7).setStrokeStyle(1, 0x445566);
    this.enemyInfoText = this.add.text(width * 0.25 - 90, 14, '', { fontSize: '12px', color: '#ffffff' });
    this.enemyHpBg = this.add.rectangle(width * 0.25, 44, 160, 8, 0x333333);
    this.enemyHpBar = this.add.rectangle(width * 0.25 - 80, 44, 160, 8, 0x44cc44).setOrigin(0, 0.5);

    // Player info panel
    this.add.rectangle(width * 0.75, height * 0.62, 200, 50, 0x000000, 0.7).setStrokeStyle(1, 0x445566);
    this.playerInfoText = this.add.text(width * 0.75 - 90, height * 0.62 - 16, '', { fontSize: '12px', color: '#ffffff' });
    this.playerHpBg = this.add.rectangle(width * 0.75, height * 0.62 + 14, 160, 8, 0x333333);
    this.playerHpBar = this.add.rectangle(width * 0.75 - 80, height * 0.62 + 14, 160, 8, 0x44cc44).setOrigin(0, 0.5);

    // Message box
    this.add.rectangle(width / 2, height - 50, width - 20, 70, 0x000000, 0.85).setStrokeStyle(1, 0xffcc44);
    this.messageText = this.add.text(20, height - 78, '', {
      fontSize: '13px', color: '#ffffff', wordWrap: { width: width - 50 },
    });

    this.updateInfoPanels();

    const introMsg = this.battleType === 'wild'
      ? `野生的 ${this.enemyMonster.nickname} 出現了！`
      : `${this.trainerName} 派出了 ${this.enemyMonster.nickname}！`;
    this.showMessage(introMsg, () => this.showActions());
  }

  private updateInfoPanels(): void {
    this.enemyInfoText.setText(
      `${this.enemyMonster.nickname} Lv.${this.enemyMonster.level}  HP:${this.enemyMonster.hp}/${this.enemyMonster.maxHp}`
    );
    this.playerInfoText.setText(
      `${this.playerMonster.nickname} Lv.${this.playerMonster.level}  HP:${this.playerMonster.hp}/${this.playerMonster.maxHp}`
    );

    const enemyRatio = Math.max(0, this.enemyMonster.hp / this.enemyMonster.maxHp);
    const playerRatio = Math.max(0, this.playerMonster.hp / this.playerMonster.maxHp);

    this.tweens.add({ targets: this.enemyHpBar, displayWidth: Math.max(1, 160 * enemyRatio), duration: 300 });
    this.tweens.add({ targets: this.playerHpBar, displayWidth: Math.max(1, 160 * playerRatio), duration: 300 });

    this.enemyHpBar.fillColor = enemyRatio > 0.5 ? 0x44cc44 : enemyRatio > 0.2 ? 0xcccc44 : 0xcc4444;
    this.playerHpBar.fillColor = playerRatio > 0.5 ? 0x44cc44 : playerRatio > 0.2 ? 0xcccc44 : 0xcc4444;
  }

  private showMessage(msg: string, onComplete?: () => void): void {
    this.messageText.setText(msg);
    this.clearButtons();

    if (onComplete) {
      this.time.delayedCall(800, () => {
        if (this.scene.isActive()) onComplete();
      });
    }
  }

  private clearButtons(): void {
    this.actionButtons.forEach(b => b.destroy());
    this.actionButtons = [];
    this.skillButtons.forEach(b => b.destroy());
    this.skillButtons = [];
  }

  private showActions(): void {
    if (this.isAnimating) return;
    this.clearButtons();
    this.messageText.setText('選擇行動：');

    const { width, height } = this.scale;
    const actions = [
      { text: '⚔ 技能', action: () => this.showSkills() },
      { text: '🔄 換獸', action: () => this.showSwitchMenu() },
    ];

    if (this.battleType === 'wild') {
      actions.push({ text: '📜 捕獲', action: () => this.tryCatch() });
      actions.push({ text: '🏃 逃跑', action: () => this.tryRun() });
    } else {
      actions.push({ text: '🏃 認輸', action: () => this.tryRun() });
    }

    actions.forEach((act, i) => {
      const x = width / 2 - 120 + (i % 2) * 160;
      const y = height - 65 + Math.floor(i / 2) * 28;
      const btn = this.add.text(x, y, act.text, {
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      }).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#ffcc44'));
      btn.on('pointerout', () => btn.setColor('#ffffff'));
      btn.on('pointerdown', act.action);
      this.actionButtons.push(btn);
    });
  }

  private showSkills(): void {
    this.clearButtons();
    this.messageText.setText('選擇技能：');

    const { width, height } = this.scale;

    this.playerMonster.skills.forEach((s, i) => {
      const x = width / 2 - 120 + (i % 2) * 180;
      const y = height - 68 + Math.floor(i / 2) * 26;
      const color = s.currentPp > 0 ? '#ffffff' : '#555555';
      const elemColor = ELEMENT_COLORS[s.skill.element];
      const elemHex = '#' + elemColor.toString(16).padStart(6, '0');
      const label = `${s.skill.name}(${s.skill.element}) PP:${s.currentPp}/${s.skill.pp}`;
      const btn = this.add.text(x, y, label, {
        fontSize: '11px', color: s.currentPp > 0 ? elemHex : color,
      }).setInteractive({ useHandCursor: true });

      if (s.currentPp > 0) {
        btn.on('pointerover', () => btn.setColor('#ffcc44'));
        btn.on('pointerout', () => btn.setColor(elemHex));
        btn.on('pointerdown', () => this.executePlayerTurn(i));
      }
      this.skillButtons.push(btn);
    });

    const back = this.add.text(width / 2, height - 15, '← 返回', {
      fontSize: '11px', color: '#889999',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.showActions());
    this.skillButtons.push(back);
  }

  // ═══════════════════════════════════════
  //  技能特效系統
  // ═══════════════════════════════════════
  private playSkillVfx(skill: Skill, targetX: number, targetY: number, onDone: () => void): void {
    const color = ELEMENT_COLORS[skill.element];

    switch (skill.element) {
      case '火': {
        // 火焰爆發 - 多個火球散射
        for (let i = 0; i < 8; i++) {
          const flame = this.add.circle(targetX, targetY, 4 + Math.random() * 6, color, 0.9);
          flame.setDepth(50);
          const angle = (i / 8) * Math.PI * 2;
          this.tweens.add({
            targets: flame,
            x: targetX + Math.cos(angle) * (30 + Math.random() * 20),
            y: targetY + Math.sin(angle) * (30 + Math.random() * 20),
            alpha: 0,
            scale: 0.2,
            duration: 400,
            onComplete: () => flame.destroy(),
          });
        }
        // 中心閃光
        const flash = this.add.circle(targetX, targetY, 20, 0xffaa00, 0.8).setDepth(50);
        this.tweens.add({
          targets: flash, alpha: 0, scale: 2, duration: 300,
          onComplete: () => { flash.destroy(); onDone(); },
        });
        break;
      }
      case '水': {
        // 水花飛濺
        for (let i = 0; i < 10; i++) {
          const drop = this.add.circle(targetX + (Math.random() - 0.5) * 40, targetY - 20, 3, color, 0.8);
          drop.setDepth(50);
          this.tweens.add({
            targets: drop,
            y: targetY + 20 + Math.random() * 30,
            x: drop.x + (Math.random() - 0.5) * 30,
            alpha: 0,
            duration: 500,
            delay: i * 30,
            onComplete: () => drop.destroy(),
          });
        }
        this.time.delayedCall(500, onDone);
        break;
      }
      case '風': {
        // 風刃旋轉
        for (let i = 0; i < 6; i++) {
          const slash = this.add.rectangle(targetX, targetY, 30, 3, color, 0.7).setDepth(50);
          slash.setAngle(i * 30);
          this.tweens.add({
            targets: slash,
            angle: slash.angle + 180,
            scale: 1.5,
            alpha: 0,
            duration: 400,
            delay: i * 50,
            onComplete: () => slash.destroy(),
          });
        }
        this.time.delayedCall(500, onDone);
        break;
      }
      case '光': {
        // 光柱從天降下
        const beam = this.add.rectangle(targetX, targetY - 100, 20, 200, color, 0.6).setDepth(50);
        this.tweens.add({
          targets: beam,
          y: targetY, alpha: 0.9,
          duration: 200,
          yoyo: true,
          hold: 150,
          onComplete: () => { beam.destroy(); onDone(); },
        });
        // 光粒子
        for (let i = 0; i < 6; i++) {
          const p = this.add.circle(targetX + (Math.random() - 0.5) * 30, targetY + (Math.random() - 0.5) * 30, 3, 0xffffff, 0.9).setDepth(51);
          this.tweens.add({
            targets: p, y: p.y - 40, alpha: 0, duration: 600, delay: 100 + i * 50,
            onComplete: () => p.destroy(),
          });
        }
        break;
      }
      case '幻': {
        // 幻影扭曲
        const rings = [];
        for (let i = 0; i < 3; i++) {
          const ring = this.add.circle(targetX, targetY, 10 + i * 12, color, 0).setDepth(50);
          ring.setStrokeStyle(2, color);
          rings.push(ring);
          this.tweens.add({
            targets: ring,
            scale: 2,
            alpha: 0,
            duration: 500,
            delay: i * 120,
            onComplete: () => ring.destroy(),
          });
        }
        this.time.delayedCall(600, onDone);
        break;
      }
      case '土': {
        // 地面震動 + 岩石飛出
        this.cameras.main.shake(200, 0.01);
        for (let i = 0; i < 6; i++) {
          const rock = this.add.rectangle(
            targetX + (Math.random() - 0.5) * 50,
            targetY + 20,
            8 + Math.random() * 8,
            8 + Math.random() * 8,
            color, 0.9,
          ).setDepth(50).setAngle(Math.random() * 45);
          this.tweens.add({
            targets: rock,
            y: targetY - 30 - Math.random() * 40,
            alpha: 0,
            angle: rock.angle + 180,
            duration: 500,
            delay: i * 40,
            onComplete: () => rock.destroy(),
          });
        }
        this.time.delayedCall(500, onDone);
        break;
      }
      case '毒': {
        // 毒霧擴散
        for (let i = 0; i < 8; i++) {
          const bubble = this.add.circle(
            targetX + (Math.random() - 0.5) * 30,
            targetY + (Math.random() - 0.5) * 30,
            5 + Math.random() * 8,
            color,
            0.5,
          ).setDepth(50);
          this.tweens.add({
            targets: bubble,
            scale: 1.5 + Math.random(),
            alpha: 0,
            x: bubble.x + (Math.random() - 0.5) * 40,
            y: bubble.y - Math.random() * 30,
            duration: 600,
            delay: i * 50,
            onComplete: () => bubble.destroy(),
          });
        }
        this.time.delayedCall(700, onDone);
        break;
      }
      default:
        onDone();
    }
  }

  private executePlayerTurn(skillIndex: number): void {
    this.isAnimating = true;
    this.clearButtons();

    const playerSkill = this.playerMonster.skills[skillIndex];
    playerSkill.currentPp--;

    const enemySkillIndex = enemyChooseAction(this.enemyMonster);
    const enemySkill = this.enemyMonster.skills[enemySkillIndex];

    const playerFirst = this.playerMonster.spd >= this.enemyMonster.spd;

    if (playerFirst) {
      this.doAttack(this.playerMonster, this.enemyMonster, playerSkill.skill, true, () => {
        if (this.enemyMonster.hp <= 0) { this.onEnemyDefeated(); return; }
        enemySkill.currentPp--;
        this.doAttack(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
          if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
          this.isAnimating = false;
          this.showActions();
        });
      });
    } else {
      enemySkill.currentPp--;
      this.doAttack(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
        if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
        this.doAttack(this.playerMonster, this.enemyMonster, playerSkill.skill, true, () => {
          if (this.enemyMonster.hp <= 0) { this.onEnemyDefeated(); return; }
          this.isAnimating = false;
          this.showActions();
        });
      });
    }
  }

  private doAttack(
    attacker: MonsterInstance, defender: MonsterInstance,
    skill: Skill, isPlayer: boolean, onDone: () => void,
  ): void {
    if (Math.random() * 100 > skill.accuracy) {
      this.showMessage(`${attacker.nickname} 的 ${skill.name} 沒有命中！`, onDone);
      return;
    }

    // 回復技能
    if (skill.power === 0) {
      const healAmount = Math.floor(attacker.maxHp * 0.3);
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
      // 回復特效
      const sprite = isPlayer ? this.playerSprite : this.enemySprite;
      for (let i = 0; i < 5; i++) {
        const sparkle = this.add.circle(sprite.x + (Math.random() - 0.5) * 40, sprite.y + 20, 3, 0x44ff88, 0.9).setDepth(50);
        this.tweens.add({
          targets: sparkle, y: sparkle.y - 50, alpha: 0, duration: 600, delay: i * 80,
          onComplete: () => sparkle.destroy(),
        });
      }
      this.showMessage(`${attacker.nickname} 使用了 ${skill.name}！恢復了 ${healAmount} HP！`, () => {
        this.updateInfoPanels();
        onDone();
      });
      return;
    }

    const result = calculateDamage(attacker, defender, skill);
    defender.hp = Math.max(0, defender.hp - result.damage);

    const sprite = isPlayer ? this.playerSprite : this.enemySprite;
    const targetSprite = isPlayer ? this.enemySprite : this.playerSprite;

    // 攻擊者衝刺動畫
    this.tweens.add({
      targets: sprite,
      x: sprite.x + (isPlayer ? 40 : -40),
      duration: 100,
      yoyo: true,
      onComplete: () => {
        // 播放屬性特效
        this.playSkillVfx(skill, targetSprite.x, targetSprite.y, () => {
          // 被擊中閃爍
          this.tweens.add({
            targets: targetSprite,
            alpha: 0.2,
            duration: 60,
            yoyo: true,
            repeat: 3,
            onComplete: () => {
              targetSprite.setAlpha(1);
              this.updateInfoPanels();

              // 顯示傷害數字
              const dmgColor = result.effectiveness === 'effective' ? '#ff4444'
                : result.effectiveness === 'weak' ? '#888888' : '#ffffff';
              const dmgText = this.add.text(targetSprite.x, targetSprite.y - 30, `-${result.damage}`, {
                fontSize: result.isCrit ? '20px' : '16px',
                fontStyle: 'bold',
                color: dmgColor,
                stroke: '#000000',
                strokeThickness: 3,
              }).setOrigin(0.5).setDepth(60);
              this.tweens.add({
                targets: dmgText, y: dmgText.y - 30, alpha: 0, duration: 800,
                onComplete: () => dmgText.destroy(),
              });

              this.showMessage(result.message, onDone);
            },
          });
        });
      },
    });
  }

  private onEnemyDefeated(): void {
    this.tweens.add({
      targets: this.enemySprite,
      alpha: 0,
      y: this.enemySprite.y + 30,
      duration: 500,
      onComplete: () => {
        const exp = getExpReward(this.enemyMonster);
        const levelResult = applyExp(this.playerMonster, exp);

        let msg = `${this.enemyMonster.nickname} 被打倒了！獲得 ${exp} 經驗值。`;
        if (levelResult.leveled) {
          msg += `\n${this.playerMonster.nickname} 升級到了 Lv.${levelResult.newLevel}！`;
        }

        this.showMessage(msg, () => {
          this.updateInfoPanels();

          this.enemyIndex++;
          if (this.enemyIndex < this.enemyTeam.length) {
            this.enemyMonster = this.enemyTeam[this.enemyIndex];
            this.enemySprite.setTexture(`monster_${this.enemyMonster.templateId}`);
            this.enemySprite.setAlpha(1);
            this.enemySprite.setPosition(this.enemySpriteOriginX, this.enemySpriteOriginY);
            this.updateInfoPanels();
            this.showMessage(`對手派出了 ${this.enemyMonster.nickname}！`, () => {
              this.isAnimating = false;
              this.showActions();
            });
            return;
          }

          if (this.trainerId) {
            getState().defeatedTrainers.add(this.trainerId);
          }
          this.showMessage('戰鬥勝利！', () => this.endBattle());
        });
      },
    });
  }

  private onPlayerMonsterDefeated(): void {
    this.showMessage(`${this.playerMonster.nickname} 倒下了！`, () => {
      const state = getState();
      const nextAlive = getFirstAliveIndex();

      if (nextAlive === -1) {
        this.showMessage('所有靈獸都倒下了...回到起點休息。', () => {
          state.team.forEach(m => {
            m.hp = m.maxHp;
            m.skills.forEach(s => { s.currentPp = s.skill.pp; });
          });
          state.currentMapId = 'qingqiu';
          state.playerX = 3;
          state.playerY = 3;
          this.endBattle();
        });
        return;
      }

      this.playerMonsterIndex = nextAlive;
      this.playerMonster = state.team[nextAlive];
      this.playerSprite.setTexture(`monster_${this.playerMonster.templateId}`);
      this.playerSprite.setPosition(this.playerSpriteOriginX, this.playerSpriteOriginY);
      this.updateInfoPanels();
      this.showMessage(`換上了 ${this.playerMonster.nickname}！`, () => {
        this.isAnimating = false;
        this.showActions();
      });
    });
  }

  private tryCatch(): void {
    this.isAnimating = true;
    this.clearButtons();

    this.showMessage('投出靈符...', () => {
      this.tweens.add({
        targets: this.enemySprite,
        angle: { from: -10, to: 10 },
        duration: 200,
        repeat: 2,
        yoyo: true,
        onComplete: () => {
          this.enemySprite.angle = 0;
          const caught = calculateCatchRate(this.enemyMonster);

          if (caught) {
            // 捕獲成功特效
            this.tweens.add({
              targets: this.enemySprite,
              scale: 0, alpha: 0, duration: 400,
              onComplete: () => {
                const inTeam = addMonsterToTeam(this.enemyMonster);
                const msg = `成功捕獲了 ${this.enemyMonster.nickname}！` +
                  (inTeam ? '' : '\n隊伍已滿，已放入倉庫。');
                this.showMessage(msg, () => {
                  const state = getState();
                  if (state.caughtIds.size >= 10) {
                    this.showMessage('恭喜！你已經收集了所有十隻山海靈獸！\n你是真正的山海靈獸師！', () => {
                      this.endBattle();
                    });
                  } else {
                    this.endBattle();
                  }
                });
              },
            });
          } else {
            this.showMessage('捕獲失敗！靈獸掙脫了！', () => {
              const enemySkillIndex = enemyChooseAction(this.enemyMonster);
              const enemySkill = this.enemyMonster.skills[enemySkillIndex];
              enemySkill.currentPp--;
              this.doAttack(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
                if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
                this.isAnimating = false;
                this.showActions();
              });
            });
          }
        },
      });
    });
  }

  private tryRun(): void {
    this.clearButtons();
    if (this.battleType === 'wild') {
      const success = Math.random() < 0.7;
      if (success) {
        this.showMessage('成功逃跑了！', () => this.endBattle());
      } else {
        this.showMessage('逃跑失敗！', () => {
          const enemySkillIndex = enemyChooseAction(this.enemyMonster);
          const enemySkill = this.enemyMonster.skills[enemySkillIndex];
          enemySkill.currentPp--;
          this.doAttack(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
            if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
            this.isAnimating = false;
            this.showActions();
          });
        });
      }
    } else {
      this.showMessage('你認輸了...', () => this.endBattle());
    }
  }

  private showSwitchMenu(): void {
    this.clearButtons();
    this.messageText.setText('選擇要換上的靈獸：');

    const { width, height } = this.scale;
    const state = getState();

    state.team.forEach((m, i) => {
      if (i === this.playerMonsterIndex) return;
      const y = height - 80 + (i > this.playerMonsterIndex ? i - 1 : i) * 18;
      const color = m.hp > 0 ? '#ffffff' : '#555555';
      const label = `${m.nickname} Lv.${m.level} HP:${m.hp}/${m.maxHp}`;
      const btn = this.add.text(30, y, label, { fontSize: '11px', color })
        .setInteractive({ useHandCursor: true });

      if (m.hp > 0) {
        btn.on('pointerover', () => btn.setColor('#ffcc44'));
        btn.on('pointerout', () => btn.setColor(color));
        btn.on('pointerdown', () => {
          this.playerMonsterIndex = i;
          this.playerMonster = m;
          this.playerSprite.setTexture(`monster_${this.playerMonster.templateId}`);
          this.updateInfoPanels();
          this.clearButtons();
          this.showMessage(`換上了 ${m.nickname}！`, () => {
            const enemySkillIndex = enemyChooseAction(this.enemyMonster);
            const enemySkill = this.enemyMonster.skills[enemySkillIndex];
            enemySkill.currentPp--;
            this.doAttack(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
              if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
              this.isAnimating = false;
              this.showActions();
            });
          });
        });
      }
      this.skillButtons.push(btn);
    });

    const back = this.add.text(width / 2, height - 15, '← 返回', {
      fontSize: '11px', color: '#889999',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.showActions());
    this.skillButtons.push(back);
  }

  private endBattle(): void {
    this.isAnimating = false;
    this.tweens.killAll();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(350, () => {
      this.onEnd?.();
      this.scene.stop();
      this.scene.resume('Overworld');
    });
  }
}

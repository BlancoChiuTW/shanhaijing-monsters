import Phaser from 'phaser';
import { type MonsterInstance, type Skill, getTemplate } from '../data/monsters';
import { calculateDamage, calculateCatchRate, getExpReward, applyExp, enemyChooseAction } from '../utils/battle';
import { getState, addMonsterToTeam, getFirstAliveIndex } from '../utils/gameState';

interface BattleData {
  type: 'wild' | 'trainer';
  enemies: MonsterInstance[];
  trainerName?: string;
  trainerId?: string;
  onEnd?: () => void;
}

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
  private playerSprite!: Phaser.GameObjects.Rectangle;
  private enemySprite!: Phaser.GameObjects.Rectangle;
  private actionButtons: Phaser.GameObjects.Text[] = [];
  private skillButtons: Phaser.GameObjects.Text[] = [];
  private isAnimating = false;

  constructor() {
    super({ key: 'Battle' });
  }

  init(data: BattleData): void {
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
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Battle arena
    this.add.rectangle(width / 2, height / 2 - 20, width - 40, height - 140, 0x0a0a1a, 0.5)
      .setStrokeStyle(1, 0x334455);

    // Enemy monster (top right)
    const enemyTemplate = getTemplate(this.enemyMonster.templateId);
    this.enemySprite = this.add.rectangle(width * 0.7, height * 0.25, 64, 64, enemyTemplate.color);
    this.enemySprite.setStrokeStyle(2, 0xffffff);

    // Player monster (bottom left)
    const playerTemplate = getTemplate(this.playerMonster.templateId);
    this.playerSprite = this.add.rectangle(width * 0.3, height * 0.5, 72, 72, playerTemplate.color);
    this.playerSprite.setStrokeStyle(2, 0x3399ff);

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

    // Update HP bars
    const enemyRatio = Math.max(0, this.enemyMonster.hp / this.enemyMonster.maxHp);
    const playerRatio = Math.max(0, this.playerMonster.hp / this.playerMonster.maxHp);

    this.tweens.add({ targets: this.enemyHpBar, displayWidth: 160 * enemyRatio, duration: 300 });
    this.tweens.add({ targets: this.playerHpBar, displayWidth: 160 * playerRatio, duration: 300 });

    // Color based on HP
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
      const label = `${s.skill.name}(${s.skill.element}) PP:${s.currentPp}/${s.skill.pp}`;
      const btn = this.add.text(x, y, label, {
        fontSize: '11px', color,
      }).setInteractive({ useHandCursor: true });

      if (s.currentPp > 0) {
        btn.on('pointerover', () => btn.setColor('#ffcc44'));
        btn.on('pointerout', () => btn.setColor('#ffffff'));
        btn.on('pointerdown', () => this.executePlayerTurn(i));
      }
      this.skillButtons.push(btn);
    });

    // Back button
    const back = this.add.text(width / 2, height - 15, '← 返回', {
      fontSize: '11px', color: '#889999',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.showActions());
    this.skillButtons.push(back);
  }

  private executePlayerTurn(skillIndex: number): void {
    this.isAnimating = true;
    this.clearButtons();

    const playerSkill = this.playerMonster.skills[skillIndex];
    playerSkill.currentPp--;

    const enemySkillIndex = enemyChooseAction(this.enemyMonster);
    const enemySkill = this.enemyMonster.skills[enemySkillIndex];

    // Speed determines who goes first
    const playerFirst = this.playerMonster.spd >= this.enemyMonster.spd;

    if (playerFirst) {
      this.doAttack(this.playerMonster, this.enemyMonster, playerSkill.skill, true, () => {
        if (this.enemyMonster.hp <= 0) {
          this.onEnemyDefeated();
          return;
        }
        enemySkill.currentPp--;
        this.doAttack(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
          if (this.playerMonster.hp <= 0) {
            this.onPlayerMonsterDefeated();
            return;
          }
          this.isAnimating = false;
          this.showActions();
        });
      });
    } else {
      enemySkill.currentPp--;
      this.doAttack(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
        if (this.playerMonster.hp <= 0) {
          this.onPlayerMonsterDefeated();
          return;
        }
        this.doAttack(this.playerMonster, this.enemyMonster, playerSkill.skill, true, () => {
          if (this.enemyMonster.hp <= 0) {
            this.onEnemyDefeated();
            return;
          }
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
    // Check accuracy
    if (Math.random() * 100 > skill.accuracy) {
      this.showMessage(`${attacker.nickname} 的 ${skill.name} 沒有命中！`, onDone);
      return;
    }

    // Healing skills (power = 0)
    if (skill.power === 0) {
      const healAmount = Math.floor(attacker.maxHp * 0.3);
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
      this.showMessage(`${attacker.nickname} 使用了 ${skill.name}！恢復了 ${healAmount} HP！`, () => {
        this.updateInfoPanels();
        onDone();
      });
      return;
    }

    const result = calculateDamage(attacker, defender, skill);
    defender.hp = Math.max(0, defender.hp - result.damage);

    // Attack animation
    const sprite = isPlayer ? this.playerSprite : this.enemySprite;
    const targetSprite = isPlayer ? this.enemySprite : this.playerSprite;

    this.tweens.add({
      targets: sprite,
      x: sprite.x + (isPlayer ? 30 : -30),
      duration: 100,
      yoyo: true,
      onComplete: () => {
        // Flash target
        this.tweens.add({
          targets: targetSprite,
          alpha: 0.3,
          duration: 80,
          yoyo: true,
          repeat: 2,
          onComplete: () => {
            this.updateInfoPanels();
            this.showMessage(result.message, onDone);
          },
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
        // Give exp
        const exp = getExpReward(this.enemyMonster);
        const levelResult = applyExp(this.playerMonster, exp);

        let msg = `${this.enemyMonster.nickname} 被打倒了！獲得 ${exp} 經驗值。`;
        if (levelResult.leveled) {
          msg += `\n${this.playerMonster.nickname} 升級到了 Lv.${levelResult.newLevel}！`;
        }

        this.showMessage(msg, () => {
          this.updateInfoPanels();

          // Check for next enemy in trainer battle
          this.enemyIndex++;
          if (this.enemyIndex < this.enemyTeam.length) {
            this.enemyMonster = this.enemyTeam[this.enemyIndex];
            const template = getTemplate(this.enemyMonster.templateId);
            this.enemySprite.fillColor = template.color;
            this.enemySprite.setAlpha(1);
            this.enemySprite.y -= 30;
            this.updateInfoPanels();
            this.showMessage(`對手派出了 ${this.enemyMonster.nickname}！`, () => {
              this.isAnimating = false;
              this.showActions();
            });
            return;
          }

          // Battle won
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
        // All monsters fainted
        this.showMessage('所有靈獸都倒下了...回到起點休息。', () => {
          // Heal and reset position
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

      // Auto switch to next alive monster
      this.playerMonsterIndex = nextAlive;
      this.playerMonster = state.team[nextAlive];
      const template = getTemplate(this.playerMonster.templateId);
      this.playerSprite.fillColor = template.color;
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
      // Shake animation
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
            const inTeam = addMonsterToTeam(this.enemyMonster);
            const msg = `成功捕獲了 ${this.enemyMonster.nickname}！` +
              (inTeam ? '' : '\n隊伍已滿，已放入倉庫。');
            this.showMessage(msg, () => {
              // Check completion
              const state = getState();
              if (state.caughtIds.size >= 10) {
                this.showMessage('恭喜！你已經收集了所有十隻山海靈獸！\n你是真正的山海靈獸師！', () => {
                  this.endBattle();
                });
              } else {
                this.endBattle();
              }
            });
          } else {
            this.showMessage('捕獲失敗！靈獸掙脫了！', () => {
              // Enemy attacks
              const enemySkillIndex = enemyChooseAction(this.enemyMonster);
              const enemySkill = this.enemyMonster.skills[enemySkillIndex];
              enemySkill.currentPp--;
              this.doAttack(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
                if (this.playerMonster.hp <= 0) {
                  this.onPlayerMonsterDefeated();
                  return;
                }
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
            if (this.playerMonster.hp <= 0) {
              this.onPlayerMonsterDefeated();
              return;
            }
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
          const template = getTemplate(m.templateId);
          this.playerSprite.fillColor = template.color;
          this.updateInfoPanels();
          this.clearButtons();
          this.showMessage(`換上了 ${m.nickname}！`, () => {
            // Enemy attacks after switch
            const enemySkillIndex = enemyChooseAction(this.enemyMonster);
            const enemySkill = this.enemyMonster.skills[enemySkillIndex];
            enemySkill.currentPp--;
            this.doAttack(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
              if (this.playerMonster.hp <= 0) {
                this.onPlayerMonsterDefeated();
                return;
              }
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
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.onEnd?.();
      this.scene.stop();
      this.scene.resume('Overworld');
    });
  }
}

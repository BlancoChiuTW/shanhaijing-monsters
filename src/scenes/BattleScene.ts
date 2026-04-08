import Phaser from 'phaser';
import { type MonsterInstance, type Skill, type Element, getTemplate, getStatStageMul, getCultivation } from '../data/monsters';
import { calculateDamage, calculateCatchRate, getExpReward, applyExp, applyBuffSkill, enemyChooseAction, resetStatStages } from '../utils/battle';
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
  private actionButtons: Phaser.GameObjects.GameObject[] = [];
  private skillButtons: Phaser.GameObjects.GameObject[] = [];
  private isAnimating = false;
  private playerSpriteOriginX = 0;
  private playerSpriteOriginY = 0;
  private enemySpriteOriginX = 0;
  private enemySpriteOriginY = 0;

  constructor() {
    super({ key: 'Battle' });
  }

  init(data: BattleData): void {
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

    // 重置所有能力等級
    for (const e of this.enemyTeam) resetStatStages(e);

    const state = getState();
    this.playerMonsterIndex = getFirstAliveIndex();
    this.playerMonster = state.team[this.playerMonsterIndex];
    resetStatStages(this.playerMonster);
  }

  create(): void {
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
    this.applyRealmVisual(this.enemySprite, this.enemyMonster);

    // Player monster (bottom left)
    this.playerSpriteOriginX = width * 0.3;
    this.playerSpriteOriginY = height * 0.5;
    this.playerSprite = this.add.image(this.playerSpriteOriginX, this.playerSpriteOriginY, `monster_${this.playerMonster.templateId}`);
    this.playerSprite.setDisplaySize(120, 120);
    this.applyRealmVisual(this.playerSprite, this.playerMonster);

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
    const pStages = this.formatStages(this.playerMonster);
    const eStages = this.formatStages(this.enemyMonster);
    const pCult = getCultivation(this.playerMonster.level);
    const eCult = getCultivation(this.enemyMonster.level);

    const pShiny = this.playerMonster.isShiny ? '[異]' : '';
    const eShiny = this.enemyMonster.isShiny ? '[異]' : '';

    this.enemyInfoText.setText(
      `${eShiny}${this.enemyMonster.nickname} ${eCult.displayName}\nHP:${this.enemyMonster.hp}/${this.enemyMonster.maxHp}${eStages}`
    );
    this.playerInfoText.setText(
      `${pShiny}${this.playerMonster.nickname} ${pCult.displayName}\nHP:${this.playerMonster.hp}/${this.playerMonster.maxHp}${pStages}`
    );

    const enemyRatio = Math.max(0, this.enemyMonster.hp / this.enemyMonster.maxHp);
    const playerRatio = Math.max(0, this.playerMonster.hp / this.playerMonster.maxHp);

    this.tweens.add({ targets: this.enemyHpBar, displayWidth: Math.max(1, 160 * enemyRatio), duration: 300 });
    this.tweens.add({ targets: this.playerHpBar, displayWidth: Math.max(1, 160 * playerRatio), duration: 300 });

    this.enemyHpBar.fillColor = enemyRatio > 0.5 ? 0x44cc44 : enemyRatio > 0.2 ? 0xcccc44 : 0xcc4444;
    this.playerHpBar.fillColor = playerRatio > 0.5 ? 0x44cc44 : playerRatio > 0.2 ? 0xcccc44 : 0xcc4444;
  }

  private formatStages(m: MonsterInstance): string {
    const parts: string[] = [];
    if (m.atkStage !== 0) parts.push(`攻${m.atkStage > 0 ? '+' : ''}${m.atkStage}`);
    if (m.defStage !== 0) parts.push(`防${m.defStage > 0 ? '+' : ''}${m.defStage}`);
    if (m.spdStage !== 0) parts.push(`速${m.spdStage > 0 ? '+' : ''}${m.spdStage}`);
    return parts.length > 0 ? `\n${parts.join(' ')}` : '';
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
    const actions: { icon: string; text: string; action: () => void }[] = [
      { icon: 'icon_skill', text: '技能', action: () => this.showSkills() },
      { icon: 'icon_swap', text: '換獸', action: () => this.showSwitchMenu() },
    ];

    if (this.battleType === 'wild') {
      actions.push({ icon: 'icon_capture', text: '捕獲', action: () => this.tryCatch() });
      actions.push({ icon: 'icon_run', text: '逃跑', action: () => this.tryRun() });
    } else {
      actions.push({ icon: 'icon_run', text: '認輸', action: () => this.tryRun() });
    }

    actions.forEach((act, i) => {
      const x = width / 2 - 120 + (i % 2) * 160;
      const y = height - 65 + Math.floor(i / 2) * 28;
      // 圖示
      const icon = this.add.image(x, y + 8, act.icon);
      icon.setDisplaySize(16, 16).setOrigin(0, 0.5);
      this.actionButtons.push(icon);
      // 文字
      const btn = this.add.text(x + 20, y, act.text, {
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      }).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => { btn.setColor('#ffcc44'); icon.setTint(0xffcc44); });
      btn.on('pointerout', () => { btn.setColor('#ffffff'); icon.clearTint(); });
      btn.on('pointerdown', act.action);
      icon.setInteractive({ useHandCursor: true });
      icon.on('pointerdown', act.action);
      this.actionButtons.push(btn);
    });
  }

  private showSkills(): void {
    this.clearButtons();
    this.messageText.setText('選擇技能：');

    const { width, height } = this.scale;

    this.playerMonster.skills.forEach((s, i) => {
      const x = width / 2 - 140 + (i % 2) * 200;
      const y = height - 68 + Math.floor(i / 2) * 26;
      const elemColor = ELEMENT_COLORS[s.skill.element];
      const elemHex = '#' + elemColor.toString(16).padStart(6, '0');
      const effectTag = s.skill.effect ? this.getEffectTag(s.skill) : '';
      const label = `${s.skill.name}(${s.skill.element}${effectTag}) ${s.currentPp}/${s.skill.pp}`;
      const color = s.currentPp > 0 ? elemHex : '#555555';
      const btn = this.add.text(x, y, label, {
        fontSize: '11px', color,
      }).setInteractive({ useHandCursor: true });

      if (s.currentPp > 0) {
        btn.on('pointerover', () => btn.setColor('#ffcc44'));
        btn.on('pointerout', () => btn.setColor(elemHex));
        btn.on('pointerdown', () => this.executePlayerTurn(i));
      }
      this.skillButtons.push(btn);
    });

    const back = this.add.text(width / 2, height - 15, '[返回]', {
      fontSize: '11px', color: '#889999',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.showActions());
    this.skillButtons.push(back);
  }

  private getEffectTag(skill: Skill): string {
    if (!skill.effect) return '';
    switch (skill.effect.type) {
      case 'heal': return '[回]';
      case 'drain': return '[吸]';
      case 'recoil': return '[反]';
      case 'statUp': return '[增]';
      case 'statDown': return '[減]';
      case 'priority': return '[先]';
      default: return '';
    }
  }

  // ═══════════════════════════════════════
  //  技能特效系統
  // ═══════════════════════════════════════
  private playSkillVfx(skill: Skill, targetX: number, targetY: number, onDone: () => void): void {
    const color = ELEMENT_COLORS[skill.element];

    switch (skill.element) {
      case '火': {
        for (let i = 0; i < 10; i++) {
          const flame = this.add.circle(targetX, targetY, 4 + Math.random() * 8, color, 0.9);
          flame.setDepth(50);
          const angle = (i / 10) * Math.PI * 2;
          const dist = 30 + Math.random() * 25;
          this.tweens.add({
            targets: flame,
            x: targetX + Math.cos(angle) * dist,
            y: targetY + Math.sin(angle) * dist,
            alpha: 0, scale: 0.2, duration: 400,
            onComplete: () => flame.destroy(),
          });
        }
        const flash = this.add.circle(targetX, targetY, 25, 0xffaa00, 0.8).setDepth(50);
        this.tweens.add({
          targets: flash, alpha: 0, scale: 2.5, duration: 350,
          onComplete: () => { flash.destroy(); onDone(); },
        });
        break;
      }
      case '水': {
        for (let i = 0; i < 12; i++) {
          const drop = this.add.circle(targetX + (Math.random() - 0.5) * 50, targetY - 30, 3 + Math.random() * 3, color, 0.8);
          drop.setDepth(50);
          this.tweens.add({
            targets: drop,
            y: targetY + 25 + Math.random() * 35,
            x: drop.x + (Math.random() - 0.5) * 40,
            alpha: 0, duration: 500, delay: i * 25,
            onComplete: () => drop.destroy(),
          });
        }
        this.time.delayedCall(500, onDone);
        break;
      }
      case '風': {
        for (let i = 0; i < 8; i++) {
          const slash = this.add.rectangle(targetX, targetY, 35, 3, color, 0.7).setDepth(50);
          slash.setAngle(i * 22.5);
          this.tweens.add({
            targets: slash,
            angle: slash.angle + 180, scale: 1.8, alpha: 0,
            duration: 400, delay: i * 40,
            onComplete: () => slash.destroy(),
          });
        }
        this.time.delayedCall(550, onDone);
        break;
      }
      case '光': {
        const beam = this.add.rectangle(targetX, targetY - 120, 24, 240, color, 0.6).setDepth(50);
        this.tweens.add({
          targets: beam, y: targetY, alpha: 0.95,
          duration: 200, yoyo: true, hold: 200,
          onComplete: () => { beam.destroy(); onDone(); },
        });
        for (let i = 0; i < 8; i++) {
          const p = this.add.circle(
            targetX + (Math.random() - 0.5) * 40,
            targetY + (Math.random() - 0.5) * 40,
            2 + Math.random() * 3, 0xffffff, 0.9,
          ).setDepth(51);
          this.tweens.add({
            targets: p, y: p.y - 50, alpha: 0,
            duration: 600, delay: 100 + i * 40,
            onComplete: () => p.destroy(),
          });
        }
        break;
      }
      case '幻': {
        for (let i = 0; i < 4; i++) {
          const ring = this.add.circle(targetX, targetY, 10 + i * 14, color, 0).setDepth(50);
          ring.setStrokeStyle(2, color);
          this.tweens.add({
            targets: ring, scale: 2.5, alpha: 0,
            duration: 500, delay: i * 100,
            onComplete: () => ring.destroy(),
          });
        }
        this.time.delayedCall(650, onDone);
        break;
      }
      case '土': {
        this.cameras.main.shake(250, 0.012);
        for (let i = 0; i < 8; i++) {
          const rock = this.add.rectangle(
            targetX + (Math.random() - 0.5) * 60, targetY + 25,
            8 + Math.random() * 10, 8 + Math.random() * 10,
            color, 0.9,
          ).setDepth(50).setAngle(Math.random() * 45);
          this.tweens.add({
            targets: rock,
            y: targetY - 35 - Math.random() * 45,
            alpha: 0, angle: rock.angle + 180,
            duration: 500, delay: i * 35,
            onComplete: () => rock.destroy(),
          });
        }
        this.time.delayedCall(550, onDone);
        break;
      }
      case '毒': {
        for (let i = 0; i < 10; i++) {
          const bubble = this.add.circle(
            targetX + (Math.random() - 0.5) * 40,
            targetY + (Math.random() - 0.5) * 40,
            4 + Math.random() * 10, color, 0.5,
          ).setDepth(50);
          this.tweens.add({
            targets: bubble,
            scale: 1.8 + Math.random(),
            alpha: 0,
            x: bubble.x + (Math.random() - 0.5) * 50,
            y: bubble.y - Math.random() * 35,
            duration: 600, delay: i * 45,
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

  /** 增益/減益特效 */
  private playBuffVfx(targetX: number, targetY: number, isUp: boolean): void {
    const color = isUp ? 0x44ff88 : 0xff4444;
    for (let i = 0; i < 6; i++) {
      const arrow = this.add.text(
        targetX + (Math.random() - 0.5) * 30,
        targetY + (isUp ? 20 : -20),
        isUp ? '▲' : '▼',
        { fontSize: '14px', color: '#' + color.toString(16).padStart(6, '0') },
      ).setOrigin(0.5).setDepth(60);
      this.tweens.add({
        targets: arrow,
        y: arrow.y + (isUp ? -50 : 50),
        alpha: 0,
        duration: 600,
        delay: i * 60,
        onComplete: () => arrow.destroy(),
      });
    }
  }

  /** 回復特效 */
  private playHealVfx(targetX: number, targetY: number): void {
    for (let i = 0; i < 8; i++) {
      const sparkle = this.add.circle(
        targetX + (Math.random() - 0.5) * 50,
        targetY + 25, 3 + Math.random() * 3, 0x44ff88, 0.9,
      ).setDepth(50);
      this.tweens.add({
        targets: sparkle, y: sparkle.y - 60, alpha: 0,
        duration: 600, delay: i * 60,
        onComplete: () => sparkle.destroy(),
      });
    }
  }

  /** 吸血特效 */
  private playDrainVfx(fromX: number, fromY: number, toX: number, toY: number): void {
    for (let i = 0; i < 5; i++) {
      const orb = this.add.circle(fromX + (Math.random() - 0.5) * 30, fromY, 4, 0x44ff88, 0.8).setDepth(55);
      this.tweens.add({
        targets: orb,
        x: toX + (Math.random() - 0.5) * 15,
        y: toY,
        alpha: 0.3,
        duration: 400,
        delay: i * 80,
        onComplete: () => orb.destroy(),
      });
    }
  }

  /** 反傷特效 */
  private playRecoilVfx(targetX: number, targetY: number): void {
    this.cameras.main.shake(100, 0.005);
    const flash = this.add.circle(targetX, targetY, 15, 0xff6644, 0.6).setDepth(55);
    this.tweens.add({
      targets: flash, alpha: 0, scale: 2, duration: 300,
      onComplete: () => flash.destroy(),
    });
  }

  private determineFirstAttacker(playerSkill: Skill, enemySkill: Skill): boolean {
    // 先制技能判定
    const playerPriority = playerSkill.effect?.type === 'priority' ? 1 : 0;
    const enemyPriority = enemySkill.effect?.type === 'priority' ? 1 : 0;
    if (playerPriority !== enemyPriority) return playerPriority > enemyPriority;

    // 速度判定（含能力等級）
    const playerSpd = this.playerMonster.spd * getStatStageMul(this.playerMonster.spdStage);
    const enemySpd = this.enemyMonster.spd * getStatStageMul(this.enemyMonster.spdStage);
    if (playerSpd !== enemySpd) return playerSpd >= enemySpd;

    // 同速隨機
    return Math.random() < 0.5;
  }

  private executePlayerTurn(skillIndex: number): void {
    this.isAnimating = true;
    this.clearButtons();

    const playerSkill = this.playerMonster.skills[skillIndex];
    playerSkill.currentPp--;

    const enemySkillIndex = enemyChooseAction(this.enemyMonster);
    const enemySkill = this.enemyMonster.skills[enemySkillIndex];

    const playerFirst = this.determineFirstAttacker(playerSkill.skill, enemySkill.skill);

    if (playerFirst) {
      this.doTurnAction(this.playerMonster, this.enemyMonster, playerSkill.skill, true, () => {
        if (this.enemyMonster.hp <= 0) { this.onEnemyDefeated(); return; }
        if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
        enemySkill.currentPp--;
        this.doTurnAction(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
          if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
          if (this.enemyMonster.hp <= 0) { this.onEnemyDefeated(); return; }
          this.isAnimating = false;
          this.showActions();
        });
      });
    } else {
      enemySkill.currentPp--;
      this.doTurnAction(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
        if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
        if (this.enemyMonster.hp <= 0) { this.onEnemyDefeated(); return; }
        this.doTurnAction(this.playerMonster, this.enemyMonster, playerSkill.skill, true, () => {
          if (this.enemyMonster.hp <= 0) { this.onEnemyDefeated(); return; }
          if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
          this.isAnimating = false;
          this.showActions();
        });
      });
    }
  }

  /** 統一處理攻擊/輔助技能 */
  private doTurnAction(
    attacker: MonsterInstance, defender: MonsterInstance,
    skill: Skill, isPlayer: boolean, onDone: () => void,
  ): void {
    // 命中判定
    if (Math.random() * 100 > skill.accuracy) {
      this.showMessage(`${attacker.nickname} 的 ${skill.name} 沒有命中！`, onDone);
      return;
    }

    // 輔助技能 (power === 0)
    if (skill.power === 0) {
      const msg = applyBuffSkill(attacker, defender, skill);
      const sprite = isPlayer ? this.playerSprite : this.enemySprite;
      const targetSprite = isPlayer ? this.enemySprite : this.playerSprite;

      if (skill.effect?.type === 'heal') {
        this.playHealVfx(sprite.x, sprite.y);
      } else if (skill.effect?.type === 'statUp') {
        this.playBuffVfx(sprite.x, sprite.y, true);
      } else if (skill.effect?.type === 'statDown') {
        this.playBuffVfx(targetSprite.x, targetSprite.y, false);
      }

      this.showMessage(msg, () => {
        this.updateInfoPanels();
        onDone();
      });
      return;
    }

    // 攻擊技能
    this.doAttack(attacker, defender, skill, isPlayer, onDone);
  }

  private doAttack(
    attacker: MonsterInstance, defender: MonsterInstance,
    skill: Skill, isPlayer: boolean, onDone: () => void,
  ): void {
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
                fontSize: result.isCrit ? '22px' : '16px',
                fontStyle: 'bold',
                color: dmgColor,
                stroke: '#000000',
                strokeThickness: 3,
              }).setOrigin(0.5).setDepth(60);
              this.tweens.add({
                targets: dmgText, y: dmgText.y - 35, alpha: 0, duration: 800,
                onComplete: () => dmgText.destroy(),
              });

              // 處理附帶效果動畫
              this.showMessage(result.message, () => {
                // 吸血效果
                if (result.drainHeal > 0) {
                  this.playDrainVfx(targetSprite.x, targetSprite.y, sprite.x, sprite.y);
                  this.updateInfoPanels();
                }
                // 反傷效果
                if (result.recoilDmg > 0) {
                  this.playRecoilVfx(sprite.x, sprite.y);
                  this.updateInfoPanels();
                  // 顯示反傷數字
                  const recoilText = this.add.text(sprite.x, sprite.y - 30, `-${result.recoilDmg}`, {
                    fontSize: '14px', fontStyle: 'bold', color: '#ff8844',
                    stroke: '#000000', strokeThickness: 2,
                  }).setOrigin(0.5).setDepth(60);
                  this.tweens.add({
                    targets: recoilText, y: recoilText.y - 25, alpha: 0, duration: 600,
                    onComplete: () => recoilText.destroy(),
                  });
                }
                // 能力變化效果
                if (result.statMsg) {
                  if (skill.effect?.type === 'statDown') {
                    this.playBuffVfx(targetSprite.x, targetSprite.y, false);
                  }
                  this.showMessage(result.statMsg, () => {
                    this.updateInfoPanels();
                    onDone();
                  });
                  return;
                }
                onDone();
              });
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
          const newCult = getCultivation(levelResult.newLevel);
          msg += `\n${this.playerMonster.nickname} 突破至 ${newCult.displayName}！`;
          if (levelResult.realmUp) {
            msg += `\n【境界突破！進入${newCult.realm}境！】`;
          }
          if (levelResult.newSkills.length > 0) {
            msg += `\n學會了新技能：${levelResult.newSkills.join('、')}！`;
          }
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

          // 擊敗最終BOSS → 結局畫面
          if (this.trainerId === 'boss') {
            this.showMessage('你擊敗了冥王·幽羅！成為最強的靈獸師！', () => {
              this.cameras.main.fadeOut(500, 0, 0, 0);
              this.time.delayedCall(550, () => {
                this.scene.stop();
                this.scene.stop('Overworld');
                this.scene.start('Ending');
              });
            });
            return;
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
            m.atkStage = 0;
            m.defStage = 0;
            m.spdStage = 0;
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
      resetStatStages(this.playerMonster);
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
              this.doTurnAction(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
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
          this.doTurnAction(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
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
          resetStatStages(this.playerMonster);
          this.playerSprite.setTexture(`monster_${this.playerMonster.templateId}`);
          this.playerSprite.setPosition(this.playerSpriteOriginX, this.playerSpriteOriginY);
          this.updateInfoPanels();
          this.clearButtons();
          this.showMessage(`換上了 ${m.nickname}！`, () => {
            const enemySkillIndex = enemyChooseAction(this.enemyMonster);
            const enemySkill = this.enemyMonster.skills[enemySkillIndex];
            enemySkill.currentPp--;
            this.doTurnAction(this.enemyMonster, this.playerMonster, enemySkill.skill, false, () => {
              if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
              this.isAnimating = false;
              this.showActions();
            });
          });
        });
      }
      this.skillButtons.push(btn);
    });

    const back = this.add.text(width / 2, height - 15, '[返回]', {
      fontSize: '11px', color: '#889999',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.showActions());
    this.skillButtons.push(back);
  }

  /** 根據修仙境界套用視覺效果 */
  private applyRealmVisual(sprite: Phaser.GameObjects.Image, monster: MonsterInstance): void {
    const cult = getCultivation(monster.level);
    const ri = cult.realmIndex;

    // 異色特殊 tint
    if (monster.isShiny) {
      sprite.setTint(0xffdd88);
    }

    // 境界越高，體型越大
    const baseSize = sprite === this.playerSprite ? 120 : 100;
    const sizeBonus = ri * 5; // 每個境界+5px
    sprite.setDisplaySize(baseSize + sizeBonus, baseSize + sizeBonus);

    // 境界 >= 2 (金丹)：添加光環
    if (ri >= 2) {
      const auraColor = parseInt(cult.color.replace('#', ''), 16);
      const aura = this.add.circle(sprite.x, sprite.y, (baseSize + sizeBonus) / 2 + 8, auraColor, 0.1);
      aura.setStrokeStyle(1, auraColor);
      aura.setDepth(sprite.depth - 1);

      // 脈動動畫
      this.tweens.add({
        targets: aura,
        scale: 1.15,
        alpha: 0.05,
        duration: 1500,
        yoyo: true,
        repeat: -1,
      });
    }

    // 境界 >= 4 (化神)：粒子效果
    if (ri >= 3) {
      const auraColor = parseInt(cult.color.replace('#', ''), 16);
      this.time.addEvent({
        delay: 800,
        loop: true,
        callback: () => {
          if (!sprite.active) return;
          const particle = this.add.circle(
            sprite.x + (Math.random() - 0.5) * 40,
            sprite.y + 20,
            2 + Math.random() * 2,
            auraColor, 0.6,
          ).setDepth(sprite.depth + 1);
          this.tweens.add({
            targets: particle,
            y: particle.y - 40 - Math.random() * 20,
            alpha: 0,
            duration: 1000,
            onComplete: () => particle.destroy(),
          });
        },
      });
    }
  }

  private endBattle(): void {
    this.isAnimating = false;
    this.tweens.killAll();

    // 重置所有能力等級
    resetStatStages(this.playerMonster);
    for (const e of this.enemyTeam) resetStatStages(e);

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(350, () => {
      this.onEnd?.();
      this.scene.stop();
      this.scene.resume('Overworld');
    });
  }
}

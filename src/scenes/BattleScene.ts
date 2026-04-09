import Phaser from 'phaser';
import { type MonsterInstance, type Skill, type Element, type CultivationMethod, type PlayerCombatStats, getTemplate, getTypeMultiplier, getStatStageMul, getCultivation, PLAYER_SKILLS, REFINE_PLAYER_SKILLS, MONSTERS, createTransformedInstance } from '../data/monsters';
import { calculateDamage, calculateCatchRate, getExpReward, applyExp, applyBuffSkill, enemyChooseAction, resetStatStages, calculatePlayerDamage, attemptRefinement, processStatusDamage, decayStatStages, clearStatus } from '../utils/battle';
import { getState, addMonsterToTeam, getFirstAliveIndex, applyPlayerExp, recalcPlayerStats, addSeenMonster, isTeamFull, saveGame } from '../utils/gameState';

interface BattleData {
  type: 'wild' | 'trainer' | 'deathmatch';
  enemies: MonsterInstance[];
  trainerName?: string;
  trainerId?: string;
  enemyPlayerStats?: PlayerCombatStats;
  isBoss?: boolean;
  onEnd?: () => void;
}

// 五行特效顏色
const ELEMENT_COLORS: Record<Element, number> = {
  '金': 0xffdd44,
  '木': 0x44cc44,
  '水': 0x3388dd,
  '火': 0xff4422,
  '土': 0xaa8844,
};

export class BattleScene extends Phaser.Scene {
  private playerMonster!: MonsterInstance;
  private playerMonsterIndex = 0;
  private enemyMonster!: MonsterInstance;
  private enemyTeam: MonsterInstance[] = [];
  private enemyIndex = 0;
  private battleType: 'wild' | 'trainer' | 'deathmatch' = 'wild';
  private trainerName = '';
  private trainerId = '';
  private onEnd?: () => void;

  // 功法系統
  private cultivationMethod: CultivationMethod = '御獸神訣';
  /** 煉天大法：人類作為額外戰鬥實體 */
  private isPlayerCombatant = false;
  /** 萬靈化型變：變身取代靈寵 */
  private isTransformed = false;
  private transformedForm: MonsterInstance | null = null;

  // 死鬥系統
  private isDeathmatch = false;
  private isBoss = false;
  /** Normal End：玩家已煉化全部靈寵 */
  private hasAbsorbedAllPets = false;
  private playerCombat: PlayerCombatStats | null = null;
  private enemyPlayerCombat: PlayerCombatStats | null = null;
  /** 死鬥人類階段：寵全滅後人類上場 */
  private playerIsHuman = false;
  private enemyIsHuman = false;

  // 煉天大法 UI（人類額外實體）
  private playerHumanHpBar!: Phaser.GameObjects.Rectangle;
  private playerHumanInfoText!: Phaser.GameObjects.Text;
  private playerHumanSprite!: Phaser.GameObjects.Image;

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
    this.isDeathmatch = data.type === 'deathmatch';
    this.enemyTeam = data.enemies;
    this.enemyIndex = 0;
    this.enemyMonster = this.enemyTeam[0];
    this.trainerName = data.trainerName || '';
    this.trainerId = data.trainerId || '';
    this.isBoss = data.isBoss || false;
    this.hasAbsorbedAllPets = false;
    this.onEnd = data.onEnd;

    // 重置所有能力等級與狀態
    for (const e of this.enemyTeam) { resetStatStages(e); clearStatus(e); }

    const state = getState();
    this.cultivationMethod = state.cultivationMethod;

    this.playerMonsterIndex = getFirstAliveIndex();
    this.playerMonster = state.team[this.playerMonsterIndex];
    resetStatStages(this.playerMonster);
    clearStatus(this.playerMonster);

    // 記錄看過的靈獸
    for (const e of this.enemyTeam) addSeenMonster(e.templateId);

    // 只有煉天大法才有額外人類實體
    this.isPlayerCombatant = this.cultivationMethod === '煉天大法';

    // 萬靈化型變：變身取代靈寵出戰
    this.isTransformed = this.cultivationMethod === '萬靈化型變';
    this.transformedForm = null;
    if (this.isTransformed && state.seenMonsterIds.size > 0) {
      const firstSeen = Array.from(state.seenMonsterIds)[0];
      this.transformedForm = createTransformedInstance(firstSeen, state.playerCombat.level);
      this.playerMonster = this.transformedForm;
    }

    // 死鬥：人類階段標記（寵物階段開始）
    this.playerIsHuman = false;
    this.enemyIsHuman = false;

    // 煉天大法 or 死鬥：初始化人類屬性
    if (this.isPlayerCombatant || this.isDeathmatch) {
      this.playerCombat = state.playerCombat;
      this.playerCombat.atkStage = 0;
      this.playerCombat.defStage = 0;
      this.playerCombat.spdStage = 0;
      this.playerCombat.isBlocking = false;
    } else {
      this.playerCombat = null;
    }

    // 死鬥：敵方人類
    if (this.isDeathmatch) {
      this.enemyPlayerCombat = data.enemyPlayerStats || null;
    } else {
      this.enemyPlayerCombat = null;
    }
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
    const playerTexKey = this.textures.exists(`monster_${this.playerMonster.templateId}_back`)
      ? `monster_${this.playerMonster.templateId}_back`
      : `monster_${this.playerMonster.templateId}`;
    this.playerSprite = this.add.image(this.playerSpriteOriginX, this.playerSpriteOriginY, playerTexKey);
    this.playerSprite.setDisplaySize(120, 120);
    this.applyRealmVisual(this.playerSprite, this.playerMonster);

    // Enemy info panel (加寬 + 加高，避免文字溢出)
    this.add.rectangle(width * 0.25, 34, 240, 60, 0x000000, 0.7).setStrokeStyle(1, 0x445566);
    this.enemyInfoText = this.add.text(width * 0.25 - 110, 10, '', {
      fontSize: '13px', color: '#ffffff', lineSpacing: 1,
      wordWrap: { width: 220 },
    });
    this.enemyHpBg = this.add.rectangle(width * 0.25, 52, 200, 8, 0x333333);
    this.enemyHpBar = this.add.rectangle(width * 0.25 - 100, 52, 200, 8, 0x44cc44).setOrigin(0, 0.5);

    // Player info panel (同樣加寬)
    this.add.rectangle(width * 0.75, height * 0.62, 240, 60, 0x000000, 0.7).setStrokeStyle(1, 0x445566);
    this.playerInfoText = this.add.text(width * 0.75 - 110, height * 0.62 - 22, '', {
      fontSize: '13px', color: '#ffffff', lineSpacing: 1,
      wordWrap: { width: 220 },
    });
    this.playerHpBg = this.add.rectangle(width * 0.75, height * 0.62 + 18, 200, 8, 0x333333);
    this.playerHpBar = this.add.rectangle(width * 0.75 - 100, height * 0.62 + 18, 200, 8, 0x44cc44).setOrigin(0, 0.5);

    // Message box
    this.add.rectangle(width / 2, height - 55, width - 20, 90, 0x000000, 0.85).setStrokeStyle(1, 0xffcc44);
    this.messageText = this.add.text(20, height - 94, '', {
      fontSize: '16px', color: '#ffffff', wordWrap: { width: width - 50 },
    });

    // 煉天大法：額外顯示人類實體
    if (this.isPlayerCombatant && this.playerCombat) {
      const phx = width * 0.12;
      const phy = height * 0.62;
      this.playerHumanSprite = this.add.image(phx, phy, 'player', 0);
      this.playerHumanSprite.setDisplaySize(50, 50);

      this.add.rectangle(phx, phy - 35, 100, 30, 0x000000, 0.7).setStrokeStyle(1, 0x445566);
      this.playerHumanInfoText = this.add.text(phx - 45, phy - 48, '', { fontSize: '13px', color: '#ffffff' });
      this.add.rectangle(phx, phy - 22, 80, 6, 0x333333);
      this.playerHumanHpBar = this.add.rectangle(phx - 40, phy - 22, 80, 6, 0x44cc44).setOrigin(0, 0.5);
    }

    this.updateInfoPanels();

    // 播放戰鬥 BGM
    if (!this.sound.get('bgm_battle')) {
      this.sound.add('bgm_battle');
    }
    this.sound.stopAll();
    this.sound.play('bgm_battle', { loop: true, volume: 0.4 });

    let introMsg: string;
    if (this.isDeathmatch) {
      introMsg = `⚔ 死鬥！${this.trainerName} 發起死鬥挑戰！`;
    } else if (this.battleType === 'wild') {
      introMsg = `野生的 ${this.enemyMonster.nickname} 出現了！`;
    } else {
      introMsg = `${this.trainerName} 派出了 ${this.enemyMonster.nickname}！`;
    }

    if (this.isTransformed && this.transformedForm) {
      introMsg += `\n你變身為 ${this.transformedForm.nickname}！(×1.1)`;
    } else if (this.cultivationMethod === '煉天大法') {
      introMsg += '\n煉天大法：你親自上場戰鬥！';
    }

    this.showMessage(introMsg, () => this.showActions());
  }

  private updateInfoPanels(): void {
    const pStages = this.formatStages(this.playerMonster);
    const eStages = this.formatStages(this.enemyMonster);
    const pCult = getCultivation(this.playerMonster.level);
    const eCult = getCultivation(this.enemyMonster.level);

    const pShiny = this.playerMonster.isShiny ? '[異]' : '';
    const eShiny = this.enemyMonster.isShiny ? '[異]' : '';
    const transformTag = this.isTransformed ? '[變身]' : '';

    const pStatusTag = this.playerMonster.statusCondition === 'burn' ? ' [灼]' : this.playerMonster.statusCondition === 'poison' ? ' [毒]' : '';
    const eStatusTag = this.enemyMonster.statusCondition === 'burn' ? ' [灼]' : this.enemyMonster.statusCondition === 'poison' ? ' [毒]' : '';

    // 敵方顯示（名稱行 + HP行 分開，避免重疊）
    if (this.enemyIsHuman && this.enemyPlayerCombat) {
      this.enemyInfoText.setText(`${this.trainerName} Lv.${this.enemyPlayerCombat.level}\nHP: ${this.enemyPlayerCombat.hp} / ${this.enemyPlayerCombat.maxHp}`);
    } else {
      const eTemplate = getTemplate(this.enemyMonster.templateId);
      const eElem = eTemplate.element;
      const line1 = `${eShiny}${this.enemyMonster.nickname}(${eElem}) ${eCult.displayName}${eStatusTag}`;
      const line2 = `HP: ${this.enemyMonster.hp} / ${this.enemyMonster.maxHp}${eStages}`;
      this.enemyInfoText.setText(`${line1}\n${line2}`);
    }

    // 玩家顯示
    if (this.playerIsHuman && this.playerCombat) {
      this.playerInfoText.setText(`靈獸師 Lv.${this.playerCombat.level}\nHP: ${this.playerCombat.hp} / ${this.playerCombat.maxHp}`);
    } else {
      const line1 = `${transformTag}${pShiny}${this.playerMonster.nickname} ${pCult.displayName}${pStatusTag}`;
      const line2 = `HP: ${this.playerMonster.hp} / ${this.playerMonster.maxHp}${pStages}`;
      this.playerInfoText.setText(`${line1}\n${line2}`);
    }

    // HP 條
    const enemyRatio = (this.enemyIsHuman && this.enemyPlayerCombat)
      ? Math.max(0, this.enemyPlayerCombat.hp / this.enemyPlayerCombat.maxHp)
      : Math.max(0, this.enemyMonster.hp / this.enemyMonster.maxHp);
    const playerRatio = (this.playerIsHuman && this.playerCombat)
      ? Math.max(0, this.playerCombat.hp / this.playerCombat.maxHp)
      : Math.max(0, this.playerMonster.hp / this.playerMonster.maxHp);

    this.tweens.add({ targets: this.enemyHpBar, displayWidth: Math.max(1, 200 * enemyRatio), duration: 300 });
    this.tweens.add({ targets: this.playerHpBar, displayWidth: Math.max(1, 200 * playerRatio), duration: 300 });

    this.enemyHpBar.fillColor = enemyRatio > 0.5 ? 0x44cc44 : enemyRatio > 0.2 ? 0xcccc44 : 0xcc4444;
    this.playerHpBar.fillColor = playerRatio > 0.5 ? 0x44cc44 : playerRatio > 0.2 ? 0xcccc44 : 0xcc4444;

    // 煉天大法：更新人類 HP 條
    if (this.isPlayerCombatant && this.playerCombat) {
      this.playerHumanInfoText.setText(`靈獸師 Lv.${this.playerCombat.level}\nHP:${this.playerCombat.hp}/${this.playerCombat.maxHp}`);
      const phRatio = Math.max(0, this.playerCombat.hp / this.playerCombat.maxHp);
      this.tweens.add({ targets: this.playerHumanHpBar, displayWidth: Math.max(1, 80 * phRatio), duration: 300 });
      this.playerHumanHpBar.fillColor = phRatio > 0.5 ? 0x44cc44 : phRatio > 0.2 ? 0xcccc44 : 0xcc4444;
    }
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

    // 煉天大法：人+寵雙實體選擇
    if (this.isPlayerCombatant) {
      this.showCombatantChoice();
      return;
    }

    // 死鬥人類階段：顯示人類技能
    if (this.playerIsHuman) {
      this.showHumanPhaseSkills();
      return;
    }

    this.messageText.setText('選擇行動：');

    const { width, height } = this.scale;
    const actions: { icon: string; text: string; action: () => void }[] = [
      { icon: 'icon_skill', text: '技能', action: () => this.showSkills() },
    ];

    // 萬靈化型變：永遠可以變化＋換獸
    if (this.cultivationMethod === '萬靈化型變') {
      actions.push({ icon: 'icon_swap', text: '變化', action: () => this.showTransformSelect() });
      actions.push({ icon: 'icon_swap', text: '換獸', action: () => this.isTransformed ? this.showTransformSwitchMenu() : this.showSwitchMenu() });
    } else {
      actions.push({ icon: 'icon_swap', text: '換獸', action: () => this.showSwitchMenu() });
    }

    if (this.battleType === 'wild') {
      const eTempl = getTemplate(this.enemyMonster.templateId);
      const hpRatio = this.enemyMonster.hp / this.enemyMonster.maxHp;
      const estRate = eTempl.catchRate * (0.3 + 1.0 * (1 - hpRatio) ** 1.5) / 255;
      const catchHint = estRate >= 0.5 ? '◎' : estRate >= 0.2 ? '○' : '△';
      actions.push({ icon: 'icon_capture', text: `捕獲${catchHint}`, action: () => this.tryCatch() });
      actions.push({ icon: 'icon_run', text: '逃跑', action: () => this.tryRun() });
    } else if (!this.isBoss) {
      actions.push({ icon: 'icon_run', text: '認輸', action: () => this.tryRun() });
    }

    actions.forEach((act, i) => {
      const x = width / 2 - 120 + (i % 2) * 160;
      const y = height - 82 + Math.floor(i / 2) * 26;
      const icon = this.add.image(x, y + 7, act.icon);
      icon.setDisplaySize(14, 14).setOrigin(0, 0.5);
      this.actionButtons.push(icon);
      const btn = this.add.text(x + 18, y, act.text, {
        fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
      }).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => { btn.setColor('#ffcc44'); icon.setTint(0xffcc44); this.playSfx('sfx_cursor', 0.3); });
      btn.on('pointerout', () => { btn.setColor('#ffffff'); icon.clearTint(); });
      btn.on('pointerdown', () => { this.playSfx('sfx_select'); act.action(); });
      icon.setInteractive({ useHandCursor: true });
      icon.on('pointerdown', act.action);
      this.actionButtons.push(btn);
    });
  }

  private showSkills(): void {
    this.clearButtons();

    const { width, height } = this.scale;

    // PP 全耗盡 → 掙扎
    const allPpEmpty = this.playerMonster.skills.every(s => s.currentPp <= 0);
    if (allPpEmpty) {
      this.messageText.setText('技能全部耗盡！');
      const btn = this.add.text(width / 2, height - 80, '掙扎（40威力，自傷1/4）', {
        fontSize: '14px', color: '#aa4444',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#ffcc44'));
      btn.on('pointerout', () => btn.setColor('#aa4444'));
      btn.on('pointerdown', () => this.executePlayerTurn(-1));
      this.skillButtons.push(btn);
      const back = this.add.text(width / 2, height - 18, '[返回]', {
        fontSize: '14px', color: '#889999',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      back.on('pointerdown', () => this.showActions());
      this.skillButtons.push(back);
      return;
    }

    this.messageText.setText('選擇技能：');

    const defTemplate = getTemplate(this.enemyMonster.templateId);

    this.playerMonster.skills.forEach((s, i) => {
      const x = width / 2 - 140 + (i % 2) * 200;
      const y = height - 90 + Math.floor(i / 2) * 22;
      const elemColor = ELEMENT_COLORS[s.skill.element];
      const elemHex = '#' + elemColor.toString(16).padStart(6, '0');
      const effectTag = s.skill.effect ? this.getEffectTag(s.skill) : '';
      const mul = s.skill.power > 0 ? getTypeMultiplier(s.skill.element, defTemplate.element) : 1;
      const matchTag = mul > 1 ? '◎' : mul < 1 ? '△' : '';
      const label = `${matchTag}${s.skill.name}(${s.skill.element}${effectTag}) ${s.currentPp}/${s.skill.pp}`;
      const color = s.currentPp > 0 ? elemHex : '#555555';
      const btn = this.add.text(x, y, label, {
        fontSize: '14px', color,
      }).setInteractive({ useHandCursor: true });

      if (s.currentPp > 0) {
        btn.on('pointerover', () => btn.setColor('#ffcc44'));
        btn.on('pointerout', () => btn.setColor(elemHex));
        btn.on('pointerdown', () => this.executePlayerTurn(i));
      }
      this.skillButtons.push(btn);
    });

    const back = this.add.text(width / 2, height - 18, '[返回]', {
      fontSize: '14px', color: '#889999',
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
      case 'burn': return '[灼]';
      case 'poison': return '[毒]';
      default: return '';
    }
  }

  // ═══════════════════════════════════════
  //  技能特效系統
  // ═══════════════════════════════════════
  private playSkillVfx(skill: Skill, targetX: number, targetY: number, onDone: () => void): void {
    const color = ELEMENT_COLORS[skill.element];

    // 疊加 VFX 圖片特效
    const vfxIdx = Math.floor(Math.random() * 6);
    this.playVfxSprite(`vfx_impact_${vfxIdx}`, targetX, targetY, 2);

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
      case '金': {
        // 金光斬擊 + 光束
        this.playVfxSprite(`vfx_star_${Math.floor(Math.random() * 6)}`, targetX, targetY - 20, 2);
        this.playVfxSprite(`vfx_light_${Math.floor(Math.random() * 6)}`, targetX, targetY, 2);
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
        const beam = this.add.rectangle(targetX, targetY - 120, 24, 240, color, 0.6).setDepth(50);
        this.tweens.add({
          targets: beam, y: targetY, alpha: 0.95,
          duration: 200, yoyo: true, hold: 200,
          onComplete: () => { beam.destroy(); onDone(); },
        });
        break;
      }
      case '木': {
        // 藤蔓/自然 VFX
        this.playVfxSprite(`vfx_arcane_${Math.floor(Math.random() * 6)}`, targetX, targetY, 2.5);
        this.playVfxSprite(`vfx_grow_${Math.floor(Math.random() * 6)}`, targetX, targetY, 2);
        for (let i = 0; i < 10; i++) {
          const leaf = this.add.circle(
            targetX + (Math.random() - 0.5) * 40,
            targetY + (Math.random() - 0.5) * 40,
            4 + Math.random() * 6, color, 0.7,
          ).setDepth(50);
          this.tweens.add({
            targets: leaf,
            scale: 1.5 + Math.random(),
            alpha: 0,
            x: leaf.x + (Math.random() - 0.5) * 50,
            y: leaf.y - Math.random() * 35,
            duration: 600, delay: i * 45,
            onComplete: () => leaf.destroy(),
          });
        }
        this.time.delayedCall(700, onDone);
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
        { fontSize: '18px', color: '#' + color.toString(16).padStart(6, '0') },
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
    // 成長光環 VFX
    this.playVfxSprite(`vfx_grow_${Math.floor(Math.random() * 6)}`, targetX, targetY, 2);
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

  /** 取得敵方本回合使用的技能（含掙扎 fallback） */
  private getEnemySkillAction(): { skill: Skill; decPp: () => void } {
    const idx = enemyChooseAction(this.enemyMonster, this.playerMonster);
    if (idx === -1) {
      return { skill: BattleScene.STRUGGLE_SKILL, decPp: () => {} };
    }
    const s = this.enemyMonster.skills[idx];
    return { skill: s.skill, decPp: () => { s.currentPp--; } };
  }

  /** 掙扎技能常數 */
  private static readonly STRUGGLE_SKILL: Skill = {
    name: '掙扎', element: '金', power: 40, accuracy: 100, pp: 1,
    description: '技能耗盡的最後掙扎',
    effect: { type: 'recoil', percent: 25 },
  };

  private executePlayerTurn(skillIndex: number): void {
    this.isAnimating = true;
    this.clearButtons();

    // 掙扎（skillIndex === -1）
    const isStruggle = skillIndex === -1;
    const playerSkill = isStruggle
      ? { skill: BattleScene.STRUGGLE_SKILL, currentPp: 1, learnLevel: 1 }
      : this.playerMonster.skills[skillIndex];
    if (!isStruggle) playerSkill.currentPp--;

    // 敵方是人類（死鬥人類階段）：使用 calculatePlayerDamage
    if (this.enemyIsHuman && this.enemyPlayerCombat) {
      this.doPetVsHumanTurn(playerSkill.skill);
      return;
    }

    const enemyAction = this.getEnemySkillAction();

    const playerFirst = this.determineFirstAttacker(playerSkill.skill, enemyAction.skill);

    if (playerFirst) {
      this.doTurnAction(this.playerMonster, this.enemyMonster, playerSkill.skill, true, () => {
        if (this.enemyMonster.hp <= 0) { this.onEnemyDefeated(); return; }
        if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
        enemyAction.decPp();
        this.doTurnAction(this.enemyMonster, this.playerMonster, enemyAction.skill, false, () => {
          if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
          if (this.enemyMonster.hp <= 0) { this.onEnemyDefeated(); return; }
          this.processEndOfTurn(() => {
            this.isAnimating = false;
            this.showActions();
          });
        });
      });
    } else {
      enemyAction.decPp();
      this.doTurnAction(this.enemyMonster, this.playerMonster, enemyAction.skill, false, () => {
        if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
        if (this.enemyMonster.hp <= 0) { this.onEnemyDefeated(); return; }
        this.doTurnAction(this.playerMonster, this.enemyMonster, playerSkill.skill, true, () => {
          if (this.enemyMonster.hp <= 0) { this.onEnemyDefeated(); return; }
          if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
          this.processEndOfTurn(() => {
            this.isAnimating = false;
            this.showActions();
          });
        });
      });
    }
  }

  /** 寵物/變身 攻擊敵方人類（死鬥人類階段） */
  private doPetVsHumanTurn(skill: Skill): void {
    const epc = this.enemyPlayerCombat!;

    if (Math.random() * 100 > skill.accuracy) {
      this.showMessage(`${this.playerMonster.nickname} 的 ${skill.name} 沒有命中！`, () => {
        this.doEnemyHumanRetaliation();
      });
      return;
    }

    if (skill.power === 0) {
      // 輔助技能對人類無效，跳過
      this.showMessage(`${this.playerMonster.nickname} 使用了 ${skill.name}！但對人類無效...`, () => {
        this.doEnemyHumanRetaliation();
      });
      return;
    }

    const result = calculatePlayerDamage(
      this.playerMonster.atk, this.playerMonster.atkStage, this.playerMonster.level, this.playerMonster.nickname,
      epc.def, epc.defStage, epc.isBlocking,
      skill.power, skill.name, epc.level,
    );
    epc.hp = Math.max(0, epc.hp - result.damage);
    epc.isBlocking = false;
    this.updateInfoPanels();

    this.showMessage(result.message, () => {
      if (epc.hp <= 0) {
        this.onDeathMatchVictory();
        return;
      }
      this.doEnemyHumanRetaliation();
    });
  }

  /** 敵方人類反擊玩家 */
  private doEnemyHumanRetaliation(): void {
    const epc = this.enemyPlayerCombat!;
    const atkSkill = Math.random() < 0.6 ? PLAYER_SKILLS[0] : PLAYER_SKILLS[1];

    if (Math.random() * 100 > atkSkill.accuracy) {
      this.showMessage(`${this.trainerName} 的 ${atkSkill.name} 沒有命中！`, () => {
        this.isAnimating = false;
        this.showActions();
      });
      return;
    }

    const result = calculatePlayerDamage(
      epc.atk, epc.atkStage, epc.level, this.trainerName,
      this.playerMonster.def, this.playerMonster.defStage, false,
      atkSkill.power, atkSkill.name, this.playerMonster.level,
    );
    this.playerMonster.hp = Math.max(0, this.playerMonster.hp - result.damage);
    this.updateInfoPanels();

    this.showMessage(result.message, () => {
      if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
      this.isAnimating = false;
      this.showActions();
    });
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

    // 計算技能動畫索引 (1-6)
    const atkTemplate = getTemplate(attacker.templateId);
    const skillIdx = Math.min(6, Math.max(1,
      (atkTemplate.skills.findIndex(s => s.skill.name === skill.name) % 6) + 1));
    const skillTexKey = `monster_${attacker.templateId}_skill${skillIdx}_`;
    const hasSkillAnim = this.textures.exists(skillTexKey + '0');

    // 保存原始材質以便還原
    const origTexture = sprite.texture.key;

    // 播放技能動畫幀 (3幀循環)
    let skillAnimTimer: Phaser.Time.TimerEvent | null = null;
    if (hasSkillAnim) {
      let frame = 0;
      sprite.setTexture(skillTexKey + '0');
      skillAnimTimer = this.time.addEvent({
        delay: 100,
        callback: () => { frame = (frame + 1) % 3; sprite.setTexture(skillTexKey + frame); },
        repeat: 5,
      });
    }

    // 攻擊者衝刺動畫
    this.tweens.add({
      targets: sprite,
      x: sprite.x + (isPlayer ? 40 : -40),
      duration: 100,
      yoyo: true,
      onComplete: () => {
        // 還原攻擊者材質
        if (hasSkillAnim) {
          if (skillAnimTimer) skillAnimTimer.destroy();
          sprite.setTexture(origTexture);
        }
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
                fontSize: result.isCrit ? '30px' : '22px',
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
                    fontSize: '18px', fontStyle: 'bold', color: '#ff8844',
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

  /** 回合結束處理：狀態異常傷害 + buff衰減 */
  private processEndOfTurn(onDone: () => void): void {
    const messages: string[] = [];

    // 處理玩家靈獸狀態傷害
    const playerStatus = processStatusDamage(this.playerMonster);
    if (playerStatus) messages.push(playerStatus.message);

    // 處理敵方靈獸狀態傷害
    const enemyStatus = processStatusDamage(this.enemyMonster);
    if (enemyStatus) messages.push(enemyStatus.message);

    // buff/debuff 衰減
    const playerDecay = decayStatStages(this.playerMonster);
    if (playerDecay) messages.push(playerDecay);
    const enemyDecay = decayStatStages(this.enemyMonster);
    if (enemyDecay) messages.push(enemyDecay);

    if (messages.length === 0) {
      onDone();
      return;
    }

    // 依序顯示訊息
    this.updateInfoPanels();
    const showNext = (idx: number) => {
      if (idx >= messages.length) {
        // 檢查狀態傷害是否擊倒
        if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
        if (this.enemyMonster.hp <= 0) { this.onEnemyDefeated(); return; }
        onDone();
        return;
      }
      this.showMessage(messages[idx], () => {
        this.updateInfoPanels();
        showNext(idx + 1);
      });
    };
    showNext(0);
  }

  private playDeathAnim(
    sprite: Phaser.GameObjects.Image, templateId: string, onDone: () => void,
  ): void {
    // 檢查是否有死亡動畫幀
    const baseKey = `monster_${templateId}_dead_`;
    if (!this.textures.exists(baseKey + '0')) {
      // 沒有死亡動畫，直接淡出
      this.tweens.add({
        targets: sprite, alpha: 0, y: sprite.y + 30, duration: 500,
        onComplete: onDone,
      });
      return;
    }
    // 計算死亡幀數
    let deadFrames = 0;
    while (this.textures.exists(baseKey + deadFrames)) deadFrames++;
    // 播放死亡動畫幀
    let frame = 0;
    sprite.setTexture(baseKey + '0');
    const timer = this.time.addEvent({
      delay: 150,
      callback: () => {
        frame++;
        if (frame < deadFrames) {
          sprite.setTexture(baseKey + frame);
        } else {
          timer.destroy();
          this.tweens.add({
            targets: sprite, alpha: 0, y: sprite.y + 20, duration: 300,
            onComplete: onDone,
          });
        }
      },
      repeat: deadFrames - 1,
    });
  }

  private onEnemyDefeated(): void {
    this.playDeathAnim(this.enemySprite, this.enemyMonster.templateId, () => {
        let exp = getExpReward(this.enemyMonster, this.playerMonster.level);

        // 越階經驗加成：敵方境界每高一階 +75%
        const playerRealm = getCultivation(this.playerMonster.level).realmIndex;
        const enemyRealm = getCultivation(this.enemyMonster.level).realmIndex;
        const realmDiff = enemyRealm - playerRealm;
        if (realmDiff > 0) {
          exp = Math.floor(exp * (1 + realmDiff * 0.75));
        }

        const levelResult = applyExp(this.playerMonster, exp);

        // 人類也獲得經驗
        const playerLvResult = applyPlayerExp(Math.floor(exp * 0.5));
        recalcPlayerStats();

        let msg = `${this.enemyMonster.nickname} 被打倒了！獲得 ${exp} 經驗值。`;
        if (realmDiff > 0) {
          msg += `（越階加成 +${realmDiff * 75}%）`;
        }
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
        if (playerLvResult.leveled) {
          msg += `\n靈獸師突破至 Lv.${playerLvResult.newLevel}！`;
        }

        this.showMessage(msg, () => {
          this.updateInfoPanels();

          // 死鬥模式
          if (this.isDeathmatch) {
            // 敵方人類已上場且被打倒 → 勝利
            if (this.enemyIsHuman) {
              this.onDeathMatchVictory();
              return;
            }
            // 找下一隻存活的敵寵
            let nextAlive = -1;
            for (let i = 0; i < this.enemyTeam.length; i++) {
              if (this.enemyTeam[i].hp > 0) { nextAlive = i; break; }
            }
            if (nextAlive >= 0) {
              this.enemyIndex = nextAlive;
              this.enemyMonster = this.enemyTeam[this.enemyIndex];
              resetStatStages(this.enemyMonster);
              clearStatus(this.enemyMonster);
              this.enemySprite.setTexture(`monster_${this.enemyMonster.templateId}`);
              this.enemySprite.setAlpha(1);
              this.enemySprite.setPosition(this.enemySpriteOriginX, this.enemySpriteOriginY);
              this.updateInfoPanels();
              this.showMessage(`對手派出了 ${this.enemyMonster.nickname}！`, () => {
                this.isAnimating = false;
                this.showActions();
              });
            } else {
              // 敵方靈寵全滅 → 敵方人類上場
              this.enemyIsHuman = true;
              this.enemySprite.setTexture(this.isBoss ? 'npc_boss' : 'npc_trainer');
              this.enemySprite.setAlpha(1);
              this.enemySprite.setPosition(this.enemySpriteOriginX, this.enemySpriteOriginY);
              this.enemySprite.setDisplaySize(100, 100);
              this.updateInfoPanels();
              this.showMessage(`${this.trainerName} 的靈寵全滅了！${this.trainerName}親自上場！`, () => {
                this.isAnimating = false;
                this.showActions();
              });
            }
            return;
          }

          // 普通/訓練家戰鬥
          this.enemyIndex++;
          if (this.enemyIndex < this.enemyTeam.length) {
            this.enemyMonster = this.enemyTeam[this.enemyIndex];
            resetStatStages(this.enemyMonster);
            clearStatus(this.enemyMonster);
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
            const endingType = this.hasAbsorbedAllPets ? 'normal' : 'true';
            const winMsg = endingType === 'true'
              ? '幽羅神魂潰散。\n【羈絆不是弱點。是變數。】'
              : '冥王·幽羅倒下了。\n代價精確。預算之內。\n……拳握緊。空蕩蕩的。';
            this.showMessage(winMsg, () => {
              this.cameras.main.fadeOut(500, 0, 0, 0);
              this.time.delayedCall(550, () => {
                this.scene.stop();
                this.scene.stop('Overworld');
                this.scene.start('Ending', { endingType });
              });
            });
            return;
          }

          this.showMessage('戰鬥勝利！', () => this.endBattle());
        });
    });
  }

  private onPlayerMonsterDefeated(): void {
    this.playDeathAnim(this.playerSprite, this.playerMonster.templateId, () => {
    this.showMessage(`${this.playerMonster.nickname} 倒下了！`, () => {
      const state = getState();

      // 萬靈化型變：變身被打倒 → 解除變身，看包包有沒有活的寵
      if (this.isTransformed) {
        this.isTransformed = false;
        this.transformedForm = null;
        const nextAliveIdx = getFirstAliveIndex();
        if (nextAliveIdx >= 0) {
          // 有活的寵，切換出場
          this.playerMonsterIndex = nextAliveIdx;
          this.playerMonster = state.team[nextAliveIdx];
          resetStatStages(this.playerMonster);
          clearStatus(this.playerMonster);
          this.playerSprite.setTexture(this.textures.exists(`monster_${this.playerMonster.templateId}_back`) ? `monster_${this.playerMonster.templateId}_back` : `monster_${this.playerMonster.templateId}`);
          this.playerSprite.setPosition(this.playerSpriteOriginX, this.playerSpriteOriginY);
          this.updateInfoPanels();
          this.showMessage(`變身被擊破了！派出 ${this.playerMonster.nickname}！`, () => {
            this.isAnimating = false;
            this.showActions();
          });
          return;
        }
        // 無活寵 → 戰敗
        this.showMessage('變身被擊破了，靈寵也全滅了...回到起點休息。', () => {
          state.team.forEach(m => {
            m.hp = m.maxHp;
            m.atkStage = 0; m.defStage = 0; m.spdStage = 0;
            m.skills.forEach(s => { s.currentPp = s.skill.pp; });
          });
          state.currentMapId = 'qingqiu';
          state.playerX = 3;
          state.playerY = 3;
          this.endBattle();
        });
        return;
      }

      // 死鬥人類階段：人類被打倒 = GAME OVER
      if (this.playerIsHuman) {
        this.onDeathMatchGameOver();
        return;
      }

      const nextAlive = getFirstAliveIndex();

      if (nextAlive === -1) {
        // 煉天大法：寵全滅 → 判定
        if (this.isPlayerCombatant) {
          this.checkCombatantEnd();
          return;
        }
        // 死鬥：寵全滅 → 玩家人類上場
        if (this.isDeathmatch && this.playerCombat) {
          this.playerIsHuman = true;
          this.playerSprite.setTexture('player');
          this.playerSprite.setAlpha(1);
          this.playerSprite.setPosition(this.playerSpriteOriginX, this.playerSpriteOriginY);
          this.playerSprite.setDisplaySize(120, 120);
          this.updateInfoPanels();
          this.showMessage('你的靈寵全滅了！你親自上場戰鬥！', () => {
            this.isAnimating = false;
            this.showActions();
          });
          return;
        }
        // 普通戰鬥：寵全滅
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
      clearStatus(this.playerMonster);
      const nextTexKey = this.textures.exists(`monster_${this.playerMonster.templateId}_back`)
        ? `monster_${this.playerMonster.templateId}_back`
        : `monster_${this.playerMonster.templateId}`;
      this.playerSprite.setTexture(nextTexKey);
      this.playerSprite.setAlpha(1);
      this.playerSprite.setPosition(this.playerSpriteOriginX, this.playerSpriteOriginY);
      this.updateInfoPanels();

      this.showMessage(`換上了 ${this.playerMonster.nickname}！`, () => {
        this.isAnimating = false;
        this.showActions();
      });
    });
    });
  }

  private tryCatch(): void {
    this.isAnimating = true;
    this.clearButtons();

    // 隊伍已滿6隻：不能捕獲
    if (isTeamFull()) {
      this.showMessage('隊伍已滿（上限6隻），無法捕獲更多靈獸！', () => {
        this.isAnimating = false;
        this.showActions();
      });
      return;
    }

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
                const where = addMonsterToTeam(this.enemyMonster);
                const msg = `成功捕獲了 ${this.enemyMonster.nickname}！` +
                  (where === 'team' ? '' : '\n隊伍已滿，已放入倉庫。');
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
              const ea = this.getEnemySkillAction();
              ea.decPp();
              this.doTurnAction(this.enemyMonster, this.playerMonster, ea.skill, false, () => {
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
    this.isAnimating = true;
    this.clearButtons();
    if (this.battleType === 'wild') {
      const success = Math.random() < 0.7;
      if (success) {
        this.showMessage('成功逃跑了！', () => this.endBattle());
      } else {
        this.showMessage('逃跑失敗！', () => {
          const ea = this.getEnemySkillAction();
          ea.decPp();
          this.doTurnAction(this.enemyMonster, this.playerMonster, ea.skill, false, () => {
            if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
            this.isAnimating = false;
            this.showActions();
          });
        });
      }
    } else if (this.isDeathmatch) {
      this.showMessage('你選擇棄權撤退，認輸了...', () => this.endBattle());
    } else {
      this.showMessage('你認輸了...', () => this.endBattle());
    }
  }

  private showSwitchMenu(): void {
    this.clearButtons();
    this.messageText.setText('選擇要換上的靈獸：');

    const { width, height } = this.scale;
    const state = getState();
    const others = state.team.map((m, i) => ({ m, i })).filter(({ i }) => i !== this.playerMonsterIndex);
    const lineH = Math.min(16, Math.floor(70 / Math.max(others.length, 1)));

    others.forEach(({ m, i }, slot) => {
      const y = height - 95 + slot * lineH;
      const color = m.hp > 0 ? '#ffffff' : '#555555';
      const label = `${m.nickname} Lv.${m.level} HP:${m.hp}/${m.maxHp}`;
      const btn = this.add.text(30, y, label, { fontSize: '13px', color })
        .setInteractive({ useHandCursor: true });

      if (m.hp > 0) {
        btn.on('pointerover', () => btn.setColor('#ffcc44'));
        btn.on('pointerout', () => btn.setColor(color));
        btn.on('pointerdown', () => {
          this.isAnimating = true;
          this.playerMonsterIndex = i;
          this.playerMonster = m;
          resetStatStages(this.playerMonster);
          clearStatus(this.playerMonster);
          this.playerSprite.setTexture(this.textures.exists(`monster_${this.playerMonster.templateId}_back`) ? `monster_${this.playerMonster.templateId}_back` : `monster_${this.playerMonster.templateId}`);
          this.playerSprite.setPosition(this.playerSpriteOriginX, this.playerSpriteOriginY);
          this.updateInfoPanels();
          this.clearButtons();
          this.showMessage(`換上了 ${m.nickname}！`, () => {
            if (this.isPlayerCombatant) {
              this.executeEnemyCombatantTurn();
            } else {
              const ea = this.getEnemySkillAction();
              ea.decPp();
              this.doTurnAction(this.enemyMonster, this.playerMonster, ea.skill, false, () => {
                if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
                this.isAnimating = false;
                this.showActions();
              });
            }
          });
        });
      }
      this.skillButtons.push(btn);
    });

    const back = this.add.text(width / 2, height - 18, '[返回]', {
      fontSize: '14px', color: '#889999',
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

    // 境界 >= 2 (金丹)：添加靈氣光環
    if (ri >= 2) {
      const auraColor = parseInt(cult.color.replace('#', ''), 16);
      // 嘗試使用 VFX 靈氣圖片
      const auraKey = `vfx_aura_${Math.min(ri, 5)}`;
      if (this.textures.exists(auraKey)) {
        const auraImg = this.add.image(sprite.x, sprite.y, auraKey)
          .setDisplaySize((baseSize + sizeBonus) + 20, (baseSize + sizeBonus) + 20)
          .setAlpha(0.3).setTint(auraColor).setDepth(sprite.depth - 1);
        this.tweens.add({
          targets: auraImg, scale: 1.1, alpha: 0.15,
          duration: 1500, yoyo: true, repeat: -1,
        });
      } else {
        const aura = this.add.circle(sprite.x, sprite.y, (baseSize + sizeBonus) / 2 + 8, auraColor, 0.1);
        aura.setStrokeStyle(1, auraColor);
        aura.setDepth(sprite.depth - 1);
        this.tweens.add({
          targets: aura, scale: 1.15, alpha: 0.05,
          duration: 1500, yoyo: true, repeat: -1,
        });
      }
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

  /** 播放 VFX 圖片特效 */
  private playVfxSprite(key: string, x: number, y: number, scale = 1.5): void {
    if (!this.textures.exists(key)) return;
    const img = this.add.image(x, y, key).setDepth(55).setScale(scale).setAlpha(0.9);
    this.tweens.add({
      targets: img,
      alpha: 0,
      scale: scale * 2,
      duration: 450,
      onComplete: () => img.destroy(),
    });
  }

  /** 播放 UI 音效 */
  private playSfx(key: string, volume = 0.5): void {
    if (this.cache.audio.exists(key)) {
      this.sound.play(key, { volume });
    }
  }

  // ═══════════════════════════════════════
  //  煉天大法：人+寵雙實體系統
  // ═══════════════════════════════════════

  private showCombatantChoice(): void {
    this.clearButtons();
    this.messageText.setText('選擇行動 — 選擇誰行動：');

    const { width, height } = this.scale;

    const petBtn = this.add.text(width / 2 - 80, height - 78, '【靈寵行動】', {
      fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
    }).setInteractive({ useHandCursor: true });
    petBtn.on('pointerover', () => petBtn.setColor('#ffcc44'));
    petBtn.on('pointerout', () => petBtn.setColor('#ffffff'));
    petBtn.on('pointerdown', () => this.showCombatantPetActions());
    this.actionButtons.push(petBtn);

    const humanBtn = this.add.text(width / 2 + 20, height - 78, '【人類行動】', {
      fontSize: '17px', color: '#ff8844', fontStyle: 'bold',
    }).setInteractive({ useHandCursor: true });
    humanBtn.on('pointerover', () => humanBtn.setColor('#ffcc44'));
    humanBtn.on('pointerout', () => humanBtn.setColor('#ff8844'));
    humanBtn.on('pointerdown', () => this.showPlayerSkills());
    this.actionButtons.push(humanBtn);
  }

  private showCombatantPetActions(): void {
    this.clearButtons();
    this.messageText.setText('靈寵行動：');

    const { width, height } = this.scale;
    const actions: { text: string; action: () => void }[] = [
      { text: '技能', action: () => this.showSkills() },
      { text: '換獸', action: () => this.showSwitchMenu() },
    ];
    if (this.battleType === 'wild') {
      actions.push({ text: '捕獲', action: () => this.tryCatch() });
    }
    if (this.battleType === 'wild') {
      actions.push({ text: '逃跑', action: () => this.tryRun() });
    } else if (!this.isBoss) {
      actions.push({ text: '認輸', action: () => this.tryRun() });
    }

    actions.forEach((act, i) => {
      const x = width / 2 - 80 + i * 70;
      const y = height - 75;
      const btn = this.add.text(x, y, act.text, {
        fontSize: '16px', color: '#ffffff',
      }).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#ffcc44'));
      btn.on('pointerout', () => btn.setColor('#ffffff'));
      btn.on('pointerdown', act.action);
      this.actionButtons.push(btn);
    });

    const back = this.add.text(width / 2, height - 18, '[返回]', {
      fontSize: '14px', color: '#889999',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.showCombatantChoice());
    this.actionButtons.push(back);
  }

  /** 煉天大法人類技能 */
  private showPlayerSkills(): void {
    this.clearButtons();
    this.messageText.setText('人類技能：');

    const { width, height } = this.scale;

    REFINE_PLAYER_SKILLS.forEach((skill, i) => {
      const x = width / 2 - 120 + (i % 2) * 160;
      const y = height - 90 + Math.floor(i / 2) * 22;

      let enabled = true;
      if (skill.type === 'refine') {
        enabled = this.enemyMonster.hp > 0 && this.enemyMonster.hp / this.enemyMonster.maxHp < 0.15;
      }

      const color = enabled ? '#ff8844' : '#555555';
      const btn = this.add.text(x, y, `${skill.name}(${skill.description})`, {
        fontSize: '14px', color,
      }).setInteractive({ useHandCursor: true });

      if (enabled) {
        btn.on('pointerover', () => btn.setColor('#ffcc44'));
        btn.on('pointerout', () => btn.setColor('#ff8844'));
        btn.on('pointerdown', () => this.executePlayerAction(i));
      }
      this.skillButtons.push(btn);
    });

    const back = this.add.text(width / 2, height - 18, '[返回]', {
      fontSize: '14px', color: '#889999',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.showCombatantChoice());
    this.skillButtons.push(back);
  }

  private executePlayerAction(skillIndex: number): void {
    if (!this.playerCombat) return;
    const skill = REFINE_PLAYER_SKILLS[skillIndex];
    this.isAnimating = true;
    this.clearButtons();

    if (skill.type === 'block') {
      this.playerCombat.isBlocking = true;
      this.showMessage('你擺出防禦姿態！減傷50%！', () => {
        this.executeEnemyCombatantTurn();
      });
      return;
    }

    if (skill.type === 'refine') {
      this.tryRefinement();
      return;
    }

    // 輕擊/重擊 → 攻擊敵方靈寵
    if (Math.random() * 100 > skill.accuracy) {
      this.showMessage(`你的 ${skill.name} 沒有命中！`, () => {
        this.executeEnemyCombatantTurn();
      });
      return;
    }

    const result = calculatePlayerDamage(
      this.playerCombat.atk, this.playerCombat.atkStage, this.playerCombat.level, '你',
      this.enemyMonster.def, this.enemyMonster.defStage, false,
      skill.power, skill.name, this.enemyMonster.level,
    );
    this.enemyMonster.hp = Math.max(0, this.enemyMonster.hp - result.damage);
    this.updateInfoPanels();
    this.showMessage(result.message, () => {
      if (this.enemyMonster.hp <= 0) {
        this.onEnemyDefeated();
        return;
      }
      this.executeEnemyCombatantTurn();
    });
  }

  /** 煉天大法敵方回合：40%打人類 60%打寵物 */
  private executeEnemyCombatantTurn(): void {
    if (this.enemyMonster.hp <= 0) {
      this.playerCombat!.isBlocking = false;
      this.isAnimating = false;
      this.showActions();
      return;
    }

    const targetHuman = this.playerCombat && this.playerCombat.hp > 0 && Math.random() < 0.4;

    if (targetHuman && this.playerCombat) {
      const eaCombat = this.getEnemySkillAction();
      eaCombat.decPp();

      if (Math.random() * 100 > eaCombat.skill.accuracy) {
        this.showMessage(`${this.enemyMonster.nickname} 的 ${eaCombat.skill.name} 沒有命中！`, () => {
          this.playerCombat!.isBlocking = false;
          this.isAnimating = false;
          this.showActions();
        });
        return;
      }

      const result = calculatePlayerDamage(
        this.enemyMonster.atk, this.enemyMonster.atkStage, this.enemyMonster.level, this.enemyMonster.nickname,
        this.playerCombat.def, this.playerCombat.defStage, this.playerCombat.isBlocking,
        eaCombat.skill.power, eaCombat.skill.name, this.playerCombat.level,
      );
      this.playerCombat.hp = Math.max(0, this.playerCombat.hp - result.damage);
      this.playerCombat.isBlocking = false;
      this.updateInfoPanels();
      this.showMessage(result.message, () => {
        if (this.checkCombatantEnd()) return;
        this.isAnimating = false;
        this.showActions();
      });
      return;
    }

    // 敵寵打玩家寵
    const eaPet = this.getEnemySkillAction();
    eaPet.decPp();
    this.doTurnAction(this.enemyMonster, this.playerMonster, eaPet.skill, false, () => {
      if (this.playerMonster.hp <= 0) {
        const nextAlive = getFirstAliveIndex();
        if (nextAlive === -1) {
          if (this.checkCombatantEnd()) return;
        } else {
          this.playerMonsterIndex = nextAlive;
          this.playerMonster = getState().team[nextAlive];
          resetStatStages(this.playerMonster);
          clearStatus(this.playerMonster);
          this.playerSprite.setTexture(this.textures.exists(`monster_${this.playerMonster.templateId}_back`) ? `monster_${this.playerMonster.templateId}_back` : `monster_${this.playerMonster.templateId}`);
          this.playerSprite.setPosition(this.playerSpriteOriginX, this.playerSpriteOriginY);
          this.updateInfoPanels();
          this.showMessage(`換上了 ${this.playerMonster.nickname}！`, () => {
            this.isAnimating = false;
            this.showActions();
          });
          return;
        }
      }
      this.processEndOfTurn(() => {
        this.isAnimating = false;
        this.showActions();
      });
    });
  }

  /** 煉天大法勝負判定 */
  private checkCombatantEnd(): boolean {
    if (!this.playerCombat) return false;
    const state = getState();
    const playerPetsDead = state.team.every(m => m.hp <= 0);
    const playerHumanDead = this.playerCombat.hp <= 0;

    if (playerHumanDead || playerPetsDead) {
      this.showMessage('你被打倒了...回到起點休息。', () => {
        state.team.forEach(m => {
          m.hp = m.maxHp;
          m.atkStage = 0; m.defStage = 0; m.spdStage = 0;
          m.skills.forEach(s => { s.currentPp = s.skill.pp; });
        });
        this.playerCombat!.hp = this.playerCombat!.maxHp;
        state.currentMapId = 'qingqiu';
        state.playerX = 3;
        state.playerY = 3;
        this.endBattle();
      });
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════
  //  萬靈化型變：變化系統（切換形態）
  // ═══════════════════════════════════════

  private showTransformSelect(): void {
    this.clearButtons();
    this.messageText.setText('選擇變身形態（見過的靈獸）：');

    const { width, height } = this.scale;
    const state = getState();
    const seenIds = Array.from(state.seenMonsterIds);

    const maxVisible = 5;
    const listStartY = height - 95;
    const visibleIds = seenIds.slice(0, maxVisible);
    const lineH = Math.min(14, Math.floor(70 / Math.max(visibleIds.length, 1)));
    visibleIds.forEach((id, i) => {
      const template = MONSTERS.find(m => m.id === id);
      if (!template) return;
      const isCurrent = this.isTransformed && this.playerMonster.templateId === id;
      const y = listStartY + i * lineH;
      const label = `${template.name}${isCurrent ? ' [當前]' : ''}`;
      const color = isCurrent ? '#555555' : '#cc66ff';
      const btn = this.add.text(30, y, label, { fontSize: '13px', color })
        .setInteractive({ useHandCursor: true });

      if (!isCurrent) {
        btn.on('pointerover', () => btn.setColor('#ffcc44'));
        btn.on('pointerout', () => btn.setColor('#cc66ff'));
        btn.on('pointerdown', () => {
          this.isAnimating = true;
          // HP% 繼承
          const hpRatio = this.playerMonster.hp / this.playerMonster.maxHp;
          const newForm = createTransformedInstance(id, state.playerCombat.level);
          newForm.hp = Math.max(1, Math.floor(newForm.maxHp * hpRatio));
          this.isTransformed = true;
          this.transformedForm = newForm;
          this.playerMonster = newForm;
          clearStatus(this.playerMonster);
          // 更新圖示
          this.playerSprite.setTexture(this.textures.exists(`monster_${id}_back`) ? `monster_${id}_back` : `monster_${id}`);
          this.updateInfoPanels();
          this.clearButtons();
          this.showMessage(`你變身為 ${template.name}！(HP ${Math.floor(hpRatio * 100)}%)`, () => {
            // 變身消耗回合，敵方行動
            const ea = this.getEnemySkillAction();
            ea.decPp();
            this.doTurnAction(this.enemyMonster, this.playerMonster, ea.skill, false, () => {
              if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
              this.isAnimating = false;
              this.showActions();
            });
          });
        });
      }
      this.skillButtons.push(btn);
    });

    const back = this.add.text(width / 2, height - 18, '[返回]', {
      fontSize: '14px', color: '#889999',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.showActions());
    this.skillButtons.push(back);
  }

  /** 萬靈化型變：換獸（解除變身，派出包包靈寵） */
  private showTransformSwitchMenu(): void {
    this.clearButtons();
    this.messageText.setText('選擇要派出的靈獸（解除變身）：');

    const { width, height } = this.scale;
    const state = getState();

    const teamLineH = Math.min(14, Math.floor(70 / Math.max(state.team.length, 1)));
    state.team.forEach((m, i) => {
      const y = height - 95 + i * teamLineH;
      const color = m.hp > 0 ? '#ffffff' : '#555555';
      const label = `${m.nickname} Lv.${m.level} HP:${m.hp}/${m.maxHp}`;
      const btn = this.add.text(30, y, label, { fontSize: '13px', color })
        .setInteractive({ useHandCursor: true });

      if (m.hp > 0) {
        btn.on('pointerover', () => btn.setColor('#ffcc44'));
        btn.on('pointerout', () => btn.setColor(color));
        btn.on('pointerdown', () => {
          this.isAnimating = true;
          this.isTransformed = false;
          this.transformedForm = null;
          this.playerMonsterIndex = i;
          this.playerMonster = m;
          resetStatStages(this.playerMonster);
          clearStatus(this.playerMonster);
          this.playerSprite.setTexture(this.textures.exists(`monster_${this.playerMonster.templateId}_back`) ? `monster_${this.playerMonster.templateId}_back` : `monster_${this.playerMonster.templateId}`);
          this.playerSprite.setPosition(this.playerSpriteOriginX, this.playerSpriteOriginY);
          this.updateInfoPanels();
          this.clearButtons();
          this.showMessage(`解除變身！派出 ${m.nickname}！`, () => {
            const ea = this.getEnemySkillAction();
            ea.decPp();
            this.doTurnAction(this.enemyMonster, this.playerMonster, ea.skill, false, () => {
              if (this.playerMonster.hp <= 0) { this.onPlayerMonsterDefeated(); return; }
              this.isAnimating = false;
              this.showActions();
            });
          });
        });
      }
      this.skillButtons.push(btn);
    });

    const back = this.add.text(width / 2, height - 18, '[返回]', {
      fontSize: '14px', color: '#889999',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.showActions());
    this.skillButtons.push(back);
  }

  // ═══════════════════════════════════════
  //  死鬥：人類階段
  // ═══════════════════════════════════════

  /** 死鬥人類階段：顯示人類技能 */
  private showHumanPhaseSkills(): void {
    this.clearButtons();
    this.messageText.setText('人類技能：');

    const { width, height } = this.scale;

    // Boss 戰不顯示撤退，但增加「煉化全寵」選項（Normal End 路線）
    const skills = this.isBoss
      ? PLAYER_SKILLS.filter(s => s.type !== 'retreat')
      : PLAYER_SKILLS;

    const displaySkills: { name: string; desc: string; color: string; action: () => void }[] = skills.map((skill, _i) => {
      const origIndex = PLAYER_SKILLS.indexOf(skill);
      return { name: skill.name, desc: skill.description, color: '#ff8844', action: () => this.executeHumanPhaseAction(origIndex) };
    });

    // Boss 人類階段：可煉化全部靈寵（Normal End 路線）
    if (this.isBoss && !this.hasAbsorbedAllPets) {
      displaySkills.push({
        name: '煉化全寵', desc: '犧牲全部靈寵，獲得力量',
        color: '#ff2222',
        action: () => this.absorbAllPetsForBoss(),
      });
    }

    displaySkills.forEach((ds, i) => {
      const x = width / 2 - 120 + (i % 2) * 160;
      const y = height - 90 + Math.floor(i / 2) * 22;
      const btn = this.add.text(x, y, `${ds.name}(${ds.desc})`, {
        fontSize: '14px', color: ds.color,
      }).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#ffcc44'));
      btn.on('pointerout', () => btn.setColor(ds.color));
      btn.on('pointerdown', () => ds.action());
      this.skillButtons.push(btn);
    });
  }

  /** 死鬥人類階段：執行人類技能 */
  private executeHumanPhaseAction(skillIndex: number): void {
    if (!this.playerCombat || !this.enemyPlayerCombat) return;
    const skill = PLAYER_SKILLS[skillIndex];
    this.isAnimating = true;
    this.clearButtons();

    if (skill.type === 'retreat') {
      this.showMessage('你選擇撤退...', () => this.onDeathMatchGameOver());
      return;
    }

    if (skill.type === 'block') {
      this.playerCombat.isBlocking = true;
      this.showMessage('你擺出防禦姿態！減傷50%！', () => {
        this.doEnemyHumanPhaseAttack();
      });
      return;
    }

    // 攻擊敵方（人類 or 靈寵）
    if (Math.random() * 100 > skill.accuracy) {
      this.showMessage(`你的 ${skill.name} 沒有命中！`, () => {
        this.doEnemyHumanPhaseAttack();
      });
      return;
    }

    if (this.enemyIsHuman) {
      // 人類 vs 人類
      const result = calculatePlayerDamage(
        this.playerCombat.atk, this.playerCombat.atkStage, this.playerCombat.level, '你',
        this.enemyPlayerCombat.def, this.enemyPlayerCombat.defStage, this.enemyPlayerCombat.isBlocking,
        skill.power, skill.name, this.enemyPlayerCombat.level,
      );
      this.enemyPlayerCombat.hp = Math.max(0, this.enemyPlayerCombat.hp - result.damage);
      this.enemyPlayerCombat.isBlocking = false;
      this.updateInfoPanels();
      this.showMessage(result.message, () => {
        if (this.enemyPlayerCombat!.hp <= 0) {
          this.onDeathMatchVictory();
          return;
        }
        this.doEnemyHumanPhaseAttack();
      });
    } else {
      // 人類 vs 靈寵
      const result = calculatePlayerDamage(
        this.playerCombat.atk, this.playerCombat.atkStage, this.playerCombat.level, '你',
        this.enemyMonster.def, this.enemyMonster.defStage, false,
        skill.power, skill.name, this.enemyMonster.level,
      );
      this.enemyMonster.hp = Math.max(0, this.enemyMonster.hp - result.damage);
      this.updateInfoPanels();
      this.showMessage(result.message, () => {
        if (this.enemyMonster.hp <= 0) {
          this.onEnemyDefeated();
          return;
        }
        this.doEnemyHumanPhaseAttack();
      });
    }
  }

  /** 死鬥人類階段：敵方反擊 */
  private doEnemyHumanPhaseAttack(): void {
    if (!this.playerCombat) return;

    if (this.enemyIsHuman && this.enemyPlayerCombat) {
      // 敵方人類攻擊玩家人類
      const atkSkill = Math.random() < 0.6 ? PLAYER_SKILLS[0] : PLAYER_SKILLS[1];
      if (Math.random() * 100 > atkSkill.accuracy) {
        this.showMessage(`${this.trainerName} 的 ${atkSkill.name} 沒有命中！`, () => {
          this.playerCombat!.isBlocking = false;
          this.isAnimating = false;
          this.showActions();
        });
        return;
      }
      const result = calculatePlayerDamage(
        this.enemyPlayerCombat.atk, this.enemyPlayerCombat.atkStage, this.enemyPlayerCombat.level, this.trainerName,
        this.playerCombat.def, this.playerCombat.defStage, this.playerCombat.isBlocking,
        atkSkill.power, atkSkill.name, this.playerCombat.level,
      );
      this.playerCombat.hp = Math.max(0, this.playerCombat.hp - result.damage);
      this.playerCombat.isBlocking = false;
      this.updateInfoPanels();
      this.showMessage(result.message, () => {
        if (this.playerCombat!.hp <= 0) {
          this.onDeathMatchGameOver();
          return;
        }
        this.isAnimating = false;
        this.showActions();
      });
    } else {
      // 敵方靈寵攻擊玩家人類
      const ea = this.getEnemySkillAction();
      ea.decPp();

      if (Math.random() * 100 > ea.skill.accuracy) {
        this.showMessage(`${this.enemyMonster.nickname} 的 ${ea.skill.name} 沒有命中！`, () => {
          this.playerCombat!.isBlocking = false;
          this.isAnimating = false;
          this.showActions();
        });
        return;
      }
      const result = calculatePlayerDamage(
        this.enemyMonster.atk, this.enemyMonster.atkStage, this.enemyMonster.level, this.enemyMonster.nickname,
        this.playerCombat.def, this.playerCombat.defStage, this.playerCombat.isBlocking,
        ea.skill.power, ea.skill.name, this.playerCombat.level,
      );
      this.playerCombat.hp = Math.max(0, this.playerCombat.hp - result.damage);
      this.playerCombat.isBlocking = false;
      this.updateInfoPanels();
      this.showMessage(result.message, () => {
        if (this.playerCombat!.hp <= 0) {
          this.onDeathMatchGameOver();
          return;
        }
        this.isAnimating = false;
        this.showActions();
      });
    }
  }

  /** 死鬥勝利：奪取對方靈寵，NPC消失 */
  private onDeathMatchVictory(): void {
    const state = getState();
    const exp = getExpReward(this.enemyTeam[0], getState().playerCombat.level) * 2;
    applyPlayerExp(Math.floor(exp * 0.5));
    recalcPlayerStats();

    for (const enemy of this.enemyTeam) {
      enemy.hp = enemy.maxHp;
      enemy.skills.forEach(s => { s.currentPp = s.skill.pp; });
      addMonsterToTeam(enemy);
    }

    if (this.trainerId) {
      state.defeatedTrainers.add(this.trainerId);
      state.defeatedDeathmatch.add(this.trainerId);
    }

    this.showMessage(`死鬥勝利！奪取了對方 ${this.enemyTeam.length} 隻靈寵！\n${this.trainerName} 消失了...`, () => {
      this.endBattle();
    });
  }

  /** 死鬥失敗：GAME OVER（Boss 戰 → Bad End） */
  private onDeathMatchGameOver(): void {
    if (this.isBoss) {
      this.showMessage('【……失策。】\n屬性崩潰警告：生命值 → 0。\n靈魂沉降……\n\nBAD END', () => {
        this.isAnimating = false;
        this.tweens.killAll();
        this.sound.stopAll();
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        this.time.delayedCall(1050, () => {
          this.scene.stop();
          this.scene.stop('Overworld');
          this.scene.start('Ending', { endingType: 'bad' });
        });
      });
      return;
    }
    this.showMessage('你在死鬥中被打倒了...\n\nGAME OVER', () => {
      this.isAnimating = false;
      this.tweens.killAll();
      this.sound.stopAll();
      this.cameras.main.fadeOut(1000, 0, 0, 0);
      this.time.delayedCall(1050, () => {
        this.scene.stop();
        this.scene.stop('Overworld');
        this.scene.start('MainMenu');
      });
    });
  }

  /** Boss 戰 Normal End 路線：煉化全部靈寵獲得力量 */
  private absorbAllPetsForBoss(): void {
    this.isAnimating = true;
    this.clearButtons();
    const state = getState();

    // 計算全部靈寵的屬性加成
    let totalHp = 0, totalAtk = 0, totalDef = 0, totalSpd = 0;
    const petNames: string[] = [];
    for (const m of state.team) {
      totalHp += m.maxHp;
      totalAtk += m.atk;
      totalDef += m.def;
      totalSpd += m.spd;
      petNames.push(m.nickname);
    }

    // 靈寵全部犧牲
    for (const m of state.team) {
      m.hp = 0;
    }

    // 人類獲得全部靈寵屬性的 80%
    const pc = this.playerCombat!;
    const gainHp = Math.floor(totalHp * 0.8);
    const gainAtk = Math.floor(totalAtk * 0.8);
    const gainDef = Math.floor(totalDef * 0.8);
    const gainSpd = Math.floor(totalSpd * 0.8);

    pc.maxHp += gainHp;
    pc.hp = pc.maxHp; // 滿血復活
    pc.atk += gainAtk;
    pc.def += gainDef;
    pc.spd += gainSpd;

    this.hasAbsorbedAllPets = true;

    const namesStr = petNames.join('、');
    this.showMessage(
      `${namesStr}的神魂化作金光——無掙扎，無遲疑。\n【它信任我。這是它最後能給的東西。】\n\nHP+${gainHp} 攻+${gainAtk} 防+${gainDef} 速+${gainSpd}`,
      () => {
        this.updateInfoPanels();
        this.isAnimating = false;
        this.showActions();
      },
    );
  }

  // ═══════════════════════════════════════
  //  煉天大法：煉化系統
  // ═══════════════════════════════════════

  /** 選擇煉化目標 */
  private tryRefinement(): void {
    this.isAnimating = true;
    this.clearButtons();
    const state = getState();

    // 收集可煉化目標
    const targets: { name: string; type: 'pet' | 'human' }[] = [];
    if (this.enemyMonster.hp > 0 && this.enemyMonster.hp / this.enemyMonster.maxHp < 0.15) {
      targets.push({ name: this.enemyMonster.nickname, type: 'pet' });
    }
    if (this.isDeathmatch && this.enemyPlayerCombat && this.enemyPlayerCombat.hp > 0 && this.enemyPlayerCombat.hp / this.enemyPlayerCombat.maxHp < 0.15) {
      targets.push({ name: this.trainerName, type: 'human' });
    }

    if (targets.length === 0) {
      this.showMessage('沒有可煉化的目標！', () => {
        this.isAnimating = false;
        this.showActions();
      });
      return;
    }

    // 只有一個目標：直接煉化
    if (targets.length === 1) {
      this.doRefinement(targets[0].type);
      return;
    }

    // 多個目標：選擇
    this.clearButtons();
    this.messageText.setText('選擇煉化目標：');
    const { width, height } = this.scale;
    targets.forEach((t, i) => {
      const btn = this.add.text(width / 2 - 60, height - 82 + i * 22, `【${t.name}】`, {
        fontSize: '16px', color: '#ff4444',
      }).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#ffcc44'));
      btn.on('pointerout', () => btn.setColor('#ff4444'));
      btn.on('pointerdown', () => this.doRefinement(t.type));
      this.actionButtons.push(btn);
    });
  }

  private doRefinement(targetType: 'pet' | 'human'): void {
    this.clearButtons();
    const state = getState();

    if (targetType === 'pet') {
      this.showMessage('嘗試煉化敵方靈寵...', () => {
        const result = attemptRefinement(this.enemyMonster, state.playerCombat);
        if (result.success) {
          this.tweens.add({
            targets: this.enemySprite,
            scale: 0, alpha: 0, duration: 600,
            onComplete: () => {
              recalcPlayerStats();
              const msg = `煉化成功！吸收了：\nHP+${result.gains.hp} 攻+${result.gains.atk} 防+${result.gains.def} 速+${result.gains.spd}`;
              this.showMessage(msg, () => {
                this.updateInfoPanels();
                this.enemyMonster.hp = 0;
                this.onEnemyDefeated();
              });
            },
          });
        } else {
          this.showMessage('煉化失敗！靈寵掙脫了！', () => {
            this.executeEnemyCombatantTurn();
          });
        }
      });
    } else {
      // 煉化敵方人類
      if (!this.enemyPlayerCombat) return;
      this.showMessage(`嘗試煉化 ${this.trainerName}...`, () => {
        // 使用類似公式：成功率 = 50% + (玩家lv - 敵lv)*2%
        const rate = Math.max(10, Math.min(90, 50 + (state.playerCombat.level - this.enemyPlayerCombat!.level) * 2));
        const success = Math.random() * 100 < rate;
        if (success) {
          const epc = this.enemyPlayerCombat!;
          const gains = {
            hp: Math.max(1, Math.floor(epc.maxHp * 0.08)),
            atk: Math.max(1, Math.floor(epc.atk * 0.08)),
            def: Math.max(1, Math.floor(epc.def * 0.08)),
            spd: Math.max(1, Math.floor(epc.spd * 0.08)),
          };
          state.playerCombat.refinedBonusHp += gains.hp;
          state.playerCombat.refinedBonusAtk += gains.atk;
          state.playerCombat.refinedBonusDef += gains.def;
          state.playerCombat.refinedBonusSpd += gains.spd;
          epc.hp = 0;
          recalcPlayerStats();
          this.updateInfoPanels();
          const msg = `煉化 ${this.trainerName} 成功！吸收了：\nHP+${gains.hp} 攻+${gains.atk} 防+${gains.def} 速+${gains.spd}`;
          this.showMessage(msg, () => {
            if (this.checkCombatantEnd()) return;
            this.isAnimating = false;
            this.showActions();
          });
        } else {
          this.showMessage('煉化失敗！對方掙脫了！', () => {
            this.executeEnemyCombatantTurn();
          });
        }
      });
    }
  }

  private endBattle(): void {
    this.isAnimating = false;
    this.tweens.killAll();

    // 重置所有能力等級
    resetStatStages(this.playerMonster);
    clearStatus(this.playerMonster);
    for (const e of this.enemyTeam) { resetStatStages(e); clearStatus(e); }

    // 自動存檔
    saveGame();

    // 停止戰鬥 BGM
    this.sound.stopAll();

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(350, () => {
      this.onEnd?.();
      this.scene.stop();
      this.scene.resume('Overworld');
    });
  }
}

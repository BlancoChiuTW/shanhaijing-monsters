import { type MonsterInstance, type Skill, type PlayerCombatStats, getTemplate, getTypeMultiplier, getStatStageMul, getRealmDamageMul, checkNewSkills, getBaseStats, calcStats, calcPlayerCombatStats } from '../data/monsters';

export { calcStats };

export interface BattleResult {
  damage: number;
  message: string;
  effectiveness: string;
  isCrit: boolean;
  drainHeal: number;
  recoilDmg: number;
  statMsg: string;
}

export function calculateDamage(attacker: MonsterInstance, defender: MonsterInstance, skill: Skill): BattleResult {
  const atkTemplate = getTemplate(attacker.templateId);
  const defTemplate = getTemplate(defender.templateId);
  const typeMultiplier = getTypeMultiplier(skill.element, defTemplate.element);

  const stab = skill.element === atkTemplate.element ? 1.3 : 1.0;
  const isCrit = Math.random() < 0.0625;
  const critMul = isCrit ? 1.5 : 1.0;
  const random = 0.85 + Math.random() * 0.15;

  const atkStat = attacker.atk * getStatStageMul(attacker.atkStage);
  const defStat = defender.def * getStatStageMul(defender.defStage);

  const realmMul = getRealmDamageMul(attacker.level, defender.level);
  const baseDamage = ((2 * attacker.level / 5 + 2) * skill.power * (atkStat / defStat)) / 50 + 2;
  const finalDamage = Math.max(1, Math.floor(baseDamage * typeMultiplier * stab * critMul * random * realmMul));

  let effectiveness = 'normal';
  let effMsg = '';
  if (typeMultiplier > 1) { effectiveness = 'effective'; effMsg = '效果拔群！'; }
  else if (typeMultiplier < 1) { effectiveness = 'weak'; effMsg = '效果不佳...'; }

  const critMsg = isCrit ? '會心一擊！' : '';

  let drainHeal = 0;
  let recoilDmg = 0;
  let statMsg = '';

  if (skill.effect) {
    switch (skill.effect.type) {
      case 'drain': {
        drainHeal = Math.floor(finalDamage * skill.effect.percent / 100);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + drainHeal);
        statMsg = `吸取了 ${drainHeal} HP！`;
        break;
      }
      case 'recoil': {
        recoilDmg = Math.floor(finalDamage * skill.effect.percent / 100);
        attacker.hp = Math.max(0, attacker.hp - recoilDmg);
        statMsg = `受到了 ${recoilDmg} 反傷！`;
        break;
      }
      case 'statDown': {
        const stat = skill.effect.stat;
        const stages = skill.effect.stages;
        const statName = stat === 'atk' ? '攻擊' : stat === 'def' ? '防禦' : '速度';
        const oldStage = defender[`${stat}Stage`];
        defender[`${stat}Stage`] = Math.max(-6, oldStage - stages);
        if (oldStage > -6) {
          statMsg = `${defender.nickname} 的${statName}${stages >= 2 ? '大幅' : ''}下降了！`;
        } else {
          statMsg = `${defender.nickname} 的${statName}已經不能再低了！`;
        }
        break;
      }
      case 'burn':
      case 'poison': {
        statMsg = applyStatus(defender, skill.effect.type);
        break;
      }
    }
  }

  const message = `${attacker.nickname} 使用了 ${skill.name}！${effMsg}${critMsg} 造成 ${finalDamage} 點傷害！`;
  return { damage: finalDamage, message, effectiveness, isCrit, drainHeal, recoilDmg, statMsg };
}

export function applyBuffSkill(user: MonsterInstance, target: MonsterInstance, skill: Skill): string {
  if (!skill.effect) {
    const healAmount = Math.floor(user.maxHp * 0.3);
    user.hp = Math.min(user.maxHp, user.hp + healAmount);
    return `${user.nickname} 使用了 ${skill.name}！恢復了 ${healAmount} HP！`;
  }

  switch (skill.effect.type) {
    case 'heal': {
      const healAmount = Math.floor(user.maxHp * skill.effect.percent / 100);
      user.hp = Math.min(user.maxHp, user.hp + healAmount);
      return `${user.nickname} 使用了 ${skill.name}！恢復了 ${healAmount} HP！`;
    }
    case 'statUp': {
      const stat = skill.effect.stat;
      const stages = skill.effect.stages;
      const statName = stat === 'atk' ? '攻擊' : stat === 'def' ? '防禦' : '速度';
      const oldStage = user[`${stat}Stage`];
      user[`${stat}Stage`] = Math.min(6, oldStage + stages);
      if (oldStage < 6) {
        return `${user.nickname} 使用了 ${skill.name}！${statName}${stages >= 2 ? '大幅' : ''}上升了！`;
      }
      return `${user.nickname} 使用了 ${skill.name}！但${statName}已經不能再高了！`;
    }
    case 'statDown': {
      const stat = skill.effect.stat;
      const stages = skill.effect.stages;
      const statName = stat === 'atk' ? '攻擊' : stat === 'def' ? '防禦' : '速度';
      const oldStage = target[`${stat}Stage`];
      target[`${stat}Stage`] = Math.max(-6, oldStage - stages);
      if (oldStage > -6) {
        return `${user.nickname} 使用了 ${skill.name}！${target.nickname} 的${statName}${stages >= 2 ? '大幅' : ''}下降了！`;
      }
      return `${user.nickname} 使用了 ${skill.name}！但${target.nickname} 的${statName}已經不能再低了！`;
    }
    default:
      return `${user.nickname} 使用了 ${skill.name}！`;
  }
}

export function calculateCatchRate(monster: MonsterInstance): boolean {
  const template = getTemplate(monster.templateId);
  const hpRatio = monster.hp / monster.maxHp;
  const modifiedRate = template.catchRate * (1 - hpRatio * 0.6);
  const roll = Math.random() * 255;
  return roll < modifiedRate;
}

export function getExpReward(defeated: MonsterInstance, myLevel?: number): number {
  let base = Math.floor(defeated.level * 25 + 30);
  // 越階獎勵：打比自己高等的敵人 +30% EXP
  if (myLevel != null && defeated.level > myLevel) {
    base = Math.floor(base * 1.3);
  }
  return base;
}

export function applyExp(monster: MonsterInstance, exp: number): { leveled: boolean; newLevel: number; newSkills: string[]; realmUp: boolean } {
  if (monster.level >= 42) return { leveled: false, newLevel: monster.level, newSkills: [], realmUp: false };

  monster.exp += exp;
  // 經驗曲線：前30級平穩成長，31+漸緩但不斷崖
  const expNeeded = monster.level <= 30
    ? monster.level * 20 + 10
    : monster.level * 30;

  if (monster.exp >= expNeeded) {
    const oldLevel = monster.level;
    monster.exp -= expNeeded;
    monster.level = Math.min(42, monster.level + 1);

    // 重算素質
    const base = getBaseStats(monster);
    const stats = calcStats(base.hp, base.atk, base.def, base.spd, monster.level);
    const oldMaxHp = monster.maxHp;
    monster.maxHp = stats.maxHp;
    monster.hp += monster.maxHp - oldMaxHp;
    monster.atk = stats.atk;
    monster.def = stats.def;
    monster.spd = stats.spd;

    // 境界突破判定
    const realmBoundaries = [10, 20, 30, 34, 38];
    const realmUp = realmBoundaries.includes(oldLevel);

    const newSkills = checkNewSkills(monster);
    return { leveled: true, newLevel: monster.level, newSkills, realmUp };
  }
  return { leveled: false, newLevel: monster.level, newSkills: [], realmUp: false };
}

export function enemyChooseAction(monster: MonsterInstance, defender?: MonsterInstance): number {
  const available = monster.skills
    .map((s, i) => ({ ...s, index: i }))
    .filter(s => s.currentPp > 0);
  if (available.length === 0) return -1; // 掙扎

  const hpRatio = monster.hp / monster.maxHp;

  // 低血量時優先使用回復/吸血技能
  if (hpRatio < 0.3) {
    const healSkill = available.find(s =>
      s.skill.effect?.type === 'heal' || s.skill.effect?.type === 'drain');
    if (healSkill && Math.random() < 0.7) return healSkill.index;
  }

  // 有 buff 技且尚未 buff 過，考慮使用
  if (monster.atkStage === 0 && monster.defStage === 0 && monster.spdStage === 0) {
    const buffSkill = available.find(s => s.skill.effect?.type === 'statUp');
    if (buffSkill && Math.random() < 0.3) return buffSkill.index;
  }

  // 考慮屬性相剋：優先選效果拔群的技能
  if (defender) {
    const defTemplate = getTemplate(defender.templateId);
    const effective = available.filter(s =>
      s.skill.power > 0 && getTypeMultiplier(s.skill.element, defTemplate.element) > 1);
    if (effective.length > 0 && Math.random() < 0.6) {
      const sorted = [...effective].sort((a, b) => b.skill.power - a.skill.power);
      return sorted[0].index;
    }
  }

  // 預設：70% 最高威力，30% 隨機
  if (Math.random() < 0.7) {
    const sorted = [...available].sort((a, b) => b.skill.power - a.skill.power);
    return sorted[0].index;
  }
  return available[Math.floor(Math.random() * available.length)].index;
}

export function healMonster(monster: MonsterInstance): void {
  monster.hp = monster.maxHp;
  monster.atkStage = 0;
  monster.defStage = 0;
  monster.spdStage = 0;
  monster.statusCondition = null;
  monster.statusTurns = 0;
  monster.buffTurnCount = 0;
  for (const s of monster.skills) {
    s.currentPp = s.skill.pp;
  }
}

export function resetStatStages(monster: MonsterInstance): void {
  monster.atkStage = 0;
  monster.defStage = 0;
  monster.spdStage = 0;
}

/** 清除狀態異常 */
export function clearStatus(monster: MonsterInstance): void {
  monster.statusCondition = null;
  monster.statusTurns = 0;
}

/** 施加狀態異常（不覆蓋已有狀態） */
export function applyStatus(monster: MonsterInstance, status: 'burn' | 'poison'): string {
  if (monster.statusCondition) {
    const name = monster.statusCondition === 'burn' ? '灼燒' : '中毒';
    return `${monster.nickname} 已經處於${name}狀態！`;
  }
  monster.statusCondition = status;
  monster.statusTurns = status === 'burn' ? 3 : 5;
  const statusName = status === 'burn' ? '灼燒' : '中毒';
  return `${monster.nickname} 陷入了${statusName}狀態！`;
}

/** 回合結束時處理狀態異常傷害，回傳傷害量與訊息 */
export function processStatusDamage(monster: MonsterInstance): { damage: number; message: string } | null {
  if (!monster.statusCondition || !monster.statusTurns || monster.statusTurns <= 0) return null;

  const fraction = monster.statusCondition === 'burn' ? 16 : 8;
  const damage = Math.max(1, Math.floor(monster.maxHp / fraction));
  monster.hp = Math.max(0, monster.hp - damage);
  monster.statusTurns--;

  const statusName = monster.statusCondition === 'burn' ? '灼燒' : '中毒';
  const message = `${monster.nickname} 受到${statusName}傷害，損失 ${damage} HP！`;

  if (monster.statusTurns <= 0) {
    monster.statusCondition = null;
  }

  return { damage, message };
}

/** buff/debuff 衰減：每4回合所有stage向0靠近1格 */
export function decayStatStages(monster: MonsterInstance): string {
  monster.buffTurnCount = (monster.buffTurnCount || 0) + 1;
  if (monster.buffTurnCount < 4) return '';
  monster.buffTurnCount = 0;

  let decayed = false;
  if (monster.atkStage > 0) { monster.atkStage--; decayed = true; }
  else if (monster.atkStage < 0) { monster.atkStage++; decayed = true; }
  if (monster.defStage > 0) { monster.defStage--; decayed = true; }
  else if (monster.defStage < 0) { monster.defStage++; decayed = true; }
  if (monster.spdStage > 0) { monster.spdStage--; decayed = true; }
  else if (monster.spdStage < 0) { monster.spdStage++; decayed = true; }

  return decayed ? `${monster.nickname} 的能力變化逐漸消退...` : '';
}

// ═══════════════════════════════════════
//  人類戰鬥
// ═══════════════════════════════════════

export interface PlayerDamageResult {
  damage: number;
  message: string;
  isCrit: boolean;
}

/** 人類攻擊靈獸或靈獸攻擊人類的傷害計算 */
export function calculatePlayerDamage(
  atkStat: number, atkStage: number, atkLevel: number, atkName: string,
  defStat: number, defStage: number, defIsBlocking: boolean,
  power: number, skillName: string,
  defLevel?: number,
): PlayerDamageResult {
  const isCrit = Math.random() < 0.0625;
  const critMul = isCrit ? 1.5 : 1.0;
  const random = 0.85 + Math.random() * 0.15;
  const atk = atkStat * getStatStageMul(atkStage);
  const def = defStat * getStatStageMul(defStage);
  const blockMul = defIsBlocking ? 0.5 : 1.0;
  const realmMul = defLevel != null ? getRealmDamageMul(atkLevel, defLevel) : 1.0;

  const baseDamage = ((2 * atkLevel / 5 + 2) * power * (atk / def)) / 50 + 2;
  const finalDamage = Math.max(1, Math.floor(baseDamage * critMul * random * blockMul * realmMul));

  const critMsg = isCrit ? '會心一擊！' : '';
  const message = `${atkName} 使用了 ${skillName}！${critMsg} 造成 ${finalDamage} 點傷害！`;
  return { damage: finalDamage, message, isCrit };
}

/** 生成NPC死鬥用人類屬性 */
export function generateEnemyPlayerStats(enemyTeam: MonsterInstance[]): PlayerCombatStats {
  const avgLevel = Math.floor(enemyTeam.reduce((s, m) => s + m.level, 0) / enemyTeam.length);
  const stats = calcPlayerCombatStats(enemyTeam, { hp: 0, atk: 0, def: 0, spd: 0 }, avgLevel);
  return {
    level: avgLevel,
    exp: 0,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    atkStage: 0, defStage: 0, spdStage: 0,
    refinedBonusHp: 0, refinedBonusAtk: 0,
    refinedBonusDef: 0, refinedBonusSpd: 0,
    isBlocking: false,
  };
}

/** 最終 Boss 人類屬性：靈獸加總/6 * 1.3 */
export function generateBossPlayerStats(enemyTeam: MonsterInstance[]): PlayerCombatStats {
  const n = enemyTeam.length;
  const sumHp = enemyTeam.reduce((s, m) => s + m.maxHp, 0);
  const sumAtk = enemyTeam.reduce((s, m) => s + m.atk, 0);
  const sumDef = enemyTeam.reduce((s, m) => s + m.def, 0);
  const sumSpd = enemyTeam.reduce((s, m) => s + m.spd, 0);
  const mul = 1.3;

  const hp = Math.floor(sumHp / n * mul);
  const atk = Math.floor(sumAtk / n * mul);
  const def = Math.floor(sumDef / n * mul);
  const spd = Math.floor(sumSpd / n * mul);

  return {
    level: 34, // 化神大圓滿
    exp: 0,
    hp, maxHp: hp,
    atk, def, spd,
    atkStage: 0, defStage: 0, spdStage: 0,
    refinedBonusHp: 0, refinedBonusAtk: 0,
    refinedBonusDef: 0, refinedBonusSpd: 0,
    isBlocking: false,
  };
}

/** 煉天大法：嘗試煉化敵方靈獸 */
export function attemptRefinement(
  enemy: MonsterInstance, playerCombat: PlayerCombatStats,
): { success: boolean; gains: { hp: number; atk: number; def: number; spd: number } } {
  const hpRatio = enemy.hp / enemy.maxHp;
  if (hpRatio > 0.15) return { success: false, gains: { hp: 0, atk: 0, def: 0, spd: 0 } };

  // 血量越低額外加成：15%→+0%, 1%→+14%
  const hpPercent = Math.floor(hpRatio * 100);
  const hpBonus = Math.max(0, 15 - hpPercent);
  const rate = Math.max(10, Math.min(90, 50 + (playerCombat.level - enemy.level) * 2 + hpBonus));
  const success = Math.random() * 100 < rate;

  if (!success) return { success: false, gains: { hp: 0, atk: 0, def: 0, spd: 0 } };

  const gains = {
    hp: Math.max(1, Math.floor(enemy.maxHp * 0.05)),
    atk: Math.max(1, Math.floor(enemy.atk * 0.05)),
    def: Math.max(1, Math.floor(enemy.def * 0.05)),
    spd: Math.max(1, Math.floor(enemy.spd * 0.05)),
  };

  playerCombat.refinedBonusHp += gains.hp;
  playerCombat.refinedBonusAtk += gains.atk;
  playerCombat.refinedBonusDef += gains.def;
  playerCombat.refinedBonusSpd += gains.spd;

  return { success, gains };
}

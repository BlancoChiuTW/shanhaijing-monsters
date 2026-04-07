import { type MonsterInstance, type Skill, getTemplate, getTypeMultiplier, createMonsterInstance } from '../data/monsters';

export interface BattleAction {
  type: 'skill' | 'catch' | 'switch' | 'run';
  skillIndex?: number;
  switchIndex?: number;
}

export interface BattleResult {
  damage: number;
  message: string;
  effectiveness: string; // 'normal' | 'effective' | 'weak'
  isCrit: boolean;
}

export function calculateDamage(attacker: MonsterInstance, defender: MonsterInstance, skill: Skill): BattleResult {
  const atkTemplate = getTemplate(attacker.templateId);
  const defTemplate = getTemplate(defender.templateId);
  const typeMultiplier = getTypeMultiplier(skill.element, defTemplate.element);

  // STAB bonus (same type attack bonus)
  const stab = skill.element === atkTemplate.element ? 1.3 : 1.0;

  // Critical hit (6.25% chance, 1.5x)
  const isCrit = Math.random() < 0.0625;
  const critMul = isCrit ? 1.5 : 1.0;

  // Random factor
  const random = 0.85 + Math.random() * 0.15;

  // Base damage formula
  const baseDamage = ((2 * attacker.level / 5 + 2) * skill.power * (attacker.atk / defender.def)) / 50 + 2;
  const finalDamage = Math.max(1, Math.floor(baseDamage * typeMultiplier * stab * critMul * random));

  let effectiveness = 'normal';
  let effMsg = '';
  if (typeMultiplier > 1) { effectiveness = 'effective'; effMsg = '效果拔群！'; }
  else if (typeMultiplier < 1) { effectiveness = 'weak'; effMsg = '效果不佳...'; }

  const critMsg = isCrit ? '會心一擊！' : '';
  const message = `${attacker.nickname} 使用了 ${skill.name}！${effMsg}${critMsg} 造成 ${finalDamage} 點傷害！`;

  return { damage: finalDamage, message, effectiveness, isCrit };
}

export function calculateCatchRate(monster: MonsterInstance): boolean {
  const template = getTemplate(monster.templateId);
  const hpRatio = monster.hp / monster.maxHp;
  // Lower HP = easier to catch
  const modifiedRate = template.catchRate * (1 - hpRatio * 0.6);
  const roll = Math.random() * 255;
  return roll < modifiedRate;
}

export function getExpReward(defeated: MonsterInstance): number {
  return Math.floor(defeated.level * 15 + 20);
}

export function applyExp(monster: MonsterInstance, exp: number): { leveled: boolean; newLevel: number } {
  monster.exp += exp;
  const expNeeded = monster.level * 50;
  if (monster.exp >= expNeeded) {
    monster.exp -= expNeeded;
    monster.level++;
    // Recalculate stats
    const template = getTemplate(monster.templateId);
    const lvlMul = 1 + (monster.level - 1) * 0.08;
    const oldMaxHp = monster.maxHp;
    monster.maxHp = Math.floor(template.baseHp * lvlMul);
    monster.hp += monster.maxHp - oldMaxHp; // Heal the HP difference
    monster.atk = Math.floor(template.baseAtk * lvlMul);
    monster.def = Math.floor(template.baseDef * lvlMul);
    monster.spd = Math.floor(template.baseSpd * lvlMul);
    return { leveled: true, newLevel: monster.level };
  }
  return { leveled: false, newLevel: monster.level };
}

export function enemyChooseAction(monster: MonsterInstance): number {
  // Simple AI: pick a random skill that has PP
  const available = monster.skills
    .map((s, i) => ({ ...s, index: i }))
    .filter(s => s.currentPp > 0);
  if (available.length === 0) return 0;
  return available[Math.floor(Math.random() * available.length)].index;
}

export function healMonster(monster: MonsterInstance): void {
  monster.hp = monster.maxHp;
  for (const s of monster.skills) {
    s.currentPp = s.skill.pp;
  }
}

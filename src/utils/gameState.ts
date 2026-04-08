import { type MonsterInstance, type CultivationMethod, type PlayerCombatStats, createMonsterInstance, createInitialPlayerCombat, calcPlayerCombatStats, recalcStats } from '../data/monsters';
import { healMonster } from './battle';

export interface PlayerState {
  name: string;
  team: MonsterInstance[];       // max 6
  storage: MonsterInstance[];    // captured but not in team
  currentMapId: string;
  playerX: number;
  playerY: number;
  caughtIds: Set<string>;       // unique monster IDs caught (for completion)
  seenMonsterIds: Set<string>;  // 見過的靈獸（萬靈化型變用）
  defeatedTrainers: Set<string>;
  defeatedDeathmatch: Set<string>; // 死鬥中被打敗的NPC（會從地圖消失）
  talkedNpcs: Set<string>;
  collectedTreasures: Set<string>; // 已拾取的寶物 ID
  cultivationMethod: CultivationMethod;
  playerCombat: PlayerCombatStats;
}

const SAVE_KEY = 'shanhaijing_save';

let state: PlayerState;

export function initNewGame(cultivationMethod: CultivationMethod, soulBoundId?: string): PlayerState {
  const starter1 = createMonsterInstance('qiongqi', 5);
  const starter2 = createMonsterInstance('bifang', 5);
  const starter3 = createMonsterInstance('kun', 5);
  const team = [starter1, starter2, starter3];

  // 御獸神訣：標記本命靈寵並重算屬性
  if (cultivationMethod === '御獸神訣' && soulBoundId) {
    const soulBound = team.find(m => m.templateId === soulBoundId);
    if (soulBound) {
      soulBound.isSoulBound = true;
      recalcStats(soulBound);
      soulBound.hp = soulBound.maxHp;
    }
  }

  const playerCombat = createInitialPlayerCombat();

  state = {
    name: '靈獸師',
    team,
    storage: [],
    currentMapId: 'qingqiu',
    playerX: 64,
    playerY: 113,
    caughtIds: new Set(['qiongqi', 'bifang', 'kun']),
    seenMonsterIds: new Set(['qiongqi', 'bifang', 'kun']),
    defeatedTrainers: new Set(),
    defeatedDeathmatch: new Set(),
    talkedNpcs: new Set(),
    collectedTreasures: new Set(),
    cultivationMethod,
    playerCombat,
  };

  recalcPlayerStats();
  state.playerCombat.hp = state.playerCombat.maxHp;
  return state;
}

export function recalcPlayerStats(): void {
  const pc = state.playerCombat;
  const stats = calcPlayerCombatStats(state.team, {
    hp: pc.refinedBonusHp, atk: pc.refinedBonusAtk,
    def: pc.refinedBonusDef, spd: pc.refinedBonusSpd,
  }, pc.level);
  const oldMaxHp = pc.maxHp;
  pc.maxHp = stats.maxHp;
  pc.hp = Math.min(pc.maxHp, pc.hp + Math.max(0, stats.maxHp - oldMaxHp));
  pc.atk = stats.atk;
  pc.def = stats.def;
  pc.spd = stats.spd;
}

export function healPlayer(): void {
  state.playerCombat.hp = state.playerCombat.maxHp;
  state.playerCombat.atkStage = 0;
  state.playerCombat.defStage = 0;
  state.playerCombat.spdStage = 0;
  state.playerCombat.isBlocking = false;
}

export function applyPlayerExp(exp: number): { leveled: boolean; newLevel: number } {
  const pc = state.playerCombat;
  if (pc.level >= 42) return { leveled: false, newLevel: pc.level };
  pc.exp += exp;
  const expNeeded = pc.level <= 30 ? pc.level * 20 + 10 : pc.level * 40;
  if (pc.exp >= expNeeded) {
    pc.exp -= expNeeded;
    pc.level = Math.min(42, pc.level + 1);
    recalcPlayerStats();
    return { leveled: true, newLevel: pc.level };
  }
  return { leveled: false, newLevel: pc.level };
}

export function getState(): PlayerState {
  return state;
}

export function setState(s: PlayerState): void {
  state = s;
}

/** 嘗試加入隊伍。隊伍滿6隻時放入倉庫，回傳 'team' | 'storage' */
export function addMonsterToTeam(monster: MonsterInstance): 'team' | 'storage' {
  state.caughtIds.add(monster.templateId);
  state.seenMonsterIds.add(monster.templateId);
  if (state.team.length < 6) {
    state.team.push(monster);
    return 'team';
  }
  state.storage.push(monster);
  return 'storage';
}

/** 隊伍是否已滿（捕獲前檢查用） */
export function isTeamFull(): boolean {
  return state.team.length >= 6;
}

/** 記錄見過的靈獸 */
export function addSeenMonster(templateId: string): void {
  state.seenMonsterIds.add(templateId);
}

export function healTeam(): void {
  for (const m of state.team) {
    healMonster(m);
  }
}

export function getFirstAliveIndex(): number {
  return state.team.findIndex(m => m.hp > 0);
}

export function saveGame(): void {
  const data = {
    ...state,
    caughtIds: Array.from(state.caughtIds),
    seenMonsterIds: Array.from(state.seenMonsterIds),
    defeatedTrainers: Array.from(state.defeatedTrainers),
    defeatedDeathmatch: Array.from(state.defeatedDeathmatch),
    talkedNpcs: Array.from(state.talkedNpcs),
    collectedTreasures: Array.from(state.collectedTreasures),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function loadGame(): PlayerState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  const data = JSON.parse(raw);
  state = {
    ...data,
    caughtIds: new Set(data.caughtIds),
    seenMonsterIds: new Set(data.seenMonsterIds || data.caughtIds || []),
    defeatedTrainers: new Set(data.defeatedTrainers),
    defeatedDeathmatch: new Set(data.defeatedDeathmatch || []),
    talkedNpcs: new Set(data.talkedNpcs),
    collectedTreasures: new Set(data.collectedTreasures || []),
  };
  // 舊存檔相容：補上新欄位
  for (const m of [...state.team, ...state.storage]) {
    if (m.atkStage === undefined) m.atkStage = 0;
    if (m.defStage === undefined) m.defStage = 0;
    if (m.spdStage === undefined) m.spdStage = 0;
    if (!m.learnedSkills) m.learnedSkills = [];
    if (m.statusCondition === undefined) m.statusCondition = null;
    if (m.statusTurns === undefined) m.statusTurns = 0;
    if (m.buffTurnCount === undefined) m.buffTurnCount = 0;
  }
  if (!state.cultivationMethod) state.cultivationMethod = '御獸神訣';
  if (!state.playerCombat) {
    state.playerCombat = createInitialPlayerCombat();
    recalcPlayerStats();
    state.playerCombat.hp = state.playerCombat.maxHp;
  }
  return state;
}

export function hasSave(): boolean {
  return !!localStorage.getItem(SAVE_KEY);
}

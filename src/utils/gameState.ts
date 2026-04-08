import { type MonsterInstance, createMonsterInstance } from '../data/monsters';
import { healMonster } from './battle';

export interface PlayerState {
  name: string;
  team: MonsterInstance[];       // max 6
  storage: MonsterInstance[];    // captured but not in team
  currentMapId: string;
  playerX: number;
  playerY: number;
  caughtIds: Set<string>;       // unique monster IDs caught (for completion)
  defeatedTrainers: Set<string>;
  talkedNpcs: Set<string>;
}

const SAVE_KEY = 'shanhaijing_save';

let state: PlayerState;

export function initNewGame(starterMonsterId: string): PlayerState {
  const starter = createMonsterInstance(starterMonsterId, 5);
  state = {
    name: '靈獸師',
    team: [starter],
    storage: [],
    currentMapId: 'qingqiu',
    playerX: 3,
    playerY: 3,
    caughtIds: new Set([starterMonsterId]),
    defeatedTrainers: new Set(),
    talkedNpcs: new Set(),
  };
  return state;
}

export function getState(): PlayerState {
  return state;
}

export function setState(s: PlayerState): void {
  state = s;
}

export function addMonsterToTeam(monster: MonsterInstance): boolean {
  if (state.team.length < 6) {
    state.team.push(monster);
    state.caughtIds.add(monster.templateId);
    return true;
  }
  state.storage.push(monster);
  state.caughtIds.add(monster.templateId);
  return false;
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
    defeatedTrainers: Array.from(state.defeatedTrainers),
    talkedNpcs: Array.from(state.talkedNpcs),
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
    defeatedTrainers: new Set(data.defeatedTrainers),
    talkedNpcs: new Set(data.talkedNpcs),
  };
  // 舊存檔相容：補上新欄位
  for (const m of [...state.team, ...state.storage]) {
    if (m.atkStage === undefined) m.atkStage = 0;
    if (m.defStage === undefined) m.defStage = 0;
    if (m.spdStage === undefined) m.spdStage = 0;
    if (!m.learnedSkills) m.learnedSkills = [];
  }
  return state;
}

export function hasSave(): boolean {
  return !!localStorage.getItem(SAVE_KEY);
}

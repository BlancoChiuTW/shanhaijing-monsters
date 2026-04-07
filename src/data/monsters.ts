export type Element = '風' | '水' | '火' | '光' | '幻' | '土' | '毒';

export type SkillEffect =
  | { type: 'heal'; percent: number }
  | { type: 'drain'; percent: number }
  | { type: 'recoil'; percent: number }
  | { type: 'statUp'; stat: 'atk' | 'def' | 'spd'; stages: number }
  | { type: 'statDown'; stat: 'atk' | 'def' | 'spd'; stages: number }
  | { type: 'priority' };

export interface Skill {
  name: string;
  element: Element;
  power: number;
  accuracy: number;
  pp: number;
  description: string;
  effect?: SkillEffect;
}

export interface TemplateSkill {
  skill: Skill;
  learnLevel: number;
}

export interface MonsterTemplate {
  id: string;
  name: string;
  element: Element;
  description: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpd: number;
  catchRate: number;
  skills: TemplateSkill[];
  color: number;
}

export interface MonsterInstance {
  templateId: string;
  nickname: string;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  exp: number;
  skills: { skill: Skill; currentPp: number }[];
  atkStage: number;
  defStage: number;
  spdStage: number;
  // 融合相關
  isFused?: boolean;
  isShiny?: boolean;
  fusionBaseStats?: { hp: number; atk: number; def: number; spd: number };
}

// ═══════════════════════════════════════
//  修仙境界系統
// ═══════════════════════════════════════

export interface CultivationInfo {
  realm: string;
  realmIndex: number; // 0-5
  subLevel: string;
  displayName: string;
  color: string; // 境界顏色
}

const REALM_COLORS = ['#aaaaaa', '#44aaff', '#ffcc44', '#ff6644', '#cc44ff', '#ff4488'];

export function getCultivation(level: number): CultivationInfo {
  if (level <= 10) {
    return { realm: '練氣', realmIndex: 0, subLevel: `${level}層`, displayName: `練氣${level}層`, color: REALM_COLORS[0] };
  } else if (level <= 20) {
    const sub = level - 10;
    return { realm: '築基', realmIndex: 1, subLevel: `${sub}層`, displayName: `築基${sub}層`, color: REALM_COLORS[1] };
  } else if (level <= 30) {
    const sub = level - 20;
    return { realm: '金丹', realmIndex: 2, subLevel: `${sub}層`, displayName: `金丹${sub}層`, color: REALM_COLORS[2] };
  } else if (level <= 34) {
    const subs = ['前期', '中期', '後期', '大圓滿'];
    const sub = subs[level - 31];
    return { realm: '化神', realmIndex: 3, subLevel: sub, displayName: `化神${sub}`, color: REALM_COLORS[3] };
  } else if (level <= 38) {
    const subs = ['前期', '中期', '後期', '大圓滿'];
    const sub = subs[level - 35];
    return { realm: '元嬰', realmIndex: 4, subLevel: sub, displayName: `元嬰${sub}`, color: REALM_COLORS[4] };
  } else {
    const subs = ['前期', '中期', '後期', '大圓滿'];
    const sub = subs[Math.min(level - 39, 3)];
    return { realm: '渡劫', realmIndex: 5, subLevel: sub, displayName: `渡劫${sub}`, color: REALM_COLORS[5] };
  }
}

// 屬性相剋表
export const TYPE_CHART: Record<Element, { strong: Element[]; weak: Element[] }> = {
  '風': { strong: ['土', '毒'], weak: ['火', '光'] },
  '水': { strong: ['火', '土'], weak: ['風', '幻'] },
  '火': { strong: ['風', '幻'], weak: ['水', '土'] },
  '光': { strong: ['幻', '毒'], weak: ['土', '水'] },
  '幻': { strong: ['水', '光'], weak: ['火', '毒'] },
  '土': { strong: ['火', '光'], weak: ['水', '風'] },
  '毒': { strong: ['幻', '水'], weak: ['風', '光'] },
};

export function getTypeMultiplier(atkElement: Element, defElement: Element): number {
  const chart = TYPE_CHART[atkElement];
  if (chart.strong.includes(defElement)) return 1.5;
  if (chart.weak.includes(defElement)) return 0.67;
  return 1;
}

export function getStatStageMul(stage: number): number {
  const clamped = Math.max(-6, Math.min(6, stage));
  if (clamped >= 0) return (2 + clamped) / 2;
  return 2 / (2 - clamped);
}

// ═══════════════════════════════════════
//  十隻靈獸定義 (技能擴展至渡劫境)
// ═══════════════════════════════════════

export const MONSTERS: MonsterTemplate[] = [
  // ── 窮奇 (風) ─ 噴火龍型物攻手 ──
  {
    id: 'qiongqi', name: '窮奇', element: '風',
    description: '形如有翼之虎，善飛行，性情兇猛。',
    baseHp: 78, baseAtk: 100, baseDef: 65, baseSpd: 90,
    catchRate: 120, color: 0x8888ff,
    skills: [
      { learnLevel: 1, skill: { name: '撲擊', element: '土', power: 40, accuracy: 100, pp: 35, description: '猛撲向敵人' } },
      { learnLevel: 1, skill: { name: '烈風爪', element: '風', power: 55, accuracy: 95, pp: 25, description: '以銳利風刃撕裂' } },
      { learnLevel: 8, skill: { name: '虎嘯', element: '風', power: 80, accuracy: 100, pp: 15, description: '震耳虎嘯產生衝擊波' } },
      { learnLevel: 15, skill: { name: '地裂踏', element: '土', power: 80, accuracy: 100, pp: 10, description: '猛力踏碎大地' } },
      { learnLevel: 22, skill: { name: '狂風暴', element: '風', power: 110, accuracy: 85, pp: 10, description: '猛烈暴風突進', effect: { type: 'recoil', percent: 25 } } },
      { learnLevel: 30, skill: { name: '天翔突襲', element: '風', power: 80, accuracy: 100, pp: 5, description: '極速俯衝先制攻擊', effect: { type: 'priority' } } },
      { learnLevel: 36, skill: { name: '天風滅世', element: '風', power: 140, accuracy: 80, pp: 5, description: '化神境風暴毀滅一切', effect: { type: 'recoil', percent: 40 } } },
      { learnLevel: 40, skill: { name: '神獸之怒', element: '風', power: 160, accuracy: 75, pp: 3, description: '渡劫境靈力全開', effect: { type: 'recoil', percent: 50 } } },
    ],
  },

  // ── 鯤 (水) ─ 蓋歐卡型水系霸主 ──
  {
    id: 'kun', name: '鯤', element: '水',
    description: '北冥有魚，其名為鯤，鯤之大，不知其幾千里也。',
    baseHp: 125, baseAtk: 70, baseDef: 90, baseSpd: 45,
    catchRate: 60, color: 0x4488cc,
    skills: [
      { learnLevel: 1, skill: { name: '潮汐', element: '水', power: 40, accuracy: 100, pp: 30, description: '掀起小型潮汐' } },
      { learnLevel: 1, skill: { name: '吞噬', element: '水', power: 65, accuracy: 95, pp: 20, description: '張開巨口吞噬一切' } },
      { learnLevel: 10, skill: { name: '巨浪', element: '水', power: 90, accuracy: 100, pp: 15, description: '掀起滔天巨浪沖刷' } },
      { learnLevel: 18, skill: { name: '化鵬', element: '風', power: 85, accuracy: 90, pp: 10, description: '化為大鵬振翅攻擊' } },
      { learnLevel: 25, skill: { name: '深淵之壓', element: '水', power: 110, accuracy: 80, pp: 5, description: '以深海水壓碾壓敵人' } },
      { learnLevel: 32, skill: { name: '鯤鵬萬里', element: '風', power: 120, accuracy: 85, pp: 5, description: '化鵬高飛再俯衝而下', effect: { type: 'recoil', percent: 33 } } },
      { learnLevel: 36, skill: { name: '北冥吞天', element: '水', power: 140, accuracy: 80, pp: 5, description: '化神境吞天之力' } },
      { learnLevel: 40, skill: { name: '逍遙遊', element: '風', power: 150, accuracy: 80, pp: 3, description: '超脫萬物的究極之力', effect: { type: 'drain', percent: 25 } } },
    ],
  },

  // ── 燭龍 (火) ─ 超夢型傳說特攻 ──
  {
    id: 'zhulong', name: '燭龍', element: '火',
    description: '人面蛇身而赤，其瞑乃晦，其視乃明。',
    baseHp: 90, baseAtk: 115, baseDef: 70, baseSpd: 65,
    catchRate: 45, color: 0xff4422,
    skills: [
      { learnLevel: 1, skill: { name: '燭火', element: '火', power: 40, accuracy: 100, pp: 30, description: '吐出不滅之火' } },
      { learnLevel: 1, skill: { name: '蛇纏', element: '土', power: 55, accuracy: 95, pp: 25, description: '以巨大蛇身纏繞壓制' } },
      { learnLevel: 10, skill: { name: '烈焰', element: '火', power: 80, accuracy: 100, pp: 15, description: '噴出高溫烈焰' } },
      { learnLevel: 18, skill: { name: '長夜', element: '幻', power: 75, accuracy: 90, pp: 10, description: '閉眼降下永夜削弱敵人', effect: { type: 'statDown', stat: 'spd', stages: 1 } } },
      { learnLevel: 25, skill: { name: '天照', element: '火', power: 110, accuracy: 85, pp: 5, description: '睜眼釋放烈日之光' } },
      { learnLevel: 33, skill: { name: '開天闢地', element: '火', power: 150, accuracy: 80, pp: 5, description: '燃燒一切的終極烈火', effect: { type: 'recoil', percent: 50 } } },
      { learnLevel: 36, skill: { name: '混沌之火', element: '火', power: 140, accuracy: 85, pp: 5, description: '化神境混沌原始之火' } },
      { learnLevel: 40, skill: { name: '日月滅世', element: '火', power: 180, accuracy: 70, pp: 3, description: '日月同滅的終極禁術', effect: { type: 'recoil', percent: 50 } } },
    ],
  },

  // ── 白澤 (光) ─ 沙奈朵型輔助特攻 ──
  {
    id: 'baize', name: '白澤', element: '光',
    description: '通曉天下萬鬼之事，能言語，為祥瑞之獸。',
    baseHp: 90, baseAtk: 60, baseDef: 80, baseSpd: 85,
    catchRate: 45, color: 0xffffcc,
    skills: [
      { learnLevel: 1, skill: { name: '聖光', element: '光', power: 45, accuracy: 100, pp: 30, description: '釋放淨化之光' } },
      { learnLevel: 1, skill: { name: '洞悉', element: '幻', power: 50, accuracy: 100, pp: 20, description: '看破弱點降低防禦', effect: { type: 'statDown', stat: 'def', stages: 1 } } },
      { learnLevel: 8, skill: { name: '瑞氣', element: '光', power: 0, accuracy: 100, pp: 10, description: '散發祥瑞之氣恢復50%體力', effect: { type: 'heal', percent: 50 } } },
      { learnLevel: 15, skill: { name: '萬鬼圖', element: '光', power: 80, accuracy: 95, pp: 15, description: '展開萬鬼圖錄封印敵人' } },
      { learnLevel: 22, skill: { name: '祥瑞結界', element: '光', power: 0, accuracy: 100, pp: 5, description: '張開結界大幅提升防禦', effect: { type: 'statUp', stat: 'def', stages: 2 } } },
      { learnLevel: 30, skill: { name: '天罰', element: '光', power: 110, accuracy: 85, pp: 5, description: '降下天罰審判一切' } },
      { learnLevel: 36, skill: { name: '萬物通曉', element: '光', power: 0, accuracy: 100, pp: 3, description: '化神境通曉一切恢復75%', effect: { type: 'heal', percent: 75 } } },
      { learnLevel: 40, skill: { name: '聖獸審判', element: '光', power: 140, accuracy: 85, pp: 3, description: '渡劫境聖光審判萬物' } },
    ],
  },

  // ── 九尾狐 (幻) ─ 耿鬼型高速干擾 ──
  {
    id: 'jiuwei', name: '九尾狐', element: '幻',
    description: '青丘之山有獸焉，其狀如狐而九尾。',
    baseHp: 70, baseAtk: 85, baseDef: 55, baseSpd: 115,
    catchRate: 80, color: 0xffaa66,
    skills: [
      { learnLevel: 1, skill: { name: '狐火', element: '火', power: 40, accuracy: 100, pp: 30, description: '放出蠱惑的鬼火' } },
      { learnLevel: 1, skill: { name: '幻術', element: '幻', power: 50, accuracy: 95, pp: 25, description: '施展迷幻之術擾亂心智' } },
      { learnLevel: 8, skill: { name: '魅惑', element: '幻', power: 0, accuracy: 90, pp: 15, description: '魅惑敵人大幅降低攻擊', effect: { type: 'statDown', stat: 'atk', stages: 2 } } },
      { learnLevel: 15, skill: { name: '九尾鞭', element: '幻', power: 80, accuracy: 95, pp: 15, description: '九尾齊發猛擊敵人' } },
      { learnLevel: 22, skill: { name: '狐影分身', element: '幻', power: 0, accuracy: 100, pp: 10, description: '分身幻影大幅提升速度', effect: { type: 'statUp', stat: 'spd', stages: 2 } } },
      { learnLevel: 30, skill: { name: '妖狐亂舞', element: '幻', power: 100, accuracy: 90, pp: 5, description: '妖力全開的致命亂舞', effect: { type: 'drain', percent: 50 } } },
      { learnLevel: 36, skill: { name: '天狐化仙', element: '幻', power: 130, accuracy: 90, pp: 5, description: '化神境天狐仙術', effect: { type: 'drain', percent: 33 } } },
      { learnLevel: 40, skill: { name: '九尾天舞', element: '幻', power: 150, accuracy: 85, pp: 3, description: '渡劫境九尾究極妖術' } },
    ],
  },

  // ── 饕餮 (土) ─ 卡比獸型超級坦克 ──
  {
    id: 'taotie', name: '饕餮', element: '土',
    description: '羊身人面，其目在腋下，虎齒人爪。貪食無厭。',
    baseHp: 130, baseAtk: 85, baseDef: 90, baseSpd: 25,
    catchRate: 50, color: 0x886633,
    skills: [
      { learnLevel: 1, skill: { name: '巨爪', element: '毒', power: 45, accuracy: 100, pp: 30, description: '揮動帶毒巨爪' } },
      { learnLevel: 1, skill: { name: '貪噬', element: '土', power: 60, accuracy: 95, pp: 25, description: '貪婪地撕咬敵人' } },
      { learnLevel: 10, skill: { name: '地裂', element: '土', power: 85, accuracy: 90, pp: 15, description: '撕裂大地猛擊' } },
      { learnLevel: 18, skill: { name: '鐵胃', element: '土', power: 0, accuracy: 100, pp: 10, description: '消化吸收恢復50%體力', effect: { type: 'heal', percent: 50 } } },
      { learnLevel: 25, skill: { name: '貪食吸收', element: '土', power: 80, accuracy: 100, pp: 10, description: '吞食敵人吸取生命力', effect: { type: 'drain', percent: 50 } } },
      { learnLevel: 32, skill: { name: '暴食亂擊', element: '土', power: 120, accuracy: 85, pp: 5, description: '狂暴吞噬一切的重擊' } },
      { learnLevel: 36, skill: { name: '萬物皆食', element: '土', power: 130, accuracy: 90, pp: 5, description: '化神境吞噬萬物之力', effect: { type: 'drain', percent: 50 } } },
      { learnLevel: 40, skill: { name: '混沌吞噬', element: '土', power: 160, accuracy: 80, pp: 3, description: '渡劫境混沌吞天滅地', effect: { type: 'recoil', percent: 33 } } },
    ],
  },

  // ── 畢方 (火) ─ 火焰雞型高速砲台 ──
  {
    id: 'bifang', name: '畢方', element: '火',
    description: '其狀如鶴，一足，赤文青質而白喙，見則有火災。',
    baseHp: 65, baseAtk: 100, baseDef: 50, baseSpd: 105,
    catchRate: 100, color: 0xff6633,
    skills: [
      { learnLevel: 1, skill: { name: '火羽', element: '火', power: 40, accuracy: 100, pp: 30, description: '射出燃燒的羽毛' } },
      { learnLevel: 1, skill: { name: '獨足踏', element: '土', power: 50, accuracy: 95, pp: 25, description: '以獨足猛力踏擊' } },
      { learnLevel: 8, skill: { name: '烈焰衝擊', element: '火', power: 75, accuracy: 100, pp: 15, description: '全身燃燒衝向敵人' } },
      { learnLevel: 15, skill: { name: '災火', element: '火', power: 90, accuracy: 90, pp: 10, description: '引發災級烈焰' } },
      { learnLevel: 22, skill: { name: '疾風步', element: '風', power: 0, accuracy: 100, pp: 10, description: '極速移動大幅提升速度', effect: { type: 'statUp', stat: 'spd', stages: 2 } } },
      { learnLevel: 30, skill: { name: '焚天', element: '火', power: 130, accuracy: 85, pp: 5, description: '將天空燃燒殆盡', effect: { type: 'recoil', percent: 33 } } },
      { learnLevel: 36, skill: { name: '鳳凰涅槃', element: '火', power: 140, accuracy: 85, pp: 5, description: '化神境浴火重生之焰' } },
      { learnLevel: 40, skill: { name: '焚世之翼', element: '火', power: 160, accuracy: 80, pp: 3, description: '渡劫境焚燒世界之翼', effect: { type: 'recoil', percent: 40 } } },
    ],
  },

  // ── 玄武 (水) ─ 水箭龜型終極城牆 ──
  {
    id: 'xuanwu', name: '玄武', element: '水',
    description: '龜蛇合體，北方之神，鎮守四方之一。',
    baseHp: 130, baseAtk: 55, baseDef: 115, baseSpd: 30,
    catchRate: 30, color: 0x224466,
    skills: [
      { learnLevel: 1, skill: { name: '玄冰', element: '水', power: 45, accuracy: 100, pp: 30, description: '釋放極寒冰晶' } },
      { learnLevel: 1, skill: { name: '蛇咬', element: '毒', power: 55, accuracy: 95, pp: 25, description: '蛇首猛咬注入毒液' } },
      { learnLevel: 10, skill: { name: '龜甲', element: '水', power: 0, accuracy: 100, pp: 10, description: '縮入龜甲大幅提升防禦', effect: { type: 'statUp', stat: 'def', stages: 2 } } },
      { learnLevel: 18, skill: { name: '寒冰之壁', element: '水', power: 80, accuracy: 95, pp: 15, description: '築起冰牆砸向敵人' } },
      { learnLevel: 25, skill: { name: '毒液注入', element: '毒', power: 70, accuracy: 100, pp: 15, description: '注入腐蝕毒液削弱攻擊', effect: { type: 'statDown', stat: 'atk', stages: 1 } } },
      { learnLevel: 32, skill: { name: '北方鎮守', element: '水', power: 110, accuracy: 85, pp: 5, description: '召喚北方之力重擊' } },
      { learnLevel: 36, skill: { name: '玄天護甲', element: '水', power: 0, accuracy: 100, pp: 3, description: '化神境龜甲極限防禦', effect: { type: 'statUp', stat: 'def', stages: 3 } } },
      { learnLevel: 40, skill: { name: '四象鎮壓', element: '水', power: 140, accuracy: 85, pp: 3, description: '渡劫境四象之力鎮壓萬物' } },
    ],
  },

  // ── 蠱雕 (風) ─ 叉字蝠型極速毒風 ──
  {
    id: 'gudiao', name: '蠱雕', element: '風',
    description: '鷹身而人面，蠍尾，其音如嬰兒。',
    baseHp: 65, baseAtk: 80, baseDef: 55, baseSpd: 120,
    catchRate: 110, color: 0x99aacc,
    skills: [
      { learnLevel: 1, skill: { name: '鷹擊', element: '風', power: 45, accuracy: 100, pp: 30, description: '俯衝啄擊' } },
      { learnLevel: 1, skill: { name: '嬰啼', element: '幻', power: 0, accuracy: 95, pp: 20, description: '嬰兒般哭聲降低攻擊', effect: { type: 'statDown', stat: 'atk', stages: 1 } } },
      { learnLevel: 8, skill: { name: '蠍尾針', element: '毒', power: 65, accuracy: 100, pp: 20, description: '以蠍尾注入劇毒' } },
      { learnLevel: 15, skill: { name: '疾風斬', element: '風', power: 80, accuracy: 95, pp: 15, description: '化為疾風切割一切' } },
      { learnLevel: 22, skill: { name: '劇毒飛針', element: '毒', power: 85, accuracy: 90, pp: 10, description: '射出劇毒飛針削弱速度', effect: { type: 'statDown', stat: 'spd', stages: 1 } } },
      { learnLevel: 30, skill: { name: '俯衝獵殺', element: '風', power: 110, accuracy: 90, pp: 5, description: '從高空全力俯衝', effect: { type: 'recoil', percent: 25 } } },
      { learnLevel: 36, skill: { name: '魔音穿腦', element: '幻', power: 110, accuracy: 90, pp: 5, description: '化神境魔音大幅削弱', effect: { type: 'statDown', stat: 'atk', stages: 2 } } },
      { learnLevel: 40, skill: { name: '天魔亂舞', element: '風', power: 140, accuracy: 85, pp: 3, description: '渡劫境天魔之舞', effect: { type: 'recoil', percent: 25 } } },
    ],
  },

  // ── 相柳 (毒) ─ 尼多王型毒系暴力 ──
  {
    id: 'xiangliu', name: '相柳', element: '毒',
    description: '九首蛇身，食於九土，其所歍所尼，即為源澤。',
    baseHp: 95, baseAtk: 110, baseDef: 65, baseSpd: 55,
    catchRate: 35, color: 0x66aa44,
    skills: [
      { learnLevel: 1, skill: { name: '腐蝕', element: '毒', power: 45, accuracy: 100, pp: 30, description: '噴出腐蝕性毒液' } },
      { learnLevel: 1, skill: { name: '沼澤', element: '水', power: 55, accuracy: 95, pp: 25, description: '將地面化為毒沼' } },
      { learnLevel: 10, skill: { name: '九首噬', element: '毒', power: 80, accuracy: 90, pp: 15, description: '九個蛇首同時撲咬' } },
      { learnLevel: 18, skill: { name: '毒沼地獄', element: '毒', power: 75, accuracy: 100, pp: 15, description: '毒沼纏身削弱速度', effect: { type: 'statDown', stat: 'spd', stages: 1 } } },
      { learnLevel: 25, skill: { name: '九頭蛇擊', element: '毒', power: 100, accuracy: 85, pp: 10, description: '九首齊攻的猛毒連擊' } },
      { learnLevel: 33, skill: { name: '毒霧', element: '毒', power: 120, accuracy: 80, pp: 5, description: '覆蓋一切的劇毒之霧' } },
      { learnLevel: 36, skill: { name: '九毒歸元', element: '毒', power: 140, accuracy: 85, pp: 5, description: '化神境九種劇毒合一' } },
      { learnLevel: 40, skill: { name: '滅世毒霧', element: '毒', power: 160, accuracy: 80, pp: 3, description: '渡劫境滅世劇毒之霧', effect: { type: 'statDown', stat: 'def', stages: 2 } } },
    ],
  },
];

// ═══════════════════════════════════════
//  建立與升級
// ═══════════════════════════════════════

function getSkillsForLevel(template: MonsterTemplate, level: number): { skill: Skill; currentPp: number }[] {
  const learned = template.skills
    .filter(ts => ts.learnLevel <= level)
    .sort((a, b) => b.learnLevel - a.learnLevel)
    .slice(0, 4);
  learned.sort((a, b) => a.learnLevel - b.learnLevel);
  return learned.map(ts => ({ skill: ts.skill, currentPp: ts.skill.pp }));
}

export function calcStats(baseHp: number, baseAtk: number, baseDef: number, baseSpd: number, level: number) {
  const lvlMul = 1 + (level - 1) * 0.06; // 調慢成長曲線適配42級
  return {
    maxHp: Math.floor(baseHp * lvlMul),
    atk: Math.floor(baseAtk * lvlMul),
    def: Math.floor(baseDef * lvlMul),
    spd: Math.floor(baseSpd * lvlMul),
  };
}

export function createMonsterInstance(templateId: string, level: number): MonsterInstance {
  const template = MONSTERS.find(m => m.id === templateId);
  if (!template) throw new Error(`Unknown monster: ${templateId}`);

  const stats = calcStats(template.baseHp, template.baseAtk, template.baseDef, template.baseSpd, level);

  return {
    templateId,
    nickname: template.name,
    level,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    exp: 0,
    skills: getSkillsForLevel(template, level),
    atkStage: 0, defStage: 0, spdStage: 0,
  };
}

export function checkNewSkills(monster: MonsterInstance): string[] {
  const template = MONSTERS.find(m => m.id === monster.templateId);
  if (!template) return [];

  const newSkills: string[] = [];
  const currentNames = new Set(monster.skills.map(s => s.skill.name));

  for (const ts of template.skills) {
    if (ts.learnLevel === monster.level && !currentNames.has(ts.skill.name)) {
      if (monster.skills.length < 4) {
        monster.skills.push({ skill: ts.skill, currentPp: ts.skill.pp });
      } else {
        let weakestIdx = -1;
        let weakestPower = Infinity;
        for (let i = 0; i < monster.skills.length; i++) {
          const s = monster.skills[i];
          if (s.skill.power > 0 && s.skill.power < weakestPower) {
            weakestPower = s.skill.power;
            weakestIdx = i;
          }
        }
        if (weakestIdx >= 0 && ts.skill.power > weakestPower) {
          monster.skills[weakestIdx] = { skill: ts.skill, currentPp: ts.skill.pp };
        }
      }
      newSkills.push(ts.skill.name);
    }
  }
  return newSkills;
}

/** 取得靈獸的基礎素質 (考慮融合) */
export function getBaseStats(monster: MonsterInstance): { hp: number; atk: number; def: number; spd: number } {
  if (monster.fusionBaseStats) return monster.fusionBaseStats;
  const template = MONSTERS.find(m => m.id === monster.templateId);
  if (!template) return { hp: 80, atk: 80, def: 80, spd: 80 };
  return { hp: template.baseHp, atk: template.baseAtk, def: template.baseDef, spd: template.baseSpd };
}

/** 重新計算素質 (升級/融合用) */
export function recalcStats(monster: MonsterInstance): void {
  const base = getBaseStats(monster);
  const stats = calcStats(base.hp, base.atk, base.def, base.spd, monster.level);
  const hpDiff = stats.maxHp - monster.maxHp;
  monster.maxHp = stats.maxHp;
  monster.hp = Math.min(monster.maxHp, monster.hp + Math.max(0, hpDiff));
  monster.atk = stats.atk;
  monster.def = stats.def;
  monster.spd = stats.spd;
}

// ═══════════════════════════════════════
//  練妖壺融合系統
// ═══════════════════════════════════════

export function fuseMonsters(a: MonsterInstance, b: MonsterInstance): MonsterInstance {
  // 隨機選一個外觀
  const baseId = Math.random() < 0.5 ? a.templateId : b.templateId;
  const template = getTemplate(baseId);

  // 等級取平均
  const level = Math.floor((a.level + b.level) / 2);

  // 素質在 A 和 B 之間隨機
  const aBase = getBaseStats(a);
  const bBase = getBaseStats(b);
  const rand = (x: number, y: number) => Math.floor(Math.min(x, y) + Math.random() * (Math.abs(x - y) + 1));

  const fusionBaseStats = {
    hp: rand(aBase.hp, bBase.hp),
    atk: rand(aBase.atk, bBase.atk),
    def: rand(aBase.def, bBase.def),
    spd: rand(aBase.spd, bBase.spd),
  };

  // 技能池：A 的 4 招 + B 的 4 招 = 8 招，隨機抽 4 招
  const allSkills = [...a.skills, ...b.skills];
  // 去重
  const unique = new Map<string, { skill: Skill; currentPp: number }>();
  for (const s of allSkills) unique.set(s.skill.name, s);
  const pool = Array.from(unique.values()).sort(() => Math.random() - 0.5);
  const picked = pool.slice(0, 4).map(s => ({ skill: s.skill, currentPp: s.skill.pp }));

  // 異色：10% 機率
  const isShiny = Math.random() < 0.1;

  const stats = calcStats(fusionBaseStats.hp, fusionBaseStats.atk, fusionBaseStats.def, fusionBaseStats.spd, level);

  return {
    templateId: baseId,
    nickname: isShiny ? `異・${template.name}` : `融・${template.name}`,
    level,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    exp: 0,
    skills: picked,
    atkStage: 0, defStage: 0, spdStage: 0,
    isFused: true,
    isShiny,
    fusionBaseStats,
  };
}

export function getTemplate(id: string): MonsterTemplate {
  const t = MONSTERS.find(m => m.id === id);
  if (!t) throw new Error(`Unknown monster: ${id}`);
  return t;
}

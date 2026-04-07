export type Element = '風' | '水' | '火' | '光' | '幻' | '土' | '毒';

export interface Skill {
  name: string;
  element: Element;
  power: number;
  accuracy: number;
  pp: number;
  description: string;
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
  catchRate: number; // 0-255, higher = easier
  skills: Skill[];
  color: number; // placeholder sprite color
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

export const MONSTERS: MonsterTemplate[] = [
  {
    id: 'qiongqi',
    name: '窮奇',
    element: '風',
    description: '形如有翼之虎，善飛行，性情兇猛。',
    baseHp: 75,
    baseAtk: 95,
    baseDef: 60,
    baseSpd: 85,
    catchRate: 120,
    color: 0x8888ff,
    skills: [
      { name: '烈風爪', element: '風', power: 60, accuracy: 95, pp: 15, description: '以風刃撕裂敵人' },
      { name: '虎嘯', element: '風', power: 85, accuracy: 85, pp: 10, description: '震耳的虎嘯產生衝擊波' },
      { name: '撲擊', element: '土', power: 40, accuracy: 100, pp: 25, description: '猛撲向敵人' },
      { name: '天翔', element: '風', power: 110, accuracy: 75, pp: 5, description: '飛至高空俯衝而下' },
    ],
  },
  {
    id: 'kun',
    name: '鯤',
    element: '水',
    description: '北冥有魚，其名為鯤，鯤之大，不知其幾千里也。',
    baseHp: 120,
    baseAtk: 65,
    baseDef: 95,
    baseSpd: 40,
    catchRate: 60,
    color: 0x4488cc,
    skills: [
      { name: '吞噬', element: '水', power: 70, accuracy: 90, pp: 15, description: '張開巨口吞噬一切' },
      { name: '深淵之壓', element: '水', power: 100, accuracy: 80, pp: 8, description: '以深海水壓碾壓敵人' },
      { name: '化鵬', element: '風', power: 90, accuracy: 85, pp: 8, description: '化為大鵬展翅攻擊' },
      { name: '潮汐', element: '水', power: 50, accuracy: 100, pp: 20, description: '掀起潮汐沖刷敵人' },
    ],
  },
  {
    id: 'zhulong',
    name: '燭龍',
    element: '火',
    description: '人面蛇身而赤，其瞑乃晦，其視乃明。',
    baseHp: 90,
    baseAtk: 100,
    baseDef: 70,
    baseSpd: 60,
    catchRate: 45,
    color: 0xff4422,
    skills: [
      { name: '燭火', element: '火', power: 65, accuracy: 95, pp: 15, description: '吐出不滅之火' },
      { name: '天照', element: '火', power: 120, accuracy: 70, pp: 5, description: '睜眼釋放烈日之光' },
      { name: '長夜', element: '幻', power: 75, accuracy: 90, pp: 10, description: '閉眼降下永夜' },
      { name: '蛇纏', element: '土', power: 55, accuracy: 95, pp: 15, description: '以巨大蛇身纏繞' },
    ],
  },
  {
    id: 'baize',
    name: '白澤',
    element: '光',
    description: '通曉天下萬鬼之事，能言語，為祥瑞之獸。',
    baseHp: 85,
    baseAtk: 55,
    baseDef: 80,
    baseSpd: 90,
    catchRate: 45,
    color: 0xffffcc,
    skills: [
      { name: '聖光', element: '光', power: 70, accuracy: 95, pp: 15, description: '釋放淨化之光' },
      { name: '萬鬼圖', element: '光', power: 100, accuracy: 80, pp: 8, description: '展開萬鬼圖錄封印敵人' },
      { name: '瑞氣', element: '光', power: 0, accuracy: 100, pp: 10, description: '散發祥瑞之氣恢復體力' },
      { name: '洞悉', element: '幻', power: 60, accuracy: 100, pp: 15, description: '看破敵人弱點' },
    ],
  },
  {
    id: 'jiuwei',
    name: '九尾狐',
    element: '幻',
    description: '青丘之山有獸焉，其狀如狐而九尾。',
    baseHp: 70,
    baseAtk: 80,
    baseDef: 55,
    baseSpd: 110,
    catchRate: 80,
    color: 0xffaa66,
    skills: [
      { name: '狐火', element: '火', power: 60, accuracy: 95, pp: 15, description: '放出蠱惑之火' },
      { name: '幻術', element: '幻', power: 75, accuracy: 90, pp: 12, description: '施展迷幻之術' },
      { name: '九尾鞭', element: '幻', power: 95, accuracy: 85, pp: 8, description: '九尾齊發猛擊' },
      { name: '魅惑', element: '幻', power: 0, accuracy: 85, pp: 10, description: '迷惑敵人使其混亂' },
    ],
  },
  {
    id: 'taotie',
    name: '饕餮',
    element: '土',
    description: '羊身人面，其目在腋下，虎齒人爪。貪食無厭。',
    baseHp: 110,
    baseAtk: 90,
    baseDef: 85,
    baseSpd: 35,
    catchRate: 50,
    color: 0x886633,
    skills: [
      { name: '貪噬', element: '土', power: 80, accuracy: 90, pp: 12, description: '貪婪地吞食一切' },
      { name: '地裂', element: '土', power: 100, accuracy: 80, pp: 8, description: '撕裂大地' },
      { name: '鐵胃', element: '土', power: 0, accuracy: 100, pp: 8, description: '消化吸收恢復體力' },
      { name: '巨爪', element: '毒', power: 65, accuracy: 95, pp: 15, description: '揮動帶毒巨爪' },
    ],
  },
  {
    id: 'bifang',
    name: '畢方',
    element: '火',
    description: '其狀如鶴，一足，赤文青質而白喙，見則有火災。',
    baseHp: 65,
    baseAtk: 90,
    baseDef: 50,
    baseSpd: 100,
    catchRate: 100,
    color: 0xff6633,
    skills: [
      { name: '火羽', element: '火', power: 55, accuracy: 100, pp: 20, description: '射出燃燒的羽毛' },
      { name: '災火', element: '火', power: 90, accuracy: 85, pp: 10, description: '引發火災級的烈焰' },
      { name: '獨足踏', element: '土', power: 50, accuracy: 95, pp: 15, description: '以獨足猛力踏擊' },
      { name: '焚天', element: '火', power: 120, accuracy: 70, pp: 5, description: '將天空燃燒殆盡' },
    ],
  },
  {
    id: 'xuanwu',
    name: '玄武',
    element: '水',
    description: '龜蛇合體，北方之神，鎮守四方之一。',
    baseHp: 130,
    baseAtk: 50,
    baseDef: 110,
    baseSpd: 30,
    catchRate: 30,
    color: 0x224466,
    skills: [
      { name: '玄冰', element: '水', power: 70, accuracy: 95, pp: 15, description: '釋放極寒之冰' },
      { name: '龜甲', element: '水', power: 0, accuracy: 100, pp: 10, description: '縮入龜甲大幅提升防禦' },
      { name: '蛇咬', element: '毒', power: 65, accuracy: 95, pp: 15, description: '蛇首猛咬注入毒液' },
      { name: '北方鎮守', element: '水', power: 110, accuracy: 75, pp: 5, description: '召喚北方之力重擊' },
    ],
  },
  {
    id: 'gudiao',
    name: '蠱雕',
    element: '風',
    description: '鷹身而人面，蠍尾，其音如嬰兒。',
    baseHp: 60,
    baseAtk: 75,
    baseDef: 50,
    baseSpd: 115,
    catchRate: 110,
    color: 0x99aacc,
    skills: [
      { name: '鷹擊', element: '風', power: 60, accuracy: 95, pp: 15, description: '俯衝猛擊' },
      { name: '蠍尾針', element: '毒', power: 70, accuracy: 90, pp: 12, description: '以蠍尾注入劇毒' },
      { name: '嬰啼', element: '幻', power: 55, accuracy: 95, pp: 15, description: '發出嬰兒般的哭聲擾亂敵人' },
      { name: '疾風斬', element: '風', power: 90, accuracy: 85, pp: 10, description: '化為疾風切割一切' },
    ],
  },
  {
    id: 'xiangliu',
    name: '相柳',
    element: '毒',
    description: '九首蛇身，食於九土，其所歍所尼，即為源澤。',
    baseHp: 95,
    baseAtk: 105,
    baseDef: 65,
    baseSpd: 55,
    catchRate: 35,
    color: 0x66aa44,
    skills: [
      { name: '九首噬', element: '毒', power: 90, accuracy: 85, pp: 10, description: '九個蛇首同時撲咬' },
      { name: '腐蝕', element: '毒', power: 65, accuracy: 95, pp: 15, description: '噴出腐蝕性毒液' },
      { name: '沼澤', element: '水', power: 70, accuracy: 90, pp: 12, description: '將地面化為劇毒沼澤' },
      { name: '毒霧', element: '毒', power: 110, accuracy: 75, pp: 5, description: '釋放覆蓋一切的劇毒之霧' },
    ],
  },
];

export function createMonsterInstance(templateId: string, level: number): MonsterInstance {
  const template = MONSTERS.find(m => m.id === templateId);
  if (!template) throw new Error(`Unknown monster: ${templateId}`);

  const lvlMul = 1 + (level - 1) * 0.08;
  const maxHp = Math.floor(template.baseHp * lvlMul);

  return {
    templateId,
    nickname: template.name,
    level,
    hp: maxHp,
    maxHp,
    atk: Math.floor(template.baseAtk * lvlMul),
    def: Math.floor(template.baseDef * lvlMul),
    spd: Math.floor(template.baseSpd * lvlMul),
    exp: 0,
    skills: template.skills.slice(0, 4).map(s => ({ skill: s, currentPp: s.pp })),
  };
}

export function getTemplate(id: string): MonsterTemplate {
  const t = MONSTERS.find(m => m.id === id);
  if (!t) throw new Error(`Unknown monster: ${id}`);
  return t;
}

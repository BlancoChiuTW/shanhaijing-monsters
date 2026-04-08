import {
  generateQingqiu, generateBeiming, generateZhuyin,
  generateKunlun, generateYoudu, findNearestWalkable,
} from '../utils/mapGenerator';

export interface WildEncounter {
  monsterId: string;
  minLevel: number;
  maxLevel: number;
  weight: number;
}

export type NpcType = 'dialogue' | 'healer' | 'trainer' | 'fusion';

export interface MapNpc {
  id: string;
  name: string;
  x: number;
  y: number;
  dialogue: string[];
  npcType: NpcType;
  team?: { monsterId: string; level: number }[];
  spriteColor?: number;
}

export interface MapTreasure {
  id: string;
  x: number;
  y: number;
  type: 'exp' | 'rare_monster' | 'heal';
  amount?: number;         // exp amount
  monsterId?: string;      // rare monster ID
  monsterLevel?: number;   // rare monster level
  label: string;           // display text
}

export interface GameMap {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  bgColor: number;
  encounterRate: number;
  wildEncounters: WildEncounter[];
  npcs: MapNpc[];
  exits: { x: number; y: number; targetMap: string; targetX: number; targetY: number }[];
  treasures: MapTreasure[];
  // 0=grass, 1=wall, 2=tall_grass, 3=water, 4=exit, 5=path, 6=flower
  tiles: number[][];
  playerStart: { x: number; y: number };
}

// 地圖種子（固定，保證每次生成一致）
const MAP_SEED = 42;

// 快取已生成的地圖 tiles
const tileCache = new Map<string, number[][]>();

function getTiles(mapId: string): number[][] {
  if (tileCache.has(mapId)) return tileCache.get(mapId)!;

  let tiles: number[][];
  switch (mapId) {
    case 'qingqiu': tiles = generateQingqiu(MAP_SEED); break;
    case 'beiming': tiles = generateBeiming(MAP_SEED + 1); break;
    case 'zhuyin': tiles = generateZhuyin(MAP_SEED + 2); break;
    case 'kunlun': tiles = generateKunlun(MAP_SEED + 3); break;
    case 'youdu': tiles = generateYoudu(MAP_SEED + 4); break;
    default: throw new Error(`Unknown map for tile generation: ${mapId}`);
  }

  tileCache.set(mapId, tiles);
  return tiles;
}

/** 解析 NPC 座標：在地圖生成後找到最近的可行走格 */
function resolveNpcPositions(npcs: MapNpc[], tiles: number[][], w: number, h: number): void {
  for (const npc of npcs) {
    const pos = findNearestWalkable(tiles, w, h, { x: npc.x, y: npc.y }, true);
    npc.x = pos.x;
    npc.y = pos.y;
  }
}

// ═══════════════════════════════════
//  地圖定義
// ═══════════════════════════════════

interface MapDef {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  bgColor: number;
  encounterRate: number;
  wildEncounters: WildEncounter[];
  npcs: MapNpc[];
  exits: { x: number; y: number; targetMap: string; targetX: number; targetY: number }[];
  treasures: MapTreasure[];
  playerStart: { x: number; y: number };
}

const MAP_DEFS: MapDef[] = [
  // ── 青丘之野 ── 新手村 128×128
  {
    id: 'qingqiu',
    name: '青丘之野',
    description: '靈氣濃度：低階。丘陵連綿，草色慘綠。狐族蟄伏其中，天賦詭異，不可輕估。',
    width: 128, height: 128,
    bgColor: 0x4a8c3f,
    encounterRate: 25,
    wildEncounters: [
      { monsterId: 'jiuwei', minLevel: 3, maxLevel: 6, weight: 40 },
      { monsterId: 'qiongqi', minLevel: 3, maxLevel: 5, weight: 35 },
      { monsterId: 'gudiao', minLevel: 2, maxLevel: 4, weight: 25 },
    ],
    npcs: [
      {
        id: 'elder', name: '村長·青木', x: 60, y: 70,
        npcType: 'dialogue',
        dialogue: [
          '靈獸師。',
          '千年前，人獸契約，靈脈共振——那是舊世界的底層邏輯。',
          '冥界之門開啟後，幽羅冥王的瘴氣滲入靈脈節點，契約頻段被污染。',
          '靈獸失去諧振源，野化率達97.3%。狂暴化，不可避免。',
          '靈脈選中你。原因不明。但選擇已成事實。',
          '高草叢是野化靈獸的刷新帶。進去。',
          '靈符捕獲，建立契約。流程很簡單。',
          '地圖上的靈氣結晶是靈獸的強化節點，不要錯過。',
          '東——北冥深淵。北——燭陰火山。',
          '終點是幽都冥界。擊殺幽羅。還原靈脈。',
        ],
      },
      {
        id: 'scholar', name: '遊方書生', x: 70, y: 95,
        npcType: 'dialogue',
        dialogue: [
          '《山海經》軼事收集者，幸會。',
          '青丘之野——九尾狐的原生棲息地，靈脈木屬性密度最高的區域之一。',
          '「青丘之山，有獸焉，其狀如狐而九尾。」這是記載，也是警告。',
          '九尾狐：木屬性·速度型。機動數值在同階靈獸中頂尖。',
          '窮奇同樣棲息於此。虎形·翼生·食人——但那是野化數值。',
          '「窮奇狀如虎，有翼，食人從首始。」契約後，攻擊偏向可重新校準。',
          '草叢深層偶有蠱雕出沒。出現機率低，但……值得等。',
          '蠱雕：鷹身人面·異相型。速度·詭異性雙屬性加成，罕見。',
          '五行相剋——金→木→土→水→火→金。記住這條鏈。',
          '屬性壓制下，傷害係數×1.5。這不是小數字。',
        ],
      },
      {
        id: 'healer_qingqiu', name: '丹藥師·青雲', x: 55, y: 110,
        npcType: 'healer',
        spriteColor: 0x44ddaa,
        dialogue: [
          '靈獸的靈力值偏低了。',
          '崑崙山源的丹藥。回復效率比普通靈草高兩個檔次。',
          '讓我處理。',
        ],
      },
      {
        id: 'trainer1', name: '修煉者·小明', x: 85, y: 55,
        npcType: 'trainer',
        dialogue: [
          '靈獸師？',
          '我修煉時間不長——但窮奇和蠱雕的成長性，你懂的。',
          '切磋一場。',
        ],
        team: [
          { monsterId: 'qiongqi', level: 5 },
          { monsterId: 'gudiao', level: 4 },
        ],
      },
    ],
    // 出口：東→北冥
    exits: [
      { x: 113, y: 64, targetMap: 'beiming', targetX: 6, targetY: 50 },
    ],
    treasures: [
      { id: 'qq_exp1', x: 40, y: 50, type: 'exp', amount: 80, label: '靈氣結晶' },
      { id: 'qq_exp2', x: 90, y: 80, type: 'exp', amount: 100, label: '靈氣結晶' },
      { id: 'qq_exp3', x: 75, y: 40, type: 'exp', amount: 60, label: '靈氣結晶' },
      { id: 'qq_rare1', x: 100, y: 100, type: 'rare_monster', monsterId: 'jiuwei', monsterLevel: 8, label: '靈力讀數驟升。九尾波動，確認。' },
      { id: 'qq_heal1', x: 50, y: 90, type: 'heal', label: '仙泉' },
    ],
    playerStart: { x: 64, y: 113 },
  },

  // ── 北冥深淵 ── 140×100 群島
  {
    id: 'beiming',
    name: '北冥深淵',
    description: '靈氣濃度：深淵級。海窟幽黑，水壓異常。巨影橫渡，體型逾千丈——非極境者，入則骨消。',
    width: 140, height: 100,
    bgColor: 0x1a3355,
    encounterRate: 30,
    wildEncounters: [
      { monsterId: 'kun', minLevel: 8, maxLevel: 12, weight: 30 },
      { monsterId: 'xuanwu', minLevel: 10, maxLevel: 14, weight: 20 },
      { monsterId: 'xiangliu', minLevel: 7, maxLevel: 10, weight: 50 },
    ],
    npcs: [
      {
        id: 'fisherman', name: '老漁夫·滄海', x: 30, y: 40,
        npcType: 'dialogue',
        dialogue: [
          '年輕人……你竟穿過群島，到了這裡。',
          '此地是北冥。《山海經》有載——鯤之居所。',
          '「北冥有魚，其名為鯤。鯤之大，不知其幾千里也。」',
          '平時沉眠於最深的海溝。靈脈波動，方能喚醒。',
          '還有玄武。龜蛇合體，守北方靈脈。',
          '防禦無雙。境界高出一截，也難撼其分毫。',
          '但最危險的——是相柳。九頭蛇怪。',
          '「相柳之所抵，厥為澤谿。」過處盡成毒沼。',
          '紫色光芒的水域，莫要靠近。那是相柳毒素殘留。',
          '深海中散落著深海靈珠。靈脈凝結之精華。',
          '尋得一枚，靈獸修為可大幅精進。',
        ],
      },
      {
        id: 'navigator', name: '尋路者·涯', x: 70, y: 30,
        npcType: 'dialogue',
        dialogue: [
          '也在找穿島的路？',
          '迷霧不定。島嶼方位隨時偏移。輕易迷失。',
          '沿陸橋走。最穩。',
          '島嶼間偶爾會出現稀有靈獸——',
          '水面起了不尋常的波紋，別猶豫。高階靈獸。',
          '東邊出口，通往崑崙仙境。',
        ],
      },
      {
        id: 'healer_beiming', name: '丹藥師·水月', x: 15, y: 50,
        npcType: 'healer',
        spriteColor: 0x44ddaa,
        dialogue: [
          '深淵戰鬥兇險。相柳毒素尤甚——致命。',
          '北冥解毒靈丹。讓我為你療傷。',
          '探索時，隨時注意靈獸狀態。',
        ],
      },
      {
        id: 'trainer2', name: '馴獸師·阿海', x: 100, y: 55,
        npcType: 'trainer',
        dialogue: [
          '嘿——新來的靈獸師？',
          '北冥靈獸不好對付。水系霸主，個個兇悍。',
          '我在這片海域修煉多年。鯤十二階，相柳十階。',
          '準備好了嗎？讓我看看你的斤兩。',
        ],
        team: [
          { monsterId: 'kun', level: 12 },
          { monsterId: 'xiangliu', level: 10 },
        ],
      },
    ],
    exits: [
      { x: 4, y: 50, targetMap: 'qingqiu', targetX: 112, targetY: 64 },
      { x: 135, y: 50, targetMap: 'zhuyin', targetX: 50, targetY: 152 },
    ],
    treasures: [
      { id: 'bm_exp1', x: 35, y: 25, type: 'exp', amount: 200, label: '深海靈珠' },
      { id: 'bm_exp2', x: 70, y: 60, type: 'exp', amount: 250, label: '深海靈珠' },
      { id: 'bm_exp3', x: 110, y: 35, type: 'exp', amount: 180, label: '深海靈珠' },
      { id: 'bm_rare1', x: 90, y: 75, type: 'rare_monster', monsterId: 'kun', monsterLevel: 15, label: '水壓異變。龐然巨物，正在接近。' },
      { id: 'bm_rare2', x: 50, y: 70, type: 'rare_monster', monsterId: 'xuanwu', monsterLevel: 14, label: '深淵震鳴。威壓外溢——來自下方。' },
      { id: 'bm_heal1', x: 70, y: 45, type: 'heal', label: '海底靈泉' },
    ],
    playerStart: { x: 5, y: 50 },
  },

  // ── 燭陰火山 ── 100×160 垂直山形
  {
    id: 'zhuyin',
    name: '燭陰火山',
    description: '靈氣濃度：中階，火屬性×3。熔岩沸騰，灼氣腐甲。火鳥盤旋高空，羽溫足以熔煉地階靈器。',
    width: 100, height: 160,
    bgColor: 0x8b2500,
    encounterRate: 35,
    wildEncounters: [
      { monsterId: 'zhulong', minLevel: 12, maxLevel: 16, weight: 25 },
      { monsterId: 'bifang', minLevel: 8, maxLevel: 12, weight: 45 },
      { monsterId: 'qiongqi', minLevel: 10, maxLevel: 13, weight: 30 },
    ],
    npcs: [
      {
        id: 'hermit', name: '火山隱士·熔岩翁', x: 50, y: 60,
        npcType: 'dialogue',
        dialogue: [
          '你竟爬到此處。燭陰火山，不是人待的地方。',
          '山腹之下，封著太古神獸——燭龍。',
          '典籍載：「其身長千里，人面蛇身，赤色。」非虛言。',
          '睜眼為晝，閉眼為夜。呼為冬，吸為夏。牠的呼吸，就是天地的律動。',
          '火屬靈獸，燭龍居首。攻擊強度——你若見到，跑不了的。',
          '山中另有一霸。畢方。',
          '「狀如鶴，一足，赤文青質而白喙。」速度，遠超你的想像。',
          '畢方所過之處，必燃烈火。牠不狩獵——牠只是飛過。',
          '沿主脈往上走，幽都冥界的裂口就在山頂。',
          '溫泉。記住溫泉的位置。它在這山裡救過不少人的命。',
          '岩漿中若浮現巨影——立刻離開。別猶豫。',
        ],
      },
      {
        id: 'miner', name: '採石人·鐵錘', x: 40, y: 100,
        npcType: 'dialogue',
        dialogue: [
          '咳——火山灰。嗆死人。',
          '火焰精華。就是為這個來的。頂級修煉材料，別處找不著。',
          '崎嶇小路兩側，就是它們散落的地方。別走大道，走邊角。',
          '你的靈獸若是吃了，修煉經驗暴漲。值得冒險。',
          '岩漿池。掉進去，就沒有然後了。',
          '記住盤山路，那是唯一能走的線。偏一步，死。',
        ],
      },
      {
        id: 'healer_zhuyin', name: '丹藥師·炎華', x: 55, y: 80,
        npcType: 'healer',
        spriteColor: 0x44ddaa,
        dialogue: [
          '灼傷侵入靈脈的速度，比你想的快。',
          '涼血丹、清火靈藥——我備足了。',
          '過來。讓我看看損耗幾成。',
        ],
      },
      {
        id: 'trainer3', name: '炎術士·赤羽', x: 45, y: 40,
        npcType: 'trainer',
        dialogue: [
          '火山修煉。意志與實力，缺一即死。',
          '我的畢方和燭龍，都是從岩漿上一刀一刀煉出來的。',
          '還有那頭饕餮——從崑崙流落至此，嗜殺成性。',
          '你既然到了這裡——就讓我看看你的成色。',
        ],
        team: [
          { monsterId: 'bifang', level: 14 },
          { monsterId: 'zhulong', level: 13 },
          { monsterId: 'taotie', level: 12 },
        ],
      },
    ],
    exits: [
      { x: 50, y: 155, targetMap: 'beiming', targetX: 134, targetY: 50 },
      { x: 50, y: 10, targetMap: 'kunlun', targetX: 65, targetY: 120 },
    ],
    treasures: [
      { id: 'zy_exp1', x: 60, y: 100, type: 'exp', amount: 350, label: '火焰精華' },
      { id: 'zy_exp2', x: 35, y: 60, type: 'exp', amount: 300, label: '火焰精華' },
      { id: 'zy_exp3', x: 55, y: 30, type: 'exp', amount: 400, label: '火焰精華' },
      { id: 'zy_rare1', x: 40, y: 25, type: 'rare_monster', monsterId: 'zhulong', monsterLevel: 18, label: '岩漿異動。龍影浮現。撤，或戰。' },
      { id: 'zy_heal1', x: 50, y: 120, type: 'heal', label: '火山溫泉' },
      { id: 'zy_heal2', x: 45, y: 50, type: 'heal', label: '火山溫泉' },
    ],
    playerStart: { x: 50, y: 152 },
  },

  // ── 崑崙仙境 ── 130×130 菱形
  {
    id: 'kunlun',
    name: '崑崙仙境',
    description: '靈氣濃度：天階封頂。雲層之上，瑞氣壓境。仙山禁制古老，觸碰即觸發——五百年前，有人在此隕落。',
    width: 130, height: 130,
    bgColor: 0xaabbdd,
    encounterRate: 20,
    wildEncounters: [
      { monsterId: 'baize', minLevel: 15, maxLevel: 20, weight: 25 },
      { monsterId: 'gudiao', minLevel: 12, maxLevel: 16, weight: 40 },
      { monsterId: 'jiuwei', minLevel: 14, maxLevel: 18, weight: 35 },
    ],
    npcs: [
      {
        id: 'immortal', name: '崑崙仙人·雲遊子', x: 65, y: 50,
        npcType: 'dialogue',
        dialogue: [
          '能走到這裡——已不容易。',
          '崑崙靈脈密度：天地之最。',
          '千年前，白澤鎮守此地靈脈核心。',
          '古籍載：「白澤能言，知萬物之情。」——萬獸名諱、致命弱點，無所不曉。',
          '獲其認可，靈獸奧秘盡覽。',
          '山上靈花，每株蘊靈力。',
          '仙靈玉露藏於花叢——修煉珍材，莫要錯過。',
          '北道通幽都冥界。幽羅冥王之域。',
          '未準備好的人進去——',
          '太乙真人在山頂。練妖壺之術，可強化靈獸根骨。',
        ],
      },
      {
        id: 'historian', name: '修史者·典籍', x: 50, y: 70,
        npcType: 'dialogue',
        dialogue: [
          '五行相剋——你以為是元素對抗？',
          '錯。是天地最基本的平衡律。',
          '金克木。利刃斬木，無需解釋。木克土——根系穿岩，可碎大地。',
          '土克水：堤壩成，洪流止。水克火：一場雨，烈焰熄。',
          '火克金：熔點到，鐵石皆液。循環無終。',
          '修仙境界亦如此——',
          '練氣。築基。金丹。化神。元嬰。渡劫。',
          '每突一大境界——質變，非量變。',
          '高壓低，有加成。越階勝，經驗暴增。',
          '所以有人專挑強敵打。以弱勝強，這條路，走得通。',
        ],
      },
      {
        id: 'healer_kunlun', name: '仙醫·玉華', x: 55, y: 105,
        npcType: 'healer',
        spriteColor: 0x44ddaa,
        dialogue: [
          '崑崙仙藥，天地靈氣凝結，非人工可比。',
          '體力恢復之外，靈魂損耗亦可修復。',
          '你和你的靈獸——都需要調整狀態。',
        ],
      },
      {
        id: 'fusion_master', name: '煉妖師·太乙', x: 75, y: 50,
        npcType: 'fusion',
        spriteColor: 0xff8844,
        dialogue: [
          '千年。練妖壺，吾只研這一術。',
          '原理：兩隻靈獸靈魂，強行融合為一。',
          '主體獲素材靈獸基礎屬性加成——20%。',
          '素材靈獸。消耗。不可逆。',
          '但有20%機率觸發異色個體。',
          '異色：全屬性額外+10%。珍。',
          '選好靈獸，動手。',
        ],
      },
      {
        id: 'trainer4', name: '仙門弟子·玉霜', x: 65, y: 35,
        npcType: 'trainer',
        dialogue: [
          '崑崙弟子，自幼浸靈脈修煉。',
          '白澤——智謀。算路最遠。',
          '九尾狐——敏捷。快到你看不清。',
          '蠱雕，速度極值。',
          '勝了我，幽都冥界的門，自己推開。',
        ],
        team: [
          { monsterId: 'baize', level: 18 },
          { monsterId: 'jiuwei', level: 17 },
          { monsterId: 'gudiao', level: 16 },
        ],
      },
    ],
    exits: [
      { x: 65, y: 122, targetMap: 'zhuyin', targetX: 50, targetY: 12 },
      { x: 65, y: 15, targetMap: 'youdu', targetX: 75, targetY: 145 },
    ],
    treasures: [
      { id: 'kl_exp1', x: 45, y: 60, type: 'exp', amount: 500, label: '仙靈玉露' },
      { id: 'kl_exp2', x: 85, y: 45, type: 'exp', amount: 450, label: '仙靈玉露' },
      { id: 'kl_exp3', x: 60, y: 80, type: 'exp', amount: 550, label: '仙靈玉露' },
      { id: 'kl_rare1', x: 80, y: 70, type: 'rare_monster', monsterId: 'baize', monsterLevel: 22, label: '靈識波動。已被感知——它在等。' },
      { id: 'kl_heal1', x: 70, y: 90, type: 'heal', label: '瑤池仙泉' },
    ],
    playerStart: { x: 65, y: 120 },
  },

  // ── 幽都冥界 ── 150×150 迷宮型
  {
    id: 'youdu',
    name: '幽都冥界',
    description: '靈氣濃度：異質，瘴氣覆蓋。黑沼無聲，瘴毒侵神識。最強靈獸盤踞深處，實力不明。',
    width: 150, height: 150,
    bgColor: 0x2a1a33,
    encounterRate: 40,
    wildEncounters: [
      { monsterId: 'taotie', minLevel: 18, maxLevel: 24, weight: 30 },
      { monsterId: 'xiangliu', minLevel: 20, maxLevel: 25, weight: 25 },
      { monsterId: 'zhulong', minLevel: 18, maxLevel: 22, weight: 20 },
      { monsterId: 'xuanwu', minLevel: 20, maxLevel: 25, weight: 25 },
    ],
    npcs: [
      {
        id: 'guardian', name: '冥界守門人·無常', x: 75, y: 120,
        npcType: 'dialogue',
        dialogue: [
          '……你來了。',
          '生死交界。萬靈終歸之地。',
          '千年前，幽羅開冥界之門。',
          '目標只有一個——吞噬人間全部靈脈，歸天地於混沌。',
          '他麾下四頭太古靈獸：相柳、饕餮、燭龍、玄武。',
          '盡數染冥氣。質變。實力遠超同階。',
          '相柳九首——同時釋放九路異系法術，無解。',
          '饕餮吞噬之力——削弱一切攻擊手段，無下限。',
          '燭龍一眼——直灼靈魂本源，繞過肉體防禦。',
          '玄武龜殼——物理法術雙抗，尚無人擊穿過。',
          '十靈獸。靈脈共鳴重建。唯一解法。',
          '我在此等候。凱旋，或永不歸。',
        ],
      },
      {
        id: 'lost_soul', name: '迷途亡魂', x: 90, y: 90,
        npcType: 'dialogue',
        spriteColor: 0x8866aa,
        dialogue: [
          '……看得見我？',
          '靈獸師。和你一樣。',
          '我來過這裡。',
          '太急。靈獸一隻隻倒下……最後……',
          '就這樣了。',
          '記住一件事——',
          '境界不足，別進去。冥界壓制加算，等級差一階，戰力折半。',
          '迷宮散落冥界靈魄。優先吸收。快速堆修為。',
          '深處有野生強獸。危險，也是機遇。',
          '……別走我的路。',
        ],
      },
      {
        id: 'healer_youdu', name: '冥醫·幽蘭', x: 65, y: 130,
        npcType: 'healer',
        spriteColor: 0x44ddaa,
        dialogue: [
          '冥界瘴氣持續侵蝕。靈獸生命力每刻都在流失。',
          '藥方摻入崑崙聖水。抵禦冥氣，效果六個時辰。',
          '坐下。前方還長。傷不能帶進去。',
        ],
      },
      {
        id: 'boss', name: '冥王·幽羅', x: 75, y: 12,
        npcType: 'trainer',
        dialogue: [
          '哈哈哈——',
          '千年。又來一個。',
          '那些攔路的人，靈魂都還在替我工作。',
          '幾隻靈獸就想翻盤？',
          '幽都之主。掌生掌死。',
          '來。',
        ],
        team: [
          { monsterId: 'xiangliu', level: 31 },
          { monsterId: 'taotie', level: 32 },
          { monsterId: 'bifang', level: 32 },
          { monsterId: 'jiuwei', level: 33 },
          { monsterId: 'zhulong', level: 33 },
          { monsterId: 'xuanwu', level: 34 },
        ],
      },
    ],
    exits: [
      { x: 75, y: 147, targetMap: 'kunlun', targetX: 65, targetY: 17 },
    ],
    treasures: [
      { id: 'yd_exp1', x: 60, y: 100, type: 'exp', amount: 800, label: '冥界靈魄' },
      { id: 'yd_exp2', x: 90, y: 60, type: 'exp', amount: 700, label: '冥界靈魄' },
      { id: 'yd_exp3', x: 50, y: 40, type: 'exp', amount: 900, label: '冥界靈魄' },
      { id: 'yd_exp4', x: 100, y: 120, type: 'exp', amount: 750, label: '冥界靈魄' },
      { id: 'yd_rare1', x: 80, y: 30, type: 'rare_monster', monsterId: 'xiangliu', monsterLevel: 27, label: '九首齊動。毒意瀰漫，退無可退。' },
      { id: 'yd_rare2', x: 110, y: 80, type: 'rare_monster', monsterId: 'xuanwu', monsterLevel: 26, label: '龜蛇合鳴。威壓覆頂——轟。' },
      { id: 'yd_heal1', x: 75, y: 100, type: 'heal', label: '冥界靈泉' },
      { id: 'yd_heal2', x: 60, y: 50, type: 'heal', label: '冥界靈泉' },
    ],
    playerStart: { x: 75, y: 145 },
  },
];

// ═══════════════════════════════════
//  快取已組裝的完整 GameMap
// ═══════════════════════════════════
const mapCache = new Map<string, GameMap>();

export function getMap(id: string): GameMap {
  if (mapCache.has(id)) return mapCache.get(id)!;

  const def = MAP_DEFS.find(m => m.id === id);
  if (!def) throw new Error(`Unknown map: ${id}`);

  const tiles = getTiles(id);

  // 深拷貝 NPC / Treasure 以免修改定義
  const npcs: MapNpc[] = def.npcs.map(n => ({ ...n }));
  resolveNpcPositions(npcs, tiles, def.width, def.height);

  const treasures: MapTreasure[] = def.treasures.map(t => {
    const pos = findNearestWalkable(tiles, def.width, def.height, { x: t.x, y: t.y }, false);
    return { ...t, x: pos.x, y: pos.y };
  });

  // 確保出口格正確
  for (const exit of def.exits) {
    const pos = findNearestWalkable(tiles, def.width, def.height, { x: exit.x, y: exit.y }, false);
    exit.x = pos.x;
    exit.y = pos.y;
    tiles[pos.y][pos.x] = 4;
  }

  // 確保 playerStart 可行走
  const startPos = findNearestWalkable(tiles, def.width, def.height, def.playerStart, false);

  const gameMap: GameMap = {
    id: def.id,
    name: def.name,
    description: def.description,
    width: def.width,
    height: def.height,
    bgColor: def.bgColor,
    encounterRate: def.encounterRate,
    wildEncounters: def.wildEncounters,
    npcs,
    exits: def.exits,
    treasures,
    tiles,
    playerStart: startPos,
  };

  mapCache.set(id, gameMap);
  return gameMap;
}

/** 取得所有地圖 ID（用於驗證） */
export function getAllMapIds(): string[] {
  return MAP_DEFS.map(m => m.id);
}

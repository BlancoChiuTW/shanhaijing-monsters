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
    description: '翠綠的丘陵草原，微風吹拂，偶見狐影。',
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
          '年輕的靈獸師啊，歡迎來到青丘之野。',
          '千年前，人與靈獸和諧共生，互為契約之伴。',
          '但自從冥界之門開啟，幽羅冥王的瘴氣擾亂了靈脈...',
          '靈獸們失去了與人類的連結，變得狂暴不安。',
          '你是最後被靈脈選中的靈獸師，能重新喚醒牠們。',
          '先從這片草原開始吧——走進高草叢便能遇到野生靈獸。',
          '用靈符捕獲牠們，建立你們之間的契約！',
          '地圖上發光的靈氣結晶可以為你的靈獸提供力量。',
          '東邊通往北冥深淵，北邊可以到達燭陰火山。',
          '一路向前，最終在幽都冥界擊敗幽羅，恢復天地靈脈！',
        ],
      },
      {
        id: 'scholar', name: '遊方書生', x: 70, y: 95,
        npcType: 'dialogue',
        dialogue: [
          '你好，我是一個收集《山海經》軼事的書生。',
          '這片青丘之野，正是傳說中九尾狐的故鄉。',
          '「青丘之山，有獸焉，其狀如狐而九尾。」',
          '九尾狐性靈敏捷，擅長木屬性法術，速度極快。',
          '另外，窮奇也棲息於此——牠外形如虎而有翼。',
          '「窮奇狀如虎，有翼，食人從首始。」但別擔心，契約後的窮奇很溫順。',
          '我還聽說草叢深處偶爾能見到蠱雕的身影......',
          '蠱雕是一種鷹身人面的靈獸，極速而詭異。',
          '啊對了，五行相剋你了解嗎？金→木→土→水→火→金。',
          '善用屬性相剋，戰鬥會輕鬆許多！',
        ],
      },
      {
        id: 'healer_qingqiu', name: '丹藥師·青雲', x: 55, y: 110,
        npcType: 'healer',
        spriteColor: 0x44ddaa,
        dialogue: [
          '你的靈獸看起來有些疲憊了...',
          '我從崑崙山帶回了珍貴的靈丹妙藥。',
          '讓我用丹藥為你和你的靈獸恢復元氣！',
        ],
      },
      {
        id: 'trainer1', name: '修煉者·小明', x: 85, y: 55,
        npcType: 'trainer',
        dialogue: [
          '哦？你也是靈獸師？',
          '我剛開始修煉不久，但我的窮奇和蠱雕已經很強了！',
          '來，讓我們切磋一下，看看誰的靈獸更厲害！',
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
      { id: 'qq_rare1', x: 100, y: 100, type: 'rare_monster', monsterId: 'jiuwei', monsterLevel: 8, label: '異常強大的靈氣！' },
      { id: 'qq_heal1', x: 50, y: 90, type: 'heal', label: '仙泉' },
    ],
    playerStart: { x: 64, y: 113 },
  },

  // ── 北冥深淵 ── 140×100 群島
  {
    id: 'beiming',
    name: '北冥深淵',
    description: '幽暗的深海洞窟，水聲迴盪，巨影潛行。',
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
          '年輕人，你竟然渡過了群島來到這裡...',
          '這片北冥水域，是《山海經》中記載的鯤的居所。',
          '「北冥有魚，其名為鯤。鯤之大，不知其幾千里也。」',
          '鯤平時沉睡在最深的海溝裡，只有靈脈波動才能喚醒牠。',
          '還有玄武，龜蛇合體的神獸，守護著北方的靈脈。',
          '牠的防禦力天下無雙，就算境界高出一大截也難以撼動。',
          '不過最危險的是相柳——九頭蛇怪。',
          '「相柳之所抵，厥為澤谿。」牠經過的地方都會變成毒沼。',
          '小心那些散發著紫色光芒的水域，那是相柳留下的毒素。',
          '對了，深海中散落著一些深海靈珠，是靈脈凝結的精華。',
          '找到它們可以大幅提升靈獸的修為！',
        ],
      },
      {
        id: 'navigator', name: '尋路者·涯', x: 70, y: 30,
        npcType: 'dialogue',
        dialogue: [
          '你也在找穿越群島的路嗎？',
          '這片海域的島嶼時常被迷霧籠罩，很容易迷失方向。',
          '我建議你沿著陸橋前進，那是最安全的路線。',
          '島嶼之間偶爾會出現稀有的靈獸——',
          '如果你看到水面泛起不尋常的波紋，那可能是高階靈獸！',
          '東邊的出口通往崑崙仙境，那是仙人修煉的聖地。',
        ],
      },
      {
        id: 'healer_beiming', name: '丹藥師·水月', x: 15, y: 50,
        npcType: 'healer',
        spriteColor: 0x44ddaa,
        dialogue: [
          '深淵中的戰鬥格外兇險，相柳的毒素更是致命。',
          '讓我用北冥特產的解毒靈丹為你療傷。',
          '記住，探索時要隨時注意靈獸的狀態！',
        ],
      },
      {
        id: 'trainer2', name: '馴獸師·阿海', x: 100, y: 55,
        npcType: 'trainer',
        dialogue: [
          '嘿，你是新來的靈獸師吧？',
          '北冥的靈獸可不好對付——牠們都是水系霸主！',
          '我在這片海域修煉多年，我的鯤和相柳都很強。',
          '準備好了嗎？讓我看看你的實力！',
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
      { id: 'bm_rare1', x: 90, y: 75, type: 'rare_monster', monsterId: 'kun', monsterLevel: 15, label: '水面泛起巨大的波紋！' },
      { id: 'bm_rare2', x: 50, y: 70, type: 'rare_monster', monsterId: 'xuanwu', monsterLevel: 14, label: '深淵中傳來低沉的吼聲...' },
      { id: 'bm_heal1', x: 70, y: 45, type: 'heal', label: '海底靈泉' },
    ],
    playerStart: { x: 5, y: 50 },
  },

  // ── 燭陰火山 ── 100×160 垂直山形
  {
    id: 'zhuyin',
    name: '燭陰火山',
    description: '熔岩翻湧的火山口，空氣灼熱，火鳥盤旋。',
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
          '你居然爬上了燭陰火山...',
          '這座火山之下，沉睡著太古神獸——燭龍。',
          '「燭龍，其身長千里，人面蛇身，赤色。」',
          '牠睜眼為晝，閉眼為夜，呼為冬，吸為夏。',
          '燭龍是火屬性中最強大的靈獸，擁有恐怖的攻擊力。',
          '而畢方，則是火山中另一位霸主。',
          '「有鳥焉，其狀如鶴，一足，赤文青質而白喙。」',
          '畢方出沒之處必有烈火，牠的速度快得驚人。',
          '往山頂走，可以通往幽都冥界的入口。',
          '但請務必小心——火山中的溫泉可以恢復體力。',
          '如果看到岩漿中浮現巨大的影子...那可能是燭龍甦醒了。',
        ],
      },
      {
        id: 'miner', name: '採石人·鐵錘', x: 40, y: 100,
        npcType: 'dialogue',
        dialogue: [
          '咳咳...這火山的灰塵太嗆了。',
          '我是來這裡採集火焰精華的，那可是珍貴的修煉材料。',
          '火焰精華通常散落在火山的崎嶇小路上。',
          '找到它們的話，你的靈獸可以獲得大量的修煉經驗。',
          '不過要小心岩漿池——掉進去可就出不來了。',
          '蜿蜒的盤山路是唯一安全的通道。',
        ],
      },
      {
        id: 'healer_zhuyin', name: '丹藥師·炎華', x: 55, y: 80,
        npcType: 'healer',
        spriteColor: 0x44ddaa,
        dialogue: [
          '火山中的戰鬥格外激烈，靈獸很容易受到灼傷。',
          '幸好我帶了足夠的涼血丹和清火靈藥。',
          '讓我幫你和靈獸恢復到最佳狀態吧！',
        ],
      },
      {
        id: 'trainer3', name: '炎術士·赤羽', x: 45, y: 40,
        npcType: 'trainer',
        dialogue: [
          '在這座火山修煉，是對意志與實力的雙重考驗！',
          '我的畢方和燭龍都是在岩漿之上淬煉出來的。',
          '還有一頭從崑崙流落至此的饕餮...',
          '讓我用火焰的力量，見識一下你的實力！',
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
      { id: 'zy_rare1', x: 40, y: 25, type: 'rare_monster', monsterId: 'zhulong', monsterLevel: 18, label: '岩漿中浮現一道巨大的身影！' },
      { id: 'zy_heal1', x: 50, y: 120, type: 'heal', label: '火山溫泉' },
      { id: 'zy_heal2', x: 45, y: 50, type: 'heal', label: '火山溫泉' },
    ],
    playerStart: { x: 50, y: 152 },
  },

  // ── 崑崙仙境 ── 130×130 菱形
  {
    id: 'kunlun',
    name: '崑崙仙境',
    description: '雲海之上的仙山，瑞氣千條，祥雲繚繞。',
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
          '能到達崑崙仙境的人，都已經歷了漫長的修煉之路。',
          '崑崙山是天地靈脈最為充沛之處。',
          '千年前，白澤神獸在此守護靈脈的核心。',
          '「白澤能言語，知萬物之情。」牠通曉萬獸的名字與弱點。',
          '如果你能獲得白澤的認可，便能了解所有靈獸的奧秘。',
          '這座仙山上的花朵都蘊含靈力——',
          '仙靈玉露就藏在花叢之中，是修煉的珍寶。',
          '北邊通往幽都冥界——那是幽羅冥王的領域。',
          '只有真正準備好的靈獸師，才能踏入那片黑暗。',
          '去見太乙真人吧，他的練妖壺可以幫你打造更強的靈獸。',
        ],
      },
      {
        id: 'historian', name: '修史者·典籍', x: 50, y: 70,
        npcType: 'dialogue',
        dialogue: [
          '你知道嗎？五行之間的相剋不僅僅是元素的對抗。',
          '它代表了天地間最基本的平衡法則。',
          '金克木——利刃可斬草木；木克土——根系可碎大地。',
          '土克水——堤壩可擋洪流；水克火——雨水可滅烈焰。',
          '火克金——烈焰可熔鐵石。如此循環，永無止境。',
          '修仙境界也遵循同樣的法則——',
          '練氣、築基、金丹、化神、元嬰、渡劫。',
          '每突破一個大境界，實力都會有質的飛躍。',
          '高境界打低境界有加成，但越階挑戰成功的經驗也更豐厚！',
          '這就是為什麼有些修煉者專門以弱敵強來磨煉自己。',
        ],
      },
      {
        id: 'healer_kunlun', name: '仙醫·玉華', x: 55, y: 105,
        npcType: 'healer',
        spriteColor: 0x44ddaa,
        dialogue: [
          '崑崙仙藥乃是天地靈氣凝結而成。',
          '服下之後，不僅能恢復體力，還能安撫靈魂。',
          '讓我為你和靈獸進行全面的療養！',
        ],
      },
      {
        id: 'fusion_master', name: '煉妖師·太乙', x: 75, y: 50,
        npcType: 'fusion',
        spriteColor: 0xff8844,
        dialogue: [
          '吾乃太乙真人，千年來專研練妖壺之術。',
          '練妖壺的原理是將兩隻靈獸的靈魂融合為一。',
          '主體靈獸會獲得素材靈獸 20% 的基礎屬性。',
          '但素材靈獸會在過程中被消耗...這是不可逆的。',
          '不過有 20% 的機率，融合會產生異色個體——',
          '異色靈獸額外獲得 10% 全屬性加成，非常珍貴！',
          '選好你要融合的靈獸後，便開始吧。',
        ],
      },
      {
        id: 'trainer4', name: '仙門弟子·玉霜', x: 65, y: 35,
        npcType: 'trainer',
        dialogue: [
          '崑崙仙門的弟子，自幼便在靈脈最充沛之處修煉。',
          '我的白澤智謀無雙，九尾狐敏捷如風。',
          '蠱雕更是擁有極致的速度。',
          '你若能勝過我，便證明你有資格進入幽都冥界！',
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
      { id: 'kl_rare1', x: 80, y: 70, type: 'rare_monster', monsterId: 'baize', monsterLevel: 22, label: '祥雲中浮現智慧的光芒...' },
      { id: 'kl_heal1', x: 70, y: 90, type: 'heal', label: '瑤池仙泉' },
    ],
    playerStart: { x: 65, y: 120 },
  },

  // ── 幽都冥界 ── 150×150 迷宮型
  {
    id: 'youdu',
    name: '幽都冥界',
    description: '暗黑沼澤，瘴氣瀰漫，最強靈獸的棲息地。',
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
          '......你竟然踏入了幽都冥界。',
          '此地乃是生與死的交界，萬靈最後的歸宿。',
          '幽羅冥王在千年前打開了冥界之門。',
          '他的野心是吞噬人間的所有靈脈，讓天地歸於混沌。',
          '他擁有四頭太古靈獸——相柳、饕餮、燭龍、玄武。',
          '每一頭都已被冥氣侵蝕，實力遠超同類。',
          '相柳的九首可以同時施展不同的法術...',
          '饕餮的吞噬之力能削弱任何攻擊...',
          '燭龍的一眼可以灼燒靈魂...',
          '玄武的龜殼堅如磐石，幾乎無法擊破。',
          '如果你能收集齊十隻靈獸，重建完整的靈脈共鳴——',
          '那便是對抗幽羅的唯一希望。',
          '我在這裡等你凱旋...或者，永遠不再回來。',
        ],
      },
      {
        id: 'lost_soul', name: '迷途亡魂', x: 90, y: 90,
        npcType: 'dialogue',
        spriteColor: 0x8866aa,
        dialogue: [
          '......你能看到我嗎？',
          '我曾經也是一名靈獸師...',
          '在很久以前，我來到這裡挑戰幽羅冥王...',
          '但我太自信了...我的靈獸一隻接一隻地倒下...',
          '死鬥中...我也......',
          '如果你要挑戰幽羅，千萬記住：',
          '不要急於求成，先確保隊伍的境界足夠高。',
          '迷宮中散落的冥界靈魄可以幫你快速提升修為。',
          '另外，迷宮深處偶爾能遇到極其強大的野生靈獸。',
          '祝你好運...不要步我的後塵。',
        ],
      },
      {
        id: 'healer_youdu', name: '冥醫·幽蘭', x: 65, y: 130,
        npcType: 'healer',
        spriteColor: 0x44ddaa,
        dialogue: [
          '冥界的瘴氣會不斷侵蝕靈獸的生命力。',
          '我的藥方中加入了崑崙聖水，可以抵禦冥氣。',
          '讓我為你全面療傷——前方的路還很長。',
        ],
      },
      {
        id: 'boss', name: '冥王·幽羅', x: 75, y: 12,
        npcType: 'trainer',
        dialogue: [
          '哈哈哈...又一個不自量力的靈獸師。',
          '千年來，無數人試圖阻止我打開冥界之門。',
          '他們的靈魂，現在都在為我效力。',
          '你以為收集幾隻靈獸就能與我抗衡？',
          '我是幽都之主！掌控生死的冥王！',
          '來吧——讓我看看你最後的掙扎！',
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
      { id: 'yd_rare1', x: 80, y: 30, type: 'rare_monster', monsterId: 'xiangliu', monsterLevel: 27, label: '九首之影在黑暗中蠢動...' },
      { id: 'yd_rare2', x: 110, y: 80, type: 'rare_monster', monsterId: 'xuanwu', monsterLevel: 26, label: '龜蛇合體的威壓撲面而來！' },
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

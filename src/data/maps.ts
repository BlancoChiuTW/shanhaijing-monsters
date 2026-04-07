export interface WildEncounter {
  monsterId: string;
  minLevel: number;
  maxLevel: number;
  weight: number; // encounter probability weight
}

export interface MapNpc {
  id: string;
  name: string;
  x: number;
  y: number;
  dialogue: string[];
  team?: { monsterId: string; level: number }[];
}

export interface GameMap {
  id: string;
  name: string;
  description: string;
  width: number; // in tiles
  height: number;
  bgColor: number;
  encounterRate: number; // 0-100, chance per grass step
  wildEncounters: WildEncounter[];
  npcs: MapNpc[];
  exits: { x: number; y: number; targetMap: string; targetX: number; targetY: number }[];
  // 0=grass, 1=wall, 2=tall_grass(encounter), 3=water, 4=exit
  tiles: number[][];
  playerStart: { x: number; y: number };
}

function generateTiles(w: number, h: number, grassPatches: { x: number; y: number; w: number; h: number }[], walls: { x: number; y: number }[]): number[][] {
  const tiles: number[][] = [];
  for (let y = 0; y < h; y++) {
    tiles[y] = [];
    for (let x = 0; x < w; x++) {
      // border walls
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        tiles[y][x] = 1;
      } else {
        tiles[y][x] = 0;
      }
    }
  }
  // Add tall grass patches
  for (const patch of grassPatches) {
    for (let py = patch.y; py < patch.y + patch.h && py < h - 1; py++) {
      for (let px = patch.x; px < patch.x + patch.w && px < w - 1; px++) {
        if (tiles[py][px] === 0) tiles[py][px] = 2;
      }
    }
  }
  // Add walls
  for (const wall of walls) {
    if (wall.y < h && wall.x < w) tiles[wall.y][wall.x] = 1;
  }
  return tiles;
}

export const MAPS: GameMap[] = [
  {
    id: 'qingqiu',
    name: '青丘之野',
    description: '翠綠的丘陵草原，微風吹拂，偶見狐影。',
    width: 24,
    height: 18,
    bgColor: 0x4a8c3f,
    encounterRate: 25,
    wildEncounters: [
      { monsterId: 'jiuwei', minLevel: 3, maxLevel: 6, weight: 40 },
      { monsterId: 'qiongqi', minLevel: 3, maxLevel: 5, weight: 35 },
      { monsterId: 'gudiao', minLevel: 2, maxLevel: 4, weight: 25 },
    ],
    npcs: [
      {
        id: 'elder',
        name: '村長',
        x: 5,
        y: 5,
        dialogue: [
          '歡迎來到青丘之野！',
          '這裡棲息著各種靈獸。',
          '走進深草叢就可能遇到牠們。',
          '用靈符可以捕獲野生靈獸！',
        ],
      },
      {
        id: 'trainer1',
        name: '修煉者·小明',
        x: 15,
        y: 8,
        dialogue: ['你也是靈獸師嗎？來切磋一下！'],
        team: [
          { monsterId: 'qiongqi', level: 5 },
          { monsterId: 'gudiao', level: 4 },
        ],
      },
    ],
    exits: [
      { x: 23, y: 9, targetMap: 'beiming', targetX: 1, targetY: 9 },
      { x: 12, y: 0, targetMap: 'zhuyin', targetX: 12, targetY: 16 },
    ],
    tiles: generateTiles(24, 18,
      [
        { x: 8, y: 3, w: 5, h: 4 },
        { x: 16, y: 10, w: 4, h: 5 },
        { x: 3, y: 12, w: 6, h: 3 },
      ],
      [
        { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 },
        { x: 7, y: 10 }, { x: 7, y: 11 },
      ],
    ),
    playerStart: { x: 3, y: 3 },
  },
  {
    id: 'beiming',
    name: '北冥深淵',
    description: '幽暗的深海洞窟，水聲迴盪，巨影潛行。',
    width: 22,
    height: 16,
    bgColor: 0x1a3355,
    encounterRate: 30,
    wildEncounters: [
      { monsterId: 'kun', minLevel: 8, maxLevel: 12, weight: 30 },
      { monsterId: 'xuanwu', minLevel: 10, maxLevel: 14, weight: 20 },
      { monsterId: 'xiangliu', minLevel: 7, maxLevel: 10, weight: 50 },
    ],
    npcs: [
      {
        id: 'fisherman',
        name: '老漁夫',
        x: 5,
        y: 4,
        dialogue: [
          '這片水域深不可測...',
          '傳說鯤就藏在最深處。',
          '小心相柳，牠的毒很厲害。',
        ],
      },
      {
        id: 'trainer2',
        name: '馴獸師·阿海',
        x: 14,
        y: 10,
        dialogue: ['北冥的靈獸可不好對付！'],
        team: [
          { monsterId: 'kun', level: 12 },
          { monsterId: 'xiangliu', level: 10 },
        ],
      },
    ],
    exits: [
      { x: 0, y: 9, targetMap: 'qingqiu', targetX: 22, targetY: 9 },
      { x: 21, y: 8, targetMap: 'kunlun', targetX: 1, targetY: 8 },
    ],
    tiles: generateTiles(22, 16,
      [
        { x: 3, y: 6, w: 4, h: 4 },
        { x: 12, y: 3, w: 5, h: 3 },
        { x: 10, y: 11, w: 6, h: 3 },
      ],
      [
        { x: 8, y: 5 }, { x: 8, y: 6 }, { x: 8, y: 7 },
        { x: 9, y: 7 }, { x: 15, y: 8 },
      ],
    ),
    playerStart: { x: 1, y: 9 },
  },
  {
    id: 'zhuyin',
    name: '燭陰火山',
    description: '熔岩翻湧的火山口，空氣灼熱，火鳥盤旋。',
    width: 20,
    height: 18,
    bgColor: 0x8b2500,
    encounterRate: 35,
    wildEncounters: [
      { monsterId: 'zhulong', minLevel: 12, maxLevel: 16, weight: 25 },
      { monsterId: 'bifang', minLevel: 8, maxLevel: 12, weight: 45 },
      { monsterId: 'qiongqi', minLevel: 10, maxLevel: 13, weight: 30 },
    ],
    npcs: [
      {
        id: 'hermit',
        name: '火山隱士',
        x: 10,
        y: 5,
        dialogue: [
          '燭龍沉睡在火山深處...',
          '牠睜眼為晝，閉眼為夜。',
          '只有最強的靈獸師才能馴服牠。',
        ],
      },
      {
        id: 'trainer3',
        name: '炎術士·赤羽',
        x: 6,
        y: 12,
        dialogue: ['火焰的力量！讓我見識你的實力！'],
        team: [
          { monsterId: 'bifang', level: 14 },
          { monsterId: 'zhulong', level: 13 },
          { monsterId: 'taotie', level: 12 },
        ],
      },
    ],
    exits: [
      { x: 12, y: 17, targetMap: 'qingqiu', targetX: 12, targetY: 1 },
      { x: 0, y: 9, targetMap: 'youdu', targetX: 18, targetY: 9 },
    ],
    tiles: generateTiles(20, 18,
      [
        { x: 4, y: 7, w: 4, h: 4 },
        { x: 12, y: 4, w: 3, h: 5 },
        { x: 8, y: 13, w: 5, h: 3 },
      ],
      [
        { x: 9, y: 3 }, { x: 10, y: 3 }, { x: 9, y: 4 },
        { x: 5, y: 11 }, { x: 6, y: 11 },
        { x: 14, y: 10 }, { x: 14, y: 11 },
      ],
    ),
    playerStart: { x: 12, y: 16 },
  },
  {
    id: 'kunlun',
    name: '崑崙仙境',
    description: '雲海之上的仙山，瑞氣千條，祥雲繚繞。',
    width: 22,
    height: 18,
    bgColor: 0xaabbdd,
    encounterRate: 20,
    wildEncounters: [
      { monsterId: 'baize', minLevel: 15, maxLevel: 20, weight: 25 },
      { monsterId: 'gudiao', minLevel: 12, maxLevel: 16, weight: 40 },
      { monsterId: 'jiuwei', minLevel: 14, maxLevel: 18, weight: 35 },
    ],
    npcs: [
      {
        id: 'immortal',
        name: '崑崙仙人',
        x: 11,
        y: 4,
        dialogue: [
          '你已經走了很遠了。',
          '白澤乃是萬獸之智者。',
          '若能得其認可，前方的幽都也不足為懼。',
        ],
      },
      {
        id: 'trainer4',
        name: '仙門弟子·玉霜',
        x: 16,
        y: 12,
        dialogue: ['崑崙仙門不容小覷！'],
        team: [
          { monsterId: 'baize', level: 18 },
          { monsterId: 'jiuwei', level: 17 },
          { monsterId: 'gudiao', level: 16 },
        ],
      },
    ],
    exits: [
      { x: 0, y: 8, targetMap: 'beiming', targetX: 20, targetY: 8 },
      { x: 21, y: 9, targetMap: 'youdu', targetX: 1, targetY: 9 },
    ],
    tiles: generateTiles(22, 18,
      [
        { x: 5, y: 6, w: 4, h: 3 },
        { x: 14, y: 8, w: 5, h: 4 },
        { x: 8, y: 13, w: 4, h: 3 },
      ],
      [
        { x: 10, y: 7 }, { x: 11, y: 7 }, { x: 12, y: 7 },
        { x: 10, y: 10 }, { x: 10, y: 11 },
      ],
    ),
    playerStart: { x: 1, y: 8 },
  },
  {
    id: 'youdu',
    name: '幽都冥界',
    description: '暗黑沼澤，瘴氣瀰漫，最強靈獸的棲息地。',
    width: 24,
    height: 20,
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
        id: 'guardian',
        name: '冥界守門人',
        x: 12,
        y: 4,
        dialogue: [
          '你竟然能走到這裡...',
          '此地是靈獸最後的試煉場。',
          '收集十隻靈獸，你就是真正的山海靈獸師！',
        ],
      },
      {
        id: 'boss',
        name: '冥王·幽羅',
        x: 18,
        y: 15,
        dialogue: ['我是幽都之主！能打敗我，你就是最強的靈獸師！'],
        team: [
          { monsterId: 'xiangliu', level: 25 },
          { monsterId: 'taotie', level: 24 },
          { monsterId: 'zhulong', level: 26 },
          { monsterId: 'xuanwu', level: 25 },
        ],
      },
    ],
    exits: [
      { x: 0, y: 9, targetMap: 'kunlun', targetX: 20, targetY: 9 },
      { x: 19, y: 9, targetMap: 'zhuyin', targetX: 1, targetY: 9 },
    ],
    tiles: generateTiles(24, 20,
      [
        { x: 4, y: 5, w: 5, h: 4 },
        { x: 14, y: 3, w: 4, h: 5 },
        { x: 6, y: 13, w: 6, h: 4 },
        { x: 16, y: 12, w: 4, h: 4 },
      ],
      [
        { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 },
        { x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 },
        { x: 13, y: 10 },
      ],
    ),
    playerStart: { x: 1, y: 9 },
  },
];

export function getMap(id: string): GameMap {
  const m = MAPS.find(map => map.id === id);
  if (!m) throw new Error(`Unknown map: ${id}`);
  return m;
}

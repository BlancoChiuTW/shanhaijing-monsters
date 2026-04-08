/**
 * 程序化地圖生成器
 * 使用 seeded PRNG + value noise 生成 128×128+ 的大地圖
 * 地圖代碼：0=草地, 1=牆壁, 2=高草, 3=水, 4=出口, 5=石板路, 6=花
 */

// ═══════════════════════════════════
//  Seeded PRNG (Mulberry32)
// ═══════════════════════════════════
export function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════
//  Value Noise 2D
// ═══════════════════════════════════
function valueNoise2D(x: number, y: number, scale: number, rng: () => number, seedOffset: number): number {
  // 建立可重現的雜訊：用座標 hash 做 lattice
  const hash = (ix: number, iy: number) => {
    let h = (ix * 374761393 + iy * 668265263 + seedOffset) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };

  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;

  // 雙線性插值
  const v00 = hash(ix, iy);
  const v10 = hash(ix + 1, iy);
  const v01 = hash(ix, iy + 1);
  const v11 = hash(ix + 1, iy + 1);

  const top = v00 + (v10 - v00) * fx;
  const bot = v01 + (v11 - v01) * fx;
  return top + (bot - top) * fy;
}

/** 多 octave 疊加 */
function fractalNoise(x: number, y: number, scale: number, octaves: number, rng: () => number, seedOffset: number): number {
  let val = 0;
  let amp = 1;
  let freq = 1;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    val += valueNoise2D(x * freq, y * freq, scale, rng, seedOffset + i * 7919) * amp;
    maxAmp += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / maxAmp;
}

// ═══════════════════════════════════
//  Path Carving (加權隨機行走)
// ═══════════════════════════════════
interface Point { x: number; y: number }

function carvePath(
  tiles: number[][], w: number, h: number,
  from: Point, to: Point, pathWidth: number,
  rng: () => number, tileType: number = 5,
): void {
  let cx = from.x;
  let cy = from.y;
  const set = (x: number, y: number) => {
    const half = Math.floor(pathWidth / 2);
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && tiles[ny][nx] !== 4) {
          tiles[ny][nx] = tileType;
        }
      }
    }
  };

  const maxSteps = (w + h) * 4;
  for (let step = 0; step < maxSteps; step++) {
    set(cx, cy);
    if (cx === to.x && cy === to.y) break;

    const dx = to.x - cx;
    const dy = to.y - cy;

    // 加權向目標移動，帶隨機彎曲
    if (rng() < 0.7) {
      // 朝目標
      if (Math.abs(dx) > Math.abs(dy)) {
        cx += dx > 0 ? 1 : -1;
      } else {
        cy += dy > 0 ? 1 : -1;
      }
    } else {
      // 隨機偏移
      const r = rng();
      if (r < 0.25) cx = Math.max(0, cx - 1);
      else if (r < 0.5) cx = Math.min(w - 1, cx + 1);
      else if (r < 0.75) cy = Math.max(0, cy - 1);
      else cy = Math.min(h - 1, cy + 1);
    }
    cx = Math.max(0, Math.min(w - 1, cx));
    cy = Math.max(0, Math.min(h - 1, cy));
  }
  // 確保終點也被設定
  set(to.x, to.y);
}

// ═══════════════════════════════════
//  BFS 連通性檢查
// ═══════════════════════════════════
function bfsReachable(tiles: number[][], w: number, h: number, start: Point): Set<string> {
  const visited = new Set<string>();
  const queue: Point[] = [start];
  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const p = queue.shift()!;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      const key = `${nx},${ny}`;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && !visited.has(key)) {
        const t = tiles[ny][nx];
        if (t !== 1 && t !== 3) {
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }
  return visited;
}

function ensureConnectivity(
  tiles: number[][], w: number, h: number,
  points: Point[], rng: () => number,
): void {
  // 從第一個點做 BFS，如果其他點不可達就強行打通
  for (let attempts = 0; attempts < 5; attempts++) {
    const reachable = bfsReachable(tiles, w, h, points[0]);
    let allConnected = true;
    for (let i = 1; i < points.length; i++) {
      const key = `${points[i].x},${points[i].y}`;
      if (!reachable.has(key)) {
        allConnected = false;
        // 打通到不可達的點
        carvePath(tiles, w, h, points[0], points[i], 3, rng, 5);
      }
    }
    if (allConnected) break;
  }
}

// ═══════════════════════════════════
//  在路徑旁放高草
// ═══════════════════════════════════
function addTallGrassAlongPaths(tiles: number[][], w: number, h: number, rng: () => number): void {
  const pathTiles: Point[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (tiles[y][x] === 5) pathTiles.push({ x, y });
    }
  }

  for (const p of pathTiles) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          if (tiles[ny][nx] === 0 && rng() < 0.35) {
            tiles[ny][nx] = 2;
          }
        }
      }
    }
  }
}

// ═══════════════════════════════════
//  NPC 座標自動解析
// ═══════════════════════════════════
export function findNearestWalkable(
  tiles: number[][], w: number, h: number,
  target: Point, avoidPath: boolean = true,
): Point {
  // BFS 找最近可行走格（非牆非水），可選避開石板路
  const visited = new Set<string>();
  const queue: Point[] = [target];
  visited.add(`${target.x},${target.y}`);

  while (queue.length > 0) {
    const p = queue.shift()!;
    const t = tiles[p.y]?.[p.x];
    if (t !== undefined && t !== 1 && t !== 3 && t !== 4) {
      if (!avoidPath || t !== 5) return p;
    }
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      const key = `${nx},${ny}`;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && !visited.has(key)) {
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return target; // fallback
}

// ═══════════════════════════════════
//  五張地圖主題生成器
// ═══════════════════════════════════

/** 青丘之野：128×128 不規則圓形草原 */
export function generateQingqiu(seed: number): number[][] {
  const w = 128, h = 128;
  const rng = seededRandom(seed);
  const tiles = createEmpty(w, h, 1);

  const cx = w / 2, cy = h / 2;
  const radius = 52;

  // 不規則圓形遮罩
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const noiseVal = fractalNoise(x, y, 20, 3, rng, 100);
      if (dist < radius + noiseVal * 15 - 5) {
        tiles[y][x] = 0; // 草地
      }
    }
  }

  // 地形分佈
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (tiles[y][x] !== 0) continue;
      const n = fractalNoise(x, y, 15, 3, rng, 200);
      if (n > 0.7) tiles[y][x] = 2; // 高草
      else if (n < 0.22) tiles[y][x] = 6; // 花
    }
  }

  // 散佈小池塘
  for (let i = 0; i < 5; i++) {
    const px = Math.floor(cx + (rng() - 0.5) * 60);
    const py = Math.floor(cy + (rng() - 0.5) * 60);
    const pr = 2 + Math.floor(rng() * 3);
    for (let dy = -pr; dy <= pr; dy++) {
      for (let dx = -pr; dx <= pr; dx++) {
        if (dx * dx + dy * dy <= pr * pr) {
          const nx = px + dx, ny = py + dy;
          if (nx > 2 && nx < w - 2 && ny > 2 && ny < h - 2 && tiles[ny][nx] === 0) {
            tiles[ny][nx] = 3;
          }
        }
      }
    }
  }

  // 入口與出口
  const entrance: Point = { x: Math.floor(cx), y: h - 15 };
  const exitE: Point = { x: w - 15, y: Math.floor(cy) };
  const exitN: Point = { x: Math.floor(cx), y: 15 };

  // 確保入口/出口在可行走區
  clearArea(tiles, entrance, 3);
  clearArea(tiles, exitE, 3);
  clearArea(tiles, exitN, 3);

  // 主幹道
  const mid: Point = { x: Math.floor(cx), y: Math.floor(cy) };
  carvePath(tiles, w, h, entrance, mid, 3, rng);
  carvePath(tiles, w, h, mid, exitE, 3, rng);
  carvePath(tiles, w, h, mid, exitN, 3, rng);

  // 高草帶
  addTallGrassAlongPaths(tiles, w, h, rng);

  // 出口標記
  tiles[exitE.y][exitE.x] = 4;
  tiles[exitN.y][exitN.x] = 4;

  ensureConnectivity(tiles, w, h, [entrance, exitE, exitN], rng);

  return tiles;
}

/** 北冥深淵：140×100 群島型 */
export function generateBeiming(seed: number): number[][] {
  const w = 140, h = 100;
  const rng = seededRandom(seed);
  const tiles = createEmpty(w, h, 3); // 全水

  // 群島：noise > 閾值 → 陸地
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fractalNoise(x, y, 25, 4, rng, 300);
      // 邊緣漸衰
      const edgeDist = Math.min(x, y, w - 1 - x, h - 1 - y);
      const edgeFade = Math.min(1, edgeDist / 8);
      if (n * edgeFade > 0.38) {
        tiles[y][x] = 0; // 陸地
      }
    }
  }

  // 確保外牆
  for (let y = 0; y < h; y++) {
    tiles[y][0] = 1;
    tiles[y][w - 1] = 1;
  }
  for (let x = 0; x < w; x++) {
    tiles[0][x] = 1;
    tiles[h - 1][x] = 1;
  }

  // 地形分佈
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (tiles[y][x] !== 0) continue;
      const n2 = fractalNoise(x, y, 10, 2, rng, 400);
      if (n2 > 0.72) tiles[y][x] = 2; // 高草
    }
  }

  const entrance: Point = { x: 5, y: Math.floor(h / 2) };
  const exitE: Point = { x: w - 6, y: Math.floor(h / 2) };

  // 確保入口和出口有陸地
  clearArea(tiles, entrance, 4);
  clearArea(tiles, exitE, 4);

  // 島嶼間陸橋
  const bridgePoints: Point[] = [
    entrance,
    { x: 35, y: 30 + Math.floor(rng() * 20) },
    { x: 70, y: 40 + Math.floor(rng() * 20) },
    { x: 105, y: 30 + Math.floor(rng() * 20) },
    exitE,
  ];

  for (let i = 0; i < bridgePoints.length - 1; i++) {
    carvePath(tiles, w, h, bridgePoints[i], bridgePoints[i + 1], 3, rng, 0);
    // 陸橋上鋪石板
    carvePath(tiles, w, h, bridgePoints[i], bridgePoints[i + 1], 2, rng, 5);
  }

  addTallGrassAlongPaths(tiles, w, h, rng);
  tiles[exitE.y][exitE.x] = 4;

  ensureConnectivity(tiles, w, h, [entrance, exitE], rng);

  return tiles;
}

/** 燭陰火山：100×160 垂直山形（下寬上窄） */
export function generateZhuyin(seed: number): number[][] {
  const w = 100, h = 160;
  const rng = seededRandom(seed);
  const tiles = createEmpty(w, h, 1);

  const cx = w / 2;

  // 梯形遮罩：底部寬，頂部窄
  for (let y = 0; y < h; y++) {
    const progress = y / h; // 0=top, 1=bottom
    const halfWidth = 12 + progress * 32; // 頂部窄，底部寬
    const noiseVal = fractalNoise(cx, y, 20, 2, rng, 500) * 8;

    for (let x = 0; x < w; x++) {
      const dist = Math.abs(x - cx);
      if (dist < halfWidth + noiseVal) {
        tiles[y][x] = 0;
      }
    }
  }

  // 火山地形：岩漿池 (water)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (tiles[y][x] !== 0) continue;
      const n = fractalNoise(x, y, 12, 3, rng, 600);
      if (n > 0.75) tiles[y][x] = 3; // 岩漿 (water)
      else if (n > 0.65) tiles[y][x] = 2; // 高草（灰燼地）
    }
  }

  const entrance: Point = { x: Math.floor(cx), y: h - 10 };
  const exitN: Point = { x: Math.floor(cx), y: 10 };

  clearArea(tiles, entrance, 3);
  clearArea(tiles, exitN, 3);

  // 蜿蜒盤山路：Z字形
  const waypoints: Point[] = [
    entrance,
    { x: cx + 20, y: Math.floor(h * 0.75) },
    { x: cx - 15, y: Math.floor(h * 0.55) },
    { x: cx + 15, y: Math.floor(h * 0.35) },
    { x: cx - 10, y: Math.floor(h * 0.2) },
    exitN,
  ];

  for (let i = 0; i < waypoints.length - 1; i++) {
    carvePath(tiles, w, h, waypoints[i], waypoints[i + 1], 3, rng);
  }

  addTallGrassAlongPaths(tiles, w, h, rng);
  tiles[exitN.y][exitN.x] = 4;

  ensureConnectivity(tiles, w, h, [entrance, exitN], rng);

  return tiles;
}

/** 崑崙仙境：130×130 菱形 */
export function generateKunlun(seed: number): number[][] {
  const w = 130, h = 130;
  const rng = seededRandom(seed);
  const tiles = createEmpty(w, h, 1);

  const cx = w / 2, cy = h / 2;

  // 菱形遮罩（寬大菱形，約佔地圖 45%）
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - cx) / (w * 0.5);
      const dy = Math.abs(y - cy) / (h * 0.5);
      const noiseVal = fractalNoise(x, y, 25, 3, rng, 700) * 0.12;
      if (dx + dy < 0.85 + noiseVal) {
        tiles[y][x] = 0;
      }
    }
  }

  // 仙境地形：大量花朵 + 雲牆(水)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (tiles[y][x] !== 0) continue;
      const n = fractalNoise(x, y, 15, 3, rng, 800);
      if (n > 0.78) tiles[y][x] = 3; // 雲海 (water)
      else if (n > 0.65) tiles[y][x] = 6; // 花
      else if (n < 0.2) tiles[y][x] = 2; // 高草
    }
  }

  const entrance: Point = { x: Math.floor(cx), y: h - 15 };
  const exitN: Point = { x: Math.floor(cx), y: 15 };

  clearArea(tiles, entrance, 3);
  clearArea(tiles, exitN, 3);

  // 階梯式石板路
  const waypoints: Point[] = [
    entrance,
    { x: cx - 25, y: Math.floor(cy + 20) },
    { x: cx + 20, y: Math.floor(cy) },
    { x: cx - 15, y: Math.floor(cy - 20) },
    exitN,
  ];

  for (let i = 0; i < waypoints.length - 1; i++) {
    carvePath(tiles, w, h, waypoints[i], waypoints[i + 1], 3, rng);
  }

  addTallGrassAlongPaths(tiles, w, h, rng);
  tiles[exitN.y][exitN.x] = 4;

  ensureConnectivity(tiles, w, h, [entrance, exitN], rng);

  return tiles;
}

/** 幽都冥界：150×150 迷宮型 */
export function generateYoudu(seed: number): number[][] {
  const w = 150, h = 150;
  const rng = seededRandom(seed);
  const tiles = createEmpty(w, h, 1); // 全牆

  // 遞迴回溯迷宮（cell size = 4，走廊寬 3）
  const cellW = Math.floor((w - 2) / 4);
  const cellH = Math.floor((h - 2) / 4);
  const visited: boolean[][] = [];
  for (let y = 0; y < cellH; y++) {
    visited[y] = new Array(cellW).fill(false);
  }

  // 開房間
  const openCell = (cx: number, cy: number) => {
    const bx = 1 + cx * 4;
    const by = 1 + cy * 4;
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        if (bx + dx < w && by + dy < h) {
          tiles[by + dy][bx + dx] = 0;
        }
      }
    }
  };

  // 打通牆壁
  const openWall = (cx1: number, cy1: number, cx2: number, cy2: number) => {
    const bx1 = 1 + cx1 * 4;
    const by1 = 1 + cy1 * 4;
    const bx2 = 1 + cx2 * 4;
    const by2 = 1 + cy2 * 4;
    const mx = (bx1 + bx2) / 2;
    const my = (by1 + by2) / 2;
    // 打通中間的牆
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = Math.floor(mx) + dx;
        const ny = Math.floor(my) + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          tiles[ny][nx] = 0;
        }
      }
    }
  };

  // 迭代式回溯（避免遞迴棧溢出）
  const stack: [number, number][] = [];
  const startCX = Math.floor(cellW / 2);
  const startCY = cellH - 2;
  visited[startCY][startCX] = true;
  openCell(startCX, startCY);
  stack.push([startCX, startCY]);

  const dirs: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    // 洗牌鄰居
    const shuffled = dirs.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let found = false;
    for (const [dx, dy] of shuffled) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < cellW && ny >= 0 && ny < cellH && !visited[ny][nx]) {
        visited[ny][nx] = true;
        openCell(nx, ny);
        openWall(cx, cy, nx, ny);
        stack.push([nx, ny]);
        found = true;
        break;
      }
    }
    if (!found) stack.pop();
  }

  // 加寬走廊（讓迷宮不那麼窒息）+ 隨機打通一些額外牆壁
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (tiles[y][x] === 1) {
        // 如果兩側都是通道，有概率打通
        const hOpen = tiles[y][x - 1] !== 1 && tiles[y][x + 1] !== 1;
        const vOpen = tiles[y - 1][x] !== 1 && tiles[y + 1][x] !== 1;
        if ((hOpen || vOpen) && rng() < 0.3) {
          tiles[y][x] = 0;
        }
      }
    }
  }

  // 毒沼（水域）散佈在死胡同
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (tiles[y][x] === 0) {
        const n = fractalNoise(x, y, 18, 2, rng, 900);
        if (n > 0.82) tiles[y][x] = 3; // 毒沼
        else if (n > 0.6) tiles[y][x] = 2; // 高草
      }
    }
  }

  const entrance: Point = { x: Math.floor(w / 2), y: h - 8 };
  const bossPos: Point = { x: Math.floor(w / 2), y: 8 };

  clearArea(tiles, entrance, 4);
  clearArea(tiles, bossPos, 4);

  // 主幹道
  carvePath(tiles, w, h, entrance, bossPos, 3, rng);
  addTallGrassAlongPaths(tiles, w, h, rng);

  ensureConnectivity(tiles, w, h, [entrance, bossPos], rng);

  return tiles;
}

// ═══════════════════════════════════
//  工具函數
// ═══════════════════════════════════
function createEmpty(w: number, h: number, fill: number): number[][] {
  const tiles: number[][] = [];
  for (let y = 0; y < h; y++) {
    tiles[y] = new Array(w).fill(fill);
  }
  return tiles;
}

function clearArea(tiles: number[][], center: Point, radius: number): void {
  const h = tiles.length;
  const w = tiles[0].length;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = center.x + dx;
      const ny = center.y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        tiles[ny][nx] = 0;
      }
    }
  }
}

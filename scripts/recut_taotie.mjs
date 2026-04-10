/**
 * Re-cut taotie sprites from source images with checkerboard fake-transparency.
 *
 * Strategy:
 * 1. Crop precise inner regions to avoid text labels and grid borders
 * 2. PER REGION: detect/remove checkerboard, flood fill from cell borders
 * 3. Trim and resize to 128x128
 *
 * Per-region processing is necessary because skill sheets have bordered cells
 * that block whole-image flood fills.
 */
import sharp from 'sharp';

const OUT = 'public/assets/monsters';

function isCheckerGray(r, g, b) {
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  const avg = (r + g + b) / 3;
  // Includes both gray (~120) and lighter gray/white (~175-250) checker squares
  return maxDiff < 18 && avg > 100 && avg < 250;
}

function cleanRegion(buf, w, h) {
  // Step 1: Remove checkerboard - gray pixels where >25% of 3x3 neighbors
  // are a DIFFERENT shade of gray (alternation pattern)
  const toRemove = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = buf[idx], g = buf[idx+1], b = buf[idx+2], a = buf[idx+3];
      if (a < 10) continue;
      if (!isCheckerGray(r, g, b)) continue;
      const myAvg = (r + g + b) / 3;
      let diffNeighbors = 0, totalN = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          totalN++;
          const ni = (ny * w + nx) * 4;
          const na = buf[ni + 3];
          if (na < 10) { diffNeighbors++; continue; }
          const nAvg = (buf[ni] + buf[ni+1] + buf[ni+2]) / 3;
          if (isCheckerGray(buf[ni], buf[ni+1], buf[ni+2]) && Math.abs(myAvg - nAvg) > 15) {
            diffNeighbors++;
          }
        }
      }
      if (totalN > 0 && diffNeighbors / totalN > 0.25) {
        toRemove[y * w + x] = 1;
      }
    }
  }
  for (let i = 0; i < toRemove.length; i++) {
    if (toRemove[i]) buf[i * 4 + 3] = 0;
  }

  // Step 2: Flood fill from this region's own borders
  const outside = new Uint8Array(w * h);
  const queue = [];
  const canPass = (x, y) => {
    const idx = (y * w + x) * 4;
    const a = buf[idx + 3];
    if (a < 30) return true;
    const r = buf[idx], g = buf[idx+1], b = buf[idx+2];
    const avg = (r + g + b) / 3;
    const maxDiff = Math.max(Math.abs(r-g), Math.abs(g-b), Math.abs(r-b));
    // Pure gray (very tight RGB equality) — catches solid gray bg of any shade.
    // Brown/colored sprite pixels have larger maxDiff so they're preserved.
    if (maxDiff < 8 && avg >= 85 && avg <= 255) return true;
    return false;
  };

  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = y * w + x;
      if (!outside[i] && canPass(x, y)) { outside[i] = 1; queue.push([x, y]); }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = y * w + x;
      if (!outside[i] && canPass(x, y)) { outside[i] = 1; queue.push([x, y]); }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (outside[ni]) continue;
      if (canPass(nx, ny)) { outside[ni] = 1; queue.push([nx, ny]); }
    }
  }

  for (let i = 0; i < outside.length; i++) {
    if (outside[i] && buf[i * 4 + 3] > 0) buf[i * 4 + 3] = 0;
  }

  // Step 3: Remove small isolated connected components (cleanup specks).
  // Keep only components larger than 200 pixels.
  const visited = new Uint8Array(w * h);
  const componentMinSize = 200;
  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const sIdx = sy * w + sx;
      if (visited[sIdx]) continue;
      if (buf[sIdx * 4 + 3] < 30) { visited[sIdx] = 1; continue; }
      // BFS to collect this component
      const comp = [];
      const cq = [[sx, sy]];
      visited[sIdx] = 1;
      let ch = 0;
      while (ch < cq.length) {
        const [cx, cy] = cq[ch++];
        comp.push(cy * w + cx);
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const ni = ny * w + nx;
          if (visited[ni]) continue;
          if (buf[ni * 4 + 3] < 30) { visited[ni] = 1; continue; }
          visited[ni] = 1;
          cq.push([nx, ny]);
        }
      }
      if (comp.length < componentMinSize) {
        for (const idx of comp) buf[idx * 4 + 3] = 0;
      }
    }
  }
}

async function processSource(srcPath, regions) {
  const img = sharp(srcPath);
  const meta = await img.metadata();
  const { width, height } = meta;
  const { data } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });

  for (const { x: rx, y: ry, w, h, outFile } of regions) {
    // Crop region into its own buffer
    const buf = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = rx + x, sy = ry + y;
        if (sx >= width || sy >= height) continue;
        const si = (sy * width + sx) * 4, di = (y * w + x) * 4;
        buf[di] = data[si]; buf[di+1] = data[si+1]; buf[di+2] = data[si+2]; buf[di+3] = data[si+3];
      }
    }
    // Clean per-region (checker removal + flood fill)
    cleanRegion(buf, w, h);

    await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
      .trim()
      .resize(128, 128, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } })
      .png()
      .toFile(`${OUT}/${outFile}`);
    console.log(`  -> ${outFile}`);
  }
}

async function main() {
  // taotie01: 1376x768
  // Label "格1: 正面 (戰鬥待機)" extends from x=112 all the way to x=415.
  // Sprite starts around x=630. Use x>=425 to fully exclude label.
  console.log('taotie01.png...');
  await processSource('storage/taotie01.png', [
    { x: 425, y: 130, w: 951, h: 285, outFile: 'taotie.png' },
    { x: 425, y: 420, w: 951, h: 325, outFile: 'taotie_back.png' },
  ]);

  // taotiedead: 1408x768, 3 frames horizontal, sprite content y≈170-560
  // No left labels, just give vertical margin
  console.log('taotiedead.png...');
  const dW = Math.floor(1408 / 3);
  await processSource('storage/taotiedead.png', [
    { x: 10,       y: 140, w: dW - 20, h: 460, outFile: 'taotie_dead_0.png' },
    { x: dW + 10,  y: 140, w: dW - 20, h: 460, outFile: 'taotie_dead_1.png' },
    { x: dW*2+10,  y: 140, w: dW - 20, h: 460, outFile: 'taotie_dead_2.png' },
  ]);

  // taotieskill123: 1408x768, 3x3 grid
  // Header (title + F labels) y<100, C labels at x=15-150
  // Each cell has its own border — crop INSIDE the border so per-region
  // flood fill can work from new (gray) borders
  console.log('taotieskill123.png...');
  const gridLeft = 165, gridTop = 105;
  const cellW = Math.floor((1408 - gridLeft - 5) / 3);
  const cellH = Math.floor((768 - gridTop - 5) / 3);
  const inset = 12;
  const s123 = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      s123.push({
        x: gridLeft + c * cellW + inset,
        y: gridTop + r * cellH + inset,
        w: cellW - inset * 2,
        h: cellH - inset * 2,
        outFile: `taotie_skill${r+1}_${c}.png`,
      });
  await processSource('storage/taotieskill123.png', s123);

  console.log('taotieskill456.png...');
  const s456 = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      s456.push({
        x: gridLeft + c * cellW + inset,
        y: gridTop + r * cellH + inset,
        w: cellW - inset * 2,
        h: cellH - inset * 2,
        outFile: `taotie_skill${r+4}_${c}.png`,
      });
  await processSource('storage/taotieskill456.png', s456);

  console.log('All done!');
}

main().catch(console.error);

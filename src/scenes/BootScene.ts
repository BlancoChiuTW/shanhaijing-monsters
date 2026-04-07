import Phaser from 'phaser';
import { MONSTERS } from '../data/monsters';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create(): void {
    this.generateTileAssets();
    this.generateCharacterAssets();
    this.generateMonsterSprites();
    this.generateSfx();
    this.scene.start('MainMenu');
  }

  // ═══════════════════════════════════════
  //  地圖磁磚（16x16）
  // ═══════════════════════════════════════
  private generateTileAssets(): void {
    // 草地 - 帶紋理
    const grass = this.make.graphics({ x: 0, y: 0 });
    grass.fillStyle(0x5a9c4f);
    grass.fillRect(0, 0, 16, 16);
    grass.fillStyle(0x4e8c43);
    grass.fillRect(3, 2, 2, 1); grass.fillRect(10, 7, 2, 1);
    grass.fillRect(6, 12, 2, 1); grass.fillRect(13, 4, 1, 1);
    grass.generateTexture('tile_grass', 16, 16);
    grass.destroy();

    // 牆壁 - 石磚紋路
    const wall = this.make.graphics({ x: 0, y: 0 });
    wall.fillStyle(0x555555);
    wall.fillRect(0, 0, 16, 16);
    wall.fillStyle(0x666666);
    wall.fillRect(1, 1, 6, 6); wall.fillRect(9, 1, 6, 6);
    wall.fillRect(1, 9, 6, 6); wall.fillRect(9, 9, 6, 6);
    wall.lineStyle(1, 0x444444);
    wall.lineBetween(0, 8, 16, 8); wall.lineBetween(8, 0, 8, 16);
    wall.generateTexture('tile_wall', 16, 16);
    wall.destroy();

    // 深草叢 - 搖曳草紋
    const tg = this.make.graphics({ x: 0, y: 0 });
    tg.fillStyle(0x2a6c1f);
    tg.fillRect(0, 0, 16, 16);
    tg.fillStyle(0x3a8c2f);
    for (let i = 1; i < 16; i += 3) {
      const h = 4 + (i % 5);
      tg.fillRect(i, 16 - h, 2, h);
    }
    tg.fillStyle(0x4a9c3f);
    for (let i = 2; i < 16; i += 5) {
      tg.fillRect(i, 16 - 6, 1, 3);
    }
    tg.generateTexture('tile_tall_grass', 16, 16);
    tg.destroy();

    // 水面 - 波紋
    const water = this.make.graphics({ x: 0, y: 0 });
    water.fillStyle(0x2255aa);
    water.fillRect(0, 0, 16, 16);
    water.lineStyle(1, 0x3388cc);
    water.lineBetween(2, 4, 6, 3); water.lineBetween(9, 5, 14, 4);
    water.lineBetween(1, 10, 5, 9); water.lineBetween(8, 11, 13, 10);
    water.fillStyle(0x4499dd, 0.3);
    water.fillRect(3, 6, 4, 1); water.fillRect(10, 12, 3, 1);
    water.generateTexture('tile_water', 16, 16);
    water.destroy();

    // 出口 - 閃爍金框
    const exit = this.make.graphics({ x: 0, y: 0 });
    exit.fillStyle(0x5a9c4f);
    exit.fillRect(0, 0, 16, 16);
    exit.lineStyle(2, 0xffcc00);
    exit.strokeRect(1, 1, 14, 14);
    exit.fillStyle(0xffee66, 0.4);
    exit.fillRect(4, 4, 8, 8);
    exit.fillStyle(0xffffff);
    exit.fillTriangle(6, 5, 6, 11, 11, 8);
    exit.generateTexture('tile_exit', 16, 16);
    exit.destroy();
  }

  // ═══════════════════════════════════════
  //  角色精靈（16x16）
  // ═══════════════════════════════════════
  private generateCharacterAssets(): void {
    // 玩家 - 小人
    const p = this.make.graphics({ x: 0, y: 0 });
    p.fillStyle(0x3399ff);
    // 頭
    p.fillRoundedRect(4, 1, 8, 7, 2);
    // 身體
    p.fillStyle(0x2277cc);
    p.fillRect(5, 8, 6, 5);
    // 腳
    p.fillStyle(0x1155aa);
    p.fillRect(5, 13, 2, 2); p.fillRect(9, 13, 2, 2);
    // 眼睛
    p.fillStyle(0xffffff);
    p.fillRect(5, 3, 2, 2); p.fillRect(9, 3, 2, 2);
    p.fillStyle(0x000000);
    p.fillRect(6, 4, 1, 1); p.fillRect(10, 4, 1, 1);
    p.generateTexture('player', 16, 16);
    p.destroy();

    // NPC - 綠色小人
    const n = this.make.graphics({ x: 0, y: 0 });
    n.fillStyle(0x33cc66);
    n.fillRoundedRect(4, 1, 8, 7, 2);
    n.fillStyle(0x22aa55);
    n.fillRect(5, 8, 6, 5);
    n.fillStyle(0x118844);
    n.fillRect(5, 13, 2, 2); n.fillRect(9, 13, 2, 2);
    n.fillStyle(0xffffff);
    n.fillRect(5, 3, 2, 2); n.fillRect(9, 3, 2, 2);
    n.fillStyle(0x000000);
    n.fillRect(6, 4, 1, 1); n.fillRect(10, 4, 1, 1);
    n.generateTexture('npc', 16, 16);
    n.destroy();

    // 靈符（捕獲道具）
    const c = this.make.graphics({ x: 0, y: 0 });
    c.fillStyle(0xffdd44);
    c.fillCircle(8, 8, 7);
    c.lineStyle(1, 0xcc9900);
    c.strokeCircle(8, 8, 7);
    c.fillStyle(0xff4444);
    c.fillCircle(8, 8, 3);
    c.fillStyle(0xffffff);
    c.fillCircle(8, 8, 1);
    c.lineStyle(1, 0xcc9900);
    c.lineBetween(1, 8, 15, 8);
    c.generateTexture('catch_ball', 16, 16);
    c.destroy();
  }

  // ═══════════════════════════════════════
  //  靈獸精靈（64x64 戰鬥用）
  // ═══════════════════════════════════════
  private generateMonsterSprites(): void {
    for (const monster of MONSTERS) {
      const g = this.make.graphics({ x: 0, y: 0 });
      const c = monster.color;
      const darkerColor = Phaser.Display.Color.IntegerToColor(c).darken(30).color;
      const lighterColor = Phaser.Display.Color.IntegerToColor(c).lighten(30).color;

      switch (monster.id) {
        case 'qiongqi': // 窮奇 - 有翼虎
          // 身體
          g.fillStyle(c); g.fillRoundedRect(12, 20, 40, 28, 6);
          // 頭
          g.fillStyle(c); g.fillRoundedRect(8, 8, 24, 20, 4);
          // 耳朵
          g.fillStyle(darkerColor);
          g.fillTriangle(10, 10, 14, 2, 18, 10);
          g.fillTriangle(22, 10, 26, 2, 30, 10);
          // 翅膀
          g.fillStyle(lighterColor);
          g.fillTriangle(4, 20, 16, 30, 4, 40);
          g.fillTriangle(60, 20, 48, 30, 60, 40);
          // 眼睛
          g.fillStyle(0xff4444); g.fillCircle(14, 16, 3); g.fillCircle(24, 16, 3);
          g.fillStyle(0xffffff); g.fillCircle(15, 15, 1); g.fillCircle(25, 15, 1);
          // 腳
          g.fillStyle(darkerColor);
          g.fillRect(16, 46, 4, 6); g.fillRect(28, 46, 4, 6);
          g.fillRect(38, 46, 4, 6); g.fillRect(44, 46, 4, 6);
          break;

        case 'kun': // 鯤 - 巨魚
          g.fillStyle(c);
          g.fillEllipse(32, 32, 52, 30);
          // 鱗片紋路
          g.fillStyle(darkerColor);
          for (let i = 16; i < 50; i += 8) {
            g.fillEllipse(i, 30, 6, 4);
          }
          // 尾鰭
          g.fillStyle(lighterColor);
          g.fillTriangle(56, 24, 64, 16, 64, 40);
          // 眼睛
          g.fillStyle(0xffffff); g.fillCircle(14, 28, 5);
          g.fillStyle(0x000066); g.fillCircle(14, 28, 3);
          // 嘴
          g.lineStyle(2, darkerColor); g.lineBetween(4, 34, 14, 36);
          break;

        case 'zhulong': // 燭龍 - 人面蛇身
          // 蛇身蜿蜒
          g.fillStyle(c);
          g.fillEllipse(20, 20, 24, 20);
          g.fillStyle(darkerColor);
          g.fillRoundedRect(28, 24, 8, 20, 3);
          g.fillStyle(c);
          g.fillRoundedRect(34, 32, 8, 20, 3);
          g.fillStyle(darkerColor);
          g.fillRoundedRect(40, 40, 12, 8, 3);
          // 眼睛（發光）
          g.fillStyle(0xffff00); g.fillCircle(14, 16, 4); g.fillCircle(26, 16, 4);
          g.fillStyle(0xff6600); g.fillCircle(14, 16, 2); g.fillCircle(26, 16, 2);
          // 火焰
          g.fillStyle(0xff4400);
          g.fillTriangle(8, 6, 12, -2, 16, 6);
          g.fillTriangle(20, 6, 24, -4, 28, 6);
          break;

        case 'baize': // 白澤 - 聖獸
          g.fillStyle(0xffffff);
          g.fillRoundedRect(12, 16, 40, 30, 8);
          // 頭
          g.fillRoundedRect(16, 4, 24, 18, 6);
          // 角
          g.fillStyle(0xffdd88);
          g.fillTriangle(20, 6, 22, -4, 24, 6);
          g.fillTriangle(32, 6, 34, -4, 36, 6);
          // 眼睛（慈祥）
          g.fillStyle(0x4488ff); g.fillCircle(22, 12, 3); g.fillCircle(34, 12, 3);
          g.fillStyle(0xffffff); g.fillCircle(23, 11, 1); g.fillCircle(35, 11, 1);
          // 祥雲紋
          g.fillStyle(0xeeeeff);
          g.fillCircle(20, 30, 4); g.fillCircle(28, 32, 3); g.fillCircle(36, 28, 4);
          // 腳
          g.fillStyle(0xddddee);
          g.fillRect(16, 44, 4, 8); g.fillRect(26, 44, 4, 8);
          g.fillRect(36, 44, 4, 8); g.fillRect(44, 44, 4, 8);
          break;

        case 'jiuwei': // 九尾狐
          g.fillStyle(c);
          g.fillRoundedRect(14, 18, 28, 22, 6);
          // 頭
          g.fillRoundedRect(10, 6, 20, 16, 4);
          // 耳朵（尖）
          g.fillTriangle(12, 8, 14, -2, 18, 8);
          g.fillTriangle(24, 8, 28, -2, 30, 8);
          // 九條尾巴
          g.fillStyle(lighterColor);
          for (let i = 0; i < 9; i++) {
            const tx = 40 + (i % 3) * 6;
            const ty = 14 + Math.floor(i / 3) * 12;
            g.fillRoundedRect(tx, ty, 16, 3, 1);
          }
          // 眼睛
          g.fillStyle(0xff6600); g.fillCircle(16, 12, 3); g.fillCircle(26, 12, 3);
          g.fillStyle(0x000000); g.fillCircle(16, 12, 1); g.fillCircle(26, 12, 1);
          break;

        case 'taotie': // 饕餮 - 貪食巨獸
          g.fillStyle(c);
          g.fillRoundedRect(8, 12, 48, 36, 8);
          // 大嘴
          g.fillStyle(0x660000);
          g.fillRoundedRect(14, 28, 36, 16, 4);
          // 牙齒
          g.fillStyle(0xffffff);
          for (let i = 16; i < 48; i += 6) {
            g.fillTriangle(i, 28, i + 3, 34, i + 6, 28);
          }
          // 眼睛（在腋下）
          g.fillStyle(0xffff00); g.fillCircle(16, 20, 4); g.fillCircle(46, 20, 4);
          g.fillStyle(0xff0000); g.fillCircle(16, 20, 2); g.fillCircle(46, 20, 2);
          break;

        case 'bifang': // 畢方 - 火鳥
          // 身體
          g.fillStyle(c); g.fillEllipse(32, 28, 28, 22);
          // 翅膀
          g.fillStyle(0xff4400);
          g.fillTriangle(10, 18, 4, 8, 24, 22);
          g.fillTriangle(54, 18, 60, 8, 40, 22);
          // 頭
          g.fillStyle(lighterColor); g.fillCircle(32, 10, 10);
          // 喙
          g.fillStyle(0xffffff); g.fillTriangle(28, 10, 36, 10, 32, 18);
          // 眼睛
          g.fillStyle(0x000000); g.fillCircle(28, 8, 2); g.fillCircle(36, 8, 2);
          // 獨足
          g.fillStyle(darkerColor); g.fillRect(30, 38, 4, 16);
          g.fillRect(26, 52, 12, 3);
          // 火焰效果
          g.fillStyle(0xff6600, 0.6);
          g.fillTriangle(12, 16, 8, 4, 18, 14);
          g.fillTriangle(52, 16, 56, 4, 46, 14);
          break;

        case 'xuanwu': // 玄武 - 龜蛇
          // 龜殼
          g.fillStyle(0x336655);
          g.fillEllipse(30, 34, 44, 28);
          g.fillStyle(darkerColor);
          // 殼紋
          g.lineStyle(2, 0x224444);
          g.strokeEllipse(30, 34, 30, 18);
          g.lineBetween(18, 28, 42, 28);
          g.lineBetween(18, 38, 42, 38);
          // 頭
          g.fillStyle(c); g.fillCircle(8, 24, 8);
          // 蛇（繞在龜上）
          g.fillStyle(0x446688);
          g.fillRoundedRect(42, 16, 4, 20, 2);
          g.fillCircle(50, 14, 5);
          g.fillStyle(0xff4444); g.fillCircle(48, 12, 1); g.fillCircle(52, 12, 1);
          // 龜眼
          g.fillStyle(0xffffff); g.fillCircle(6, 22, 2);
          g.fillStyle(0x000000); g.fillCircle(6, 22, 1);
          break;

        case 'gudiao': // 蠱雕 - 鷹身人面
          // 身體
          g.fillStyle(c); g.fillEllipse(32, 30, 30, 24);
          // 翅膀
          g.fillStyle(darkerColor);
          g.fillTriangle(4, 20, 8, 10, 20, 26);
          g.fillTriangle(60, 20, 56, 10, 44, 26);
          // 人面
          g.fillStyle(0xffccaa); g.fillCircle(32, 12, 10);
          // 眼睛
          g.fillStyle(0x000000); g.fillCircle(28, 10, 2); g.fillCircle(36, 10, 2);
          // 嘴
          g.lineStyle(1, 0x884444); g.lineBetween(29, 16, 35, 16);
          // 蠍尾
          g.fillStyle(0x884466);
          g.fillRoundedRect(44, 36, 4, 16, 1);
          g.fillCircle(48, 38, 4);
          break;

        case 'xiangliu': // 相柳 - 九頭蛇
          // 身體
          g.fillStyle(c); g.fillRoundedRect(16, 28, 32, 24, 6);
          // 九個蛇頭
          const headPositions = [
            [12, 14], [20, 8], [28, 4], [36, 8], [44, 14],
            [16, 20], [24, 16], [32, 16], [40, 20],
          ];
          for (const [hx, hy] of headPositions) {
            g.fillStyle(lighterColor);
            g.fillCircle(hx, hy, 5);
            g.fillStyle(0xff0000);
            g.fillCircle(hx - 1, hy - 1, 1);
            g.fillCircle(hx + 2, hy - 1, 1);
          }
          // 毒液滴
          g.fillStyle(0xaaff00, 0.6);
          g.fillCircle(20, 50, 3); g.fillCircle(34, 52, 2); g.fillCircle(44, 48, 3);
          break;

        default:
          g.fillStyle(c); g.fillCircle(32, 32, 24);
      }

      g.generateTexture(`monster_${monster.id}`, 64, 64);
      g.destroy();
    }
  }

  // ═══════════════════════════════════════
  //  程式產生音效（Web Audio API）
  // ═══════════════════════════════════════
  private generateSfx(): void {
    const audioCtx = new AudioContext();

    const createTone = (freq: number, duration: number, type: OscillatorType = 'square'): AudioBuffer => {
      const sampleRate = audioCtx.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const buffer = audioCtx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const envelope = Math.max(0, 1 - t / duration);
        let sample = 0;
        if (type === 'square') {
          sample = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
        } else if (type === 'sine') {
          sample = Math.sin(2 * Math.PI * freq * t);
        } else if (type === 'sawtooth') {
          sample = 2 * (freq * t - Math.floor(freq * t + 0.5));
        }
        data[i] = sample * envelope * 0.3;
      }
      return buffer;
    };

    const createNoise = (duration: number): AudioBuffer => {
      const sampleRate = audioCtx.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const buffer = audioCtx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const envelope = Math.max(0, 1 - i / length);
        data[i] = (Math.random() * 2 - 1) * envelope * 0.2;
      }
      return buffer;
    };

    // 攻擊音效 - 快速下降音
    const attackBuf = (() => {
      const sr = audioCtx.sampleRate;
      const len = Math.floor(sr * 0.15);
      const buf = audioCtx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const freq = 800 - t * 4000;
        const env = Math.max(0, 1 - t / 0.15);
        d[i] = (Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1) * env * 0.25;
      }
      return buf;
    })();

    // 受傷音效
    const hurtBuf = createNoise(0.2);

    // 捕獲音效 - 上升音階
    const catchBuf = (() => {
      const sr = audioCtx.sampleRate;
      const len = Math.floor(sr * 0.4);
      const buf = audioCtx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const freq = 400 + t * 800;
        const env = Math.max(0, 1 - t / 0.4) * 0.3;
        d[i] = Math.sin(2 * Math.PI * freq * t) * env;
      }
      return buf;
    })();

    // 升級音效 - 歡快上升
    const levelUpBuf = (() => {
      const sr = audioCtx.sampleRate;
      const len = Math.floor(sr * 0.6);
      const buf = audioCtx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const noteIdx = Math.min(3, Math.floor(t / 0.15));
        const env = Math.max(0, 1 - (t % 0.15) / 0.2) * 0.25;
        d[i] = Math.sin(2 * Math.PI * notes[noteIdx] * t) * env;
      }
      return buf;
    })();

    // UI 點擊音效
    const clickBuf = createTone(800, 0.05, 'sine');

    // 選單選擇
    const selectBuf = createTone(600, 0.08, 'sine');

    // 逃跑音效
    const runBuf = (() => {
      const sr = audioCtx.sampleRate;
      const len = Math.floor(sr * 0.3);
      const buf = audioCtx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const freq = 600 - t * 1500;
        d[i] = Math.sin(2 * Math.PI * Math.max(100, freq) * t) * Math.max(0, 1 - t / 0.3) * 0.2;
      }
      return buf;
    })();

    // 儲存為 base64 data URI 讓 Phaser 載入
    const bufferToWav = (buffer: AudioBuffer): string => {
      const numChannels = 1;
      const sampleRate = buffer.sampleRate;
      const data = buffer.getChannelData(0);
      const length = data.length;
      const wavBuffer = new ArrayBuffer(44 + length * 2);
      const view = new DataView(wavBuffer);

      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };

      writeString(0, 'RIFF');
      view.setUint32(4, 36 + length * 2, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numChannels * 2, true);
      view.setUint16(32, numChannels * 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, length * 2, true);

      for (let i = 0; i < length; i++) {
        const s = Math.max(-1, Math.min(1, data[i]));
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }

      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    };

    const sfxMap: Record<string, AudioBuffer> = {
      sfx_attack: attackBuf,
      sfx_hurt: hurtBuf,
      sfx_catch: catchBuf,
      sfx_levelup: levelUpBuf,
      sfx_click: clickBuf,
      sfx_select: selectBuf,
      sfx_run: runBuf,
    };

    for (const [key, buf] of Object.entries(sfxMap)) {
      const url = bufferToWav(buf);
      this.sound.add(key);
      this.load.audio(key, url);
    }
    this.load.start();
  }
}

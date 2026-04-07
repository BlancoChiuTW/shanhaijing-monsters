import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create(): void {
    // Generate placeholder sprites programmatically
    this.generatePlaceholderAssets();
    this.scene.start('MainMenu');
  }

  private generatePlaceholderAssets(): void {
    // Player sprite (16x16 blue square)
    const playerGfx = this.make.graphics({ x: 0, y: 0 });
    playerGfx.fillStyle(0x3399ff);
    playerGfx.fillRect(0, 0, 16, 16);
    playerGfx.fillStyle(0xffffff);
    playerGfx.fillRect(4, 3, 3, 3);
    playerGfx.fillRect(9, 3, 3, 3);
    playerGfx.fillRect(5, 10, 6, 2);
    playerGfx.generateTexture('player', 16, 16);
    playerGfx.destroy();

    // NPC sprite (16x16 green square)
    const npcGfx = this.make.graphics({ x: 0, y: 0 });
    npcGfx.fillStyle(0x33cc66);
    npcGfx.fillRect(0, 0, 16, 16);
    npcGfx.fillStyle(0xffffff);
    npcGfx.fillRect(4, 3, 3, 3);
    npcGfx.fillRect(9, 3, 3, 3);
    npcGfx.generateTexture('npc', 16, 16);
    npcGfx.destroy();

    // Tile textures
    const tileColors: Record<string, number> = {
      grass: 0x5a9c4f,
      wall: 0x555555,
      tall_grass: 0x3a7c2f,
      water: 0x3366aa,
      exit: 0xffcc00,
    };

    for (const [name, color] of Object.entries(tileColors)) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(color);
      g.fillRect(0, 0, 16, 16);
      if (name === 'tall_grass') {
        g.lineStyle(1, 0x2a6c1f);
        for (let i = 2; i < 16; i += 4) {
          g.lineBetween(i, 16, i + 2, 8);
        }
      }
      if (name === 'exit') {
        g.lineStyle(2, 0xff9900);
        g.strokeRect(1, 1, 14, 14);
      }
      g.generateTexture(`tile_${name}`, 16, 16);
      g.destroy();
    }

    // Catch item (靈符)
    const catchGfx = this.make.graphics({ x: 0, y: 0 });
    catchGfx.fillStyle(0xffdd44);
    catchGfx.fillCircle(8, 8, 7);
    catchGfx.fillStyle(0xff4444);
    catchGfx.fillCircle(8, 8, 3);
    catchGfx.generateTexture('catch_ball', 16, 16);
    catchGfx.destroy();
  }
}

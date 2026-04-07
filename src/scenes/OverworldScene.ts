import Phaser from 'phaser';
import { getMap, type GameMap, type MapNpc } from '../data/maps';
import { getState, saveGame, getFirstAliveIndex, healTeam } from '../utils/gameState';
import { createMonsterInstance, MONSTERS } from '../data/monsters';

const TILE_SIZE = 32;

export class OverworldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private currentMap!: GameMap;
  private tileSprites: Phaser.GameObjects.Image[] = [];
  private npcSprites: Phaser.GameObjects.Rectangle[] = [];
  private npcLabels: Phaser.GameObjects.Text[] = [];
  private playerTileX = 0;
  private playerTileY = 0;
  private isMoving = false;
  private moveTimer = 0;
  private dialogueBox: Phaser.GameObjects.Container | null = null;
  private mapNameText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'Overworld' });
  }

  create(): void {
    const state = getState();
    this.currentMap = getMap(state.currentMapId);
    this.playerTileX = state.playerX;
    this.playerTileY = state.playerY;

    this.renderMap();
    this.createPlayer();
    this.createNpcs();
    this.setupInput();
    this.createUI();

    this.cameras.main.setBackgroundColor(this.currentMap.bgColor);
  }

  private renderMap(): void {
    // Clear old tiles
    this.tileSprites.forEach(s => s.destroy());
    this.tileSprites = [];

    const tileKeys = ['tile_grass', 'tile_wall', 'tile_tall_grass', 'tile_water', 'tile_exit'];

    for (let y = 0; y < this.currentMap.height; y++) {
      for (let x = 0; x < this.currentMap.width; x++) {
        const tileType = this.currentMap.tiles[y][x];
        const key = tileKeys[tileType] || 'tile_grass';
        const sprite = this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, key);
        sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
        this.tileSprites.push(sprite);
      }
    }

    // Mark exits
    for (const exit of this.currentMap.exits) {
      const ex = this.add.image(exit.x * TILE_SIZE + TILE_SIZE / 2, exit.y * TILE_SIZE + TILE_SIZE / 2, 'tile_exit');
      ex.setDisplaySize(TILE_SIZE, TILE_SIZE);
      this.tileSprites.push(ex);
      // Make exit tile walkable
      this.currentMap.tiles[exit.y][exit.x] = 4;
    }
  }

  private createPlayer(): void {
    this.player = this.add.rectangle(
      this.playerTileX * TILE_SIZE + TILE_SIZE / 2,
      this.playerTileY * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE - 4,
      TILE_SIZE - 4,
      0x3399ff,
    );
    this.player.setDepth(10);

    // Camera follow
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);
  }

  private createNpcs(): void {
    this.npcSprites.forEach(s => s.destroy());
    this.npcLabels.forEach(s => s.destroy());
    this.npcSprites = [];
    this.npcLabels = [];

    for (const npc of this.currentMap.npcs) {
      const sprite = this.add.rectangle(
        npc.x * TILE_SIZE + TILE_SIZE / 2,
        npc.y * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE - 4,
        TILE_SIZE - 4,
        npc.team ? 0xcc3333 : 0x33cc66,
      );
      sprite.setDepth(5);
      this.npcSprites.push(sprite);

      const label = this.add.text(
        npc.x * TILE_SIZE + TILE_SIZE / 2,
        npc.y * TILE_SIZE - 4,
        npc.name,
        { fontSize: '8px', color: '#ffffff', align: 'center' },
      ).setOrigin(0.5, 1).setDepth(6);
      this.npcLabels.push(label);
    }
  }

  private createUI(): void {
    this.mapNameText = this.add.text(10, 10, this.currentMap.name, {
      fontSize: '14px',
      fontFamily: 'serif',
      color: '#ffcc44',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    this.infoText = this.add.text(10, 34, '', {
      fontSize: '10px',
      color: '#aabbcc',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(100);

    this.updateInfoText();

    // Menu hint
    this.add.text(this.scale.width - 10, 10, '[M]選單 [Z]互動', {
      fontSize: '10px',
      color: '#667788',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 3 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
  }

  private updateInfoText(): void {
    const state = getState();
    const alive = state.team.filter(m => m.hp > 0).length;
    this.infoText.setText(`隊伍：${alive}/${state.team.length}　圖鑑：${state.caughtIds.size}/10`);
  }

  private setupInput(): void {
    if (!this.input.keyboard) return;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard.addKey('W'),
      A: this.input.keyboard.addKey('A'),
      S: this.input.keyboard.addKey('S'),
      D: this.input.keyboard.addKey('D'),
      Z: this.input.keyboard.addKey('Z'),
      M: this.input.keyboard.addKey('M'),
    };

    // Z = interact
    this.wasd.Z.on('down', () => this.interact());

    // M = menu (save/heal)
    this.wasd.M.on('down', () => this.showQuickMenu());
  }

  update(_time: number, delta: number): void {
    if (this.dialogueBox || this.isMoving) return;

    this.moveTimer -= delta;
    if (this.moveTimer > 0) return;

    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -1;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = 1;
    else if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -1;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = 1;

    if (dx === 0 && dy === 0) return;

    const newX = this.playerTileX + dx;
    const newY = this.playerTileY + dy;

    // Bounds check
    if (newX < 0 || newY < 0 || newX >= this.currentMap.width || newY >= this.currentMap.height) return;

    // Check for NPC blocking
    const npcAt = this.currentMap.npcs.find(n => n.x === newX && n.y === newY);
    if (npcAt) return;

    const tile = this.currentMap.tiles[newY][newX];
    // Wall or water
    if (tile === 1 || tile === 3) return;

    // Move
    this.isMoving = true;
    this.playerTileX = newX;
    this.playerTileY = newY;

    const state = getState();
    state.playerX = newX;
    state.playerY = newY;

    this.tweens.add({
      targets: this.player,
      x: newX * TILE_SIZE + TILE_SIZE / 2,
      y: newY * TILE_SIZE + TILE_SIZE / 2,
      duration: 120,
      onComplete: () => {
        this.isMoving = false;
        this.checkTile(newX, newY);
      },
    });

    this.moveTimer = 50;
  }

  private checkTile(x: number, y: number): void {
    const tile = this.currentMap.tiles[y][x];

    // Exit
    if (tile === 4) {
      const exit = this.currentMap.exits.find(e => e.x === x && e.y === y);
      if (exit) {
        this.transitionToMap(exit.targetMap, exit.targetX, exit.targetY);
        return;
      }
    }

    // Tall grass - random encounter
    if (tile === 2) {
      const roll = Math.random() * 100;
      if (roll < this.currentMap.encounterRate) {
        this.triggerWildEncounter();
      }
    }
  }

  private triggerWildEncounter(): void {
    const state = getState();
    if (getFirstAliveIndex() === -1) return;

    // Pick random wild monster based on weights
    const totalWeight = this.currentMap.wildEncounters.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    let encounter = this.currentMap.wildEncounters[0];

    for (const e of this.currentMap.wildEncounters) {
      roll -= e.weight;
      if (roll <= 0) {
        encounter = e;
        break;
      }
    }

    const level = encounter.minLevel + Math.floor(Math.random() * (encounter.maxLevel - encounter.minLevel + 1));
    const wildMonster = createMonsterInstance(encounter.monsterId, level);

    // Flash effect
    this.cameras.main.flash(300, 255, 255, 255);

    this.time.delayedCall(300, () => {
      this.scene.launch('Battle', {
        type: 'wild',
        enemies: [wildMonster],
        onEnd: () => {
          this.updateInfoText();
        },
      });
      this.scene.pause();
    });
  }

  private interact(): void {
    // Check adjacent tiles for NPCs
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];

    for (const dir of dirs) {
      const checkX = this.playerTileX + dir.dx;
      const checkY = this.playerTileY + dir.dy;
      const npc = this.currentMap.npcs.find(n => n.x === checkX && n.y === checkY);
      if (npc) {
        this.talkToNpc(npc);
        return;
      }
    }
  }

  private talkToNpc(npc: MapNpc): void {
    const state = getState();
    let dialogueIndex = 0;

    const showDialogue = () => {
      if (this.dialogueBox) {
        this.dialogueBox.destroy();
        this.dialogueBox = null;
      }

      if (dialogueIndex >= npc.dialogue.length) {
        // After dialogue, check for trainer battle
        if (npc.team && !state.defeatedTrainers.has(npc.id)) {
          const enemies = npc.team.map(t => createMonsterInstance(t.monsterId, t.level));
          this.cameras.main.flash(300, 255, 100, 100);
          this.time.delayedCall(300, () => {
            this.scene.launch('Battle', {
              type: 'trainer',
              trainerName: npc.name,
              trainerId: npc.id,
              enemies,
              onEnd: () => {
                this.updateInfoText();
              },
            });
            this.scene.pause();
          });
        }
        state.talkedNpcs.add(npc.id);
        return;
      }

      const boxH = 60;
      const camW = this.scale.width;
      const camH = this.scale.height;

      const container = this.add.container(0, 0);
      container.setScrollFactor(0);
      container.setDepth(200);

      const bg = this.add.rectangle(camW / 2, camH - boxH / 2 - 5, camW - 20, boxH, 0x000000, 0.85);
      bg.setStrokeStyle(1, 0xffcc44);
      container.add(bg);

      const nameLabel = this.add.text(20, camH - boxH - 2, npc.name, {
        fontSize: '11px',
        color: '#ffcc44',
        fontStyle: 'bold',
      });
      container.add(nameLabel);

      const text = this.add.text(20, camH - boxH + 16, npc.dialogue[dialogueIndex], {
        fontSize: '12px',
        color: '#ffffff',
        wordWrap: { width: camW - 50 },
      });
      container.add(text);

      const hint = this.add.text(camW - 25, camH - 15, '▼', {
        fontSize: '10px',
        color: '#ffcc44',
      });
      container.add(hint);

      this.dialogueBox = container;
      dialogueIndex++;

      // Click or Z to advance
      const advance = () => {
        if (!this.input.keyboard) return;
        this.input.off('pointerdown', advance);
        this.wasd.Z.off('down', advance);
        showDialogue();
      };

      this.time.delayedCall(100, () => {
        this.input.once('pointerdown', advance);
        this.wasd.Z.once('down', advance);
      });
    };

    showDialogue();
  }

  private transitionToMap(mapId: string, targetX: number, targetY: number): void {
    const state = getState();
    state.currentMapId = mapId;
    state.playerX = targetX;
    state.playerY = targetY;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.restart();
    });
  }

  private showQuickMenu(): void {
    if (this.dialogueBox) return;

    const camW = this.scale.width;
    const camH = this.scale.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0);
    container.setDepth(200);

    const bg = this.add.rectangle(camW / 2, camH / 2, 200, 180, 0x0a0a1a, 0.95);
    bg.setStrokeStyle(2, 0xffcc44);
    container.add(bg);

    const title = this.add.text(camW / 2, camH / 2 - 70, '— 選 單 —', {
      fontSize: '16px', fontFamily: 'serif', color: '#ffcc44',
    }).setOrigin(0.5);
    container.add(title);

    const state = getState();
    const options = [
      { text: '隊伍狀態', action: () => this.showTeamStatus(container) },
      { text: '靈獸圖鑑', action: () => this.showPokedex(container) },
      { text: '回復全隊', action: () => { healTeam(); this.updateInfoText(); closeMenu(); } },
      { text: '儲存遊戲', action: () => { saveGame(); closeMenu(); } },
      { text: '關閉', action: () => closeMenu() },
    ];

    options.forEach((opt, i) => {
      const btn = this.add.text(camW / 2, camH / 2 - 35 + i * 28, opt.text, {
        fontSize: '14px', color: '#ffffff',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#ffcc44'));
      btn.on('pointerout', () => btn.setColor('#ffffff'));
      btn.on('pointerdown', opt.action);
      container.add(btn);
    });

    this.dialogueBox = container;

    const closeMenu = () => {
      container.destroy();
      this.dialogueBox = null;
    };
  }

  private showTeamStatus(parentContainer: Phaser.GameObjects.Container): void {
    parentContainer.destroy();
    this.dialogueBox = null;

    const state = getState();
    const camW = this.scale.width;
    const camH = this.scale.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0);
    container.setDepth(200);

    const bg = this.add.rectangle(camW / 2, camH / 2, camW - 20, camH - 20, 0x0a0a1a, 0.95);
    bg.setStrokeStyle(2, 0xffcc44);
    container.add(bg);

    container.add(this.add.text(camW / 2, 18, '— 隊 伍 —', {
      fontSize: '14px', fontFamily: 'serif', color: '#ffcc44',
    }).setOrigin(0.5));

    state.team.forEach((m, i) => {
      const y = 40 + i * 30;
      const color = m.hp > 0 ? '#ffffff' : '#ff4444';
      const info = `${m.nickname} Lv.${m.level}　HP:${m.hp}/${m.maxHp}　攻:${m.atk} 防:${m.def} 速:${m.spd}`;
      container.add(this.add.text(20, y, info, { fontSize: '11px', color }));
    });

    const closeBtn = this.add.text(camW / 2, camH - 20, '關閉', {
      fontSize: '12px', color: '#ffcc44',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
    container.add(closeBtn);

    this.dialogueBox = container;
  }

  private showPokedex(parentContainer: Phaser.GameObjects.Container): void {
    parentContainer.destroy();
    this.dialogueBox = null;

    const state = getState();
    const camW = this.scale.width;
    const camH = this.scale.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0);
    container.setDepth(200);

    const bg = this.add.rectangle(camW / 2, camH / 2, camW - 20, camH - 20, 0x0a0a1a, 0.95);
    bg.setStrokeStyle(2, 0xffcc44);
    container.add(bg);

    container.add(this.add.text(camW / 2, 18, `— 靈獸圖鑑 ${state.caughtIds.size}/10 —`, {
      fontSize: '14px', fontFamily: 'serif', color: '#ffcc44',
    }).setOrigin(0.5));

    MONSTERS.forEach((m, i) => {
      const y = 40 + i * 22;
      const caught = state.caughtIds.has(m.id);
      const text = caught ? `${m.name}　${m.element}　${m.description}` : '？？？';
      const color = caught ? '#ffffff' : '#445566';
      container.add(this.add.text(20, y, text, { fontSize: '10px', color }));
    });

    const closeBtn = this.add.text(camW / 2, camH - 20, '關閉', {
      fontSize: '12px', color: '#ffcc44',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
    container.add(closeBtn);

    this.dialogueBox = container;
  }
}

import Phaser from 'phaser';
import { getMap, type GameMap, type MapNpc, type MapTreasure } from '../data/maps';
import { getState, saveGame, getFirstAliveIndex, healTeam, addMonsterToTeam, recalcPlayerStats, healPlayer, applyPlayerExp } from '../utils/gameState';
import { createMonsterInstance, MONSTERS, getCultivation, fuseMonsters, swapSkill, getTemplate, type MonsterInstance } from '../data/monsters';
import { healMonster, applyExp, getExpReward, generateEnemyPlayerStats, generateBossPlayerStats } from '../utils/battle';
import { findNearestWalkable } from '../utils/mapGenerator';

const TILE_SIZE = 32;
const TILE_KEYS = ['tile_grass', 'tile_wall', 'tile_tall_grass', 'tile_water', 'tile_exit', 'tile_path', 'tile_flower'];

// 視口裁切用的 buffer（上下左右各多渲染幾格）
const CULL_BUFFER = 8;

export class OverworldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private playerDir: 'down' | 'up' | 'left' | 'right' = 'down';
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private currentMap!: GameMap;
  private npcSprites: Phaser.GameObjects.Container[] = [];
  private playerTileX = 0;
  private playerTileY = 0;
  private isMoving = false;
  private isTransitioning = false;
  private moveTimer = 0;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private dialogueBox: Phaser.GameObjects.Container | null = null;
  private dialogueCooldown = 0;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private mapNameText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private gracePeriod = 0;
  private stepsSinceEncounter = 0;

  // Tile pool（視口裁切）
  private tilePool: Phaser.GameObjects.Image[] = [];
  private poolSize = 0;
  private lastCullX = -999;
  private lastCullY = -999;
  private lastCullX2 = -999;
  private lastCullY2 = -999;

  // 寶物精靈
  private treasureSprites: Phaser.GameObjects.Container[] = [];

  // 小地圖
  private minimapContainer: Phaser.GameObjects.Container | null = null;

  // window keydown 綁定（需在 shutdown 時移除）
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    super({ key: 'Overworld' });
  }

  shutdown(): void {
    if (this.boundKeyHandler) {
      window.removeEventListener('keydown', this.boundKeyHandler);
      this.boundKeyHandler = null;
    }
    this.minimapContainer = null;
  }

  create(): void {
    const state = getState();
    this.currentMap = getMap(state.currentMapId);
    this.playerTileX = state.playerX;
    this.playerTileY = state.playerY;
    this.isTransitioning = false;
    this.minimapContainer = null;

    this.initTilePool();
    this.createPlayer();
    this.createNpcs();
    this.createTreasures();
    this.setupInput();
    this.createUI();

    // 攝影機邊界
    this.cameras.main.setBackgroundColor(this.currentMap.bgColor);
    this.cameras.main.setBounds(
      0, 0,
      this.currentMap.width * TILE_SIZE,
      this.currentMap.height * TILE_SIZE,
    );

    // 首次裁切
    this.lastCullX = -999;
    this.lastCullY = -999;
    this.cullTiles();

    // 播放大地圖 BGM（如果還沒在播）
    const bgmKey = 'bgm_overworld';
    if (this.cache.audio.exists(bgmKey) && !this.sound.get(bgmKey)?.isPlaying) {
      this.sound.stopAll();
      this.sound.play(bgmKey, { loop: true, volume: 0.3 });
    }
  }

  private initTilePool(): void {
    // 清理舊 pool
    this.tilePool.forEach(s => s.destroy());
    this.tilePool = [];

    // 計算可見範圍：960/32/zoom=15 寬, 540/32/zoom=8.4 高，加 buffer
    const zoom = 2;
    const visW = Math.ceil(this.scale.width / TILE_SIZE / zoom) + CULL_BUFFER * 2 + 4;
    const visH = Math.ceil(this.scale.height / TILE_SIZE / zoom) + CULL_BUFFER * 2 + 4;
    this.poolSize = visW * visH;

    for (let i = 0; i < this.poolSize; i++) {
      const img = this.add.image(0, 0, 'tile_grass');
      img.setDisplaySize(TILE_SIZE, TILE_SIZE);
      img.setVisible(false);
      this.tilePool.push(img);
    }
  }

  private cullTiles(): void {
    const cam = this.cameras.main;
    const zoom = cam.zoom;

    // 計算攝影機左上角的 tile 座標
    const camLeft = cam.scrollX;
    const camTop = cam.scrollY;
    const camRight = camLeft + this.scale.width / zoom;
    const camBottom = camTop + this.scale.height / zoom;

    const startX = Math.max(0, Math.floor(camLeft / TILE_SIZE) - CULL_BUFFER);
    const startY = Math.max(0, Math.floor(camTop / TILE_SIZE) - CULL_BUFFER);
    const endX = Math.min(this.currentMap.width - 1, Math.ceil(camRight / TILE_SIZE) + CULL_BUFFER);
    const endY = Math.min(this.currentMap.height - 1, Math.ceil(camBottom / TILE_SIZE) + CULL_BUFFER);

    // 早退：可見範圍完全不變才跳過
    if (startX === this.lastCullX && startY === this.lastCullY &&
        endX === this.lastCullX2 && endY === this.lastCullY2) return;
    this.lastCullX = startX;
    this.lastCullY = startY;
    this.lastCullX2 = endX;
    this.lastCullY2 = endY;

    let poolIdx = 0;

    for (let y = startY; y <= endY && poolIdx < this.poolSize; y++) {
      for (let x = startX; x <= endX && poolIdx < this.poolSize; x++) {
        const tileType = this.currentMap.tiles[y]?.[x] ?? 1;
        const key = TILE_KEYS[tileType] || 'tile_grass';
        const img = this.tilePool[poolIdx];
        img.setTexture(key);
        img.setPosition(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2);
        img.setVisible(true);
        poolIdx++;
      }
    }

    // 隱藏多餘的 pool sprite
    for (let i = poolIdx; i < this.poolSize; i++) {
      this.tilePool[i].setVisible(false);
    }
  }

  private createPlayer(): void {
    this.player = this.add.sprite(
      this.playerTileX * TILE_SIZE + TILE_SIZE / 2,
      this.playerTileY * TILE_SIZE + TILE_SIZE / 2,
      'player', 0,
    );
    this.player.setDisplaySize(TILE_SIZE - 2, TILE_SIZE - 2);
    this.player.setDepth(10);
    this.player.play('player_idle_down');

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);

    // UI 專用相機：無 zoom、無 scroll，讓 UI 互動座標正確
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);

    // UI 相機忽略所有遊戲世界物件（地圖磁磚、玩家、NPC）
    this.uiCamera.ignore(this.tilePool);
    this.uiCamera.ignore(this.player);
    this.npcSprites.forEach(npc => {
      this.uiCamera.ignore(npc);
      this.uiCamera.ignore(npc.getAll());
    });
  }

  private createNpcs(): void {
    this.npcSprites.forEach(s => s.destroy());
    this.npcSprites = [];

    for (const npc of this.currentMap.npcs) {
      const container = this.add.container(
        npc.x * TILE_SIZE + TILE_SIZE / 2,
        npc.y * TILE_SIZE + TILE_SIZE / 2,
      );
      container.setDepth(5);

      // NPC 角色精靈 — 依類型載入不同圖片
      let spriteKey = 'npc_default';
      if (npc.id === 'boss') spriteKey = 'npc_boss';
      else if (npc.npcType === 'trainer') spriteKey = 'npc_trainer';
      else if (npc.npcType === 'healer') spriteKey = 'npc_healer';
      else if (npc.npcType === 'fusion') spriteKey = 'npc_fusion';
      const sprite = this.add.image(0, 0, spriteKey);
      sprite.setDisplaySize(TILE_SIZE - 2, TILE_SIZE - 2);

      // 自訂色彩覆蓋
      if (npc.spriteColor) {
        sprite.setTint(npc.spriteColor);
      }

      container.add(sprite);

      // NPC 名稱標籤
      const label = this.add.text(0, -TILE_SIZE / 2 - 2, npc.name, {
        fontSize: '10px', color: '#ffffff', align: 'center',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1);
      container.add(label);

      // NPC 類型圖示 (使用 icon 圖片)
      let iconKey = '';
      if (npc.npcType === 'healer') iconKey = 'icon_npc_heal';
      else if (npc.npcType === 'fusion') iconKey = 'icon_npc_fusion';
      else if (npc.npcType === 'trainer') iconKey = 'icon_npc_battle';

      if (iconKey) {
        const iconImg = this.add.image(TILE_SIZE / 2 - 4, -TILE_SIZE / 2 + 4, iconKey);
        iconImg.setDisplaySize(10, 10);
        container.add(iconImg);
      }

      // 死鬥中被打敗的NPC從地圖消失
      if (npc.npcType === 'trainer' && getState().defeatedDeathmatch.has(npc.id)) {
        container.setVisible(false);
      }

      this.npcSprites.push(container);
    }
  }

  private createTreasures(): void {
    this.treasureSprites.forEach(s => s.destroy());
    this.treasureSprites = [];

    const state = getState();

    for (const treasure of this.currentMap.treasures) {
      if (state.collectedTreasures.has(treasure.id)) continue;

      const container = this.add.container(
        treasure.x * TILE_SIZE + TILE_SIZE / 2,
        treasure.y * TILE_SIZE + TILE_SIZE / 2,
      );
      container.setDepth(4);

      // 光球效果
      let color = 0xffcc44;
      let radius = 5;
      if (treasure.type === 'rare_monster') { color = 0xff4488; radius = 6; }
      else if (treasure.type === 'heal') { color = 0x44ff88; radius = 5; }

      const glow = this.add.circle(0, 0, radius + 3, color, 0.2);
      container.add(glow);

      const orb = this.add.circle(0, 0, radius, color, 0.85);
      container.add(orb);

      const sparkle = this.add.circle(0, -2, 2, 0xffffff, 0.9);
      container.add(sparkle);

      // 浮動動畫
      this.tweens.add({
        targets: container, y: container.y - 4,
        duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: glow, alpha: 0.1,
        duration: 800, yoyo: true, repeat: -1,
      });

      // 記錄 treasure id 在 container data 上
      container.setData('treasureId', treasure.id);
      this.treasureSprites.push(container);
    }

    // UI 相機忽略寶物
    this.treasureSprites.forEach(t => {
      this.uiCamera.ignore(t);
      this.uiCamera.ignore(t.getAll());
    });
  }

  /** 完成 UI 容器建構後呼叫：讓主相機忽略容器及所有子物件，只由 UI 相機渲染 */
  private finalizeUI(container: Phaser.GameObjects.Container): void {
    this.cameras.main.ignore(container);
    const list = container.getAll();
    if (list.length > 0) {
      this.cameras.main.ignore(list);
    }
  }

  private createUI(): void {
    this.mapNameText = this.add.text(10, 10, this.currentMap.name, {
      fontSize: '22px', fontFamily: 'serif', color: '#ffcc44',
      backgroundColor: '#000000cc', padding: { x: 10, y: 5 },
    }).setScrollFactor(0).setDepth(100);
    this.cameras.main.ignore(this.mapNameText);

    this.infoText = this.add.text(10, 40, '', {
      fontSize: '17px', color: '#ccddee', lineSpacing: 4,
      backgroundColor: '#000000cc', padding: { x: 8, y: 5 },
    }).setScrollFactor(0).setDepth(100);
    this.cameras.main.ignore(this.infoText);

    this.updateInfoText();

    // 操作提示 — 右上角
    const hints = [
      this.add.text(this.scale.width - 10, 10, '方向鍵/WASD 移動 ｜ 滑鼠點擊互動', {
        fontSize: '13px', color: '#667788',
        backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(100),

      this.add.text(this.scale.width - 10, 26, 'Z/Space 對話 ｜ M 地圖 ｜ B/ESC 選單', {
        fontSize: '13px', color: '#667788',
        backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(100),
    ];
    hints.forEach(h => this.cameras.main.ignore(h));
  }

  private updateInfoText(): void {
    const state = getState();
    if (state.team.length === 0) return;
    const alive = state.team.filter(m => m.hp > 0).length;
    const lead = state.team[0];
    const cult = getCultivation(lead.level);
    const pc = state.playerCombat;
    let methodInfo = `人類Lv.${pc.level} HP:${pc.hp}/${pc.maxHp}`;
    if (state.cultivationMethod === '萬靈化型變') {
      methodInfo = `見過：${state.seenMonsterIds.size}種 人類Lv.${pc.level}`;
    }
    this.infoText.setText(
      `${lead.nickname} ${cult.displayName}　隊伍：${alive}/${state.team.length}(上限6)　圖鑑：${state.caughtIds.size}/10\n` +
      `[${state.cultivationMethod}] ${methodInfo}`
    );
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
      B: this.input.keyboard.addKey('B'),
    };
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    // 先移除舊的 handler（scene.restart 時避免重複綁定）
    if (this.boundKeyHandler) {
      window.removeEventListener('keydown', this.boundKeyHandler);
    }

    // 統一使用 window keydown，避免 Phaser addKey 和 window 事件雙觸發
    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (!this.scene.isActive()) return;

      // M 鍵地圖：即使對話中也不影響（獨立處理）
      if (e.code === 'KeyM') {
        e.preventDefault();
        this.toggleMinimap();
        return;
      }

      // 小地圖打開時，ESC 也關閉小地圖
      if (this.minimapContainer) {
        if (e.code === 'Escape') {
          e.preventDefault();
          this.toggleMinimap();
        }
        return;
      }

      // 對話/選單打開時，不觸發 interact 和 menu
      if (this.dialogueBox || this.dialogueCooldown > 0) return;

      if (e.code === 'KeyZ' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.interact();
      } else if (e.code === 'KeyB' || e.code === 'Escape') {
        e.preventDefault();
        this.showQuickMenu();
      }
    };
    window.addEventListener('keydown', this.boundKeyHandler);
  }

  update(_time: number, delta: number): void {
    this.cullTiles();
    if (this.dialogueCooldown > 0) this.dialogueCooldown -= delta;
    if (this.dialogueBox || this.isMoving || this.isTransitioning) return;

    this.moveTimer -= delta;
    if (this.moveTimer > 0) return;

    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -1;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = 1;
    else if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -1;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = 1;

    if (dx === 0 && dy === 0) {
      // 停止移動時切換到靜止幀
      if (this.player.anims.isPlaying) {
        this.player.play(`player_idle_${this.playerDir}`);
      }
      return;
    }

    // 更新方向
    if (dx === -1) this.playerDir = 'left';
    else if (dx === 1) this.playerDir = 'right';
    else if (dy === -1) this.playerDir = 'up';
    else if (dy === 1) this.playerDir = 'down';

    const newX = this.playerTileX + dx;
    const newY = this.playerTileY + dy;

    if (newX < 0 || newY < 0 || newX >= this.currentMap.width || newY >= this.currentMap.height) return;

    const npcAt = this.currentMap.npcs.find(n => n.x === newX && n.y === newY);
    if (npcAt) return;

    const tile = this.currentMap.tiles[newY][newX];
    if (tile === 1 || tile === 3) return;

    this.isMoving = true;
    this.playerTileX = newX;
    this.playerTileY = newY;

    // 播放行走動畫
    const walkAnim = `player_walk_${this.playerDir}`;
    if (this.player.anims.currentAnim?.key !== walkAnim) {
      this.player.play(walkAnim);
    }

    const state = getState();
    state.playerX = newX;
    state.playerY = newY;

    const isSprinting = this.shiftKey.isDown;
    const moveDuration = isSprinting ? 50 : 120;

    this.tweens.add({
      targets: this.player,
      x: newX * TILE_SIZE + TILE_SIZE / 2,
      y: newY * TILE_SIZE + TILE_SIZE / 2,
      duration: moveDuration,
      onComplete: () => {
        this.isMoving = false;
        this.checkTile(newX, newY);
      },
    });

    this.moveTimer = isSprinting ? 10 : 50;
  }

  private checkTile(x: number, y: number): void {
    const tile = this.currentMap.tiles[y][x];

    if (tile === 4) {
      const exit = this.currentMap.exits.find(e => e.x === x && e.y === y);
      if (exit) {
        this.transitionToMap(exit.targetMap, exit.targetX, exit.targetY);
        return;
      }
    }

    // 寶物拾取
    this.checkTreasurePickup(x, y);

    if (tile === 2) {
      if (this.gracePeriod > 0) {
        this.gracePeriod--;
        return;
      }
      this.stepsSinceEncounter++;
      const baseRate = this.currentMap.encounterRate;
      const scaledRate = baseRate * Math.min(1, this.stepsSinceEncounter / 8);
      const roll = Math.random() * 100;
      if (roll < scaledRate) {
        this.stepsSinceEncounter = 0;
        this.triggerWildEncounter();
      }
    }
  }

  private checkTreasurePickup(x: number, y: number): void {
    const state = getState();
    const treasure = this.currentMap.treasures.find(
      t => t.x === x && t.y === y && !state.collectedTreasures.has(t.id),
    );
    if (!treasure) return;

    state.collectedTreasures.add(treasure.id);

    // 移除精靈
    const spriteIdx = this.treasureSprites.findIndex(s => s.getData('treasureId') === treasure.id);
    if (spriteIdx >= 0) {
      const sprite = this.treasureSprites[spriteIdx];
      // 拾取特效
      this.tweens.add({
        targets: sprite, y: sprite.y - 30, alpha: 0,
        duration: 400, onComplete: () => sprite.destroy(),
      });
      this.treasureSprites.splice(spriteIdx, 1);
    }

    if (treasure.type === 'exp') {
      // 經驗分配給全隊
      const amount = treasure.amount || 100;
      const perMon = Math.floor(amount / Math.max(1, state.team.length));
      const levelUps: string[] = [];
      for (const m of state.team) {
        if (m.hp <= 0) continue;
        const result = applyExp(m, perMon);
        if (result.leveled) {
          levelUps.push(`${m.nickname} 突破至 ${getCultivation(result.newLevel).displayName}！`);
        }
      }
      const msg = levelUps.length > 0
        ? `拾取了${treasure.label}！全隊獲得 ${amount} EXP\n${levelUps[levelUps.length - 1]}`
        : `拾取了${treasure.label}！全隊獲得 ${amount} EXP`;
      this.showNotification(msg, 0xffcc44);
      this.updateInfoText();

    } else if (treasure.type === 'rare_monster') {
      // 觸發稀有靈獸戰鬥
      if (getFirstAliveIndex() === -1) return;
      const wildMonster = createMonsterInstance(treasure.monsterId!, treasure.monsterLevel!);
      this.showNotification(treasure.label, 0xff4488);
      this.cameras.main.flash(400, 255, 100, 200);
      this.time.delayedCall(500, () => {
        this.scene.launch('Battle', {
          type: 'wild',
          enemies: [wildMonster],
          onEnd: () => {
            this.gracePeriod = 10;
            this.stepsSinceEncounter = 0;
            this.updateInfoText();
          },
        });
        this.scene.pause();
      });

    } else if (treasure.type === 'heal') {
      healTeam();
      healPlayer();
      this.updateInfoText();
      this.showNotification(`發現了${treasure.label}！全隊完全恢復！`, 0x44ff88);
    }
  }

  private triggerWildEncounter(): void {
    if (getFirstAliveIndex() === -1) return;

    const totalWeight = this.currentMap.wildEncounters.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    let encounter = this.currentMap.wildEncounters[0];

    for (const e of this.currentMap.wildEncounters) {
      roll -= e.weight;
      if (roll <= 0) { encounter = e; break; }
    }

    const level = encounter.minLevel + Math.floor(Math.random() * (encounter.maxLevel - encounter.minLevel + 1));
    const wildMonster = createMonsterInstance(encounter.monsterId, level);

    this.cameras.main.flash(300, 255, 255, 255);

    this.time.delayedCall(300, () => {
      this.scene.launch('Battle', {
        type: 'wild',
        enemies: [wildMonster],
        onEnd: () => {
          this.gracePeriod = 8 + Math.floor(Math.random() * 5);
          this.stepsSinceEncounter = 0;
          this.updateInfoText();
        },
      });
      this.scene.pause();
    });
  }

  private interact(): void {
    // 如果已在對話/選單中，或對話剛結束的冷卻期，不要重複觸發
    if (this.dialogueBox || this.dialogueCooldown > 0) return;

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
    // 用於防止 setupInput 的 Z/Space/Enter 和對話 keydown 雙重觸發
    let dialogueActive = false;
    let currentCleanup: (() => void) | null = null;

    const showDialogue = () => {
      // 先清理上一頁的事件
      if (currentCleanup) {
        currentCleanup();
        currentCleanup = null;
      }

      if (this.dialogueBox) {
        this.dialogueBox.destroy();
        this.dialogueBox = null;
      }

      if (dialogueIndex >= npc.dialogue.length) {
        // 對話完全結束 — 設定 300ms 冷卻防止同一按鍵又觸發 interact
        dialogueActive = false;
        this.dialogueCooldown = 300;
        state.talkedNpcs.add(npc.id);
        this.time.delayedCall(50, () => {
          this.handleNpcAction(npc);
        });
        return;
      }

      dialogueActive = true;
      const boxH = 80;
      const camW = this.scale.width;
      const camH = this.scale.height;
      const isLast = dialogueIndex === npc.dialogue.length - 1;

      const container = this.add.container(0, 0);
      container.setScrollFactor(0).setDepth(200);

      // 對話框背景
      const bg = this.add.rectangle(camW / 2, camH - boxH / 2 - 4, camW - 16, boxH, 0x0a0a1a, 0.95);
      bg.setStrokeStyle(2, 0xffcc44);
      container.add(bg);

      // 內框裝飾線
      const inner = this.add.rectangle(camW / 2, camH - boxH / 2 - 4, camW - 24, boxH - 8, 0x000000, 0);
      inner.setStrokeStyle(1, 0x334455);
      container.add(inner);

      // NPC 頭像
      const isBossNpc = npc.id === 'boss';
      let npcSpriteKey = 'npc_default';
      if (isBossNpc) npcSpriteKey = 'boss_dialogue';
      else if (npc.npcType === 'trainer') npcSpriteKey = 'npc_trainer';
      else if (npc.npcType === 'healer') npcSpriteKey = 'npc_healer';
      else if (npc.npcType === 'fusion') npcSpriteKey = 'npc_fusion';

      const portraitSize = isBossNpc ? 52 : 32;
      const portrait = this.add.image(28, camH - boxH / 2 - 4, npcSpriteKey);
      portrait.setDisplaySize(portraitSize, portraitSize);
      container.add(portrait);

      // NPC 名稱
      const nameLabel = this.add.text(12, camH - boxH - 10, npc.name, {
        fontSize: '15px', color: '#ffcc44', fontStyle: 'bold',
        backgroundColor: '#0a0a1a', padding: { x: 4, y: 1 },
      });
      container.add(nameLabel);

      // NPC 類型標籤
      let typeTag = '';
      if (isBossNpc) typeTag = '[幽都之主]';
      else if (npc.npcType === 'healer') typeTag = '[治療]';
      else if (npc.npcType === 'fusion') typeTag = '[練妖壺]';
      else if (npc.npcType === 'trainer') typeTag = '[對戰]';
      if (typeTag) {
        container.add(this.add.text(nameLabel.x + nameLabel.width + 6, camH - boxH - 10, typeTag, {
          fontSize: '13px', color: '#88aacc', backgroundColor: '#0a0a1a', padding: { x: 2, y: 2 },
        }));
      }

      // 對話文字 — 打字機效果
      const fullText = npc.dialogue[dialogueIndex];
      const textObj = this.add.text(52, camH - boxH + 10, '', {
        fontSize: '16px', color: '#ffffff', lineSpacing: 4,
        wordWrap: { width: camW - 80 },
      });
      container.add(textObj);

      let charIdx = 0;
      let typewriterDone = false;
      let advancing = false; // 防止同一幀多次 advance

      const typeTimer = this.time.addEvent({
        delay: 25,
        repeat: fullText.length - 1,
        callback: () => {
          charIdx++;
          textObj.setText(fullText.substring(0, charIdx));
          if (charIdx >= fullText.length) {
            typewriterDone = true;
            showHint();
          }
        },
      });

      // 推進提示
      const showHint = () => {
        if (!container.active) return;
        const hintText = isLast ? '[Z / Space] 結束對話' : '[Z / Space] 繼續 >>';
        const hintColor = isLast ? '#88aacc' : '#ffcc44';
        const hint = this.add.text(camW - 16, camH - 12, hintText, {
          fontSize: '13px', color: hintColor,
        }).setOrigin(1, 0.5);
        container.add(hint);
        this.tweens.add({
          targets: hint, alpha: 0.3, duration: 500,
          yoyo: true, repeat: -1,
        });
      };

      this.dialogueBox = container;
      this.finalizeUI(container);
      dialogueIndex++;

      // 推進邏輯 — 用 advancing flag 防止同一幀多次觸發
      const advance = () => {
        if (advancing || !dialogueActive) return;

        if (!typewriterDone) {
          // 打字未完成 → 直接顯示全文
          typeTimer.remove();
          charIdx = fullText.length;
          textObj.setText(fullText);
          typewriterDone = true;
          showHint();
          // 短暫鎖定防止跳過
          advancing = true;
          this.time.delayedCall(200, () => { advancing = false; });
          return;
        }

        advancing = true;
        showDialogue();
      };

      // 使用 scene 級別的 keydown 事件（不用 addKey 避免和 setupInput 衝突）
      const onKey = (event: KeyboardEvent) => {
        if (event.code === 'KeyZ' || event.code === 'Space' || event.code === 'Enter') {
          event.preventDefault();
          advance();
        }
      };
      const onPointer = () => advance();

      // 延遲綁定，避免開啟對話的那次按鍵同時觸發推進
      this.time.delayedCall(100, () => {
        if (!dialogueActive || !container.active) return;
        window.addEventListener('keydown', onKey);
        this.input.on('pointerdown', onPointer);
      });

      currentCleanup = () => {
        window.removeEventListener('keydown', onKey);
        this.input.off('pointerdown', onPointer);
      };
    };

    showDialogue();
  }

  private handleNpcAction(npc: MapNpc): void {
    const state = getState();

    switch (npc.npcType) {
      case 'healer':
        healTeam();
        healPlayer();
        this.updateInfoText();
        this.showNotification('所有靈獸及人類已完全恢復！', 0x44ff88);
        break;

      case 'fusion':
        this.showFusionMenu();
        break;

      case 'trainer':
        if (npc.team && !state.defeatedTrainers.has(npc.id)) {
          if (npc.id === 'boss') {
            this.launchBossBattle(npc);
          } else {
            this.showBattleTypeChoice(npc);
          }
        } else if (npc.team && state.defeatedTrainers.has(npc.id)) {
          this.showNotification('你已經打敗過這個對手了。', 0xaabbcc);
        }
        break;
    }
  }

  private showBattleTypeChoice(npc: MapNpc): void {
    if (this.dialogueBox) return;
    const camW = this.scale.width;
    const camH = this.scale.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0).setDepth(200);

    const bg = this.add.rectangle(camW / 2, camH / 2, 240, 120, 0x0a0a1a, 0.95);
    bg.setStrokeStyle(2, 0xffcc44);
    container.add(bg);

    container.add(this.add.text(camW / 2, camH / 2 - 40, '選擇對戰方式', {
      fontSize: '18px', fontFamily: 'serif', color: '#ffcc44',
    }).setOrigin(0.5));

    const launchBattle = (type: 'trainer' | 'deathmatch') => {
      container.destroy();
      this.dialogueBox = null;
      const enemies = npc.team!.map(t => createMonsterInstance(t.monsterId, t.level));
      this.cameras.main.flash(300, 255, 100, 100);
      this.time.delayedCall(300, () => {
        const data: Record<string, unknown> = {
          type,
          trainerName: npc.name,
          trainerId: npc.id,
          enemies,
          onEnd: () => {
            this.gracePeriod = 10;
            this.stepsSinceEncounter = 0;
            this.updateInfoText();
            // 死鬥勝利後隱藏NPC精靈
            if (type === 'deathmatch' && getState().defeatedDeathmatch.has(npc.id)) {
              const npcIdx = this.currentMap.npcs.indexOf(npc);
              if (npcIdx >= 0 && this.npcSprites[npcIdx]) {
                this.npcSprites[npcIdx].setVisible(false);
              }
            }
          },
        };
        if (type === 'deathmatch') {
          data.enemyPlayerStats = generateEnemyPlayerStats(enemies);
        }
        this.scene.launch('Battle', data);
        this.scene.pause();
      });
    };

    const normalBtn = this.add.text(camW / 2 - 60, camH / 2, '【普通對戰】', {
      fontSize: '17px', color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    normalBtn.on('pointerover', () => normalBtn.setColor('#ffcc44'));
    normalBtn.on('pointerout', () => normalBtn.setColor('#ffffff'));
    normalBtn.on('pointerdown', () => launchBattle('trainer'));
    container.add(normalBtn);

    const deathBtn = this.add.text(camW / 2 + 60, camH / 2, '【死　鬥】', {
      fontSize: '17px', color: '#ff4444',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    deathBtn.on('pointerover', () => deathBtn.setColor('#ffcc44'));
    deathBtn.on('pointerout', () => deathBtn.setColor('#ff4444'));
    deathBtn.on('pointerdown', () => launchBattle('deathmatch'));
    container.add(deathBtn);

    container.add(this.add.text(camW / 2, camH / 2 + 25, '死鬥：人+寵同時出戰，敗者失去所有靈寵', {
      fontSize: '11px', color: '#ff6666',
    }).setOrigin(0.5));

    const cancelBtn = this.add.text(camW / 2, camH / 2 + 45, '取消', {
      fontSize: '15px', color: '#667788',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
    container.add(cancelBtn);

    this.dialogueBox = container;
    this.finalizeUI(container);
  }

  private launchBossBattle(npc: MapNpc): void {
    const enemies = npc.team!.map(t => createMonsterInstance(t.monsterId, t.level));
    this.cameras.main.flash(500, 200, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.launch('Battle', {
        type: 'deathmatch',
        trainerName: npc.name,
        trainerId: npc.id,
        enemies,
        isBoss: true,
        enemyPlayerStats: generateBossPlayerStats(enemies),
        onEnd: () => {
          this.gracePeriod = 10;
          this.stepsSinceEncounter = 0;
          this.updateInfoText();
          if (getState().defeatedDeathmatch.has(npc.id)) {
            const npcIdx = this.currentMap.npcs.indexOf(npc);
            if (npcIdx >= 0 && this.npcSprites[npcIdx]) {
              this.npcSprites[npcIdx].setVisible(false);
            }
          }
        },
      });
      this.scene.pause();
    });
  }

  private showNotification(msg: string, color: number): void {
    const camW = this.scale.width;
    const text = this.add.text(camW / 2, 60, msg, {
      fontSize: '17px', color: '#' + color.toString(16).padStart(6, '0'),
      backgroundColor: '#000000cc', padding: { x: 10, y: 6 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
    this.cameras.main.ignore(text);

    this.tweens.add({
      targets: text,
      alpha: 0, y: 40,
      duration: 1500, delay: 800,
      onComplete: () => text.destroy(),
    });
  }

  // ═══════════════════════════════════
  //  練妖壺 融合介面
  // ═══════════════════════════════════
  private showFusionMenu(): void {
    const state = getState();
    if (state.team.length < 2) {
      this.showNotification('需要至少兩隻靈獸才能融合！', 0xff4444);
      return;
    }

    const camW = this.scale.width;
    const camH = this.scale.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0).setDepth(200);

    const bg = this.add.rectangle(camW / 2, camH / 2, camW - 10, camH - 10, 0x0a0a1a, 0.95);
    bg.setStrokeStyle(2, 0xff8844);
    container.add(bg);

    container.add(this.add.text(camW / 2, 15, '— 練 妖 壺 —', {
      fontSize: '18px', fontFamily: 'serif', color: '#ff8844',
    }).setOrigin(0.5));

    container.add(this.add.text(camW / 2, 32, '選擇兩隻靈獸進行融合（將被消耗）', {
      fontSize: '13px', color: '#aa8866',
    }).setOrigin(0.5));

    let selectedA: number | null = null;
    let selectedB: number | null = null;
    const buttons: Phaser.GameObjects.Text[] = [];

    const updateSelection = () => {
      buttons.forEach((btn, i) => {
        if (i === selectedA) btn.setColor('#ff8844');
        else if (i === selectedB) btn.setColor('#44aaff');
        else btn.setColor('#ffffff');
      });

      if (selectedA !== null && selectedB !== null) {
        fuseBtn.setColor('#ffcc44').setInteractive({ useHandCursor: true });
      } else {
        fuseBtn.setColor('#555555').removeInteractive();
      }
    };

    state.team.forEach((m, i) => {
      const y = 48 + i * 22;
      const cult = getCultivation(m.level);
      const shinyTag = m.isShiny ? '[異]' : '';
      const fusedTag = m.isFused ? '融' : '';
      const info = `${shinyTag}${fusedTag}${m.nickname} ${cult.displayName} HP:${m.hp}/${m.maxHp} 攻:${m.atk}`;
      const btn = this.add.text(15, y, info, { fontSize: '14px', color: '#ffffff' })
        .setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        if (selectedA === i) { selectedA = null; }
        else if (selectedB === i) { selectedB = null; }
        else if (selectedA === null) { selectedA = i; }
        else if (selectedB === null) { selectedB = i; }
        else { selectedB = i; }
        updateSelection();
      });

      buttons.push(btn);
      container.add(btn);
    });

    // 融合按鈕
    const fuseBtn = this.add.text(camW / 2, camH - 42, '【 融 合 】', {
      fontSize: '17px', color: '#555555', fontStyle: 'bold',
    }).setOrigin(0.5);

    fuseBtn.on('pointerdown', () => {
      if (selectedA === null || selectedB === null) return;
      const monA = state.team[selectedA];
      const monB = state.team[selectedB];

      // 執行融合
      const result = fuseMonsters(monA, monB);

      // 移除素材（先移除較大 index）
      const [hi, lo] = selectedA > selectedB ? [selectedA, selectedB] : [selectedB, selectedA];
      state.team.splice(hi, 1);
      state.team.splice(lo, 1);

      // 加入融合結果
      state.team.push(result);
      state.caughtIds.add(result.templateId);

      container.destroy();
      this.dialogueBox = null;
      this.updateInfoText();

      // 融合結果通知
      const shinyMsg = result.isShiny ? '\n恭喜！煉出了異色珍品！' : '';
      this.showFusionResult(result, shinyMsg);
    });

    container.add(fuseBtn);

    const closeBtn = this.add.text(camW / 2, camH - 22, '取消', {
      fontSize: '14px', color: '#889999',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
    container.add(closeBtn);

    this.dialogueBox = container;
    this.finalizeUI(container);
  }

  private showFusionResult(monster: MonsterInstance, extraMsg: string): void {
    const camW = this.scale.width;
    const camH = this.scale.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0).setDepth(200);

    const bg = this.add.rectangle(camW / 2, camH / 2, camW - 30, 160, 0x0a0a1a, 0.95);
    bg.setStrokeStyle(2, monster.isShiny ? 0xffcc44 : 0xff8844);
    container.add(bg);

    container.add(this.add.text(camW / 2, camH / 2 - 60, '融合成功！', {
      fontSize: '22px', color: '#ff8844', fontStyle: 'bold',
    }).setOrigin(0.5));

    // 靈獸圖片
    const sprite = this.add.image(camW / 2, camH / 2 - 20, `monster_${monster.templateId}`);
    sprite.setDisplaySize(48, 48);
    if (monster.isShiny) sprite.setTint(0xffdd88);
    container.add(sprite);

    const cult = getCultivation(monster.level);
    const info = `${monster.nickname} ${cult.displayName}\nHP:${monster.maxHp} 攻:${monster.atk} 防:${monster.def} 速:${monster.spd}`;
    container.add(this.add.text(camW / 2, camH / 2 + 20, info, {
      fontSize: '15px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5));

    const skills = monster.skills.map(s => s.skill.name).join('、');
    container.add(this.add.text(camW / 2, camH / 2 + 48, `技能：${skills}`, {
      fontSize: '13px', color: '#aabbcc', align: 'center',
      wordWrap: { width: camW - 60 },
    }).setOrigin(0.5));

    if (extraMsg) {
      container.add(this.add.text(camW / 2, camH / 2 + 65, extraMsg, {
        fontSize: '15px', color: '#ffcc44', fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    const closeBtn = this.add.text(camW / 2, camH / 2 + 82, '確認', {
      fontSize: '16px', color: '#ffcc44',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
    container.add(closeBtn);

    this.dialogueBox = container;
    this.finalizeUI(container);
  }

  private transitionToMap(mapId: string, targetX: number, targetY: number): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    // 預載目標地圖，用 findNearestWalkable 確保落點可行走
    const targetMap = getMap(mapId);
    const safePos = findNearestWalkable(
      targetMap.tiles, targetMap.width, targetMap.height,
      { x: targetX, y: targetY }, false,
    );

    const state = getState();
    state.currentMapId = mapId;
    state.playerX = safePos.x;
    state.playerY = safePos.y;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.restart();
    });
  }

  // ═══════════════════════════════════
  //  小地圖
  // ═══════════════════════════════════
  private toggleMinimap(): void {
    if (this.minimapContainer) {
      this.minimapContainer.destroy();
      this.minimapContainer = null;
      return;
    }

    const camW = this.scale.width;
    const camH = this.scale.height;
    const map = this.currentMap;

    // 計算縮放比例，讓地圖填滿面板（留 padding）
    const panelW = camW - 40;
    const panelH = camH - 60;
    const scale = Math.min(panelW / map.width, panelH / map.height);
    const mapDrawW = Math.floor(map.width * scale);
    const mapDrawH = Math.floor(map.height * scale);
    const offsetX = Math.floor((camW - mapDrawW) / 2);
    const offsetY = Math.floor((camH - mapDrawH) / 2) + 10;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0).setDepth(250);

    // 半透明背景
    const bg = this.add.rectangle(camW / 2, camH / 2, camW, camH, 0x000000, 0.85);
    container.add(bg);

    // 標題
    container.add(this.add.text(camW / 2, 8, `${map.name} — 地圖`, {
      fontSize: '17px', fontFamily: 'serif', color: '#ffcc44',
    }).setOrigin(0.5));

    // 用 RenderTexture 繪製地圖
    const rt = this.add.renderTexture(offsetX, offsetY, mapDrawW, mapDrawH);
    rt.setOrigin(0, 0);

    // 色彩對照表
    const tileColors: Record<number, number> = {
      0: 0x4a8c3f, // 草地
      1: 0x555555, // 牆壁
      2: 0x2d6b1e, // 高草
      3: 0x2244aa, // 水
      4: 0xffcc44, // 出口
      5: 0x998866, // 石板路
      6: 0xff88cc, // 花
    };

    // 繪製像素地圖
    const pixelSize = Math.max(1, Math.floor(scale));
    const gfx = this.make.graphics({ x: 0, y: 0 });

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tileType = map.tiles[y]?.[x] ?? 1;
        const color = tileColors[tileType] ?? 0x000000;
        gfx.fillStyle(color);
        gfx.fillRect(
          Math.floor(x * scale),
          Math.floor(y * scale),
          pixelSize, pixelSize,
        );
      }
    }

    // NPC 標記
    for (const npc of map.npcs) {
      let npcColor = 0xffffff;
      if (npc.npcType === 'healer') npcColor = 0x44ff88;
      else if (npc.npcType === 'trainer') npcColor = 0xff4444;
      else if (npc.npcType === 'fusion') npcColor = 0xff8844;
      gfx.fillStyle(npcColor);
      const nx = Math.floor(npc.x * scale);
      const ny = Math.floor(npc.y * scale);
      gfx.fillRect(nx - 1, ny - 1, 3, 3);
    }

    // 玩家位置（閃爍亮點）
    gfx.fillStyle(0x00ffff);
    const px = Math.floor(this.playerTileX * scale);
    const py = Math.floor(this.playerTileY * scale);
    gfx.fillRect(px - 1, py - 1, 3, 3);

    rt.draw(gfx);
    gfx.destroy();
    container.add(rt);

    // 玩家閃爍標記（覆蓋在 rt 上方）
    const playerDot = this.add.circle(offsetX + px, offsetY + py, 3, 0x00ffff);
    container.add(playerDot);
    this.tweens.add({
      targets: playerDot, alpha: 0.2,
      duration: 400, yoyo: true, repeat: -1,
    });

    // 圖例
    const legendY = offsetY + mapDrawH + 6;
    const legends = [
      { color: '#4a8c3f', label: '草地' },
      { color: '#2d6b1e', label: '高草' },
      { color: '#998866', label: '路' },
      { color: '#2244aa', label: '水' },
      { color: '#ffcc44', label: '出口' },
      { color: '#00ffff', label: '你' },
    ];
    legends.forEach((leg, i) => {
      const lx = 20 + i * 70;
      container.add(this.add.rectangle(lx, legendY, 8, 8, parseInt(leg.color.replace('#', '0x'))).setOrigin(0, 0.5));
      container.add(this.add.text(lx + 12, legendY, leg.label, {
        fontSize: '11px', color: '#aabbcc',
      }).setOrigin(0, 0.5));
    });

    // 關閉提示
    container.add(this.add.text(camW / 2, camH - 16, '按 M 或點擊關閉', {
      fontSize: '11px', color: '#667788',
    }).setOrigin(0.5));

    // 點擊關閉
    bg.setInteractive();
    bg.on('pointerdown', () => this.toggleMinimap());

    this.minimapContainer = container;
    this.finalizeUI(container);
  }

  // ═══════════════════════════════════
  //  選單系統
  // ═══════════════════════════════════
  private showQuickMenu(): void {
    if (this.dialogueBox) return;

    const camW = this.scale.width;
    const camH = this.scale.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0).setDepth(200);

    const bg = this.add.rectangle(camW / 2, camH / 2, 220, 310, 0x0a0a1a, 0.95);
    bg.setStrokeStyle(2, 0xffcc44);
    container.add(bg);

    container.add(this.add.text(camW / 2, camH / 2 - 80, '— 選 單 —', {
      fontSize: '22px', fontFamily: 'serif', color: '#ffcc44',
    }).setOrigin(0.5));

    const options = [
      { icon: 'icon_backpack', text: '靈獸背包', action: () => this.showBackpack(container) },
      { icon: 'icon_absorb', text: '練化互吃', action: () => this.showAbsorptionMenu(container) },
      { icon: 'icon_absorb', text: '練妖壺', action: () => { container.destroy(); this.dialogueBox = null; this.showFusionMenu(); } },
      { icon: 'icon_pokedex', text: '靈獸圖鑑', action: () => this.showPokedex(container) },
      { icon: 'icon_skill', text: '獨斷萬古', action: () => { this.debugGrantExp(container); } },
      { icon: 'icon_skill', text: '傾刻煉化', action: () => { this.debugBoostPlayer(container); } },
      { icon: 'icon_save', text: '儲存遊戲', action: () => { saveGame(); closeMenu(); this.showNotification('遊戲已儲存！', 0x44aaff); } },
      { icon: 'icon_close', text: '返回遊戲', action: () => closeMenu() },
    ];

    options.forEach((opt, i) => {
      const y = camH / 2 - 42 + i * 28;
      // 圖示
      const icon = this.add.image(camW / 2 - 70, y, opt.icon);
      icon.setDisplaySize(16, 16);
      container.add(icon);
      // 文字
      const btn = this.add.text(camW / 2 - 52, y, opt.text, {
        fontSize: '17px', color: '#ffffff',
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => { btn.setColor('#ffcc44'); icon.setTint(0xffcc44); });
      btn.on('pointerout', () => { btn.setColor('#ffffff'); icon.clearTint(); });
      btn.on('pointerdown', opt.action);
      // 讓圖示也可點擊
      icon.setInteractive({ useHandCursor: true });
      icon.on('pointerdown', opt.action);
      container.add(btn);
    });

    this.dialogueBox = container;
    this.finalizeUI(container);

    const closeMenu = () => {
      container.destroy();
      this.dialogueBox = null;
    };
  }

  // ═══════════════════════════════════
  //  獨斷萬古（測試用：全隊+本人 +99999 EXP）
  // ═══════════════════════════════════
  private debugGrantExp(parentContainer: Phaser.GameObjects.Container): void {
    const state = getState();
    const results: string[] = [];
    for (const m of state.team) {
      const oldLv = m.level;
      let remaining = 99999;
      while (remaining > 0 && m.level < 42) {
        const chunk = Math.min(remaining, 9999);
        applyExp(m, chunk);
        remaining -= chunk;
      }
      results.push(m.level > oldLv ? `${m.nickname} Lv.${oldLv}→${m.level}` : `${m.nickname} Lv.${m.level}(滿)`);
    }
    // 本人也獲得經驗
    const oldPlayerLv = state.playerCombat.level;
    let remaining = 99999;
    while (remaining > 0 && state.playerCombat.level < 42) {
      const chunk = Math.min(remaining, 9999);
      applyPlayerExp(chunk);
      remaining -= chunk;
    }
    const playerMsg = state.playerCombat.level > oldPlayerLv
      ? `本人 Lv.${oldPlayerLv}→${state.playerCombat.level}`
      : `本人 Lv.${state.playerCombat.level}(滿)`;
    parentContainer.destroy();
    this.dialogueBox = null;
    this.showNotification(`獨斷萬古！\n${results.join(' ')}\n${playerMsg}`, 0xff4488);
  }

  // ═══════════════════════════════════
  //  傾刻煉化（測試用：本人全屬性 +9999）
  // ═══════════════════════════════════
  private debugBoostPlayer(parentContainer: Phaser.GameObjects.Container): void {
    const state = getState();
    const pc = state.playerCombat;
    pc.maxHp += 9999; pc.hp = pc.maxHp;
    pc.atk += 9999;
    pc.def += 9999;
    pc.spd += 9999;
    parentContainer.destroy();
    this.dialogueBox = null;
    this.showNotification(
      `傾刻煉化！本人屬性暴漲！\nHP:${pc.hp} 攻:${pc.atk} 防:${pc.def} 速:${pc.spd}`,
      0xff2222,
    );
  }

  // ═══════════════════════════════════
  //  靈獸背包 (詳細養成資訊)
  // ═══════════════════════════════════
  private showBackpack(parentContainer: Phaser.GameObjects.Container): void {
    parentContainer.destroy();
    this.dialogueBox = null;

    const state = getState();
    const camW = this.scale.width;
    const camH = this.scale.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0).setDepth(200);

    const bg = this.add.rectangle(camW / 2, camH / 2, camW - 10, camH - 10, 0x0a0a1a, 0.95);
    bg.setStrokeStyle(2, 0xffcc44);
    container.add(bg);

    container.add(this.add.text(camW / 2, 12, '— 靈 獸 背 包 —', {
      fontSize: '17px', fontFamily: 'serif', color: '#ffcc44',
    }).setOrigin(0.5));

    // 顯示每隻靈獸
    state.team.forEach((m, i) => {
      const startY = 28 + i * 36;
      const cult = getCultivation(m.level);
      const hpColor = m.hp > 0 ? '#ffffff' : '#ff4444';

      // 靈獸小圖
      const sprite = this.add.image(22, startY + 10, `monster_${m.templateId}`);
      sprite.setDisplaySize(24, 24);
      if (m.isShiny) sprite.setTint(0xffdd88);
      container.add(sprite);

      // 名稱 + 境界
      const shinyTag = m.isShiny ? '[異]' : '';
      const fusedTag = m.isFused ? '[融]' : '';
      container.add(this.add.text(38, startY, `${shinyTag}${fusedTag}${m.nickname}`, {
        fontSize: '14px', color: hpColor, fontStyle: 'bold',
      }));

      container.add(this.add.text(38, startY + 12, `${cult.displayName}`, {
        fontSize: '13px', color: cult.color,
      }));

      // 素質
      container.add(this.add.text(camW / 2 + 10, startY, `HP:${m.hp}/${m.maxHp}`, {
        fontSize: '13px', color: hpColor,
      }));
      container.add(this.add.text(camW / 2 + 10, startY + 11, `攻:${m.atk} 防:${m.def} 速:${m.spd}`, {
        fontSize: '11px', color: '#889999',
      }));

      // 經驗值
      const expNeeded = m.level <= 30 ? m.level * 20 + 10 : m.level * 40;
      container.add(this.add.text(camW / 2 + 10, startY + 22, `EXP:${m.exp}/${expNeeded}`, {
        fontSize: '11px', color: '#667788',
      }));

      // 點擊查看技能詳情
      const detailBtn = this.add.text(camW - 20, startY + 10, '▶', {
        fontSize: '16px', color: '#667788',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      detailBtn.on('pointerdown', () => this.showMonsterDetail(container, m));
      container.add(detailBtn);
    });

    // 隊伍靈獸：存入倉庫按鈕
    if (state.storage.length > 0 || state.team.length > 1) {
      state.team.forEach((m, i) => {
        if (state.team.length <= 1) return; // 至少保留一隻
        const startY = 28 + i * 36;
        const toStorageBtn = this.add.text(camW - 42, startY + 10, '▼存', {
          fontSize: '11px', color: '#6688aa',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        toStorageBtn.on('pointerover', () => toStorageBtn.setColor('#ffcc44'));
        toStorageBtn.on('pointerout', () => toStorageBtn.setColor('#6688aa'));
        toStorageBtn.on('pointerdown', () => {
          state.storage.push(state.team.splice(i, 1)[0]);
          this.showBackpack(container);
        });
        container.add(toStorageBtn);
      });
    }

    // 倉庫
    if (state.storage.length > 0) {
      const storageY = 28 + state.team.length * 36 + 5;
      container.add(this.add.text(10, storageY, `── 倉庫 (${state.storage.length}) ──`, {
        fontSize: '13px', color: '#667788',
      }));
      state.storage.forEach((m, i) => {
        const y = storageY + 16 + i * 18;
        const cult = getCultivation(m.level);
        container.add(this.add.text(15, y, `${m.nickname} ${cult.displayName} HP:${m.hp}/${m.maxHp}`, {
          fontSize: '11px', color: '#8899aa',
        }));
        // 取回隊伍按鈕
        if (state.team.length < 6) {
          const toTeamBtn = this.add.text(camW - 42, y + 2, '▲隊', {
            fontSize: '11px', color: '#44aa88',
          }).setOrigin(0.5).setInteractive({ useHandCursor: true });
          toTeamBtn.on('pointerover', () => toTeamBtn.setColor('#ffcc44'));
          toTeamBtn.on('pointerout', () => toTeamBtn.setColor('#44aa88'));
          toTeamBtn.on('pointerdown', () => {
            state.team.push(state.storage.splice(i, 1)[0]);
            this.showBackpack(container);
          });
          container.add(toTeamBtn);
        } else {
          // 隊伍已滿，提供交換功能
          const swapBtn = this.add.text(camW - 42, y + 2, '⇄換', {
            fontSize: '11px', color: '#cc8844',
          }).setOrigin(0.5).setInteractive({ useHandCursor: true });
          swapBtn.on('pointerover', () => swapBtn.setColor('#ffcc44'));
          swapBtn.on('pointerout', () => swapBtn.setColor('#cc8844'));
          swapBtn.on('pointerdown', () => {
            this.showSwapPicker(container, i);
          });
          container.add(swapBtn);
        }
      });
    }

    const closeBtn = this.add.text(camW / 2, camH - 20, '關閉', {
      fontSize: '15px', color: '#ffcc44',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
    container.add(closeBtn);

    this.dialogueBox = container;
    this.finalizeUI(container);
  }

  // ═══════════════════════════════════
  //  隊伍 ↔ 倉庫交換（隊伍已滿時）
  // ═══════════════════════════════════
  private showSwapPicker(parentContainer: Phaser.GameObjects.Container, storageIndex: number): void {
    parentContainer.destroy();
    this.dialogueBox = null;

    const state = getState();
    const camW = this.scale.width;
    const camH = this.scale.height;
    const storageMonster = state.storage[storageIndex];

    const container = this.add.container(0, 0);
    container.setScrollFactor(0).setDepth(200);

    const bg = this.add.rectangle(camW / 2, camH / 2, camW - 10, camH - 10, 0x0a0a1a, 0.95);
    bg.setStrokeStyle(2, 0xcc8844);
    container.add(bg);

    const cult = getCultivation(storageMonster.level);
    container.add(this.add.text(camW / 2, 12, `交換 ${storageMonster.nickname}(${cult.displayName})`, {
      fontSize: '15px', fontFamily: 'serif', color: '#cc8844',
    }).setOrigin(0.5));
    container.add(this.add.text(camW / 2, 30, '選擇要換出的隊伍靈獸：', {
      fontSize: '13px', color: '#889999',
    }).setOrigin(0.5));

    state.team.forEach((m, i) => {
      const y = 50 + i * 28;
      const mCult = getCultivation(m.level);
      const hpColor = m.hp > 0 ? '#ffffff' : '#ff4444';

      const sprite = this.add.image(22, y + 6, `monster_${m.templateId}`);
      sprite.setDisplaySize(20, 20);
      container.add(sprite);

      const btn = this.add.text(40, y, `${m.nickname} ${mCult.displayName} HP:${m.hp}/${m.maxHp}`, {
        fontSize: '13px', color: hpColor,
      }).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#ffcc44'));
      btn.on('pointerout', () => btn.setColor(hpColor));
      btn.on('pointerdown', () => {
        // 交換：隊伍[i] ↔ 倉庫[storageIndex]
        const temp = state.team[i];
        state.team[i] = state.storage[storageIndex];
        state.storage[storageIndex] = temp;
        this.showBackpack(container);
      });
      container.add(btn);
    });

    const back = this.add.text(camW / 2, camH - 20, '← 返回', {
      fontSize: '15px', color: '#ffcc44',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.showBackpack(container));
    container.add(back);

    this.dialogueBox = container;
    this.finalizeUI(container);
  }

  // ═══════════════════════════════════
  //  練化（靈獸互吃吸收經驗）
  // ═══════════════════════════════════
  private showAbsorptionMenu(parentContainer: Phaser.GameObjects.Container): void {
    parentContainer.destroy();
    this.dialogueBox = null;

    const state = getState();
    if (state.team.length + state.storage.length < 2) {
      this.showNotification('需要至少兩隻靈獸才能練化！', 0xff4444);
      return;
    }

    const camW = this.scale.width;
    const camH = this.scale.height;
    let selectedEater: number | null = null;
    let selectedFood: number | null = null;

    const allMonsters = [...state.team, ...state.storage];

    const redraw = () => {
      container.removeAll(true);

      const bg = this.add.rectangle(camW / 2, camH / 2, camW - 10, camH - 10, 0x0a0a1a, 0.95);
      bg.setStrokeStyle(2, 0xff6644);
      container.add(bg);

      container.add(this.add.text(camW / 2, 10, '— 練 化 —', {
        fontSize: '17px', fontFamily: 'serif', color: '#ff6644',
      }).setOrigin(0.5));
      container.add(this.add.text(camW / 2, 26, '選擇吞噬者，再選祭品。祭品的累積經驗將被吸收。', {
        fontSize: '10px', color: '#aabbcc', wordWrap: { width: camW - 40 },
      }).setOrigin(0.5));

      // 列出所有靈獸
      const itemH = Math.min(28, Math.floor((camH - 100) / allMonsters.length));
      allMonsters.forEach((m, i) => {
        const isInTeam = i < state.team.length;
        const y = 40 + i * itemH;
        const cult = getCultivation(m.level);

        // 計算此靈獸累積的總經驗值
        let totalExp = m.exp;
        for (let lv = 1; lv < m.level; lv++) {
          totalExp += lv <= 30 ? lv * 20 + 10 : lv * 40;
        }

        let label = `${m.nickname} ${cult.displayName}`;
        if (!isInTeam) label = `[倉] ${label}`;

        let color = '#ffffff';
        if (selectedEater === i) color = '#ff6644';
        else if (selectedFood === i) color = '#44ff44';

        const sprite = this.add.image(18, y + 6, `monster_${m.templateId}`);
        sprite.setDisplaySize(18, 18);
        if (m.isShiny) sprite.setTint(0xffdd88);
        container.add(sprite);

        const nameText = this.add.text(32, y, label, {
          fontSize: '13px', color, fontStyle: selectedEater === i || selectedFood === i ? 'bold' : 'normal',
        }).setInteractive({ useHandCursor: true });

        const expText = this.add.text(32, y + 12, `累積EXP: ${totalExp}`, {
          fontSize: '10px', color: '#667788',
        });

        nameText.on('pointerdown', () => {
          if (selectedEater === null) {
            selectedEater = i;
            redraw();
          } else if (selectedEater === i) {
            // 取消選擇
            selectedEater = null;
            selectedFood = null;
            redraw();
          } else {
            selectedFood = i;
            redraw();
          }
        });

        container.add(nameText);
        container.add(expText);

        // 角色標記
        if (selectedEater === i) {
          container.add(this.add.text(camW - 30, y + 4, '吞', {
            fontSize: '14px', color: '#ff6644', fontStyle: 'bold',
          }));
        } else if (selectedFood === i) {
          container.add(this.add.text(camW - 30, y + 4, '祭', {
            fontSize: '14px', color: '#44ff44', fontStyle: 'bold',
          }));
        }
      });

      // 確認按鈕
      if (selectedEater !== null && selectedFood !== null) {
        const eater = allMonsters[selectedEater];
        const food = allMonsters[selectedFood];

        // 計算祭品的累積經驗
        let foodTotalExp = food.exp;
        for (let lv = 1; lv < food.level; lv++) {
          foodTotalExp += lv <= 30 ? lv * 20 + 10 : lv * 40;
        }

        // 同角色 1.5x，同屬性 1.25x
        let bonusMul = 1;
        let bonusTag = '';
        if (eater.templateId === food.templateId) {
          bonusMul = 1.5;
          bonusTag = ' [同種×1.5]';
        } else {
          const eaterElem = getTemplate(eater.templateId).element;
          const foodElem = getTemplate(food.templateId).element;
          if (eaterElem === foodElem) {
            bonusMul = 1.25;
            bonusTag = ' [同屬×1.25]';
          }
        }
        foodTotalExp = Math.floor(foodTotalExp * bonusMul);

        const confirmBtn = this.add.text(camW / 2, camH - 35, `確認練化：${eater.nickname} 吞噬 ${food.nickname} (+${foodTotalExp} EXP)${bonusTag}`, {
          fontSize: '14px', color: '#ff6644', fontStyle: 'bold',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        confirmBtn.on('pointerover', () => confirmBtn.setColor('#ffcc44'));
        confirmBtn.on('pointerout', () => confirmBtn.setColor('#ff6644'));
        confirmBtn.on('pointerdown', () => {
          // 餵經驗
          let totalGained = foodTotalExp;
          const results: string[] = [];
          while (totalGained > 0 && eater.level < 42) {
            const expNeeded = eater.level <= 30 ? eater.level * 20 + 10 : eater.level * 40;
            const remaining = expNeeded - eater.exp;
            if (totalGained >= remaining) {
              totalGained -= remaining;
              const result = applyExp(eater, remaining);
              if (result.leveled) {
                results.push(`${eater.nickname} 突破至 ${getCultivation(result.newLevel).displayName}！`);
              }
            } else {
              eater.exp += totalGained;
              totalGained = 0;
            }
          }

          // 移除祭品
          const foodIdx = selectedFood!;
          if (foodIdx < state.team.length) {
            state.team.splice(foodIdx, 1);
          } else {
            state.storage.splice(foodIdx - state.team.length, 1);
          }

          container.destroy();
          this.dialogueBox = null;

          const msg = results.length > 0
            ? `練化成功！${results[results.length - 1]}`
            : `練化成功！${eater.nickname} 獲得了 ${foodTotalExp} 經驗！`;
          this.showNotification(msg, 0xff6644);
        });
        container.add(confirmBtn);
      }

      // 關閉按鈕
      const closeBtn = this.add.text(camW / 2, camH - 18, '取消', {
        fontSize: '14px', color: '#667788',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      closeBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
      container.add(closeBtn);

      // 每次 redraw 後重新註冊 UI 相機
      this.finalizeUI(container);
    };

    const container = this.add.container(0, 0);
    container.setScrollFactor(0).setDepth(200);
    this.dialogueBox = container;
    redraw();
  }

  private showMonsterDetail(parentContainer: Phaser.GameObjects.Container, m: MonsterInstance): void {
    parentContainer.destroy();
    this.dialogueBox = null;

    const camW = this.scale.width;
    const camH = this.scale.height;
    let swapMode: { equippedIdx: number } | null = null;

    const redrawDetail = () => {
      container.removeAll(true);

      const bg = this.add.rectangle(camW / 2, camH / 2, camW - 10, camH - 10, 0x0a0a1a, 0.95);
      bg.setStrokeStyle(2, 0xffcc44);
      container.add(bg);

      const cult = getCultivation(m.level);

      // 靈獸大圖
      const sprite = this.add.image(70, 40, `monster_${m.templateId}`);
      sprite.setDisplaySize(48, 48);
      if (m.isShiny) sprite.setTint(0xffdd88);
      container.add(sprite);

      if (cult.realmIndex >= 1) {
        const aura = this.add.circle(70, 40, 28 + cult.realmIndex * 2, parseInt(cult.color.replace('#', '0x')), 0.15);
        container.add(aura);
      }

      // 名稱 + 境界
      const shinyTag = m.isShiny ? '[異] ' : '';
      const fusedTag = m.isFused ? '[融] ' : '';
      container.add(this.add.text(110, 22, `${shinyTag}${fusedTag}${m.nickname}`, {
        fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
      }));
      container.add(this.add.text(110, 38, cult.displayName, {
        fontSize: '15px', color: cult.color,
      }));

      // 素質
      container.add(this.add.text(110, 54, `HP:${m.hp}/${m.maxHp} 攻:${m.atk} 防:${m.def} 速:${m.spd}`, {
        fontSize: '11px', color: '#aabbcc',
      }));
      const expNeeded = m.level <= 30 ? m.level * 20 + 10 : m.level * 40;
      container.add(this.add.text(110, 65, `EXP: ${m.exp}/${expNeeded}`, {
        fontSize: '11px', color: '#667788',
      }));

      // ── 裝備中的技能 ──
      container.add(this.add.text(15, 82, '-- 裝備中 (戰鬥使用) --', {
        fontSize: '13px', color: '#ffcc44',
      }));

      m.skills.forEach((s, i) => {
        const y = 96 + i * 18;
        const effectTag = s.skill.effect ? this.getEffectLabel(s.skill) : '';
        const isSelected = swapMode?.equippedIdx === i;
        const color = isSelected ? '#ff6644' : '#ffffff';

        const nameBtn = this.add.text(15, y, `${i + 1}. ${s.skill.name} (${s.skill.element})`, {
          fontSize: '13px', color, fontStyle: isSelected ? 'bold' : 'normal',
        }).setInteractive({ useHandCursor: true });

        container.add(nameBtn);
        container.add(this.add.text(camW - 15, y, `威力:${s.skill.power} 命中:${s.skill.accuracy} PP:${s.currentPp}/${s.skill.pp} ${effectTag}`, {
          fontSize: '10px', color: '#889999',
        }).setOrigin(1, 0));

        // 點擊裝備中的技能 → 進入交換模式
        nameBtn.on('pointerdown', () => {
          if (m.learnedSkills.length === 0) return; // 沒有可交換的
          if (swapMode?.equippedIdx === i) {
            swapMode = null; // 取消
          } else {
            swapMode = { equippedIdx: i };
          }
          redrawDetail();
        });

        if (isSelected) {
          container.add(this.add.text(camW - 15, y + 9, '<- 點選下方技能替換', {
            fontSize: '10px', color: '#ff6644',
          }).setOrigin(1, 0));
        }
      });

      // ── 技能池（已習得未裝備）──
      const poolY = 96 + Math.max(m.skills.length, 4) * 18 + 8;
      const poolLabel = m.learnedSkills.length > 0
        ? `-- 技能池 (${m.learnedSkills.length}) 點擊可替換 --`
        : '-- 技能池 (空) --';
      container.add(this.add.text(15, poolY, poolLabel, {
        fontSize: '13px', color: swapMode ? '#ff6644' : '#667788',
      }));

      m.learnedSkills.forEach((s, i) => {
        const y = poolY + 14 + i * 16;
        const effectTag = s.effect ? this.getEffectLabel(s) : '';
        const color = swapMode ? '#44ccff' : '#556677';

        const poolBtn = this.add.text(15, y, `  ${s.name} (${s.element})`, {
          fontSize: '11px', color,
        }).setInteractive({ useHandCursor: true });

        container.add(poolBtn);
        container.add(this.add.text(camW - 15, y, `威力:${s.power} 命中:${s.accuracy} PP:${s.pp} ${effectTag}`, {
          fontSize: '10px', color: '#556677',
        }).setOrigin(1, 0));

        poolBtn.on('pointerdown', () => {
          if (swapMode) {
            // 執行交換
            swapSkill(m, swapMode.equippedIdx, i);
            swapMode = null;
            redrawDetail();
          } else {
            // 如果沒選裝備中的技能，自動選第一個裝備欄
            swapMode = { equippedIdx: 0 };
            redrawDetail();
          }
        });
      });

      // 返回按鈕
      const backBtn = this.add.text(camW / 2, camH - 20, '<- 返回背包', {
        fontSize: '14px', color: '#ffcc44',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      backBtn.on('pointerdown', () => {
        container.destroy();
        this.dialogueBox = null;
        const dummyContainer = this.add.container(0, 0);
        this.showBackpack(dummyContainer);
      });
      container.add(backBtn);

      // 每次 redraw 後重新註冊 UI 相機
      this.finalizeUI(container);
    };

    const container = this.add.container(0, 0);
    container.setScrollFactor(0).setDepth(200);
    this.dialogueBox = container;
    redrawDetail();
  }

  private getEffectLabel(skill: { effect?: { type: string } }): string {
    if (!skill.effect) return '';
    switch (skill.effect.type) {
      case 'heal': return '[回復]';
      case 'drain': return '[吸血]';
      case 'recoil': return '[反傷]';
      case 'statUp': return '[增益]';
      case 'statDown': return '[減益]';
      case 'priority': return '[先制]';
      default: return '';
    }
  }

  // ═══════════════════════════════════
  //  圖鑑
  // ═══════════════════════════════════
  private showPokedex(parentContainer: Phaser.GameObjects.Container): void {
    parentContainer.destroy();
    this.dialogueBox = null;

    const state = getState();
    const camW = this.scale.width;
    const camH = this.scale.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0).setDepth(200);

    const bg = this.add.rectangle(camW / 2, camH / 2, camW - 10, camH - 10, 0x0a0a1a, 0.95);
    bg.setStrokeStyle(2, 0xffcc44);
    container.add(bg);

    container.add(this.add.text(camW / 2, 15, `— 靈獸圖鑑 ${state.caughtIds.size}/10 —`, {
      fontSize: '17px', fontFamily: 'serif', color: '#ffcc44',
    }).setOrigin(0.5));

    MONSTERS.forEach((m, i) => {
      const y = 35 + i * 22;
      const caught = state.caughtIds.has(m.id);

      if (caught) {
        // 靈獸小圖
        const sprite = this.add.image(18, y + 5, `monster_${m.id}`);
        sprite.setDisplaySize(16, 16);
        container.add(sprite);

        container.add(this.add.text(30, y, `${m.name}　${m.element}`, {
          fontSize: '14px', color: '#ffffff',
        }));
        container.add(this.add.text(30, y + 11, m.description, {
          fontSize: '11px', color: '#667788',
          wordWrap: { width: camW - 60 },
        }));
      } else {
        container.add(this.add.text(30, y + 3, '？？？', {
          fontSize: '14px', color: '#334455',
        }));
      }
    });

    const closeBtn = this.add.text(camW / 2, camH - 20, '關閉', {
      fontSize: '15px', color: '#ffcc44',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
    container.add(closeBtn);

    this.dialogueBox = container;
    this.finalizeUI(container);
  }
}

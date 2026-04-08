import Phaser from 'phaser';
import { getMap, type GameMap, type MapNpc } from '../data/maps';
import { getState, saveGame, getFirstAliveIndex, healTeam, addMonsterToTeam } from '../utils/gameState';
import { createMonsterInstance, MONSTERS, getCultivation, fuseMonsters, swapSkill, type MonsterInstance } from '../data/monsters';
import { healMonster, applyExp, getExpReward } from '../utils/battle';

const TILE_SIZE = 32;

export class OverworldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private currentMap!: GameMap;
  private tileSprites: Phaser.GameObjects.Image[] = [];
  private npcSprites: Phaser.GameObjects.Container[] = [];
  private playerTileX = 0;
  private playerTileY = 0;
  private isMoving = false;
  private moveTimer = 0;
  private dialogueBox: Phaser.GameObjects.Container | null = null;
  private mapNameText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private gracePeriod = 0;
  private stepsSinceEncounter = 0;

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
    this.tileSprites.forEach(s => s.destroy());
    this.tileSprites = [];

    const tileKeys = ['tile_grass', 'tile_wall', 'tile_tall_grass', 'tile_water', 'tile_exit', 'tile_path', 'tile_flower'];

    for (let y = 0; y < this.currentMap.height; y++) {
      for (let x = 0; x < this.currentMap.width; x++) {
        const tileType = this.currentMap.tiles[y][x];
        const key = tileKeys[tileType] || 'tile_grass';
        const sprite = this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, key);
        sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
        this.tileSprites.push(sprite);
      }
    }

    for (const exit of this.currentMap.exits) {
      const ex = this.add.image(exit.x * TILE_SIZE + TILE_SIZE / 2, exit.y * TILE_SIZE + TILE_SIZE / 2, 'tile_exit');
      ex.setDisplaySize(TILE_SIZE, TILE_SIZE);
      this.tileSprites.push(ex);
      this.currentMap.tiles[exit.y][exit.x] = 4;
    }
  }

  private createPlayer(): void {
    this.player = this.add.image(
      this.playerTileX * TILE_SIZE + TILE_SIZE / 2,
      this.playerTileY * TILE_SIZE + TILE_SIZE / 2,
      'player',
    );
    this.player.setDisplaySize(TILE_SIZE - 2, TILE_SIZE - 2);
    this.player.setDepth(10);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);
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
      if (npc.npcType === 'trainer') spriteKey = 'npc_trainer';
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
        fontSize: '7px', color: '#ffffff', align: 'center',
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

      this.npcSprites.push(container);
    }
  }

  private createUI(): void {
    this.mapNameText = this.add.text(10, 10, this.currentMap.name, {
      fontSize: '14px', fontFamily: 'serif', color: '#ffcc44',
      backgroundColor: '#000000aa', padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    this.infoText = this.add.text(10, 34, '', {
      fontSize: '10px', color: '#aabbcc',
      backgroundColor: '#000000aa', padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(100);

    this.updateInfoText();

    // 操作提示 — 右上角
    this.add.text(this.scale.width - 10, 10, '方向鍵/WASD 移動', {
      fontSize: '9px', color: '#667788',
      backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    this.add.text(this.scale.width - 10, 26, 'Z/Space/Enter 對話互動', {
      fontSize: '9px', color: '#667788',
      backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    this.add.text(this.scale.width - 10, 42, 'M/ESC 開啟選單', {
      fontSize: '9px', color: '#667788',
      backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
  }

  private updateInfoText(): void {
    const state = getState();
    const alive = state.team.filter(m => m.hp > 0).length;
    const lead = state.team[0];
    const cult = getCultivation(lead.level);
    this.infoText.setText(
      `${lead.nickname} ${cult.displayName}　隊伍：${alive}/${state.team.length}　圖鑑：${state.caughtIds.size}/10`
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
    };

    this.wasd.Z.on('down', () => this.interact());
    this.wasd.M.on('down', () => this.showQuickMenu());

    // 額外支援 Space / Enter 作為對話鍵, ESC 開選單
    const space = this.input.keyboard.addKey('SPACE');
    const enter = this.input.keyboard.addKey('ENTER');
    const esc = this.input.keyboard.addKey('ESC');
    space.on('down', () => this.interact());
    enter.on('down', () => this.interact());
    esc.on('down', () => {
      if (this.dialogueBox) return;
      this.showQuickMenu();
    });
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

    if (newX < 0 || newY < 0 || newX >= this.currentMap.width || newY >= this.currentMap.height) return;

    const npcAt = this.currentMap.npcs.find(n => n.x === newX && n.y === newY);
    if (npcAt) return;

    const tile = this.currentMap.tiles[newY][newX];
    if (tile === 1 || tile === 3) return;

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

    if (tile === 4) {
      const exit = this.currentMap.exits.find(e => e.x === x && e.y === y);
      if (exit) {
        this.transitionToMap(exit.targetMap, exit.targetX, exit.targetY);
        return;
      }
    }

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
    // 如果已在對話/選單中，不要重複觸發
    if (this.dialogueBox) return;

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
        // 對話完全結束
        dialogueActive = false;
        state.talkedNpcs.add(npc.id);
        // 延遲一幀再執行 NPC 功能，確保 dialogueBox 狀態乾淨
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
      let npcSpriteKey = 'npc_default';
      if (npc.npcType === 'trainer') npcSpriteKey = 'npc_trainer';
      else if (npc.npcType === 'healer') npcSpriteKey = 'npc_healer';
      else if (npc.npcType === 'fusion') npcSpriteKey = 'npc_fusion';

      const portrait = this.add.image(28, camH - boxH / 2 - 4, npcSpriteKey);
      portrait.setDisplaySize(32, 32);
      container.add(portrait);

      // NPC 名稱
      const nameLabel = this.add.text(12, camH - boxH - 10, npc.name, {
        fontSize: '11px', color: '#ffcc44', fontStyle: 'bold',
        backgroundColor: '#0a0a1a', padding: { x: 4, y: 1 },
      });
      container.add(nameLabel);

      // NPC 類型標籤
      let typeTag = '';
      if (npc.npcType === 'healer') typeTag = '[治療]';
      else if (npc.npcType === 'fusion') typeTag = '[練妖壺]';
      else if (npc.npcType === 'trainer') typeTag = '[對戰]';
      if (typeTag) {
        container.add(this.add.text(nameLabel.x + nameLabel.width + 6, camH - boxH - 10, typeTag, {
          fontSize: '9px', color: '#88aacc', backgroundColor: '#0a0a1a', padding: { x: 2, y: 2 },
        }));
      }

      // 對話文字 — 打字機效果
      const fullText = npc.dialogue[dialogueIndex];
      const textObj = this.add.text(52, camH - boxH + 10, '', {
        fontSize: '12px', color: '#ffffff', lineSpacing: 4,
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
          fontSize: '9px', color: hintColor,
        }).setOrigin(1, 0.5);
        container.add(hint);
        this.tweens.add({
          targets: hint, alpha: 0.3, duration: 500,
          yoyo: true, repeat: -1,
        });
      };

      this.dialogueBox = container;
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
        this.updateInfoText();
        this.showNotification('所有靈獸已完全恢復！', 0x44ff88);
        break;

      case 'fusion':
        this.showFusionMenu();
        break;

      case 'trainer':
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
                this.gracePeriod = 10;
                this.stepsSinceEncounter = 0;
                this.updateInfoText();
              },
            });
            this.scene.pause();
          });
        } else if (npc.team && state.defeatedTrainers.has(npc.id)) {
          this.showNotification('你已經打敗過這個對手了。', 0xaabbcc);
        }
        break;
    }
  }

  private showNotification(msg: string, color: number): void {
    const camW = this.scale.width;
    const text = this.add.text(camW / 2, 60, msg, {
      fontSize: '13px', color: '#' + color.toString(16).padStart(6, '0'),
      backgroundColor: '#000000cc', padding: { x: 10, y: 6 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);

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
      fontSize: '14px', fontFamily: 'serif', color: '#ff8844',
    }).setOrigin(0.5));

    container.add(this.add.text(camW / 2, 32, '選擇兩隻靈獸進行融合（將被消耗）', {
      fontSize: '9px', color: '#aa8866',
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
      const btn = this.add.text(15, y, info, { fontSize: '10px', color: '#ffffff' })
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
    const fuseBtn = this.add.text(camW / 2, camH - 40, '【 融 合 】', {
      fontSize: '14px', color: '#555555', fontStyle: 'bold',
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

    const closeBtn = this.add.text(camW / 2, camH - 18, '取消', {
      fontSize: '11px', color: '#889999',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
    container.add(closeBtn);

    this.dialogueBox = container;
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
      fontSize: '16px', color: '#ff8844', fontStyle: 'bold',
    }).setOrigin(0.5));

    // 靈獸圖片
    const sprite = this.add.image(camW / 2, camH / 2 - 20, `monster_${monster.templateId}`);
    sprite.setDisplaySize(48, 48);
    if (monster.isShiny) sprite.setTint(0xffdd88);
    container.add(sprite);

    const cult = getCultivation(monster.level);
    const info = `${monster.nickname} ${cult.displayName}\nHP:${monster.maxHp} 攻:${monster.atk} 防:${monster.def} 速:${monster.spd}`;
    container.add(this.add.text(camW / 2, camH / 2 + 20, info, {
      fontSize: '11px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5));

    const skills = monster.skills.map(s => s.skill.name).join('、');
    container.add(this.add.text(camW / 2, camH / 2 + 48, `技能：${skills}`, {
      fontSize: '9px', color: '#aabbcc', align: 'center',
      wordWrap: { width: camW - 60 },
    }).setOrigin(0.5));

    if (extraMsg) {
      container.add(this.add.text(camW / 2, camH / 2 + 65, extraMsg, {
        fontSize: '11px', color: '#ffcc44', fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    const closeBtn = this.add.text(camW / 2, camH / 2 + 82, '確認', {
      fontSize: '12px', color: '#ffcc44',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
    container.add(closeBtn);

    this.dialogueBox = container;
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

  // ═══════════════════════════════════
  //  選單系統
  // ═══════════════════════════════════
  private showQuickMenu(): void {
    if (this.dialogueBox) return;

    const camW = this.scale.width;
    const camH = this.scale.height;

    const container = this.add.container(0, 0);
    container.setScrollFactor(0).setDepth(200);

    const bg = this.add.rectangle(camW / 2, camH / 2, 220, 230, 0x0a0a1a, 0.95);
    bg.setStrokeStyle(2, 0xffcc44);
    container.add(bg);

    container.add(this.add.text(camW / 2, camH / 2 - 80, '— 選 單 —', {
      fontSize: '16px', fontFamily: 'serif', color: '#ffcc44',
    }).setOrigin(0.5));

    const options = [
      { icon: 'icon_backpack', text: '靈獸背包', action: () => this.showBackpack(container) },
      { icon: 'icon_absorb', text: '練化互吃', action: () => this.showAbsorptionMenu(container) },
      { icon: 'icon_pokedex', text: '靈獸圖鑑', action: () => this.showPokedex(container) },
      { icon: 'icon_heal', text: '回復全隊', action: () => { healTeam(); this.updateInfoText(); closeMenu(); this.showNotification('全隊已恢復！', 0x44ff88); } },
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
        fontSize: '13px', color: '#ffffff',
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

    const closeMenu = () => {
      container.destroy();
      this.dialogueBox = null;
    };
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
      fontSize: '13px', fontFamily: 'serif', color: '#ffcc44',
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
        fontSize: '10px', color: hpColor, fontStyle: 'bold',
      }));

      container.add(this.add.text(38, startY + 12, `${cult.displayName}`, {
        fontSize: '9px', color: cult.color,
      }));

      // 素質
      container.add(this.add.text(camW / 2 + 10, startY, `HP:${m.hp}/${m.maxHp}`, {
        fontSize: '9px', color: hpColor,
      }));
      container.add(this.add.text(camW / 2 + 10, startY + 11, `攻:${m.atk} 防:${m.def} 速:${m.spd}`, {
        fontSize: '8px', color: '#889999',
      }));

      // 經驗值
      const expNeeded = m.level <= 30 ? m.level * 40 + 20 : m.level * 80;
      container.add(this.add.text(camW / 2 + 10, startY + 22, `EXP:${m.exp}/${expNeeded}`, {
        fontSize: '8px', color: '#667788',
      }));

      // 點擊查看技能詳情
      const detailBtn = this.add.text(camW - 20, startY + 10, '▶', {
        fontSize: '12px', color: '#667788',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      detailBtn.on('pointerdown', () => this.showMonsterDetail(container, m));
      container.add(detailBtn);
    });

    // 倉庫
    if (state.storage.length > 0) {
      const storageY = 28 + state.team.length * 36 + 5;
      container.add(this.add.text(10, storageY, `倉庫 (${state.storage.length})`, {
        fontSize: '9px', color: '#667788',
      }));
      state.storage.forEach((m, i) => {
        const y = storageY + 14 + i * 14;
        const cult = getCultivation(m.level);
        container.add(this.add.text(15, y, `${m.nickname} ${cult.displayName}`, {
          fontSize: '8px', color: '#556677',
        }));
      });
    }

    const closeBtn = this.add.text(camW / 2, camH - 15, '關閉', {
      fontSize: '12px', color: '#ffcc44',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
    container.add(closeBtn);

    this.dialogueBox = container;
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
        fontSize: '13px', fontFamily: 'serif', color: '#ff6644',
      }).setOrigin(0.5));
      container.add(this.add.text(camW / 2, 26, '選擇吞噬者，再選祭品。祭品的累積經驗將被吸收。', {
        fontSize: '7px', color: '#aabbcc', wordWrap: { width: camW - 40 },
      }).setOrigin(0.5));

      // 列出所有靈獸
      allMonsters.forEach((m, i) => {
        const isInTeam = i < state.team.length;
        const y = 42 + i * 28;
        const cult = getCultivation(m.level);

        // 計算此靈獸累積的總經驗值
        let totalExp = m.exp;
        for (let lv = 1; lv < m.level; lv++) {
          totalExp += lv <= 30 ? lv * 40 + 20 : lv * 80;
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
          fontSize: '9px', color, fontStyle: selectedEater === i || selectedFood === i ? 'bold' : 'normal',
        }).setInteractive({ useHandCursor: true });

        const expText = this.add.text(32, y + 12, `累積EXP: ${totalExp}`, {
          fontSize: '7px', color: '#667788',
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
            fontSize: '10px', color: '#ff6644', fontStyle: 'bold',
          }));
        } else if (selectedFood === i) {
          container.add(this.add.text(camW - 30, y + 4, '祭', {
            fontSize: '10px', color: '#44ff44', fontStyle: 'bold',
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
          foodTotalExp += lv <= 30 ? lv * 40 + 20 : lv * 80;
        }

        const confirmBtn = this.add.text(camW / 2, camH - 35, `確認練化：${eater.nickname} 吞噬 ${food.nickname} (+${foodTotalExp} EXP)`, {
          fontSize: '10px', color: '#ff6644', fontStyle: 'bold',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        confirmBtn.on('pointerover', () => confirmBtn.setColor('#ffcc44'));
        confirmBtn.on('pointerout', () => confirmBtn.setColor('#ff6644'));
        confirmBtn.on('pointerdown', () => {
          // 餵經驗
          let totalGained = foodTotalExp;
          const results: string[] = [];
          while (totalGained > 0 && eater.level < 42) {
            const expNeeded = eater.level <= 30 ? eater.level * 40 + 20 : eater.level * 80;
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
      const closeBtn = this.add.text(camW / 2, camH - 14, '取消', {
        fontSize: '11px', color: '#667788',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      closeBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
      container.add(closeBtn);
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
        fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
      }));
      container.add(this.add.text(110, 38, cult.displayName, {
        fontSize: '11px', color: cult.color,
      }));

      // 素質
      container.add(this.add.text(110, 54, `HP:${m.hp}/${m.maxHp} 攻:${m.atk} 防:${m.def} 速:${m.spd}`, {
        fontSize: '8px', color: '#aabbcc',
      }));
      const expNeeded = m.level <= 30 ? m.level * 40 + 20 : m.level * 80;
      container.add(this.add.text(110, 65, `EXP: ${m.exp}/${expNeeded}`, {
        fontSize: '8px', color: '#667788',
      }));

      // ── 裝備中的技能 ──
      container.add(this.add.text(15, 82, '-- 裝備中 (戰鬥使用) --', {
        fontSize: '9px', color: '#ffcc44',
      }));

      m.skills.forEach((s, i) => {
        const y = 96 + i * 18;
        const effectTag = s.skill.effect ? this.getEffectLabel(s.skill) : '';
        const isSelected = swapMode?.equippedIdx === i;
        const color = isSelected ? '#ff6644' : '#ffffff';

        const nameBtn = this.add.text(15, y, `${i + 1}. ${s.skill.name} (${s.skill.element})`, {
          fontSize: '9px', color, fontStyle: isSelected ? 'bold' : 'normal',
        }).setInteractive({ useHandCursor: true });

        container.add(nameBtn);
        container.add(this.add.text(camW - 15, y, `威力:${s.skill.power} 命中:${s.skill.accuracy} PP:${s.currentPp}/${s.skill.pp} ${effectTag}`, {
          fontSize: '7px', color: '#889999',
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
            fontSize: '7px', color: '#ff6644',
          }).setOrigin(1, 0));
        }
      });

      // ── 技能池（已習得未裝備）──
      const poolY = 96 + Math.max(m.skills.length, 4) * 18 + 8;
      const poolLabel = m.learnedSkills.length > 0
        ? `-- 技能池 (${m.learnedSkills.length}) 點擊可替換 --`
        : '-- 技能池 (空) --';
      container.add(this.add.text(15, poolY, poolLabel, {
        fontSize: '9px', color: swapMode ? '#ff6644' : '#667788',
      }));

      m.learnedSkills.forEach((s, i) => {
        const y = poolY + 14 + i * 16;
        const effectTag = s.effect ? this.getEffectLabel(s) : '';
        const color = swapMode ? '#44ccff' : '#556677';

        const poolBtn = this.add.text(15, y, `  ${s.name} (${s.element})`, {
          fontSize: '8px', color,
        }).setInteractive({ useHandCursor: true });

        container.add(poolBtn);
        container.add(this.add.text(camW - 15, y, `威力:${s.power} 命中:${s.accuracy} PP:${s.pp} ${effectTag}`, {
          fontSize: '7px', color: '#556677',
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
      const backBtn = this.add.text(camW / 2, camH - 14, '<- 返回背包', {
        fontSize: '11px', color: '#ffcc44',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      backBtn.on('pointerdown', () => {
        container.destroy();
        this.dialogueBox = null;
        const dummyContainer = this.add.container(0, 0);
        this.showBackpack(dummyContainer);
      });
      container.add(backBtn);
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
      fontSize: '13px', fontFamily: 'serif', color: '#ffcc44',
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
          fontSize: '10px', color: '#ffffff',
        }));
        container.add(this.add.text(30, y + 11, m.description, {
          fontSize: '8px', color: '#667788',
          wordWrap: { width: camW - 60 },
        }));
      } else {
        container.add(this.add.text(30, y + 3, '？？？', {
          fontSize: '10px', color: '#334455',
        }));
      }
    });

    const closeBtn = this.add.text(camW / 2, camH - 15, '關閉', {
      fontSize: '12px', color: '#ffcc44',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { container.destroy(); this.dialogueBox = null; });
    container.add(closeBtn);

    this.dialogueBox = container;
  }
}

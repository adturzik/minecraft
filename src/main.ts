import * as THREE from 'three';
import { ChunkManager } from './engine/world/chunkManager';
import { raycastVoxels } from './engine/world/voxelRaycast';
import { PlayerController } from './game/player/playerController';
import { BlockId, tierIndex, ToolTier } from './game/items/blockDefs';
import { getBlockDef } from './game/items/blocks';
import { blockDropItemId, getItemDef, miningSeconds } from './game/items/items';
import { CrackOverlay } from './engine/mesh/crackOverlay';
import { HeldItemView } from './engine/mesh/heldItemView';
import { GameUI } from './ui/gameUI';
import { FurnaceManager } from './game/crafting/furnaceManager';
import { SurvivalState } from './game/player/survival';
import type { GameMode } from './game/player/gameMode';
import { GameClock } from './game/time/gameClock';
import { SurvivalHUD } from './ui/hud/survivalHUD';
import { MobManager } from './game/entities/mobManager';
import type { Mob } from './game/entities/mob';
import { MainMenu, PlayOptions, renderSettingsPanel } from './ui/mainMenu';
import { TITLE_FONT, BODY_FONT, logoTextShadow, buttonStyle, attachButtonHover, panelStyle } from './ui/pixelStyle';
import { LoadingScreen } from './ui/loadingScreen';
import { loadSettings } from './persistence/settings';
import { saveWorld, WorldSaveData } from './persistence/saveSystem';
import { soundEngine, FootstepMaterial } from './audio/soundEngine';
import type { Slot } from './game/player/inventory';

const app = document.getElementById('app')!;

const FOOTSTEP_MATERIAL: Record<string, FootstepMaterial> = {
  grass_block: 'grass', tall_grass: 'grass',
  dirt: 'dirt', clay: 'dirt',
  sand: 'sand', sandstone: 'sand',
  stone: 'stone', cobblestone: 'stone', bedrock: 'stone', obsidian: 'stone',
  coal_ore: 'stone', iron_ore: 'stone', gold_ore: 'stone', diamond_ore: 'stone', redstone_ore: 'stone', lapis_ore: 'stone',
  oak_planks: 'wood', oak_log: 'wood', birch_planks: 'wood', birch_log: 'wood', spruce_planks: 'wood', spruce_log: 'wood',
  crafting_table: 'wood', chest: 'wood', door_wood: 'wood', ladder: 'wood',
  water: 'water', ice: 'water', snow: 'water',
};

function footstepMaterialFor(blockId: number): FootstepMaterial {
  if (blockId === BlockId.Air) return 'default';
  return FOOTSTEP_MATERIAL[getBlockDef(blockId).key] ?? 'default';
}

function startGame(opts: PlayOptions) {
  const gameMode: GameMode = opts.gameMode;
  const settings = loadSettings();
  soundEngine.ensureStarted();
  soundEngine.setVolumes(settings.masterVolume, settings.sfxVolume, settings.musicVolume);

  const loading = new LoadingScreen(opts.worldName);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 70, 105);

  const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.1, 800);
  camera.rotation.order = 'YXZ';
  scene.add(camera); // required for objects parented to the camera (heldItemView) to render at all

  const heldItemView = new HeldItemView();
  camera.add(heldItemView.mesh);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  app.innerHTML = '';
  app.appendChild(renderer.domElement);

  const chunkManager = new ChunkManager(scene, { seed: opts.seed, renderDistance: settings.renderDistance });
  if (opts.existingSave) chunkManager.loadEdits(opts.existingSave.blockEdits);

  const player = new PlayerController(camera, renderer.domElement);
  player.controls.pointerSpeed = settings.mouseSensitivity;
  const SPAWN_POSITION = new THREE.Vector3(0.5, 90, 0.5);

  const gameUI = new GameUI(gameMode);
  const furnaceManager = new FurnaceManager();
  const survival = new SurvivalState();
  const clock = new GameClock(0.25);
  const survivalHUD = new SurvivalHUD();
  const mobManager = new MobManager(scene);

  if (opts.existingSave) {
    const save = opts.existingSave;
    player.position.set(save.player.x, save.player.y, save.player.z);
    camera.rotation.y = save.player.yawRad;
    camera.rotation.x = save.player.pitchRad;
    survival.health = save.player.health;
    survival.hunger = save.player.hunger;
    survival.breath = save.player.breath;
    clock.elapsed = save.gameTimeElapsed;
    gameUI.inventory.slots = save.inventorySlots.slice() as Slot[];
    gameUI.refreshHotbar();
  }

  chunkManager.setCenter(player.position.x, player.position.z);

  function buildSaveData(): WorldSaveData {
    return {
      id: opts.worldId,
      name: opts.worldName,
      seed: opts.seed,
      createdAt: opts.existingSave?.createdAt ?? Date.now(),
      lastPlayedAt: Date.now(),
      gameTimeElapsed: clock.elapsed,
      gameMode,
      player: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        yawRad: camera.rotation.y,
        pitchRad: camera.rotation.x,
        health: survival.health,
        hunger: survival.hunger,
        breath: survival.breath,
      },
      inventorySlots: gameUI.inventory.slots,
      blockEdits: chunkManager.getEdits(),
    };
  }

  async function doSave() {
    try {
      await saveWorld(buildSaveData());
    } catch (err) {
      console.error('Save failed', err);
    }
  }

  function quitToMenu() {
    doSave().finally(() => location.reload());
  }

  const nightOverlay = document.createElement('div');
  nightOverlay.style.cssText = 'position:fixed;inset:0;background:#00081a;opacity:0;pointer-events:none;z-index:5;transition:opacity 1s linear;';
  document.body.appendChild(nightOverlay);

  survivalHUD.setRespawnHandler(() => {
    player.position.copy(SPAWN_POSITION);
    player.velocity.set(0, 0, 0);
    survival.respawn();
    player.lock();
  });

  /** Applies armor's flat damage-reduction (same formula as vanilla: -4%
   * damage per defense point, capped at 20 points / 80% reduction). */
  function applyDamage(amount: number) {
    if (gameMode === 'creative') return;
    const defense = gameUI.inventory.getTotalDefense();
    const reduced = amount * (1 - Math.min(20, defense) * 0.04);
    survival.takeDamage(Math.max(0, reduced));
  }

  function findSurfaceY(x: number, z: number): number | null {
    for (let y = 100; y > 1; y--) {
      if (chunkManager.isSolid(x, y, z) && !chunkManager.isSolid(x, y + 1, z)) {
        const top = chunkManager.getBlock(x, y, z);
        if (top !== BlockId.Water && top !== BlockId.Lava) return y;
      }
    }
    return null;
  }

  // ---- block outline highlight ----
  const outlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
  const outline = new THREE.LineSegments(outlineGeo, new THREE.LineBasicMaterial({ color: 0x000000 }));
  outline.visible = false;
  scene.add(outline);

  const REACH = 5;
  let currentHit: { x: number; y: number; z: number; normal: [number, number, number] } | null = null;
  let currentMobHit: Mob | null = null;

  // ---- crosshair + pause/intro overlay ----
  const crosshair = document.createElement('div');
  crosshair.style.cssText =
    'position:fixed;top:50%;left:50%;width:6px;height:6px;margin:-3px;background:#fff;mix-blend-mode:difference;border-radius:50%;pointer-events:none;display:none;';
  document.body.appendChild(crosshair);

  // ---- mining progress (hold-to-break) ----
  const miningBarOuter = document.createElement('div');
  miningBarOuter.style.cssText =
    'position:fixed;top:calc(50% + 14px);left:50%;transform:translateX(-50%);width:36px;height:5px;background:rgba(0,0,0,0.5);border:1px solid #000;display:none;z-index:20;';
  const miningBarFill = document.createElement('div');
  miningBarFill.style.cssText = 'height:100%;width:0%;background:#fff;';
  miningBarOuter.appendChild(miningBarFill);
  document.body.appendChild(miningBarOuter);

  const crackOverlay = new CrackOverlay();
  scene.add(crackOverlay.mesh);

  /** Creative mode has infinite blocks/items -- only survival consumes the
   * stack that was just placed/used/turned into a bucket. */
  function consumeSelected(count = 1) {
    if (gameMode === 'creative') return;
    gameUI.inventory.removeFromSlot(gameUI.inventory.selectedHotbarIndex, count);
  }

  let leftMouseDown = false;
  let miningTarget: { x: number; y: number; z: number } | null = null;
  let miningProgress = 0;

  function resetMining() {
    leftMouseDown = false;
    miningTarget = null;
    miningProgress = 0;
    miningBarOuter.style.display = 'none';
    crackOverlay.hide();
  }

  /** Breaks the block at (x,y,z): removes it, plays the sound, drops the
   * harvested item (if the held tool meets the block's minimum tier) and
   * damages the held tool. Shared by the instant-break path (hardness 0
   * blocks) and the hold-to-mine completion path. */
  function breakBlock(x: number, y: number, z: number) {
    const brokenId = chunkManager.getBlock(x, y, z);
    if (brokenId === BlockId.Air) return;
    chunkManager.setBlock(x, y, z, BlockId.Air);
    soundEngine.breakBlock();
    if (brokenId === BlockId.Furnace) furnaceManager.remove(x, y, z);

    if (gameMode === 'creative') return; // block just vanishes: no drop, no tool wear (matches vanilla creative)

    const blockDef = getBlockDef(brokenId);
    const heldId = gameUI.selectedItemId;
    const heldItemDef = heldId ? getItemDef(heldId) : null;
    const harvestable =
      blockDef.toolType !== 'pickaxe' ||
      (heldItemDef?.toolType === 'pickaxe' && tierIndex(heldItemDef.toolTier as ToolTier) >= tierIndex(blockDef.minToolTier));
    if (harvestable) {
      const dropId = blockDropItemId(brokenId);
      if (dropId) gameUI.giveItem(dropId, 1);
    }
    gameUI.damageSelectedTool();
  }

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:rgba(0,0,0,0.55);color:#fff;text-align:center;z-index:1500;';
  document.body.appendChild(overlay);

  let everLocked = false;

  function renderOverlay() {
    overlay.innerHTML = '';
    if (!everLocked) {
      const title = document.createElement('div');
      title.style.cssText = `font-family:${TITLE_FONT};font-size:32px;color:#ffcf4a;text-shadow:${logoTextShadow('#5a3d00')};letter-spacing:2px;margin-bottom:6px;`;
      title.textContent = 'CURRYCRAFT';
      const sub = document.createElement('div');
      sub.textContent = 'Klikni pro hraní';
      sub.style.cssText = `cursor:pointer;font-family:${BODY_FONT};font-size:16px;`;
      const hint = document.createElement('div');
      hint.style.cssText = `font-size:12px;opacity:0.85;max-width:420px;font-family:${BODY_FONT};margin-top:6px;`;
      hint.innerHTML =
        'WASD pohyb · myš rozhlížení · mezerník skok · Shift crouch · Ctrl sprint · F létání<br/>levé tlačítko těžba/útok · pravé tlačítko pokládání/interakce/jídlo · E inventář · kolečko/1-9 hotbar · Esc pauza';
      overlay.append(title, sub, hint);
      overlay.style.cursor = 'pointer';
      overlay.onclick = () => {
        if (!gameUI.isOpen && !survival.dead) player.lock();
      };
    } else {
      overlay.style.cursor = 'default';
      overlay.onclick = null;
      const title = document.createElement('div');
      title.style.cssText = `font-family:${TITLE_FONT};font-size:22px;color:#fff;text-shadow:${logoTextShadow('#000')};margin-bottom:10px;`;
      title.textContent = 'PAUZA';
      overlay.appendChild(title);

      const mkBtn = (label: string, fn: () => void) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = buttonStyle() + 'min-width:220px;';
        attachButtonHover(b);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          soundEngine.uiClick();
          fn();
        });
        return b;
      };
      overlay.appendChild(mkBtn('Pokračovat', () => player.lock()));
      const settingsBox = document.createElement('div');
      settingsBox.style.cssText = panelStyle() + 'display:none;padding:14px;width:340px;text-align:left;margin-top:4px;';
      renderSettingsPanel(settingsBox, (s) => {
        camera.fov = s.fov;
        camera.updateProjectionMatrix();
        player.controls.pointerSpeed = s.mouseSensitivity;
      });
      overlay.appendChild(mkBtn('Nastavení', () => {
        settingsBox.style.display = settingsBox.style.display === 'none' ? 'block' : 'none';
      }));
      overlay.appendChild(settingsBox);
      overlay.appendChild(mkBtn('Uložit a odejít do menu', () => quitToMenu()));
    }
  }
  renderOverlay();

  player.controls.addEventListener('lock', () => {
    everLocked = true;
    overlay.style.display = 'none';
    crosshair.style.display = 'block';
    soundEngine.startAmbient();
  });
  player.controls.addEventListener('unlock', () => {
    crosshair.style.display = 'none';
    resetMining();
    if (!gameUI.isOpen && !survival.dead) {
      renderOverlay();
      overlay.style.display = 'flex';
    }
  });

  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  renderer.domElement.addEventListener('mousedown', (e) => {
    if (!player.isLocked || gameUI.isOpen || survival.dead) return;

    if (e.button === 0 && currentMobHit) {
      const heldId = gameUI.selectedItemId;
      const heldItemDef = heldId ? getItemDef(heldId) : null;
      const damage = heldItemDef?.attackDamage ?? 1;
      const knockback = new THREE.Vector3().subVectors(currentMobHit.position, player.position);
      knockback.y = 0.15;
      knockback.normalize().multiplyScalar(3);
      currentMobHit.takeDamage(damage, knockback);
      soundEngine.hit();
      if (heldItemDef?.maxDurability && gameMode === 'survival') gameUI.damageSelectedTool();
      return;
    }

    if (e.button === 2 && currentMobHit && currentMobHit.config.kind === 'sheep' && gameUI.selectedItemId === 'shears') {
      // Shear a sheep instead of killing it for wool -- doesn't touch its HP.
      gameUI.giveItem('wool', 1 + Math.floor(Math.random() * 3));
      soundEngine.placeBlock();
      if (gameMode === 'survival') gameUI.damageSelectedTool();
      return;
    }

    if (!currentHit) return;

    if (e.button === 0) {
      // Actual breaking happens over time in animate() (see the mining
      // progress block below) — this just starts the hold.
      leftMouseDown = true;
    } else if (e.button === 2) {
      const targetId = chunkManager.getBlock(currentHit.x, currentHit.y, currentHit.z);
      if (targetId === BlockId.CraftingTable) {
        gameUI.openCraftingTable();
        return;
      }
      if (targetId === BlockId.Furnace) {
        gameUI.openFurnace(currentHit, (p) => furnaceManager.get(p.x, p.y, p.z));
        return;
      }

      const heldId = gameUI.selectedItemId;
      if (!heldId) return;
      const itemDef = getItemDef(heldId);

      if (heldId === 'bucket') {
        // Empty bucket raycast has to treat fluids as stoppable too --
        // the normal solid-only raycast walks straight through water/lava.
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const fluidHit = raycastVoxels(
          camera.position.x, camera.position.y, camera.position.z,
          dir.x, dir.y, dir.z, REACH,
          (x, y, z) => {
            const id = chunkManager.getBlock(x, y, z);
            return chunkManager.isSolid(x, y, z) || id === BlockId.Water || id === BlockId.Lava;
          }
        );
        if (fluidHit) {
          const fluidId = chunkManager.getBlock(fluidHit.x, fluidHit.y, fluidHit.z);
          if (fluidId === BlockId.Water || fluidId === BlockId.Lava) {
            chunkManager.setBlock(fluidHit.x, fluidHit.y, fluidHit.z, BlockId.Air);
            consumeSelected();
            gameUI.inventory.addItem(fluidId === BlockId.Water ? 'water_bucket' : 'lava_bucket', 1);
            gameUI.refreshHotbar();
            soundEngine.placeBlock();
          }
        }
        return;
      }
      if (heldId === 'water_bucket' || heldId === 'lava_bucket') {
        const [nx, ny, nz] = currentHit.normal;
        const px = currentHit.x + nx;
        const py = currentHit.y + ny;
        const pz = currentHit.z + nz;
        chunkManager.setBlock(px, py, pz, heldId === 'water_bucket' ? BlockId.Water : BlockId.Lava);
        consumeSelected();
        gameUI.inventory.addItem('bucket', 1);
        gameUI.refreshHotbar();
        soundEngine.placeBlock();
        return;
      }

      if (gameMode === 'survival' && itemDef.foodRestore && survival.hunger < survival.maxHunger) {
        survival.eat(itemDef.foodRestore);
        consumeSelected();
        gameUI.refreshHotbar();
        return;
      }
      if (!itemDef.isBlock || itemDef.blockId === undefined) return;

      const [nx, ny, nz] = currentHit.normal;
      const px = currentHit.x + nx;
      const py = currentHit.y + ny;
      const pz = currentHit.z + nz;
      const feet = player.position;
      const insidePlayer =
        Math.floor(px) === Math.floor(feet.x) &&
        Math.floor(pz) === Math.floor(feet.z) &&
        (Math.floor(py) === Math.floor(feet.y) || Math.floor(py) === Math.floor(feet.y + 1));
      if (!insidePlayer) {
        chunkManager.setBlock(px, py, pz, itemDef.blockId);
        soundEngine.placeBlock();
        consumeSelected();
        gameUI.refreshHotbar();
      }
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) leftMouseDown = false;
  });

  gameUI.onOpenScreen = () => {
    player.controls.unlock();
    resetMining();
  };
  gameUI.onCloseScreen = () => {
    if (player.controls.domElement) player.lock();
  };

  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;top:8px;left:8px;color:#fff;font:12px monospace;text-shadow:0 0 3px #000;pointer-events:none;';
  document.body.appendChild(hud);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const autosaveTimer = setInterval(doSave, 60000);
  window.addEventListener('beforeunload', () => {
    clearInterval(autosaveTimer);
  });

  let lastFootstepPos = player.position.clone();
  let loadingDone = false;
  let lastTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    heldItemView.setItem(gameUI.isOpen || survival.dead ? null : gameUI.selectedItemId);

    if (!loadingDone) {
      const ready = chunkManager.getReadyChunkCount();
      const total = chunkManager.getLoadedChunkCount();
      loading.setProgress(total > 0 ? ready / total : 0);
      if (total > 0 && ready === total) {
        loadingDone = true;
        loading.destroy();
      }
    }

    furnaceManager.tick(dt);
    gameUI.tickFurnaceUI();

    clock.update(dt);
    const sky = clock.getSky();
    (scene.background as THREE.Color).copy(sky.skyColor);
    (scene.fog as THREE.Fog).color.copy(sky.fogColor);
    nightOverlay.style.opacity = String(sky.ambientDarkness * 0.45);

    if (player.isLocked && !gameUI.isOpen && !survival.dead) {
      player.update(dt, (x, y, z) => chunkManager.isSolid(x, y, z), (x, y, z) => chunkManager.getBlock(x, y, z));
      chunkManager.setCenter(player.position.x, player.position.z);
      if (gameMode === 'survival') {
        if (player.fallDamageThisFrame > 0) {
          applyDamage(player.fallDamageThisFrame);
          soundEngine.damage();
        }
        survival.update(dt, player.sprinting);
        survival.updateBreath(dt, player.headUnderwater);
        if (player.inLava) applyDamage(dt * 4);
      }

      if (player.grounded && !player.inWater) {
        const dx = player.position.x - lastFootstepPos.x;
        const dz = player.position.z - lastFootstepPos.z;
        if (Math.hypot(dx, dz) > 0.9) {
          lastFootstepPos.copy(player.position);
          const belowId = chunkManager.getBlock(Math.floor(player.position.x), Math.floor(player.position.y - 0.1), Math.floor(player.position.z));
          soundEngine.footstep(footstepMaterialFor(belowId));
        }
      } else {
        lastFootstepPos.copy(player.position);
      }
    }
    if (survival.dead && player.isLocked) player.controls.unlock();
    survivalHUD.update(survival, gameMode);

    if (!gameUI.isOpen && !survival.dead) {
      mobManager.tick(
        dt,
        player.position,
        (x, y, z) => chunkManager.isSolid(x, y, z),
        sky.isNight,
        findSurfaceY,
        (x, y, z) => chunkManager.getLightLevel(x, y, z),
        (ex, ey, ez, radius, damage) => {
          const dist = player.position.distanceTo(new THREE.Vector3(ex, ey, ez));
          if (dist < radius) {
            applyDamage(Math.round(damage * (1 - dist / radius)));
            soundEngine.damage();
          }
        },
        (mob) => {
          for (const drop of mob.config.drops) {
            const count = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
            if (count > 0) gameUI.giveItem(drop.itemId, count);
          }
        }
      );
    }

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    currentHit = raycastVoxels(
      camera.position.x,
      camera.position.y,
      camera.position.z,
      dir.x,
      dir.y,
      dir.z,
      REACH,
      (x, y, z) => chunkManager.isSolid(x, y, z)
    );
    currentMobHit = mobManager.raycastMobs(camera.position, dir, REACH);
    if (currentMobHit && currentHit) {
      const blockDist = camera.position.distanceTo(new THREE.Vector3(currentHit.x + 0.5, currentHit.y + 0.5, currentHit.z + 0.5));
      const mobDist = camera.position.distanceTo(currentMobHit.position);
      if (mobDist > blockDist) currentMobHit = null;
    }
    if (currentHit && !gameUI.isOpen && !currentMobHit) {
      outline.position.set(currentHit.x + 0.5, currentHit.y + 0.5, currentHit.z + 0.5);
      outline.visible = true;
    } else {
      outline.visible = false;
    }

    if (leftMouseDown && currentHit && !currentMobHit && player.isLocked && !gameUI.isOpen && !survival.dead) {
      const sameTarget = miningTarget && miningTarget.x === currentHit.x && miningTarget.y === currentHit.y && miningTarget.z === currentHit.z;
      if (!sameTarget) {
        miningTarget = { x: currentHit.x, y: currentHit.y, z: currentHit.z };
        miningProgress = 0;
      }
      const blockId = chunkManager.getBlock(currentHit.x, currentHit.y, currentHit.z);
      const blockDef = getBlockDef(blockId);
      const heldId = gameUI.selectedItemId;
      const heldItemDef = heldId ? getItemDef(heldId) : null;
      const required = gameMode === 'creative' ? (blockDef.hardness === Infinity ? Infinity : 0) : miningSeconds(blockDef, heldItemDef);
      if (required === Infinity) {
        miningProgress = 0;
        miningBarOuter.style.display = 'none';
        crackOverlay.hide();
      } else {
        miningProgress += dt;
        miningBarOuter.style.display = 'block';
        const fraction = Math.min(1, miningProgress / Math.max(required, 0.0001));
        miningBarFill.style.width = `${fraction * 100}%`;
        crackOverlay.update(currentHit.x, currentHit.y, currentHit.z, fraction);
        if (miningProgress >= required) {
          breakBlock(currentHit.x, currentHit.y, currentHit.z);
          miningProgress = 0;
          miningTarget = null;
          miningBarOuter.style.display = 'none';
          crackOverlay.hide();
        }
      }
    } else if (miningProgress > 0 || miningTarget) {
      miningProgress = 0;
      miningTarget = null;
      miningBarOuter.style.display = 'none';
      crackOverlay.hide();
    }

    hud.textContent = `${opts.worldName} | seed: ${opts.seed} | chunks: ${chunkManager.getReadyChunkCount()}/${chunkManager.getLoadedChunkCount()} | pos: ${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}, ${player.position.z.toFixed(1)} | ${player.flying ? 'flying' : player.grounded ? 'grounded' : 'air'} | mobs: ${mobManager.getMobs().length} | ${sky.isNight ? 'night' : 'day'}`;

    renderer.render(scene, camera);
  }
  animate();
}

new MainMenu((opts) => startGame(opts));

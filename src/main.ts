import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ChunkManager } from './engine/world/chunkManager';
import { TerrainGenerator, SEA_LEVEL } from './engine/worldgen/terrain';
import { raycastVoxels } from './engine/world/voxelRaycast';
import { PlayerController } from './game/player/playerController';
import { BlockId, tierIndex, ToolTier } from './game/items/blockDefs';
import { getBlockDef } from './game/items/blocks';
import { averageTileColor } from './engine/mesh/textureAtlas';
import { preloadModels, ALL_MODEL_NAMES } from './engine/assets/models';
import { itemIconUrl } from './ui/itemIcons';
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
import { Arrow } from './game/entities/projectile';
import { updateSwayTime } from './engine/mesh/blockMaterials';
import { MainMenu, PlayOptions, renderSettingsPanel } from './ui/mainMenu';
import { TITLE_FONT, BODY_FONT, logoTextShadow, buttonStyle, attachButtonHover, panelStyle } from './ui/pixelStyle';
import { LoadingScreen } from './ui/loadingScreen';
import { loadSettings } from './persistence/settings';
import { saveWorld, WorldSaveData } from './persistence/saveSystem';
import { soundEngine, FootstepMaterial } from './audio/soundEngine';
import type { Slot } from './game/player/inventory';

const app = document.getElementById('app')!;

const SUN_DAY_COLOR = new THREE.Color(0xffffff);
const SUN_WARM_COLOR = new THREE.Color(0xffa552); // low-elevation (sunrise/sunset) tint

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

// --- Procedural sky dressing (sun/moon discs, stars, clouds) --------------
// All textures are generated on a <canvas> at startup, same no-external-
// assets approach as the block textures, so there's nothing to fetch/host.

function makeGlowDiscTexture(coreColor: string, edgeAlpha = 0): HTMLCanvasElement {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, coreColor);
  grad.addColorStop(0.55, coreColor);
  grad.addColorStop(1, `rgba(255,255,255,${edgeAlpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function makeMoonTexture(): THREE.CanvasTexture {
  const canvas = makeGlowDiscTexture('rgba(226,230,238,1)');
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(170,178,196,0.5)';
  const craters: [number, number, number][] = [[46, 40, 9], [80, 58, 13], [58, 82, 7], [90, 30, 6], [34, 78, 5]];
  for (const [cx, cy, r] of craters) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

function makeStarField(count: number, radius: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = 1 - 2 * Math.random();
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = 2 * Math.PI * Math.random();
    positions[i * 3] = Math.cos(theta) * r * radius;
    positions[i * 3 + 1] = Math.abs(y) * radius; // upper hemisphere only -- stars, not underworld glow
    positions[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.renderOrder = -3;
  return points;
}

/** A seamlessly-tileable soft cloud texture: blobs are stamped at their base
 * position plus all 8 neighboring offsets so edges wrap cleanly under
 * THREE.RepeatWrapping. */
function makeCloudTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  const blobs: [number, number, number][] = [];
  const rand = mulberry32(1337);
  for (let i = 0; i < 22; i++) {
    blobs.push([rand() * size, rand() * size, 30 + rand() * 70]);
  }
  for (const [bx, by, r] of blobs) {
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const x = bx + ox;
        const y = by + oy;
        if (x < -r || x > size + r || y < -r || y > size + r) continue;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.6, 'rgba(255,255,255,0.5)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function startGame(opts: PlayOptions) {
  const gameMode: GameMode = opts.gameMode;
  const settings = loadSettings();
  soundEngine.ensureStarted();
  soundEngine.setVolumes(settings.masterVolume, settings.sfxVolume, settings.musicVolume);

  const loading = new LoadingScreen(opts.worldName);
  // Fire-and-forget: kicks off loading every tool/weapon/mob GLB the user
  // generated in parallel with world/chunk generation. 1.6MB total, so this
  // almost always finishes well before the loading screen does -- held
  // items and mobs check isModelReady() and fall back gracefully (icon
  // plane / old procedural mesh) for the rare case a model isn't cached yet.
  preloadModels(ALL_MODEL_NAMES);

  const FOG_NEAR = 70;
  const FOG_FAR = 105;
  const UNDERWATER_FOG_COLOR = new THREE.Color(0x1c4a78);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, FOG_NEAR, FOG_FAR);

  const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.1, 800);
  camera.rotation.order = 'YXZ';
  scene.add(camera); // required for objects parented to the camera (heldItemView) to render at all

  const heldItemView = new HeldItemView();
  camera.add(heldItemView.mesh);

  // Real dynamic lighting: the mesher has always emitted proper face normals
  // (see culledMesher.ts), they just went unused under the old MeshBasicMaterial.
  // The sun tracks GameClock's already-computed sunDirection every frame
  // below; hemiLight is a cheap always-on sky/ground fill so shadowed faces
  // never go pure black (the baked per-face vertex shading still supplies
  // the Minecraft-style AO/light-level base on top of this).
  const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 260;
  // Kept tight (a ~44-block radius around the player) rather than matching
  // full render distance: shadow cost scales with frustum area, not chunk
  // count, so a small frustum is what keeps this affordable every frame.
  const SHADOW_HALF_SIZE = 44;
  sunLight.shadow.camera.left = -SHADOW_HALF_SIZE;
  sunLight.shadow.camera.right = SHADOW_HALF_SIZE;
  sunLight.shadow.camera.top = SHADOW_HALF_SIZE;
  sunLight.shadow.camera.bottom = -SHADOW_HALF_SIZE;
  sunLight.shadow.camera.updateProjectionMatrix();
  sunLight.shadow.bias = -0.0015;
  sunLight.shadow.normalBias = 0.03;
  // Shadows should read as "slightly dimmer", not "can't see anything here"
  // -- full-strength cast shadows under a tree canopy or next to any
  // building made the ground underneath too dark to make out. Below 1
  // blends the shadowed result back toward the unshadowed one instead of
  // fully cutting the sun's direct contribution.
  sunLight.shadow.intensity = 0.4;
  scene.add(sunLight);
  scene.add(sunLight.target);
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3a2f1a, 0.55);
  scene.add(hemiLight);

  // Sky dressing: sun/moon discs and a starfield, all positioned at a fixed
  // "infinite" distance from the camera and recentered on it every frame
  // (see the sky-follow block in animate()), same trick as a skybox.
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(makeGlowDiscTexture('rgba(255,252,235,1)')), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })
  );
  sunSprite.scale.set(55, 55, 1);
  sunSprite.renderOrder = -2;
  scene.add(sunSprite);

  const moonSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: makeMoonTexture(), transparent: true, depthWrite: false, fog: false })
  );
  moonSprite.scale.set(38, 38, 1);
  moonSprite.renderOrder = -2;
  scene.add(moonSprite);

  const stars = makeStarField(1400, 400);
  scene.add(stars);

  // Drifting cloud layer: one big plane recentered under the player each
  // frame with the UV offset animated over time, so the clouds themselves
  // drift independently of camera movement.
  const cloudTexture = makeCloudTexture();
  const cloudMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshBasicMaterial({ map: cloudTexture, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, fog: true })
  );
  cloudMesh.rotation.x = Math.PI / 2;
  cloudMesh.position.y = 148;
  cloudMesh.renderOrder = -1;
  scene.add(cloudMesh);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  app.innerHTML = '';
  app.appendChild(renderer.domElement);

  // Conservative bloom: only pixels already near-white (sun disc, bright sky
  // near the horizon) pick up a soft glow -- ordinary block faces sit well
  // below the threshold so they're untouched.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.4, 0.86);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  const chunkManager = new ChunkManager(scene, { seed: opts.seed, renderDistance: settings.renderDistance });
  if (opts.existingSave) chunkManager.loadEdits(opts.existingSave.blockEdits);

  // Real per-torch point lights: obviously brightens its immediate area
  // (the point of the whole complaint that touched this off), on top of the
  // baked block-light tint that already existed for the mesh's own shading.
  // Capped to the nearest MAX_ACTIVE_TORCH_LIGHTS, distance-culled
  // periodically, so a base full of torches doesn't blow up the light
  // budget -- torches far from the player just fall back to the baked tint.
  const TORCH_LIGHT_RANGE = 10;
  const MAX_ACTIVE_TORCH_LIGHTS = 12;
  const torchPositions = new Map<string, THREE.Vector3>();
  const activeTorchLights = new Map<string, THREE.PointLight>();
  const torchKey = (x: number, y: number, z: number) => `${x},${y},${z}`;
  function registerTorch(x: number, y: number, z: number) {
    torchPositions.set(torchKey(x, y, z), new THREE.Vector3(x + 0.5, y + 0.6, z + 0.5));
  }
  function unregisterTorch(x: number, y: number, z: number) {
    const tk = torchKey(x, y, z);
    torchPositions.delete(tk);
    const light = activeTorchLights.get(tk);
    if (light) {
      scene.remove(light);
      activeTorchLights.delete(tk);
    }
  }
  function refreshTorchLights(playerPos: THREE.Vector3) {
    const inRange = Array.from(torchPositions.entries())
      .map(([tk, pos]) => ({ tk, pos, dist: pos.distanceTo(playerPos) }))
      .filter((t) => t.dist < TORCH_LIGHT_RANGE)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, MAX_ACTIVE_TORCH_LIGHTS);
    const wanted = new Set(inRange.map((t) => t.tk));
    for (const [tk, light] of activeTorchLights) {
      if (!wanted.has(tk)) {
        scene.remove(light);
        activeTorchLights.delete(tk);
      }
    }
    for (const t of inRange) {
      if (activeTorchLights.has(t.tk)) continue;
      const light = new THREE.PointLight(0xffaa55, 1.3, TORCH_LIGHT_RANGE, 2);
      light.position.copy(t.pos);
      scene.add(light);
      activeTorchLights.set(t.tk, light);
    }
  }
  if (opts.existingSave) {
    for (const [posKey, blockId] of opts.existingSave.blockEdits) {
      if (blockId === BlockId.Torch) {
        const [ex, ey, ez] = posKey.split(',').map(Number);
        registerTorch(ex, ey, ez);
      }
    }
  }

  // Simple fluid spread: breaking a block next to standing water/lava lets
  // it pour into the new opening instead of sitting frozen next to a hole,
  // like it did before. Not a full vanilla flow-level simulation (no
  // partial "flowing" visual states) -- just a bounded, gently-paced BFS
  // seeded from whatever cell just became air, so it reads as the fluid
  // actually finding its way into new space. Capped both sideways (matches
  // vanilla water's 7-block max travel) and by a fall-depth limit, so
  // opening one hole next to an ocean can't drain the whole thing.
  const FLUID_SPREAD_DELAY = 0.12;
  const FLUID_SIDE_SPREAD_LIMIT = 7;
  const FLUID_FALL_LIMIT = 40;
  interface FluidSpreadJob {
    x: number;
    y: number;
    z: number;
    fluidId: number;
    sideDist: number;
    fallDist: number;
  }
  const fluidSpreadQueue: FluidSpreadJob[] = [];
  let fluidSpreadTimer = 0;
  function tryFluidSpread(job: FluidSpreadJob) {
    if (chunkManager.getBlock(job.x, job.y, job.z) !== BlockId.Air) return;
    chunkManager.setBlock(job.x, job.y, job.z, job.fluidId);
    if (!chunkManager.isSolid(job.x, job.y - 1, job.z) && job.fallDist < FLUID_FALL_LIMIT) {
      // Prioritize falling over spreading sideways, like a real waterfall --
      // only spreads outward once it lands on something solid.
      fluidSpreadQueue.push({ x: job.x, y: job.y - 1, z: job.z, fluidId: job.fluidId, sideDist: 0, fallDist: job.fallDist + 1 });
      return;
    }
    if (job.sideDist >= FLUID_SIDE_SPREAD_LIMIT) return;
    const sideDist = job.sideDist + 1;
    const sideOffsets: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of sideOffsets) {
      fluidSpreadQueue.push({ x: job.x + dx, y: job.y, z: job.z + dz, fluidId: job.fluidId, sideDist, fallDist: 0 });
    }
  }
  /** Call whenever (x,y,z) just became air -- if a fluid source is touching
   * it, seed a spread starting there. */
  function scheduleFluidCheck(x: number, y: number, z: number) {
    const neighbors: [number, number, number][] = [
      [x + 1, y, z], [x - 1, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1],
    ];
    for (const [nx, ny, nz] of neighbors) {
      const nId = chunkManager.getBlock(nx, ny, nz);
      if (nId === BlockId.Water || nId === BlockId.Lava) {
        fluidSpreadQueue.push({ x, y, z, fluidId: nId, sideDist: 0, fallDist: 0 });
        return;
      }
    }
  }

  const player = new PlayerController(camera, renderer.domElement);
  player.controls.pointerSpeed = settings.mouseSensitivity;
  player.flightAllowed = gameMode === 'creative'; // free flight is a creative-only privilege, matching vanilla
  // Real ground height at the spawn column (not a fixed y=90) so a brand-new
  // world drops the player right onto the terrain instead of into a long
  // fall from high in the air. getHeight() is pure/synchronous (same noise
  // the chunk worker uses), so this doesn't need to wait for any chunk to
  // actually finish generating -- cheap enough to search a small spiral
  // around the origin for a dry-land column (matching vanilla's own
  // land-seeking spawn search) instead of risking (0,0) landing underwater.
  function findLandSpawn(seed: number): { x: number; z: number; y: number } {
    const terrain = new TerrainGenerator(seed);
    const originHeight = terrain.getHeight(0, 0);
    if (originHeight >= SEA_LEVEL) return { x: 0, z: 0, y: originHeight };
    for (let radius = 4; radius <= 64; radius += 4) {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const x = Math.round(Math.cos(angle) * radius);
        const z = Math.round(Math.sin(angle) * radius);
        const h = terrain.getHeight(x, z);
        if (h >= SEA_LEVEL) return { x, z, y: h };
      }
    }
    return { x: 0, z: 0, y: originHeight }; // all ocean nearby -- fall back to spawning at sea level
  }
  const landSpawn = findLandSpawn(opts.seed);
  const spawnGroundY = Math.max(landSpawn.y, SEA_LEVEL);
  const SPAWN_POSITION = new THREE.Vector3(landSpawn.x + 0.5, spawnGroundY + 1, landSpawn.z + 0.5);
  if (!opts.existingSave) player.position.copy(SPAWN_POSITION);

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

  const waterOverlay = document.createElement('div');
  waterOverlay.style.cssText = 'position:fixed;inset:0;background:radial-gradient(circle,rgba(40,110,180,0.25) 0%,rgba(20,70,140,0.55) 100%);opacity:0;pointer-events:none;z-index:6;transition:opacity 0.4s linear;';
  document.body.appendChild(waterOverlay);

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
        // Water/lava aren't "solid" (see chunkManager.isSolid), so the scan
        // above naturally walks straight through a lake and lands on its
        // bed -- without this check that reads as a valid open-air surface
        // and mobs (chickens, etc.) spawn on the lake floor, submerged.
        const above = chunkManager.getBlock(x, y + 1, z);
        if (above === BlockId.Water || above === BlockId.Lava) return null;
        return y;
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

  const arrows: Arrow[] = [];

  /** Creative mode has infinite blocks/items -- only survival consumes the
   * stack that was just placed/used/turned into a bucket. */
  function consumeSelected(count = 1) {
    if (gameMode === 'creative') return;
    gameUI.inventory.removeFromSlot(gameUI.inventory.selectedHotbarIndex, count);
  }

  let leftMouseDown = false;
  let miningTarget: { x: number; y: number; z: number } | null = null;
  let miningProgress = 0;
  let miningSwingTimer = 0;

  function resetMining() {
    leftMouseDown = false;
    miningTarget = null;
    miningProgress = 0;
    miningBarOuter.style.display = 'none';
    crackOverlay.hide();
  }

  // Block-break debris: a handful of small cubes tinted with the broken
  // block's own average texture color (so it reads as a real chunk of that
  // block, same idea as vanilla Minecraft's break particles), tossed with
  // random velocity and settling under gravity/collision before fading out.
  interface BreakParticle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    age: number;
    maxLife: number;
  }
  const breakParticles: BreakParticle[] = [];
  function spawnBreakParticles(bx: number, by: number, bz: number, blockId: number) {
    const def = getBlockDef(blockId);
    const [r, g, b] = averageTileColor(def.top);
    const color = new THREE.Color(r / 255, g / 255, b / 255);
    for (let i = 0; i < 7; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), new THREE.MeshLambertMaterial({ color }));
      mesh.position.set(
        bx + 0.5 + (Math.random() - 0.5) * 0.7,
        by + 0.3 + Math.random() * 0.5,
        bz + 0.5 + (Math.random() - 0.5) * 0.7
      );
      scene.add(mesh);
      breakParticles.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 2.6 + 1.4, (Math.random() - 0.5) * 2.4),
        age: 0,
        maxLife: 0.45 + Math.random() * 0.3,
      });
    }
  }
  function updateBreakParticles(dt: number) {
    for (let i = breakParticles.length - 1; i >= 0; i--) {
      const p = breakParticles[i];
      p.age += dt;
      p.velocity.y -= 9 * dt;
      const next = p.mesh.position.clone().addScaledVector(p.velocity, dt);
      if (chunkManager.isSolid(Math.floor(next.x), Math.floor(next.y), Math.floor(next.z))) {
        p.velocity.set(0, 0, 0);
      } else {
        p.mesh.position.copy(next);
      }
      if (p.age >= p.maxLife) {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        breakParticles.splice(i, 1);
      } else {
        p.mesh.scale.setScalar(1 - (p.age / p.maxLife) * 0.6);
      }
    }
  }

  // Physical item drops: breaking a block (or a mob dying, or shearing a
  // sheep) used to add straight to the inventory instantly. Real Minecraft
  // drops the item on the ground instead, with its own little fall/bounce,
  // and only actually collects it once the player walks close enough --
  // this reproduces that instead of the instant pickup.
  const dropIconCache = new Map<string, THREE.Texture>();
  function getDropIconTexture(itemId: string): THREE.Texture {
    let tex = dropIconCache.get(itemId);
    if (tex) return tex;
    const img = new Image();
    tex = new THREE.Texture(img);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    img.onload = () => {
      tex!.needsUpdate = true;
    };
    img.src = itemIconUrl(getItemDef(itemId));
    dropIconCache.set(itemId, tex);
    return tex;
  }

  interface ItemDrop {
    itemId: string;
    count: number;
    sprite: THREE.Sprite;
    velocity: THREE.Vector3;
    age: number;
  }
  const itemDrops: ItemDrop[] = [];
  const DROP_PICKUP_RADIUS = 1.1;
  const DROP_PICKUP_DELAY = 0.4; // matches vanilla's brief can't-instantly-reabsorb window
  const DROP_MAX_AGE = 120; // despawn after 2 minutes, same idea as vanilla's 5-minute item timeout

  function spawnItemDrop(bx: number, by: number, bz: number, itemId: string, count: number) {
    const mat = new THREE.SpriteMaterial({ map: getDropIconTexture(itemId), transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.35, 0.35, 1);
    sprite.position.set(bx + 0.5 + (Math.random() - 0.5) * 0.4, by + 0.4, bz + 0.5 + (Math.random() - 0.5) * 0.4);
    scene.add(sprite);
    itemDrops.push({
      itemId,
      count,
      sprite,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 1.4, 2.2, (Math.random() - 0.5) * 1.4),
      age: 0,
    });
  }

  function updateItemDrops(dt: number) {
    for (let i = itemDrops.length - 1; i >= 0; i--) {
      const d = itemDrops[i];
      d.age += dt;
      d.velocity.y -= 9 * dt;
      const next = d.sprite.position.clone().addScaledVector(d.velocity, dt);
      if (chunkManager.isSolid(Math.floor(next.x), Math.floor(next.y), Math.floor(next.z))) {
        d.velocity.set(0, 0, 0);
      } else {
        d.sprite.position.copy(next);
      }

      let collected = false;
      if (d.age >= DROP_PICKUP_DELAY) {
        const dx = d.sprite.position.x - player.position.x;
        const dy = d.sprite.position.y - (player.position.y + 0.9);
        const dz = d.sprite.position.z - player.position.z;
        if (dx * dx + dy * dy + dz * dz < DROP_PICKUP_RADIUS * DROP_PICKUP_RADIUS) {
          gameUI.giveItem(d.itemId, d.count);
          soundEngine.uiClick();
          collected = true;
        }
      }
      if (collected || d.age > DROP_MAX_AGE) {
        scene.remove(d.sprite);
        (d.sprite.material as THREE.SpriteMaterial).map?.dispose();
        (d.sprite.material as THREE.Material).dispose();
        itemDrops.splice(i, 1);
      }
    }
  }

  /** Breaks the block at (x,y,z): removes it, plays the sound, drops the
   * harvested item (if the held tool meets the block's minimum tier) and
   * damages the held tool. Shared by the instant-break path (hardness 0
   * blocks) and the hold-to-mine completion path. */
  function breakBlock(x: number, y: number, z: number) {
    const brokenId = chunkManager.getBlock(x, y, z);
    if (brokenId === BlockId.Air) return;
    spawnBreakParticles(x, y, z, brokenId);
    chunkManager.setBlock(x, y, z, BlockId.Air);
    scheduleFluidCheck(x, y, z);
    soundEngine.breakBlock();
    if (brokenId === BlockId.Furnace) furnaceManager.remove(x, y, z);
    if (brokenId === BlockId.Torch) unregisterTorch(x, y, z);

    if (gameMode === 'creative') return; // block just vanishes: no drop, no tool wear (matches vanilla creative)

    const blockDef = getBlockDef(brokenId);
    const heldId = gameUI.selectedItemId;
    const heldItemDef = heldId ? getItemDef(heldId) : null;
    const harvestable =
      blockDef.toolType !== 'pickaxe' ||
      (heldItemDef?.toolType === 'pickaxe' && tierIndex(heldItemDef.toolTier as ToolTier) >= tierIndex(blockDef.minToolTier));
    if (harvestable) {
      const dropId = blockDropItemId(brokenId);
      if (dropId) spawnItemDrop(x, y, z, dropId, 1);
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
      const flyHint = gameMode === 'creative' ? ' · F létání' : '';
      hint.innerHTML =
        `WASD pohyb · myš rozhlížení · mezerník skok · Shift crouch · Ctrl sprint${flyHint}<br/>levé tlačítko těžba/útok · pravé tlačítko pokládání/interakce/jídlo · E inventář · kolečko/1-9 hotbar · Esc pauza`;
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
      heldItemView.swing();
      if (heldItemDef?.maxDurability && gameMode === 'survival') gameUI.damageSelectedTool();
      return;
    }

    if (e.button === 2 && currentMobHit && currentMobHit.config.kind === 'sheep' && gameUI.selectedItemId === 'shears') {
      // Shear a sheep instead of killing it for wool -- doesn't touch its HP.
      spawnItemDrop(
        Math.floor(currentMobHit.position.x),
        Math.floor(currentMobHit.position.y),
        Math.floor(currentMobHit.position.z),
        'wool',
        1 + Math.floor(Math.random() * 3)
      );
      soundEngine.placeBlock();
      if (gameMode === 'survival') gameUI.damageSelectedTool();
      return;
    }

    if (e.button === 2 && gameUI.selectedItemId === 'bow') {
      // Bow draws its ammo from anywhere in the inventory, not just the
      // selected slot (matches vanilla) -- creative never runs out.
      if (gameMode === 'creative' || gameUI.inventory.removeItem('arrow', 1)) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const origin = camera.position.clone().addScaledVector(dir, 0.6);
        const arrow = new Arrow(origin, dir);
        scene.add(arrow.mesh);
        arrows.push(arrow);
        soundEngine.placeBlock();
        if (gameMode === 'survival') gameUI.damageSelectedTool();
      }
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
            scheduleFluidCheck(fluidHit.x, fluidHit.y, fluidHit.z);
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
        if (itemDef.blockId === BlockId.Torch) registerTorch(px, py, pz);
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
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.setSize(window.innerWidth, window.innerHeight);
  });

  const autosaveTimer = setInterval(doSave, 60000);
  window.addEventListener('beforeunload', () => {
    clearInterval(autosaveTimer);
  });

  let lastFootstepPos = player.position.clone();
  let loadingDone = false;
  let lastTime = performance.now();
  let elapsedTime = 0; // free-running seconds for the wind/wave shader (never wraps, unlike clock.elapsed)
  let torchRefreshTimer = 0;

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    heldItemView.setItem(gameUI.isOpen || survival.dead ? null : gameUI.selectedItemId);
    heldItemView.update(dt);

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

    // Sun follows the day/night cycle's already-computed direction; it only
    // actually lights the world while above the horizon (elevation > 0) --
    // below that, moonlit visibility comes from hemiLight + the baked block
    // light in vertex colors, same as before this lighting pass existed.
    const elevation = Math.max(0, sky.sunDirection.y);
    sunLight.position.copy(camera.position).addScaledVector(sky.sunDirection, 200);
    sunLight.target.position.copy(camera.position);
    sunLight.intensity = elevation * 1.1;
    const warmth = THREE.MathUtils.clamp(1 - elevation * 2.2, 0, 1);
    sunLight.color.copy(SUN_DAY_COLOR).lerp(SUN_WARM_COLOR, warmth);
    // Raised from the original 0.14/0.46 -- shaded daytime spots (under a
    // tree canopy, north sides of buildings, anywhere the shadow map blocks
    // direct sun) had only this ambient term to fall back on, and it read
    // as too dark to see well. Night floor (0.2) stays clearly dimmer than
    // day so a torch's light -- baked tint plus its own PointLight -- still
    // reads as making a real difference.
    hemiLight.intensity = 0.2 + (1 - sky.ambientDarkness) * 0.55;
    hemiLight.color.copy(sky.skyColor);

    // Sun/moon discs and stars sit at a fixed distance from the camera and
    // just get recentered every frame, like a conventional skybox -- the
    // moon is exactly opposite the sun, matching real Minecraft's sky.
    sunSprite.position.copy(camera.position).addScaledVector(sky.sunDirection, 400);
    moonSprite.position.copy(camera.position).addScaledVector(sky.sunDirection, -400);
    (sunSprite.material as THREE.SpriteMaterial).opacity = 1 - sky.ambientDarkness;
    (moonSprite.material as THREE.SpriteMaterial).opacity = sky.ambientDarkness;
    (stars.material as THREE.PointsMaterial).opacity = sky.ambientDarkness * 0.9;
    stars.position.copy(camera.position);

    // Clouds drift on their own via animated UV offset; the plane itself
    // just follows the player on x/z so it never scrolls out of view.
    cloudMesh.position.x = camera.position.x;
    cloudMesh.position.z = camera.position.z;
    const cloudMap = (cloudMesh.material as THREE.MeshBasicMaterial).map!;
    cloudMap.offset.x = elapsedTime * 0.004;
    cloudMap.offset.y = elapsedTime * 0.0015;
    (cloudMesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - sky.ambientDarkness * 0.6);

    // Underwater look: denser near fog in a blue-green tint plus a screen
    // tint overlay, using the head-submersion flag survival breath already
    // relies on -- no new detection logic needed.
    if (player.headUnderwater) {
      (scene.fog as THREE.Fog).color.copy(UNDERWATER_FOG_COLOR);
      (scene.fog as THREE.Fog).near = 1;
      (scene.fog as THREE.Fog).far = 22;
      waterOverlay.style.opacity = '1';
    } else {
      (scene.fog as THREE.Fog).near = FOG_NEAR;
      (scene.fog as THREE.Fog).far = FOG_FAR;
      waterOverlay.style.opacity = '0';
    }

    elapsedTime += dt;
    updateSwayTime(elapsedTime);
    updateBreakParticles(dt);
    updateItemDrops(dt);

    torchRefreshTimer -= dt;
    if (torchRefreshTimer <= 0) {
      torchRefreshTimer = 0.5;
      refreshTorchLights(player.position);
    }

    fluidSpreadTimer -= dt;
    if (fluidSpreadTimer <= 0 && fluidSpreadQueue.length > 0) {
      fluidSpreadTimer = FLUID_SPREAD_DELAY;
      const batch = fluidSpreadQueue.splice(0, 3);
      for (const job of batch) tryFluidSpread(job);
    }

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
            if (count > 0) {
              spawnItemDrop(Math.floor(mob.position.x), Math.floor(mob.position.y), Math.floor(mob.position.z), drop.itemId, count);
            }
          }
        }
      );
    }

    for (let i = arrows.length - 1; i >= 0; i--) {
      const arrow = arrows[i];
      arrow.update(dt, (x, y, z) => chunkManager.isSolid(x, y, z), mobManager.getMobs(), (mob, velocity) => {
        const knockback = velocity.clone().normalize().multiplyScalar(2.5);
        knockback.y = 0.2;
        mob.takeDamage(5, knockback);
        soundEngine.hit();
      });
      if (arrow.dead) {
        scene.remove(arrow.mesh);
        arrows.splice(i, 1);
      }
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
        // Swings the hand repeatedly while a hit lands, like vanilla's arm
        // animation, instead of it sitting frozen for the whole mining bar.
        miningSwingTimer -= dt;
        if (miningSwingTimer <= 0) {
          heldItemView.swing();
          miningSwingTimer = 0.3;
        }
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
      miningSwingTimer = 0;
      miningBarOuter.style.display = 'none';
      crackOverlay.hide();
    }

    hud.textContent = `${opts.worldName} | seed: ${opts.seed} | chunks: ${chunkManager.getReadyChunkCount()}/${chunkManager.getLoadedChunkCount()} | pos: ${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}, ${player.position.z.toFixed(1)} | ${player.flying ? 'flying' : player.grounded ? 'grounded' : 'air'} | mobs: ${mobManager.getMobs().length} | ${sky.isNight ? 'night' : 'day'}`;

    composer.render();
  }
  animate();
}

new MainMenu((opts) => startGame(opts));

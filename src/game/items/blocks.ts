import {
  atlasBuilder,
  solid,
  speckled,
  grain,
  rings,
  crossFoliage,
  liquid,
  glassTile,
  emissiveGlow,
  TileRect,
} from '../../engine/mesh/textureAtlas';
import { RAW_BLOCKS, RawBlockDef, BlockId } from './blockDefs';

export { BlockId, tierIndex } from './blockDefs';
export type { RenderType, ToolType, ToolTier } from './blockDefs';

export interface BlockDef extends RawBlockDef {
  top: TileRect;
  side: TileRect;
  bottom: TileRect;
}

function uniform(tile: TileRect) {
  return { top: tile, side: tile, bottom: tile };
}
function topSideBottom(top: TileRect, side: TileRect, bottom: TileRect) {
  return { top, side, bottom };
}
function topSide(top: TileRect, side: TileRect) {
  return { top, side, bottom: side };
}

// ---------------- tiles ----------------
const T = {
  bedrock: atlasBuilder.register('bedrock', speckled([50, 50, 50], [20, 20, 20], 0.25)),
  stone: atlasBuilder.register('stone', speckled([128, 128, 128], [110, 110, 110], 0.15)),
  cobblestone: atlasBuilder.register('cobblestone', speckled([120, 120, 120], [90, 90, 90], 0.3)),
  dirt: atlasBuilder.register('dirt', speckled([134, 96, 67], [110, 78, 52], 0.15)),
  grass_top: atlasBuilder.register('grass_top', speckled([95, 159, 53], [80, 140, 45], 0.2)),
  grass_side: atlasBuilder.register('grass_side', (ctx, px, py, size, rng) => {
    speckled([134, 96, 67], [110, 78, 52], 0.15)(ctx, px, py, size, rng);
    for (let x = 0; x < size; x++) {
      const n = Math.floor((rng() - 0.5) * 20);
      ctx.fillStyle = `rgb(${95 + n},${159 + n},${53 + n})`;
      ctx.fillRect(px + x, py, 1, 3);
    }
  }),
  sand: atlasBuilder.register('sand', speckled([219, 205, 145], [200, 185, 125], 0.1)),
  gravel: atlasBuilder.register('gravel', speckled([131, 127, 124], [100, 96, 93], 0.35)),
  sandstone: atlasBuilder.register('sandstone', solid([214, 200, 154], 10)),
  snow: atlasBuilder.register('snow', solid([250, 250, 252], 6)),
  ice: atlasBuilder.register('ice', solid([160, 200, 230], 8)),
  clay: atlasBuilder.register('clay', speckled([160, 166, 179], [140, 146, 159], 0.1)),
  oak_log_side: atlasBuilder.register('oak_log_side', grain([107, 84, 52], [70, 52, 30])),
  oak_log_top: atlasBuilder.register('oak_log_top', rings([150, 118, 75], [90, 65, 40])),
  oak_leaves: atlasBuilder.register('oak_leaves', speckled([63, 114, 45], [45, 95, 30], 0.35)),
  oak_planks: atlasBuilder.register('oak_planks', grain([176, 143, 92], [150, 115, 70])),
  birch_log_side: atlasBuilder.register('birch_log_side', grain([224, 223, 216], [70, 70, 65])),
  birch_log_top: atlasBuilder.register('birch_log_top', rings([230, 225, 210], [190, 180, 160])),
  birch_leaves: atlasBuilder.register('birch_leaves', speckled([120, 150, 60], [100, 130, 45], 0.3)),
  birch_planks: atlasBuilder.register('birch_planks', grain([222, 205, 160], [195, 175, 130])),
  spruce_log_side: atlasBuilder.register('spruce_log_side', grain([69, 50, 33], [45, 32, 20])),
  spruce_log_top: atlasBuilder.register('spruce_log_top', rings([100, 75, 50], [60, 42, 28])),
  spruce_leaves: atlasBuilder.register('spruce_leaves', speckled([40, 80, 50], [25, 60, 35], 0.35)),
  spruce_planks: atlasBuilder.register('spruce_planks', grain([120, 85, 55], [95, 65, 40])),
  sapling: atlasBuilder.register('sapling', crossFoliage([70, 140, 50])),
  tall_grass: atlasBuilder.register('tall_grass', crossFoliage([95, 159, 53])),
  flower_red: atlasBuilder.register('flower_red', crossFoliage([200, 40, 40])),
  flower_yellow: atlasBuilder.register('flower_yellow', crossFoliage([220, 200, 40])),
  cactus_side: atlasBuilder.register('cactus_side', speckled([60, 110, 50], [40, 90, 35], 0.1)),
  cactus_top: atlasBuilder.register('cactus_top', solid([70, 120, 55], 10)),
  mushroom: atlasBuilder.register('mushroom', crossFoliage([200, 80, 60])),
  coal_ore: atlasBuilder.register('coal_ore', speckled([128, 128, 128], [20, 20, 20], 0.18)),
  iron_ore: atlasBuilder.register('iron_ore', speckled([128, 128, 128], [200, 170, 130], 0.16)),
  gold_ore: atlasBuilder.register('gold_ore', speckled([128, 128, 128], [235, 200, 60], 0.16)),
  diamond_ore: atlasBuilder.register('diamond_ore', speckled([128, 128, 128], [90, 220, 220], 0.14)),
  redstone_ore: atlasBuilder.register('redstone_ore', speckled([128, 128, 128], [210, 30, 30], 0.16)),
  lapis_ore: atlasBuilder.register('lapis_ore', speckled([128, 128, 128], [40, 60, 190], 0.16)),
  glass: atlasBuilder.register('glass', glassTile([200, 220, 230])),
  brick: atlasBuilder.register('brick', (ctx, px, py, size, rng) => {
    solid([150, 80, 65], 10)(ctx, px, py, size, rng);
    ctx.strokeStyle = 'rgba(200,200,200,0.35)';
    for (let y = 0; y < size; y += 4) {
      ctx.beginPath();
      ctx.moveTo(px, py + y);
      ctx.lineTo(px + size, py + y);
      ctx.stroke();
    }
  }),
  torch: atlasBuilder.register(
    'torch',
    crossFoliage([230, 180, 60]),
    emissiveGlow([255, 200, 80])
  ),
  crafting_top: atlasBuilder.register('crafting_top', (ctx, px, py, size, rng) => {
    grain([160, 120, 75], [110, 80, 50])(ctx, px, py, size, rng);
    ctx.strokeStyle = 'rgba(40,40,40,0.5)';
    ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
  }),
  crafting_side: atlasBuilder.register('crafting_side', grain([150, 110, 70], [100, 75, 45])),
  furnace_top: atlasBuilder.register('furnace_top', speckled([110, 110, 110], [90, 90, 90], 0.2)),
  furnace_side: atlasBuilder.register(
    'furnace_side',
    (ctx, px, py, size, rng) => {
      speckled([110, 110, 110], [90, 90, 90], 0.2)(ctx, px, py, size, rng);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(px + 4, py + 5, 8, 7);
    },
    (ctx, px, py, size) => {
      ctx.fillStyle = '#552200';
      ctx.fillRect(px + 5, py + 6, 6, 5);
    }
  ),
  chest: atlasBuilder.register('chest', (ctx, px, py, size, rng) => {
    grain([150, 110, 60], [100, 75, 40])(ctx, px, py, size, rng);
    ctx.fillStyle = '#3a2a15';
    ctx.fillRect(px, py + size / 2 - 1, size, 2);
    ctx.fillStyle = '#c8a030';
    ctx.fillRect(px + size / 2 - 1, py + size / 2 - 2, 2, 4);
  }),
  ladder: atlasBuilder.register('ladder', crossFoliage([120, 90, 55])),
  door: atlasBuilder.register('door', grain([150, 110, 65], [100, 75, 45])),
  obsidian: atlasBuilder.register('obsidian', speckled([25, 15, 40], [45, 30, 70], 0.2)),
  wool: atlasBuilder.register('wool', solid([235, 235, 235], 10)),
  lava: atlasBuilder.register('lava', liquid([220, 90, 20]), emissiveGlow([255, 120, 30])),
  water: atlasBuilder.register('water', liquid([60, 110, 220])),
  iron_block: atlasBuilder.register('iron_block', speckled([230, 230, 230], [200, 200, 200], 0.08)),
  gold_block: atlasBuilder.register('gold_block', speckled([250, 210, 60], [225, 185, 40], 0.08)),
  diamond_block: atlasBuilder.register('diamond_block', speckled([100, 220, 220], [80, 200, 210], 0.1)),
  coal_block: atlasBuilder.register('coal_block', speckled([35, 35, 35], [20, 20, 20], 0.1)),
  lapis_block: atlasBuilder.register('lapis_block', speckled([40, 70, 200], [30, 55, 170], 0.12)),
  redstone_block: atlasBuilder.register('redstone_block', speckled([200, 20, 20], [170, 10, 10], 0.1)),
  emerald_block: atlasBuilder.register('emerald_block', speckled([40, 200, 110], [30, 175, 95], 0.1)),
  emerald_ore: atlasBuilder.register('emerald_ore', speckled([128, 128, 128], [40, 200, 110], 0.15)),
  wool_red: atlasBuilder.register('wool_red', solid([190, 50, 45], 10)),
  wool_yellow: atlasBuilder.register('wool_yellow', solid([230, 200, 50], 10)),
  wool_blue: atlasBuilder.register('wool_blue', solid([50, 70, 190], 10)),
  wool_black: atlasBuilder.register('wool_black', solid([35, 35, 40], 8)),
  wool_green: atlasBuilder.register('wool_green', solid([70, 130, 50], 10)),
};

const FACE_TILES: Record<number, { top: TileRect; side: TileRect; bottom: TileRect }> = {
  1: uniform(T.bedrock),
  2: uniform(T.stone),
  3: uniform(T.cobblestone),
  4: uniform(T.dirt),
  5: topSideBottom(T.grass_top, T.grass_side, T.dirt),
  6: uniform(T.sand),
  7: uniform(T.gravel),
  8: uniform(T.sandstone),
  9: uniform(T.snow),
  10: uniform(T.ice),
  11: uniform(T.water),
  12: uniform(T.lava),
  13: uniform(T.clay),
  14: topSide(T.oak_log_top, T.oak_log_side),
  15: uniform(T.oak_leaves),
  16: uniform(T.oak_planks),
  17: topSide(T.birch_log_top, T.birch_log_side),
  18: uniform(T.birch_leaves),
  19: uniform(T.birch_planks),
  20: topSide(T.spruce_log_top, T.spruce_log_side),
  21: uniform(T.spruce_leaves),
  22: uniform(T.spruce_planks),
  23: uniform(T.sapling),
  24: uniform(T.tall_grass),
  25: uniform(T.flower_red),
  26: uniform(T.flower_yellow),
  27: topSideBottom(T.cactus_top, T.cactus_side, T.cactus_top),
  28: uniform(T.mushroom),
  29: uniform(T.coal_ore),
  30: uniform(T.iron_ore),
  31: uniform(T.gold_ore),
  32: uniform(T.diamond_ore),
  33: uniform(T.redstone_ore),
  34: uniform(T.lapis_ore),
  35: uniform(T.glass),
  36: uniform(T.brick),
  37: uniform(T.torch),
  38: topSideBottom(T.crafting_top, T.crafting_side, T.oak_planks),
  39: topSideBottom(T.furnace_top, T.furnace_side, T.furnace_top),
  40: uniform(T.chest),
  41: uniform(T.ladder),
  42: uniform(T.door),
  43: uniform(T.obsidian),
  44: uniform(T.wool),
  45: uniform(T.iron_block),
  46: uniform(T.gold_block),
  47: uniform(T.diamond_block),
  48: uniform(T.coal_block),
  49: uniform(T.lapis_block),
  50: uniform(T.redstone_block),
  51: uniform(T.emerald_block),
  52: uniform(T.emerald_ore),
  53: uniform(T.wool_red),
  54: uniform(T.wool_yellow),
  55: uniform(T.wool_blue),
  56: uniform(T.wool_black),
  57: uniform(T.wool_green),
};

export const BLOCKS: BlockDef[] = RAW_BLOCKS.map((raw) => {
  const tiles = raw.id === 0 ? { top: T.stone, side: T.stone, bottom: T.stone } : FACE_TILES[raw.id];
  return { ...raw, ...tiles };
});

const BY_ID = new Map<number, BlockDef>(BLOCKS.map((b) => [b.id, b]));
const BY_KEY = new Map<string, BlockDef>(BLOCKS.map((b) => [b.key, b]));

export function getBlockDef(id: number): BlockDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown block id ${id}`);
  return def;
}

export function getBlockByKey(key: string): BlockDef {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Unknown block key ${key}`);
  return def;
}

/** Serializable tile table (blockId -> face TileRects) to hand to Web Workers. */
export type TileTable = Record<number, { top: TileRect; side: TileRect; bottom: TileRect }>;

export function serializeTileTable(): TileTable {
  const table: TileTable = {};
  for (const b of BLOCKS) {
    table[b.id] = { top: b.top, side: b.side, bottom: b.bottom };
  }
  return table;
}

// re-export BlockId as a value (enum) too, for convenience call sites that
// only imported from './blocks' before the blockDefs split.
void BlockId;

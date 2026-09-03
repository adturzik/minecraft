// Pure block metadata: no DOM/canvas dependency, safe to import from a Web
// Worker. Texture tile assignment (which needs a canvas) lives in blocks.ts
// and is layered on top of this on the main thread; workers reconstruct an
// equivalent lookup from a serialized tile table sent via postMessage.

export type RenderType = 'cube' | 'cross' | 'liquid';
export type ToolType = 'none' | 'pickaxe' | 'axe' | 'shovel';
export type ToolTier = 'hand' | 'wood' | 'stone' | 'iron' | 'diamond';

const TIER_ORDER: ToolTier[] = ['hand', 'wood', 'stone', 'iron', 'diamond'];
export function tierIndex(t: ToolTier): number {
  return TIER_ORDER.indexOf(t);
}

export interface RawBlockDef {
  id: number;
  key: string;
  name: string;
  solid: boolean;
  opaque: boolean;
  transparent: boolean;
  renderType: RenderType;
  lightEmission: number;
  hardness: number;
  toolType: ToolType;
  minToolTier: ToolTier;
  drop: string | null;
  dropCount: [number, number];
}

export enum BlockId {
  Air = 0,
  Bedrock = 1,
  Stone = 2,
  Cobblestone = 3,
  Dirt = 4,
  GrassBlock = 5,
  Sand = 6,
  Gravel = 7,
  Sandstone = 8,
  Snow = 9,
  Ice = 10,
  Water = 11,
  Lava = 12,
  Clay = 13,
  OakLog = 14,
  OakLeaves = 15,
  OakPlanks = 16,
  BirchLog = 17,
  BirchLeaves = 18,
  BirchPlanks = 19,
  SpruceLog = 20,
  SpruceLeaves = 21,
  SprucePlanks = 22,
  Sapling = 23,
  TallGrass = 24,
  FlowerRed = 25,
  FlowerYellow = 26,
  Cactus = 27,
  Mushroom = 28,
  CoalOre = 29,
  IronOre = 30,
  GoldOre = 31,
  DiamondOre = 32,
  RedstoneOre = 33,
  LapisOre = 34,
  Glass = 35,
  BrickBlock = 36,
  Torch = 37,
  CraftingTable = 38,
  Furnace = 39,
  Chest = 40,
  Ladder = 41,
  DoorWood = 42,
  Obsidian = 43,
  Wool = 44,
  IronBlock = 45,
  GoldBlock = 46,
  DiamondBlock = 47,
  CoalBlock = 48,
  LapisBlock = 49,
  RedstoneBlock = 50,
  EmeraldBlock = 51,
  EmeraldOre = 52,
  WoolRed = 53,
  WoolYellow = 54,
  WoolBlue = 55,
  WoolBlack = 56,
  WoolGreen = 57,
}

const INF = Infinity;

export const RAW_BLOCKS: RawBlockDef[] = [
  { id: 0, key: 'air', name: 'Air', solid: false, opaque: false, transparent: true, renderType: 'cube', lightEmission: 0, hardness: 0, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [0, 0] },
  { id: 1, key: 'bedrock', name: 'Bedrock', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: INF, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 2, key: 'stone', name: 'Stone', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 1.5, toolType: 'pickaxe', minToolTier: 'wood', drop: 'cobblestone', dropCount: [1, 1] },
  { id: 3, key: 'cobblestone', name: 'Cobblestone', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 2, toolType: 'pickaxe', minToolTier: 'wood', drop: null, dropCount: [1, 1] },
  { id: 4, key: 'dirt', name: 'Dirt', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.5, toolType: 'shovel', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 5, key: 'grass_block', name: 'Grass Block', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.6, toolType: 'shovel', minToolTier: 'hand', drop: 'dirt', dropCount: [1, 1] },
  { id: 6, key: 'sand', name: 'Sand', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.5, toolType: 'shovel', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 7, key: 'gravel', name: 'Gravel', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.6, toolType: 'shovel', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 8, key: 'sandstone', name: 'Sandstone', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.8, toolType: 'pickaxe', minToolTier: 'wood', drop: null, dropCount: [1, 1] },
  { id: 9, key: 'snow', name: 'Snow Block', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.2, toolType: 'shovel', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 10, key: 'ice', name: 'Ice', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.5, toolType: 'pickaxe', minToolTier: 'wood', drop: null, dropCount: [1, 1] },
  { id: 11, key: 'water', name: 'Water', solid: false, opaque: false, transparent: true, renderType: 'liquid', lightEmission: 0, hardness: INF, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [0, 0] },
  { id: 12, key: 'lava', name: 'Lava', solid: false, opaque: false, transparent: true, renderType: 'liquid', lightEmission: 15, hardness: INF, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [0, 0] },
  { id: 13, key: 'clay', name: 'Clay', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.6, toolType: 'shovel', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 14, key: 'oak_log', name: 'Oak Log', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 2, toolType: 'axe', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 15, key: 'oak_leaves', name: 'Oak Leaves', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.2, toolType: 'none', minToolTier: 'hand', drop: 'sapling', dropCount: [0, 1] },
  { id: 16, key: 'oak_planks', name: 'Oak Planks', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 2, toolType: 'axe', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 17, key: 'birch_log', name: 'Birch Log', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 2, toolType: 'axe', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 18, key: 'birch_leaves', name: 'Birch Leaves', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.2, toolType: 'none', minToolTier: 'hand', drop: 'sapling', dropCount: [0, 1] },
  { id: 19, key: 'birch_planks', name: 'Birch Planks', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 2, toolType: 'axe', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 20, key: 'spruce_log', name: 'Spruce Log', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 2, toolType: 'axe', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 21, key: 'spruce_leaves', name: 'Spruce Leaves', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.2, toolType: 'none', minToolTier: 'hand', drop: 'sapling', dropCount: [0, 1] },
  { id: 22, key: 'spruce_planks', name: 'Spruce Planks', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 2, toolType: 'axe', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 23, key: 'sapling', name: 'Sapling', solid: false, opaque: false, transparent: true, renderType: 'cross', lightEmission: 0, hardness: 0, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 24, key: 'tall_grass', name: 'Tall Grass', solid: false, opaque: false, transparent: true, renderType: 'cross', lightEmission: 0, hardness: 0, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [0, 1] },
  { id: 25, key: 'flower_red', name: 'Red Flower', solid: false, opaque: false, transparent: true, renderType: 'cross', lightEmission: 0, hardness: 0, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 26, key: 'flower_yellow', name: 'Yellow Flower', solid: false, opaque: false, transparent: true, renderType: 'cross', lightEmission: 0, hardness: 0, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 27, key: 'cactus', name: 'Cactus', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.4, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 28, key: 'mushroom', name: 'Mushroom', solid: false, opaque: false, transparent: true, renderType: 'cross', lightEmission: 0, hardness: 0, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 29, key: 'coal_ore', name: 'Coal Ore', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 3, toolType: 'pickaxe', minToolTier: 'wood', drop: 'coal', dropCount: [1, 1] },
  { id: 30, key: 'iron_ore', name: 'Iron Ore', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 3, toolType: 'pickaxe', minToolTier: 'stone', drop: 'raw_iron', dropCount: [1, 1] },
  { id: 31, key: 'gold_ore', name: 'Gold Ore', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 3, toolType: 'pickaxe', minToolTier: 'iron', drop: 'raw_gold', dropCount: [1, 1] },
  { id: 32, key: 'diamond_ore', name: 'Diamond Ore', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 3, toolType: 'pickaxe', minToolTier: 'iron', drop: 'diamond', dropCount: [1, 1] },
  { id: 33, key: 'redstone_ore', name: 'Redstone Ore', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 3, toolType: 'pickaxe', minToolTier: 'iron', drop: 'redstone_dust', dropCount: [3, 5] },
  { id: 34, key: 'lapis_ore', name: 'Lapis Ore', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 3, toolType: 'pickaxe', minToolTier: 'stone', drop: 'lapis_lazuli', dropCount: [3, 6] },
  { id: 35, key: 'glass', name: 'Glass', solid: true, opaque: false, transparent: true, renderType: 'cube', lightEmission: 0, hardness: 0.3, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 36, key: 'brick_block', name: 'Bricks', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 2, toolType: 'pickaxe', minToolTier: 'wood', drop: null, dropCount: [1, 1] },
  { id: 37, key: 'torch', name: 'Torch', solid: false, opaque: false, transparent: true, renderType: 'cross', lightEmission: 14, hardness: 0, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 38, key: 'crafting_table', name: 'Crafting Table', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 2.5, toolType: 'axe', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 39, key: 'furnace', name: 'Furnace', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 3.5, toolType: 'pickaxe', minToolTier: 'wood', drop: null, dropCount: [1, 1] },
  { id: 40, key: 'chest', name: 'Chest', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 2.5, toolType: 'axe', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 41, key: 'ladder', name: 'Ladder', solid: false, opaque: false, transparent: true, renderType: 'cross', lightEmission: 0, hardness: 0.4, toolType: 'axe', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 42, key: 'door_wood', name: 'Wooden Door', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 3, toolType: 'axe', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 43, key: 'obsidian', name: 'Obsidian', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 50, toolType: 'pickaxe', minToolTier: 'diamond', drop: null, dropCount: [1, 1] },
  { id: 44, key: 'wool', name: 'Wool', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.8, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 45, key: 'iron_block', name: 'Block of Iron', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 5, toolType: 'pickaxe', minToolTier: 'stone', drop: null, dropCount: [1, 1] },
  { id: 46, key: 'gold_block', name: 'Block of Gold', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 5, toolType: 'pickaxe', minToolTier: 'iron', drop: null, dropCount: [1, 1] },
  { id: 47, key: 'diamond_block', name: 'Block of Diamond', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 5, toolType: 'pickaxe', minToolTier: 'iron', drop: null, dropCount: [1, 1] },
  { id: 48, key: 'coal_block', name: 'Block of Coal', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 5, toolType: 'pickaxe', minToolTier: 'wood', drop: null, dropCount: [1, 1] },
  { id: 49, key: 'lapis_block', name: 'Block of Lapis', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 3, toolType: 'pickaxe', minToolTier: 'stone', drop: null, dropCount: [1, 1] },
  { id: 50, key: 'redstone_block', name: 'Block of Redstone', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 5, toolType: 'pickaxe', minToolTier: 'wood', drop: null, dropCount: [1, 1] },
  { id: 51, key: 'emerald_block', name: 'Block of Emerald', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 5, toolType: 'pickaxe', minToolTier: 'iron', drop: null, dropCount: [1, 1] },
  { id: 52, key: 'emerald_ore', name: 'Emerald Ore', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 3, toolType: 'pickaxe', minToolTier: 'iron', drop: 'emerald', dropCount: [1, 1] },
  { id: 53, key: 'wool_red', name: 'Red Wool', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.8, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 54, key: 'wool_yellow', name: 'Yellow Wool', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.8, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 55, key: 'wool_blue', name: 'Blue Wool', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.8, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 56, key: 'wool_black', name: 'Black Wool', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.8, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
  { id: 57, key: 'wool_green', name: 'Green Wool', solid: true, opaque: true, transparent: false, renderType: 'cube', lightEmission: 0, hardness: 0.8, toolType: 'none', minToolTier: 'hand', drop: null, dropCount: [1, 1] },
];

const BY_ID = new Map<number, RawBlockDef>(RAW_BLOCKS.map((b) => [b.id, b]));
const BY_KEY = new Map<string, RawBlockDef>(RAW_BLOCKS.map((b) => [b.key, b]));

export function getRawBlockDef(id: number): RawBlockDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown block id ${id}`);
  return def;
}

export function getRawBlockByKey(key: string): RawBlockDef {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Unknown block key ${key}`);
  return def;
}

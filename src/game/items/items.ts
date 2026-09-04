import { BlockId, ToolTier, ToolType, RawBlockDef, getRawBlockDef, RAW_BLOCKS } from './blockDefs';

// Items need a couple of tool kinds (sword, hoe, shears) that never gate
// block harvesting and so were deliberately left out of blockDefs.ToolType.
export type ItemToolType = ToolType | 'sword' | 'hoe' | 'shears';

export type ArmorType = 'helmet' | 'chestplate' | 'leggings' | 'boots';
export type ArmorTier = 'leather' | 'iron' | 'gold' | 'diamond';

export interface ItemDef {
  id: string;
  name: string;
  stackSize: number;
  color: [number, number, number]; // flat UI icon color (no real texture for non-block items)
  toolType?: ItemToolType;
  toolTier?: ToolTier;
  maxDurability?: number;
  attackDamage?: number;
  isBlock?: boolean;
  blockId?: number;
  foodRestore?: number; // hunger points restored on use
  armorType?: ArmorType;
  defense?: number; // flat armor points, see the damage-reduction formula in main.ts
}

const TOOL_DURABILITY: Record<ToolTier, number> = { hand: 0, wood: 59, stone: 131, iron: 250, diamond: 1561 };
// Real vanilla per-tool-type attack damage (Java Edition) -- each tool type
// scales differently with tier instead of one flat "+2/-2 from a base
// number" formula, matching actual per-item stats: axes hit hardest but
// pickaxes/shovels are weak sidearms, and hoes barely count as weapons at
// any tier.
const SWORD_DAMAGE: Record<ToolTier, number> = { hand: 1, wood: 4, stone: 5, iron: 6, diamond: 7 };
const AXE_DAMAGE: Record<ToolTier, number> = { hand: 1, wood: 7, stone: 9, iron: 9, diamond: 9 };
const PICKAXE_DAMAGE: Record<ToolTier, number> = { hand: 1, wood: 2, stone: 3, iron: 4, diamond: 5 };
const SHOVEL_DAMAGE: Record<ToolTier, number> = { hand: 1, wood: 2.5, stone: 3.5, iron: 4.5, diamond: 5.5 };
const HOE_DAMAGE: Record<ToolTier, number> = { hand: 1, wood: 1, stone: 1, iron: 1, diamond: 1 };
const TOOL_COLOR: Record<ToolTier, [number, number, number]> = {
  hand: [200, 180, 160],
  wood: [176, 143, 92],
  stone: [150, 150, 150],
  iron: [216, 216, 216],
  diamond: [100, 220, 220],
};

// Defense points per piece, matching vanilla Minecraft's own values.
const ARMOR_DEFENSE: Record<ArmorTier, Record<ArmorType, number>> = {
  leather: { helmet: 1, chestplate: 3, leggings: 2, boots: 1 },
  iron: { helmet: 2, chestplate: 6, leggings: 5, boots: 2 },
  gold: { helmet: 2, chestplate: 5, leggings: 3, boots: 1 },
  diamond: { helmet: 3, chestplate: 8, leggings: 6, boots: 3 },
};
// Real vanilla per-piece durability -- chestplates/leggings are notably
// tougher than a helmet of the same tier, not a single flat value per tier.
const ARMOR_DURABILITY: Record<ArmorTier, Record<ArmorType, number>> = {
  leather: { helmet: 55, chestplate: 80, leggings: 75, boots: 65 },
  iron: { helmet: 165, chestplate: 240, leggings: 225, boots: 195 },
  gold: { helmet: 77, chestplate: 112, leggings: 105, boots: 91 },
  diamond: { helmet: 363, chestplate: 528, leggings: 495, boots: 429 },
};
const ARMOR_COLOR: Record<ArmorTier, [number, number, number]> = {
  leather: [150, 100, 60],
  iron: [216, 216, 216],
  gold: [250, 210, 60],
  diamond: [100, 220, 220],
};
const ARMOR_NAME: Record<ArmorType, string> = { helmet: 'Helmet', chestplate: 'Chestplate', leggings: 'Leggings', boots: 'Boots' };

function armor(tier: ArmorTier, type: ArmorType): ItemDef {
  return {
    id: `${tier}_${type}`,
    name: `${tier[0].toUpperCase()}${tier.slice(1)} ${ARMOR_NAME[type]}`,
    stackSize: 1,
    color: ARMOR_COLOR[tier],
    armorType: type,
    maxDurability: ARMOR_DURABILITY[tier][type],
    defense: ARMOR_DEFENSE[tier][type],
  };
}

const TOOL_DAMAGE_TABLE: Record<'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe', Record<ToolTier, number>> = {
  sword: SWORD_DAMAGE,
  axe: AXE_DAMAGE,
  pickaxe: PICKAXE_DAMAGE,
  shovel: SHOVEL_DAMAGE,
  hoe: HOE_DAMAGE,
};

function tool(tier: ToolTier, type: 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe'): ItemDef {
  return {
    id: `${tier}_${type}`,
    name: `${tier[0].toUpperCase()}${tier.slice(1)} ${type[0].toUpperCase()}${type.slice(1)}`,
    stackSize: 1,
    color: TOOL_COLOR[tier],
    toolType: type,
    toolTier: tier,
    maxDurability: TOOL_DURABILITY[tier],
    attackDamage: TOOL_DAMAGE_TABLE[type][tier],
  };
}

const NON_BLOCK_ITEMS: ItemDef[] = [
  { id: 'stick', name: 'Stick', stackSize: 64, color: [150, 110, 60] },
  { id: 'coal', name: 'Coal', stackSize: 64, color: [30, 30, 30] },
  { id: 'charcoal', name: 'Charcoal', stackSize: 64, color: [60, 55, 50] },
  { id: 'raw_iron', name: 'Raw Iron', stackSize: 64, color: [200, 160, 130] },
  { id: 'iron_ingot', name: 'Iron Ingot', stackSize: 64, color: [230, 230, 230] },
  { id: 'raw_gold', name: 'Raw Gold', stackSize: 64, color: [230, 190, 90] },
  { id: 'gold_ingot', name: 'Gold Ingot', stackSize: 64, color: [250, 210, 60] },
  { id: 'diamond', name: 'Diamond', stackSize: 64, color: [90, 220, 220] },
  { id: 'redstone_dust', name: 'Redstone Dust', stackSize: 64, color: [200, 20, 20] },
  { id: 'lapis_lazuli', name: 'Lapis Lazuli', stackSize: 64, color: [40, 70, 200] },
  { id: 'wheat', name: 'Wheat', stackSize: 64, color: [220, 200, 100] },
  { id: 'bread', name: 'Bread', stackSize: 64, color: [200, 160, 90], foodRestore: 5 },
  { id: 'apple', name: 'Apple', stackSize: 64, color: [200, 40, 40], foodRestore: 4 },
  { id: 'leather', name: 'Leather', stackSize: 64, color: [150, 100, 60] },
  { id: 'raw_beef', name: 'Raw Beef', stackSize: 64, color: [180, 60, 60], foodRestore: 3 },
  { id: 'cooked_beef', name: 'Cooked Beef', stackSize: 64, color: [140, 80, 50], foodRestore: 8 },
  { id: 'raw_porkchop', name: 'Raw Porkchop', stackSize: 64, color: [220, 130, 140], foodRestore: 3 },
  { id: 'cooked_porkchop', name: 'Cooked Porkchop', stackSize: 64, color: [170, 110, 80], foodRestore: 8 },
  { id: 'raw_chicken', name: 'Raw Chicken', stackSize: 64, color: [230, 200, 180], foodRestore: 2 },
  { id: 'cooked_chicken', name: 'Cooked Chicken', stackSize: 64, color: [200, 160, 110], foodRestore: 6 },
  { id: 'feather', name: 'Feather', stackSize: 64, color: [240, 240, 240] },
  { id: 'rotten_flesh', name: 'Rotten Flesh', stackSize: 64, color: [110, 90, 60] },
  { id: 'bone', name: 'Bone', stackSize: 64, color: [235, 225, 200] },
  { id: 'string', name: 'String', stackSize: 64, color: [230, 230, 220] },
  { id: 'gunpowder', name: 'Gunpowder', stackSize: 64, color: [90, 90, 95] },
  { id: 'flint', name: 'Flint', stackSize: 64, color: [60, 60, 65] },
  { id: 'bow', name: 'Bow', stackSize: 1, color: [150, 110, 60], maxDurability: 384 },
  { id: 'arrow', name: 'Arrow', stackSize: 64, color: [150, 150, 150] },
  { id: 'emerald', name: 'Emerald', stackSize: 64, color: [40, 200, 110] },
  // Dyes: each has a real in-world source (see recipes.ts) rather than being
  // a dead-end item with no way to obtain it.
  { id: 'dye_red', name: 'Red Dye', stackSize: 64, color: [190, 50, 45] },
  { id: 'dye_yellow', name: 'Yellow Dye', stackSize: 64, color: [230, 200, 50] },
  { id: 'dye_blue', name: 'Blue Dye', stackSize: 64, color: [50, 70, 190] },
  { id: 'dye_black', name: 'Black Dye', stackSize: 64, color: [35, 35, 40] },
  { id: 'dye_white', name: 'White Dye', stackSize: 64, color: [240, 240, 240] },
  { id: 'dye_green', name: 'Green Dye', stackSize: 64, color: [70, 130, 50] },
  // Farming / food
  { id: 'carrot', name: 'Carrot', stackSize: 64, color: [230, 140, 40], foodRestore: 3 },
  { id: 'potato', name: 'Potato', stackSize: 64, color: [200, 170, 110], foodRestore: 1 },
  { id: 'baked_potato', name: 'Baked Potato', stackSize: 64, color: [210, 160, 90], foodRestore: 5 },
  { id: 'golden_apple', name: 'Golden Apple', stackSize: 64, color: [240, 210, 60], foodRestore: 9 },
  // Buckets: empty bucket picks up a water/lava source (right-click a fluid
  // block); a filled bucket places it back and empties. See main.ts.
  // Right-click a sheep to collect wool without hurting it (main.ts) --
  // its own tool type, matching vanilla, so it doesn't gate any block.
  { id: 'shears', name: 'Shears', stackSize: 1, color: [190, 190, 195], toolType: 'shears', maxDurability: 238 },
  { id: 'bucket', name: 'Bucket', stackSize: 16, color: [190, 190, 195] },
  { id: 'water_bucket', name: 'Water Bucket', stackSize: 1, color: [60, 110, 220] },
  { id: 'lava_bucket', name: 'Lava Bucket', stackSize: 1, color: [220, 90, 20] },
  tool('wood', 'pickaxe'), tool('wood', 'axe'), tool('wood', 'shovel'), tool('wood', 'sword'), tool('wood', 'hoe'),
  tool('stone', 'pickaxe'), tool('stone', 'axe'), tool('stone', 'shovel'), tool('stone', 'sword'), tool('stone', 'hoe'),
  tool('iron', 'pickaxe'), tool('iron', 'axe'), tool('iron', 'shovel'), tool('iron', 'sword'), tool('iron', 'hoe'),
  tool('diamond', 'pickaxe'), tool('diamond', 'axe'), tool('diamond', 'shovel'), tool('diamond', 'sword'), tool('diamond', 'hoe'),
  armor('leather', 'helmet'), armor('leather', 'chestplate'), armor('leather', 'leggings'), armor('leather', 'boots'),
  armor('iron', 'helmet'), armor('iron', 'chestplate'), armor('iron', 'leggings'), armor('iron', 'boots'),
  armor('gold', 'helmet'), armor('gold', 'chestplate'), armor('gold', 'leggings'), armor('gold', 'boots'),
  armor('diamond', 'helmet'), armor('diamond', 'chestplate'), armor('diamond', 'leggings'), armor('diamond', 'boots'),
];

const BLOCK_UI_COLOR: Partial<Record<number, [number, number, number]>> = {
  [BlockId.Bedrock]: [40, 40, 40],
  [BlockId.Stone]: [128, 128, 128],
  [BlockId.Cobblestone]: [115, 115, 115],
  [BlockId.Dirt]: [134, 96, 67],
  [BlockId.GrassBlock]: [95, 159, 53],
  [BlockId.Sand]: [219, 205, 145],
  [BlockId.Gravel]: [131, 127, 124],
  [BlockId.Sandstone]: [214, 200, 154],
  [BlockId.Snow]: [250, 250, 252],
  [BlockId.Ice]: [160, 200, 230],
  [BlockId.Clay]: [160, 166, 179],
  [BlockId.OakLog]: [107, 84, 52],
  [BlockId.OakLeaves]: [63, 114, 45],
  [BlockId.OakPlanks]: [176, 143, 92],
  [BlockId.BirchLog]: [224, 223, 216],
  [BlockId.BirchLeaves]: [120, 150, 60],
  [BlockId.BirchPlanks]: [222, 205, 160],
  [BlockId.SpruceLog]: [69, 50, 33],
  [BlockId.SpruceLeaves]: [40, 80, 50],
  [BlockId.SprucePlanks]: [120, 85, 55],
  [BlockId.Sapling]: [70, 140, 50],
  [BlockId.TallGrass]: [95, 159, 53],
  [BlockId.FlowerRed]: [200, 40, 40],
  [BlockId.FlowerYellow]: [220, 200, 40],
  [BlockId.Cactus]: [60, 110, 50],
  [BlockId.CoalOre]: [90, 90, 90],
  [BlockId.IronOre]: [180, 160, 140],
  [BlockId.GoldOre]: [210, 180, 90],
  [BlockId.DiamondOre]: [110, 200, 200],
  [BlockId.RedstoneOre]: [180, 90, 90],
  [BlockId.LapisOre]: [90, 100, 180],
  [BlockId.Glass]: [210, 230, 235],
  [BlockId.BrickBlock]: [150, 80, 65],
  [BlockId.Torch]: [230, 180, 60],
  [BlockId.CraftingTable]: [160, 120, 75],
  [BlockId.Furnace]: [110, 110, 110],
  [BlockId.Chest]: [150, 110, 60],
  [BlockId.Ladder]: [120, 90, 55],
  [BlockId.Obsidian]: [35, 20, 55],
  [BlockId.Wool]: [235, 235, 235],
  [BlockId.IronBlock]: [230, 230, 230],
  [BlockId.GoldBlock]: [250, 210, 60],
  [BlockId.DiamondBlock]: [100, 220, 220],
  [BlockId.CoalBlock]: [35, 35, 35],
  [BlockId.LapisBlock]: [40, 70, 200],
  [BlockId.RedstoneBlock]: [200, 20, 20],
  [BlockId.EmeraldBlock]: [40, 200, 110],
  [BlockId.EmeraldOre]: [110, 200, 160],
  [BlockId.WoolRed]: [190, 50, 45],
  [BlockId.WoolYellow]: [230, 200, 50],
  [BlockId.WoolBlue]: [50, 70, 190],
  [BlockId.WoolBlack]: [35, 35, 40],
  [BlockId.WoolGreen]: [70, 130, 50],
};

function blockItem(id: number): ItemDef {
  const raw = getRawBlockDef(id);
  return {
    id: raw.key,
    name: raw.name,
    stackSize: 64,
    color: BLOCK_UI_COLOR[id] ?? [180, 180, 180],
    isBlock: true,
    blockId: id,
  };
}

const BLOCK_ITEMS: ItemDef[] = RAW_BLOCKS.filter((b) => b.id !== BlockId.Air && b.id !== BlockId.Water && b.id !== BlockId.Lava).map((b) => blockItem(b.id));

export const ITEMS: ItemDef[] = [...BLOCK_ITEMS, ...NON_BLOCK_ITEMS];
const BY_ID = new Map<string, ItemDef>(ITEMS.map((i) => [i.id, i]));

export function getItemDef(id: string): ItemDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown item id ${id}`);
  return def;
}

const LEAF_BLOCKS = new Set([BlockId.OakLeaves, BlockId.BirchLeaves, BlockId.SpruceLeaves]);

/** What a broken block yields as an item id (falls back to its own block key).
 * Leaves get a small extra chance at an apple on top of their usual sapling
 * drop -- otherwise nothing in the game ever produces one, which left
 * golden_apple permanently uncraftable. */
export function blockDropItemId(blockId: number): string | null {
  if (blockId === BlockId.Air) return null;
  if (LEAF_BLOCKS.has(blockId) && Math.random() < 0.08) return 'apple';
  // Matches vanilla: gravel has a chance to yield flint instead of itself --
  // otherwise flint (needed for arrows) would have no source at all.
  if (blockId === BlockId.Gravel && Math.random() < 0.1) return 'flint';
  const raw = getRawBlockDef(blockId);
  return raw.drop ?? raw.key;
}

/** Mining speed multiplier relative to bare hands, by tool tier — matching
 * tool type is required to get any bonus at all (see miningSeconds). */
const TOOL_SPEED: Record<ToolTier, number> = { hand: 1, wood: 2, stone: 4, iron: 6, diamond: 8 };

/** Seconds needed to break a block of `blockDef` with `heldItem` in hand
 * (null/mismatched tool = bare-hand speed). 0 = instant (leaves, flowers,
 * torches, ...), Infinity = unbreakable (bedrock, fluids). Loosely mirrors
 * vanilla Minecraft's hardness*1.5/speed formula. */
export function miningSeconds(blockDef: RawBlockDef, heldItem: ItemDef | null): number {
  if (blockDef.hardness === Infinity) return Infinity;
  if (blockDef.hardness <= 0) return 0;
  let speed = TOOL_SPEED.hand;
  if (blockDef.toolType !== 'none' && heldItem?.toolType === blockDef.toolType) {
    speed = TOOL_SPEED[heldItem.toolTier ?? 'hand'];
  }
  return (blockDef.hardness * 1.5) / speed;
}

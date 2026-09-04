import { ToolTier } from '../items/blockDefs';

export type IngredientSpec = string | string[];

export interface ShapedRecipe {
  id: string;
  type: 'shaped';
  pattern: (IngredientSpec | null)[][]; // rows x cols
  result: { itemId: string; count: number };
  requiresTable: boolean; // false = also craftable in the player's 2x2 grid
}
export interface ShapelessRecipe {
  id: string;
  type: 'shapeless';
  ingredients: string[];
  result: { itemId: string; count: number };
  requiresTable: boolean;
}
export type Recipe = ShapedRecipe | ShapelessRecipe;

const PLANKS = ['oak_planks', 'birch_planks', 'spruce_planks'];
const LOG_TO_PLANKS: [string, string][] = [
  ['oak_log', 'oak_planks'],
  ['birch_log', 'birch_planks'],
  ['spruce_log', 'spruce_planks'],
];

const TOOL_TIER_MATERIAL: Record<Exclude<ToolTier, 'hand'>, string | string[]> = {
  wood: PLANKS,
  stone: 'cobblestone',
  iron: 'iron_ingot',
  diamond: 'diamond',
};

const ARMOR_MATERIAL: Record<string, string> = { leather: 'leather', iron: 'iron_ingot', gold: 'gold_ingot', diamond: 'diamond' };

function armorRecipes(): ShapedRecipe[] {
  const out: ShapedRecipe[] = [];
  for (const tier of ['leather', 'iron', 'gold', 'diamond']) {
    const mat = ARMOR_MATERIAL[tier];
    const id = (type: string) => `${tier}_${type}`;
    out.push(
      { id: `craft_${id('helmet')}`, type: 'shaped', requiresTable: true, result: { itemId: id('helmet'), count: 1 }, pattern: [[mat, mat, mat], [mat, null, mat]] },
      { id: `craft_${id('chestplate')}`, type: 'shaped', requiresTable: true, result: { itemId: id('chestplate'), count: 1 }, pattern: [[mat, null, mat], [mat, mat, mat], [mat, mat, mat]] },
      { id: `craft_${id('leggings')}`, type: 'shaped', requiresTable: true, result: { itemId: id('leggings'), count: 1 }, pattern: [[mat, mat, mat], [mat, null, mat], [mat, null, mat]] },
      { id: `craft_${id('boots')}`, type: 'shaped', requiresTable: true, result: { itemId: id('boots'), count: 1 }, pattern: [[mat, null, mat], [mat, null, mat]] }
    );
  }
  return out;
}

const STORAGE_BLOCKS: [string, string][] = [
  ['iron_ingot', 'iron_block'],
  ['gold_ingot', 'gold_block'],
  ['diamond', 'diamond_block'],
  ['coal', 'coal_block'],
  ['lapis_lazuli', 'lapis_block'],
  ['redstone_dust', 'redstone_block'],
  ['emerald', 'emerald_block'],
];

function storageRecipes(): ShapedRecipe[] {
  const out: ShapedRecipe[] = [];
  for (const [item, block] of STORAGE_BLOCKS) {
    out.push({ id: `store_${block}`, type: 'shaped', requiresTable: true, result: { itemId: block, count: 1 }, pattern: [[item, item, item], [item, item, item], [item, item, item]] });
    out.push({ id: `unstore_${block}`, type: 'shaped', requiresTable: false, result: { itemId: item, count: 9 }, pattern: [[block]] });
  }
  return out;
}

const DYE_SOURCES: [string, string, number][] = [
  ['flower_red', 'dye_red', 2],
  ['flower_yellow', 'dye_yellow', 2],
  ['lapis_lazuli', 'dye_blue', 1],
  ['coal', 'dye_black', 1],
  ['bone', 'dye_white', 3],
];

function dyeRecipes(): ShapelessRecipe[] {
  return DYE_SOURCES.map(([src, dye, count]) => ({
    id: `craft_${dye}`,
    type: 'shapeless',
    requiresTable: false,
    ingredients: [src],
    result: { itemId: dye, count },
  }));
}

const WOOL_COLORS: [string, string][] = [
  ['dye_red', 'wool_red'],
  ['dye_yellow', 'wool_yellow'],
  ['dye_blue', 'wool_blue'],
  ['dye_black', 'wool_black'],
  ['dye_green', 'wool_green'],
];

function woolDyeRecipes(): ShapelessRecipe[] {
  return WOOL_COLORS.map(([dye, wool]) => ({
    id: `dye_${wool}`,
    type: 'shapeless',
    requiresTable: false,
    ingredients: ['wool', dye],
    result: { itemId: wool, count: 1 },
  }));
}

function toolRecipes(): ShapedRecipe[] {
  const out: ShapedRecipe[] = [];
  for (const tier of ['wood', 'stone', 'iron', 'diamond'] as const) {
    const mat = TOOL_TIER_MATERIAL[tier];
    const id = (type: string) => `${tier}_${type}`;
    out.push(
      { id: `craft_${id('pickaxe')}`, type: 'shaped', requiresTable: true, result: { itemId: id('pickaxe'), count: 1 }, pattern: [[mat, mat, mat], [null, 'stick', null], [null, 'stick', null]] },
      { id: `craft_${id('axe')}`, type: 'shaped', requiresTable: true, result: { itemId: id('axe'), count: 1 }, pattern: [[mat, mat], [mat, 'stick'], [null, 'stick']] },
      { id: `craft_${id('shovel')}`, type: 'shaped', requiresTable: false, result: { itemId: id('shovel'), count: 1 }, pattern: [[mat], ['stick'], ['stick']] },
      { id: `craft_${id('sword')}`, type: 'shaped', requiresTable: false, result: { itemId: id('sword'), count: 1 }, pattern: [[mat], [mat], ['stick']] },
      { id: `craft_${id('hoe')}`, type: 'shaped', requiresTable: true, result: { itemId: id('hoe'), count: 1 }, pattern: [[mat, mat], [null, 'stick'], [null, 'stick']] }
    );
  }
  return out;
}

export const RECIPES: Recipe[] = [
  ...LOG_TO_PLANKS.map(
    ([log, planks]): ShapedRecipe => ({
      id: `planks_${planks}`,
      type: 'shaped',
      requiresTable: false,
      pattern: [[log]],
      result: { itemId: planks, count: 4 },
    })
  ),
  { id: 'stick', type: 'shaped', requiresTable: false, pattern: [[PLANKS], [PLANKS]], result: { itemId: 'stick', count: 4 } },
  { id: 'crafting_table', type: 'shaped', requiresTable: false, pattern: [[PLANKS, PLANKS], [PLANKS, PLANKS]], result: { itemId: 'crafting_table', count: 1 } },
  {
    id: 'furnace',
    type: 'shaped',
    requiresTable: true,
    pattern: [
      ['cobblestone', 'cobblestone', 'cobblestone'],
      ['cobblestone', null, 'cobblestone'],
      ['cobblestone', 'cobblestone', 'cobblestone'],
    ],
    result: { itemId: 'furnace', count: 1 },
  },
  {
    id: 'chest',
    type: 'shaped',
    requiresTable: true,
    pattern: [
      [PLANKS, PLANKS, PLANKS],
      [PLANKS, null, PLANKS],
      [PLANKS, PLANKS, PLANKS],
    ],
    result: { itemId: 'chest', count: 1 },
  },
  { id: 'torch', type: 'shaped', requiresTable: false, pattern: [[['coal', 'charcoal']], ['stick']], result: { itemId: 'torch', count: 4 } },
  {
    id: 'ladder',
    type: 'shaped',
    requiresTable: true,
    pattern: [
      ['stick', null, 'stick'],
      ['stick', 'stick', 'stick'],
      ['stick', null, 'stick'],
    ],
    result: { itemId: 'ladder', count: 3 },
  },
  {
    id: 'door_wood',
    type: 'shaped',
    requiresTable: true,
    pattern: [
      [PLANKS, PLANKS],
      [PLANKS, PLANKS],
      [PLANKS, PLANKS],
    ],
    result: { itemId: 'door_wood', count: 3 },
  },
  { id: 'bread', type: 'shaped', requiresTable: true, pattern: [['wheat', 'wheat', 'wheat']], result: { itemId: 'bread', count: 1 } },
  {
    id: 'bucket',
    type: 'shaped',
    requiresTable: true,
    pattern: [['iron_ingot', null, 'iron_ingot'], [null, 'iron_ingot', null]],
    result: { itemId: 'bucket', count: 1 },
  },
  {
    id: 'shears',
    type: 'shaped',
    requiresTable: false,
    pattern: [[null, 'iron_ingot'], ['iron_ingot', null]],
    result: { itemId: 'shears', count: 1 },
  },
  {
    id: 'bow',
    type: 'shaped',
    requiresTable: true,
    pattern: [
      [null, 'stick', 'string'],
      ['stick', null, 'string'],
      [null, 'stick', 'string'],
    ],
    result: { itemId: 'bow', count: 1 },
  },
  {
    id: 'arrow',
    type: 'shaped',
    requiresTable: true, // 3 rows tall -- doesn't fit the personal 2x2 grid
    pattern: [['flint'], ['stick'], ['feather']],
    result: { itemId: 'arrow', count: 4 },
  },
  {
    id: 'golden_apple',
    type: 'shaped',
    requiresTable: true,
    pattern: [
      ['gold_ingot', 'gold_ingot', 'gold_ingot'],
      ['gold_ingot', 'apple', 'gold_ingot'],
      ['gold_ingot', 'gold_ingot', 'gold_ingot'],
    ],
    result: { itemId: 'golden_apple', count: 1 },
  },
  ...toolRecipes(),
  ...armorRecipes(),
  ...storageRecipes(),
  ...dyeRecipes(),
  ...woolDyeRecipes(),
];

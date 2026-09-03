export interface SmeltRecipe {
  input: string;
  output: string;
  count: number;
  timeSeconds: number;
}

export const SMELT_RECIPES: SmeltRecipe[] = [
  { input: 'sand', output: 'glass', count: 1, timeSeconds: 10 },
  { input: 'oak_log', output: 'charcoal', count: 1, timeSeconds: 10 },
  { input: 'birch_log', output: 'charcoal', count: 1, timeSeconds: 10 },
  { input: 'spruce_log', output: 'charcoal', count: 1, timeSeconds: 10 },
  { input: 'raw_iron', output: 'iron_ingot', count: 1, timeSeconds: 10 },
  { input: 'raw_gold', output: 'gold_ingot', count: 1, timeSeconds: 10 },
  { input: 'cobblestone', output: 'stone', count: 1, timeSeconds: 10 },
  { input: 'clay', output: 'brick_block', count: 1, timeSeconds: 10 },
  { input: 'raw_beef', output: 'cooked_beef', count: 1, timeSeconds: 10 },
  { input: 'raw_porkchop', output: 'cooked_porkchop', count: 1, timeSeconds: 10 },
  { input: 'raw_chicken', output: 'cooked_chicken', count: 1, timeSeconds: 10 },
  { input: 'potato', output: 'baked_potato', count: 1, timeSeconds: 10 },
  { input: 'cactus', output: 'dye_green', count: 1, timeSeconds: 10 },
];

export function getSmeltRecipe(inputItemId: string): SmeltRecipe | null {
  return SMELT_RECIPES.find((r) => r.input === inputItemId) ?? null;
}

export interface FuelSpec {
  itemId: string;
  burnSeconds: number;
}

export const FUELS: FuelSpec[] = [
  { itemId: 'coal', burnSeconds: 80 },
  { itemId: 'charcoal', burnSeconds: 80 },
  { itemId: 'oak_planks', burnSeconds: 15 },
  { itemId: 'birch_planks', burnSeconds: 15 },
  { itemId: 'spruce_planks', burnSeconds: 15 },
  { itemId: 'oak_log', burnSeconds: 15 },
  { itemId: 'birch_log', burnSeconds: 15 },
  { itemId: 'spruce_log', burnSeconds: 15 },
  { itemId: 'stick', burnSeconds: 5 },
];

export function getFuel(itemId: string): FuelSpec | null {
  return FUELS.find((f) => f.itemId === itemId) ?? null;
}

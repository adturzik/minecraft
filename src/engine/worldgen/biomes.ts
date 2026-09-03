import { BlockId } from '../../game/items/blockDefs';

export type BiomeId =
  | 'ocean'
  | 'beach'
  | 'plains'
  | 'forest'
  | 'desert'
  | 'taiga'
  | 'tundra'
  | 'mountains'
  | 'jungle'
  | 'swamp';

export type TreeType = 'oak' | 'birch' | 'spruce' | null;

export interface BiomeDef {
  id: BiomeId;
  surface: number; // BlockId placed at the top of the column
  subsurface: number; // a few layers below the surface
  underwaterSurface: number; // used instead of `surface` when height < sea level
  treeType: TreeType;
  treeChance: number; // probability per surface column
  grassChance: number;
  flowerChance: number;
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  ocean: { id: 'ocean', surface: BlockId.Sand, subsurface: BlockId.Sand, underwaterSurface: BlockId.Sand, treeType: null, treeChance: 0, grassChance: 0, flowerChance: 0 },
  beach: { id: 'beach', surface: BlockId.Sand, subsurface: BlockId.Sand, underwaterSurface: BlockId.Sand, treeType: null, treeChance: 0, grassChance: 0, flowerChance: 0 },
  plains: { id: 'plains', surface: BlockId.GrassBlock, subsurface: BlockId.Dirt, underwaterSurface: BlockId.Sand, treeType: 'oak', treeChance: 0.004, grassChance: 0.12, flowerChance: 0.02 },
  forest: { id: 'forest', surface: BlockId.GrassBlock, subsurface: BlockId.Dirt, underwaterSurface: BlockId.Sand, treeType: 'oak', treeChance: 0.035, grassChance: 0.08, flowerChance: 0.015 },
  desert: { id: 'desert', surface: BlockId.Sand, subsurface: BlockId.Sandstone, underwaterSurface: BlockId.Sand, treeType: null, treeChance: 0, grassChance: 0, flowerChance: 0 },
  taiga: { id: 'taiga', surface: BlockId.GrassBlock, subsurface: BlockId.Dirt, underwaterSurface: BlockId.Sand, treeType: 'spruce', treeChance: 0.03, grassChance: 0.05, flowerChance: 0.005 },
  tundra: { id: 'tundra', surface: BlockId.Snow, subsurface: BlockId.Dirt, underwaterSurface: BlockId.Sand, treeType: null, treeChance: 0, grassChance: 0.01, flowerChance: 0 },
  mountains: { id: 'mountains', surface: BlockId.Stone, subsurface: BlockId.Stone, underwaterSurface: BlockId.Sand, treeType: null, treeChance: 0, grassChance: 0, flowerChance: 0 },
  jungle: { id: 'jungle', surface: BlockId.GrassBlock, subsurface: BlockId.Dirt, underwaterSurface: BlockId.Sand, treeType: 'oak', treeChance: 0.06, grassChance: 0.2, flowerChance: 0.03 },
  swamp: { id: 'swamp', surface: BlockId.GrassBlock, subsurface: BlockId.Dirt, underwaterSurface: BlockId.Sand, treeType: 'oak', treeChance: 0.015, grassChance: 0.15, flowerChance: 0.01 },
};

/** Whittaker-ish biome pick from temperature/humidity in [0,1], with height
 * overrides for oceans/beaches/mountains applied by the caller. */
export function pickBiome(temperature: number, humidity: number): BiomeDef {
  if (temperature < 0.28) {
    return humidity < 0.45 ? BIOMES.tundra : BIOMES.taiga;
  }
  if (temperature < 0.72) {
    if (humidity < 0.3) return BIOMES.plains;
    if (humidity < 0.65) return BIOMES.forest;
    return BIOMES.swamp;
  }
  return humidity < 0.35 ? BIOMES.desert : BIOMES.jungle;
}

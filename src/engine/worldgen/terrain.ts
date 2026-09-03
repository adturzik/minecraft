import { createNoise2D, createNoise3D, NoiseFunction2D, NoiseFunction3D } from 'simplex-noise';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE_X, CHUNK_SIZE_Z } from '../world/chunk';
import { BlockId } from '../../game/items/blockDefs';
import { mulberry32, hash3D } from './random';
import { BiomeDef, pickBiome } from './biomes';

export const SEA_LEVEL = 62;
const BASE_HEIGHT = 58;

function octaveNoise2D(noise: NoiseFunction2D, x: number, z: number, octaves: number, persistence: number, scale: number): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * scale * frequency, z * scale * frequency) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return sum / max; // -1..1
}

interface OreSpec {
  id: number;
  minY: number;
  maxY: number;
  chance: number; // per-stone-block probability at the sweet spot depth
}

const ORES: OreSpec[] = [
  { id: BlockId.CoalOre, minY: 5, maxY: 90, chance: 0.018 },
  { id: BlockId.IronOre, minY: 5, maxY: 60, chance: 0.012 },
  { id: BlockId.GoldOre, minY: 5, maxY: 32, chance: 0.006 },
  { id: BlockId.RedstoneOre, minY: 5, maxY: 20, chance: 0.007 },
  { id: BlockId.LapisOre, minY: 5, maxY: 30, chance: 0.005 },
  { id: BlockId.DiamondOre, minY: 5, maxY: 16, chance: 0.0035 },
];

export class TerrainGenerator {
  readonly seed: number;
  private heightNoise: NoiseFunction2D;
  private mountainNoise: NoiseFunction2D;
  private tempNoise: NoiseFunction2D;
  private humidNoise: NoiseFunction2D;
  private caveNoise: NoiseFunction3D;

  constructor(seed: number) {
    this.seed = seed;
    this.heightNoise = createNoise2D(mulberry32(seed));
    this.mountainNoise = createNoise2D(mulberry32(seed + 1));
    this.tempNoise = createNoise2D(mulberry32(seed + 2));
    this.humidNoise = createNoise2D(mulberry32(seed + 3));
    this.caveNoise = createNoise3D(mulberry32(seed + 4));
  }

  getClimate(wx: number, wz: number): { temperature: number; humidity: number } {
    const temperature = (octaveNoise2D(this.tempNoise, wx, wz, 2, 0.5, 0.004) + 1) / 2;
    const humidity = (octaveNoise2D(this.humidNoise, wx, wz, 2, 0.5, 0.004) + 1) / 2;
    return { temperature, humidity };
  }

  getHeight(wx: number, wz: number): number {
    const base = octaveNoise2D(this.heightNoise, wx, wz, 5, 0.5, 0.008);
    const mountain = octaveNoise2D(this.mountainNoise, wx, wz, 4, 0.55, 0.006);
    const mountainMask = Math.max(0, mountain - 0.35) * 1.6;
    let h = BASE_HEIGHT + base * 14 + mountainMask * 55;
    h = Math.max(4, Math.min(CHUNK_HEIGHT - 10, h));
    return Math.floor(h);
  }

  getBiome(wx: number, wz: number, height: number): BiomeDef {
    const { temperature, humidity } = this.getClimate(wx, wz);
    if (height > 100) return { ...pickBiome(temperature, humidity), id: 'mountains', surface: BlockId.Stone, subsurface: BlockId.Stone, treeType: null, treeChance: 0 };
    if (height <= SEA_LEVEL - 3) return { ...pickBiome(temperature, humidity), id: 'ocean', surface: BlockId.Sand, subsurface: BlockId.Sand, treeType: null, treeChance: 0 };
    if (height <= SEA_LEVEL + 1) return { ...pickBiome(temperature, humidity), id: 'beach', surface: BlockId.Sand, subsurface: BlockId.Sand, treeType: null, treeChance: 0 };
    return pickBiome(temperature, humidity);
  }

  private isCave(wx: number, y: number, wz: number): boolean {
    if (y < 4 || y > 62) return false;
    const n = this.caveNoise(wx * 0.045, y * 0.07, wz * 0.045);
    return n > 0.62;
  }

  private oreAt(wx: number, y: number, wz: number): number | null {
    for (const ore of ORES) {
      if (y < ore.minY || y > ore.maxY) continue;
      const roll = hash3D(this.seed ^ ore.id, wx, y, wz);
      if (roll < ore.chance) return ore.id;
    }
    return null;
  }

  generateChunk(cx: number, cz: number): Chunk {
    const chunk = new Chunk(cx, cz);
    const originX = chunk.worldOriginX;
    const originZ = chunk.worldOriginZ;

    const heights: number[][] = [];
    const biomes: BiomeDef[][] = [];
    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      heights[x] = [];
      biomes[x] = [];
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        const wx = originX + x;
        const wz = originZ + z;
        const h = this.getHeight(wx, wz);
        heights[x][z] = h;
        biomes[x][z] = this.getBiome(wx, wz, h);
      }
    }

    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        const wx = originX + x;
        const wz = originZ + z;
        const height = heights[x][z];
        const biome = biomes[x][z];
        const underwater = height < SEA_LEVEL;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          if (y === 0 || (y <= 2 && hash3D(this.seed, wx, y, wz) < 0.5 - y * 0.2)) {
            chunk.setBlock(x, y, z, BlockId.Bedrock);
            continue;
          }

          if (y > height) {
            if (y <= SEA_LEVEL) chunk.setBlock(x, y, z, BlockId.Water);
            continue; // else air
          }

          if (this.isCave(wx, y, wz) && y < height - 2) {
            continue; // air pocket
          }

          const depth = height - y;
          if (depth === 0) {
            chunk.setBlock(x, y, z, underwater ? biome.underwaterSurface : biome.surface);
          } else if (depth <= 3) {
            chunk.setBlock(x, y, z, biome.subsurface);
          } else {
            const ore = this.oreAt(wx, y, wz);
            chunk.setBlock(x, y, z, ore ?? BlockId.Stone);
          }
        }
      }
    }

    this.decorate(chunk, heights, biomes);
    return chunk;
  }

  private decorate(chunk: Chunk, heights: number[][], biomes: BiomeDef[][]) {
    const originX = chunk.worldOriginX;
    const originZ = chunk.worldOriginZ;
    for (let x = 2; x < CHUNK_SIZE_X - 2; x++) {
      for (let z = 2; z < CHUNK_SIZE_Z - 2; z++) {
        const height = heights[x][z];
        const biome = biomes[x][z];
        if (height < SEA_LEVEL) continue;
        const surfaceBlock = chunk.getBlock(x, height, z);
        if (surfaceBlock !== BlockId.GrassBlock) continue;

        const wx = originX + x;
        const wz = originZ + z;
        const roll = hash3D(this.seed, wx, 999, wz);
        if (biome.treeType && roll < biome.treeChance) {
          this.placeTree(chunk, x, height + 1, z, biome.treeType);
        } else if (roll < biome.treeChance + biome.grassChance) {
          chunk.setBlock(x, height + 1, z, BlockId.TallGrass);
        } else if (roll < biome.treeChance + biome.grassChance + biome.flowerChance) {
          const flowerRoll = hash3D(this.seed + 7, wx, 111, wz);
          chunk.setBlock(x, height + 1, z, flowerRoll < 0.5 ? BlockId.FlowerRed : BlockId.FlowerYellow);
        }
      }
    }
  }

  private placeTree(chunk: Chunk, x: number, y: number, z: number, type: 'oak' | 'birch' | 'spruce') {
    const log = type === 'oak' ? BlockId.OakLog : type === 'birch' ? BlockId.BirchLog : BlockId.SpruceLog;
    const leaves = type === 'oak' ? BlockId.OakLeaves : type === 'birch' ? BlockId.BirchLeaves : BlockId.SpruceLeaves;
    const trunkHeight = 4 + Math.floor(hash3D(this.seed + 3, x, y, z) * 2);

    for (let i = 0; i < trunkHeight; i++) chunk.setBlock(x, y + i, z, log);

    const topY = y + trunkHeight;
    for (let ly = topY - 2; ly <= topY + 1; ly++) {
      const radius = ly >= topY ? 1 : 2;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (Math.abs(lx) === radius && Math.abs(lz) === radius && radius === 2) continue;
          if (lx === 0 && lz === 0 && ly < topY) continue; // keep trunk visible below the cap
          if (chunk.getBlock(x + lx, ly, z + lz) === BlockId.Air) {
            chunk.setBlock(x + lx, ly, z + lz, leaves);
          }
        }
      }
    }
  }
}

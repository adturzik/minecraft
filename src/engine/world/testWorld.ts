import { Chunk, CHUNK_SIZE_X, CHUNK_SIZE_Z } from './chunk';
import { BlockId } from '../../game/items/blocks';

// Phase 1 visual test scene: a small flat-ish terrain patch showcasing
// several block types & face culling, no world-gen noise yet (that's Phase 2).
export function buildTestChunk(): Chunk {
  const chunk = new Chunk(0, 0);

  for (let x = 0; x < CHUNK_SIZE_X; x++) {
    for (let z = 0; z < CHUNK_SIZE_Z; z++) {
      chunk.setBlock(x, 0, z, BlockId.Bedrock);
      for (let y = 1; y <= 3; y++) chunk.setBlock(x, y, z, BlockId.Stone);
      for (let y = 4; y <= 6; y++) chunk.setBlock(x, y, z, BlockId.Dirt);
      chunk.setBlock(x, 7, z, BlockId.GrassBlock);
    }
  }

  // sand patch
  for (let x = 0; x < 5; x++) {
    for (let z = 0; z < 5; z++) {
      chunk.setBlock(x, 7, z, BlockId.Sand);
    }
  }

  // cobblestone + ore outcrop
  for (let x = 10; x < 14; x++) {
    for (let z = 2; z < 6; z++) {
      chunk.setBlock(x, 7, z, BlockId.Cobblestone);
      chunk.setBlock(x, 8, z, BlockId.Cobblestone);
    }
  }
  chunk.setBlock(11, 8, 3, BlockId.CoalOre);
  chunk.setBlock(12, 8, 4, BlockId.IronOre);
  chunk.setBlock(13, 8, 3, BlockId.DiamondOre);

  // small water pool
  for (let x = 6; x < 9; x++) {
    for (let z = 10; z < 13; z++) {
      chunk.setBlock(x, 6, z, BlockId.Sand);
      chunk.setBlock(x, 7, z, BlockId.Water);
    }
  }

  // glass box
  for (let x = 2; x < 5; x++) {
    chunk.setBlock(x, 8, 12, BlockId.Glass);
    chunk.setBlock(x, 9, 12, BlockId.Glass);
  }

  // oak log + leaves "tree"
  const tx = 8,
    tz = 8;
  for (let y = 8; y <= 10; y++) chunk.setBlock(tx, y, tz, BlockId.OakLog);
  for (let ly = 9; ly <= 12; ly++) {
    for (let lx = -2; lx <= 2; lx++) {
      for (let lz = -2; lz <= 2; lz++) {
        if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
        if (ly === 11 && (lx === 0 || lz === 0)) continue;
        const bx = tx + lx,
          bz = tz + lz;
        if (chunk.getBlock(bx, ly, bz) === BlockId.Air) chunk.setBlock(bx, ly, bz, BlockId.OakLeaves);
      }
    }
  }
  chunk.setBlock(tx, 11, tz, BlockId.OakLog);

  // crafting table + furnace + torch for visual check
  chunk.setBlock(0, 8, 8, BlockId.CraftingTable);
  chunk.setBlock(1, 8, 8, BlockId.Furnace);
  chunk.setBlock(2, 8, 8, BlockId.BrickBlock);
  chunk.setBlock(3, 8, 8, BlockId.Obsidian);

  return chunk;
}

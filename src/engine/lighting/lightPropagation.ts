import { CHUNK_SIZE_X, CHUNK_SIZE_Z, CHUNK_HEIGHT, Chunk } from '../world/chunk';
import { getRawBlockDef } from '../../game/items/blockDefs';

export const MAX_LIGHT = 15;

interface LightMeta {
  opaque: boolean;
  transparent: boolean;
  lightEmission: number;
}

function meta(id: number): LightMeta {
  const raw = getRawBlockDef(id);
  return { opaque: raw.opaque, transparent: raw.transparent, lightEmission: raw.lightEmission };
}

/** Per-chunk BFS light propagation (both sunlight and block-emitted light
 * combined into one 0..15 channel per cell — see PROGRESS.md Phase 7 for why
 * a single combined channel, computed independently per chunk with no
 * cross-chunk data, is an intentional simplification for this MVP). Skylight
 * seeds every open-air cell in a column down to the first opaque block (so
 * an unobstructed vertical shaft stays fully lit, matching vanilla), then a
 * standard flood fill with -1 falloff per step handles both sky and torch
 * light through transparent blocks. */
export function computeChunkLight(blocks: Uint16Array): Uint8Array {
  const light = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_HEIGHT);
  const queue: number[] = []; // flat indices, level encoded via a parallel array

  const levelOf = new Uint8Array(blocks.length);

  const idx = (x: number, y: number, z: number) => Chunk.index(x, y, z);

  // seed skylight
  for (let x = 0; x < CHUNK_SIZE_X; x++) {
    for (let z = 0; z < CHUNK_SIZE_Z; z++) {
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        const id = blocks[idx(x, y, z)];
        if (meta(id).opaque) break;
        const i = idx(x, y, z);
        light[i] = MAX_LIGHT;
        levelOf[i] = MAX_LIGHT;
        queue.push(i);
      }
    }
  }

  // seed block light
  for (let x = 0; x < CHUNK_SIZE_X; x++) {
    for (let z = 0; z < CHUNK_SIZE_Z; z++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const id = blocks[idx(x, y, z)];
        const emission = meta(id).lightEmission;
        if (emission > 0) {
          const i = idx(x, y, z);
          if (emission > light[i]) {
            light[i] = emission;
            levelOf[i] = emission;
            queue.push(i);
          }
        }
      }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const level = levelOf[i];
    if (level <= 1) continue;

    const y = Math.floor(i / (CHUNK_SIZE_X * CHUNK_SIZE_Z));
    const rem = i - y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
    const z = Math.floor(rem / CHUNK_SIZE_X);
    const x = rem - z * CHUNK_SIZE_X;

    const neighbors: [number, number, number][] = [
      [x + 1, y, z], [x - 1, y, z],
      [x, y + 1, z], [x, y - 1, z],
      [x, y, z + 1], [x, y, z - 1],
    ];
    for (const [nx, ny, nz] of neighbors) {
      if (nx < 0 || nx >= CHUNK_SIZE_X || nz < 0 || nz >= CHUNK_SIZE_Z || ny < 0 || ny >= CHUNK_HEIGHT) continue;
      const ni = idx(nx, ny, nz);
      const nId = blocks[ni];
      if (meta(nId).opaque) continue;
      const newLevel = level - 1;
      if (newLevel > levelOf[ni]) {
        levelOf[ni] = newLevel;
        light[ni] = newLevel;
        queue.push(ni);
      }
    }
  }

  return light;
}

/** Light level for a chunk-boundary neighbor we have no data for. Treated as
 * bright to avoid seam faces going falsely dark (see the meshing note). */
export const OUT_OF_CHUNK_LIGHT = MAX_LIGHT;

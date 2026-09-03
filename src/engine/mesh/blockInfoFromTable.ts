import { getRawBlockDef } from '../../game/items/blockDefs';
import type { BlockInfoResolver, MeshBlockInfo } from './culledMesher';
import type { TileTable } from '../../game/items/blocks';

/** Builds a mesher BlockInfoResolver from pure blockDefs metadata + a
 * postMessage'd tile table. Worker-safe (no DOM/canvas import). */
export function makeBlockInfoResolver(tileTable: TileTable): BlockInfoResolver {
  const cache = new Map<number, MeshBlockInfo>();
  return (id: number) => {
    const cached = cache.get(id);
    if (cached) return cached;
    const raw = getRawBlockDef(id);
    const tiles = tileTable[id];
    const info: MeshBlockInfo = {
      solid: raw.solid,
      opaque: raw.opaque,
      transparent: raw.transparent,
      renderType: raw.renderType,
      top: tiles.top,
      side: tiles.side,
      bottom: tiles.bottom,
    };
    cache.set(id, info);
    return info;
  };
}

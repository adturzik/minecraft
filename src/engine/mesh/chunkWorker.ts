/// <reference lib="webworker" />
// Runs off the main thread: terrain generation + culled meshing. Imports only
// worker-safe (no DOM/canvas) modules -- see PROGRESS.md for why the block
// registry is split into blockDefs.ts (pure data) vs blocks.ts (adds canvas
// texture tiles, main-thread only).
import { TerrainGenerator } from '../worldgen/terrain';
import { buildChunkMesh, MeshBuffers } from './culledMesher';
import { makeBlockInfoResolver } from './blockInfoFromTable';
import type { TileTable } from '../../game/items/blocks';
import { CHUNK_HEIGHT, CHUNK_SIZE_X, CHUNK_SIZE_Z, Chunk } from '../world/chunk';
import { computeChunkLight, OUT_OF_CHUNK_LIGHT } from '../lighting/lightPropagation';

interface InitMessage {
  type: 'init';
  seed: number;
  tileTable: TileTable;
}
interface GenerateMessage {
  type: 'generate';
  requestId: number;
  cx: number;
  cz: number;
}
type InMessage = InitMessage | GenerateMessage;

let generator: TerrainGenerator | null = null;
let getInfo: ReturnType<typeof makeBlockInfoResolver> | null = null;

function typed(buffers: MeshBuffers) {
  return {
    positions: new Float32Array(buffers.positions),
    normals: new Float32Array(buffers.normals),
    uvs: new Float32Array(buffers.uvs),
    colors: new Float32Array(buffers.colors),
    indices: new Uint32Array(buffers.indices),
    sway: new Float32Array(buffers.sway),
  };
}

self.onmessage = (e: MessageEvent<InMessage>) => {
  try {
    handleMessage(e.data);
  } catch (err) {
    console.error('[chunkWorker] error handling message', e.data.type, err);
  }
};

function handleMessage(msg: InMessage) {
  if (msg.type === 'init') {
    generator = new TerrainGenerator(msg.seed);
    getInfo = makeBlockInfoResolver(msg.tileTable);
    return;
  }

  if (msg.type === 'generate') {
    if (!generator || !getInfo) {
      console.error('[chunkWorker] generate requested before init', { hasGenerator: !!generator, hasGetInfo: !!getInfo });
      return;
    }
    const chunk = generator.generateChunk(msg.cx, msg.cz);
    const getBlock = (x: number, y: number, z: number) => chunk.getBlock(x, y, z);
    const light = computeChunkLight(chunk.blocks);
    const getLight = (x: number, y: number, z: number) => {
      if (x < 0 || x >= CHUNK_SIZE_X || z < 0 || z >= CHUNK_SIZE_Z || y < 0 || y >= CHUNK_HEIGHT) return OUT_OF_CHUNK_LIGHT;
      return light[Chunk.index(x, y, z)];
    };
    const { opaque, transparent } = buildChunkMesh(getBlock, CHUNK_SIZE_X, CHUNK_HEIGHT, CHUNK_SIZE_Z, getInfo, getLight);
    const opaqueT = typed(opaque);
    const transparentT = typed(transparent);
    const blocksCopy = chunk.blocks.slice();
    const lightCopy = light.slice();

    const transfer: Transferable[] = [
      opaqueT.positions.buffer, opaqueT.normals.buffer, opaqueT.uvs.buffer, opaqueT.colors.buffer, opaqueT.indices.buffer, opaqueT.sway.buffer,
      transparentT.positions.buffer, transparentT.normals.buffer, transparentT.uvs.buffer, transparentT.colors.buffer, transparentT.indices.buffer, transparentT.sway.buffer,
      blocksCopy.buffer,
      lightCopy.buffer,
    ];

    (self as unknown as Worker).postMessage(
      {
        type: 'chunkReady',
        requestId: msg.requestId,
        cx: msg.cx,
        cz: msg.cz,
        opaque: opaqueT,
        light: lightCopy,
        transparent: transparentT,
        blocks: blocksCopy,
      },
      transfer
    );
  }
}

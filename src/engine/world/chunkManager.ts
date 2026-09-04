import * as THREE from 'three';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE_X, CHUNK_SIZE_Z } from './chunk';
import { getBlockMaterials, buffersToGeometry } from '../mesh/blockMaterials';
import { buildChunkMesh } from '../mesh/culledMesher';
import { getBlockDef, serializeTileTable } from '../../game/items/blocks';
import { computeChunkLight, OUT_OF_CHUNK_LIGHT } from '../lighting/lightPropagation';

interface LoadedChunk {
  cx: number;
  cz: number;
  blocks: Uint16Array | null;
  light: Uint8Array | null;
  opaqueMesh: THREE.Mesh | null;
  transparentMesh: THREE.Mesh | null;
  state: 'pending' | 'ready';
}

const key = (cx: number, cz: number) => `${cx},${cz}`;

export interface ChunkManagerOptions {
  seed: number;
  renderDistance?: number;
  workerCount?: number;
}

/** Streams chunks in/out around a moving center point using a pool of Web
 * Workers for terrain generation + meshing, so the main thread never blocks. */
export class ChunkManager {
  private scene: THREE.Scene;
  private workers: Worker[] = [];
  private nextWorker = 0;
  private chunks = new Map<string, LoadedChunk>();
  private renderDistance: number;
  private requestId = 0;
  private centerCx = Infinity;
  private centerCz = Infinity;
  private materials = getBlockMaterials();
  /** Every block the player has changed vs. freshly generated terrain,
   * "wx,wy,wz" -> blockId. Persisted instead of the whole world (see
   * saveSystem.ts) and replayed onto chunks as they stream in. */
  private edits = new Map<string, number>();

  constructor(scene: THREE.Scene, options: ChunkManagerOptions) {
    this.scene = scene;
    this.renderDistance = options.renderDistance ?? 6;
    const tileTable = serializeTileTable();
    const workerCount = options.workerCount ?? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(new URL('../mesh/chunkWorker.ts', import.meta.url), { type: 'module' });
      worker.postMessage({ type: 'init', seed: options.seed, tileTable });
      worker.onmessage = (e: MessageEvent) => this.handleWorkerMessage(e.data);
      this.workers.push(worker);
    }
  }

  private handleWorkerMessage(data: {
    type: string;
    cx: number;
    cz: number;
    opaque: { positions: Float32Array; normals: Float32Array; uvs: Float32Array; colors: Float32Array; indices: Uint32Array; sway: Float32Array };
    transparent: { positions: Float32Array; normals: Float32Array; uvs: Float32Array; colors: Float32Array; indices: Uint32Array; sway: Float32Array };
    blocks: Uint16Array;
    light: Uint8Array;
  }) {
    if (data.type !== 'chunkReady') return;
    const k = key(data.cx, data.cz);
    const entry = this.chunks.get(k);
    if (!entry) return; // was unloaded before its generation finished

    const opaqueGeo = buffersToGeometry(data.opaque);
    const transparentGeo = buffersToGeometry(data.transparent);

    entry.blocks = data.blocks;
    entry.light = data.light;
    entry.state = 'ready';

    let touchedByEdits = false;
    if (this.edits.size > 0) {
      const minX = data.cx * CHUNK_SIZE_X;
      const minZ = data.cz * CHUNK_SIZE_Z;
      for (const [posKey, blockId] of this.edits) {
        const [ex, ey, ez] = posKey.split(',').map(Number);
        if (ex < minX || ex >= minX + CHUNK_SIZE_X || ez < minZ || ez >= minZ + CHUNK_SIZE_Z) continue;
        entry.blocks[Chunk.index(ex - minX, ey, ez - minZ)] = blockId;
        touchedByEdits = true;
      }
    }
    if (touchedByEdits) {
      this.remeshChunk(entry); // re-light + re-mesh with the edits applied instead of the worker's pristine mesh
      return;
    }

    if (opaqueGeo) {
      const mesh = new THREE.Mesh(opaqueGeo, this.materials.opaque);
      mesh.position.set(data.cx * CHUNK_SIZE_X, 0, data.cz * CHUNK_SIZE_Z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      entry.opaqueMesh = mesh;
    }
    if (transparentGeo) {
      const mesh = new THREE.Mesh(transparentGeo, this.materials.transparent);
      mesh.position.set(data.cx * CHUNK_SIZE_X, 0, data.cz * CHUNK_SIZE_Z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      entry.transparentMesh = mesh;
    }
  }

  private requestChunk(cx: number, cz: number) {
    const k = key(cx, cz);
    if (this.chunks.has(k)) return;
    this.chunks.set(k, { cx, cz, blocks: null, light: null, opaqueMesh: null, transparentMesh: null, state: 'pending' });
    const worker = this.workers[this.nextWorker];
    this.nextWorker = (this.nextWorker + 1) % this.workers.length;
    worker.postMessage({ type: 'generate', requestId: this.requestId++, cx, cz });
  }

  private unloadChunk(k: string) {
    const entry = this.chunks.get(k);
    if (!entry) return;
    if (entry.opaqueMesh) {
      this.scene.remove(entry.opaqueMesh);
      entry.opaqueMesh.geometry.dispose();
    }
    if (entry.transparentMesh) {
      this.scene.remove(entry.transparentMesh);
      entry.transparentMesh.geometry.dispose();
    }
    this.chunks.delete(k);
  }

  /** Call whenever the player crosses into a new chunk (cheap no-op otherwise). */
  setCenter(worldX: number, worldZ: number) {
    const cx = Math.floor(worldX / CHUNK_SIZE_X);
    const cz = Math.floor(worldZ / CHUNK_SIZE_Z);
    if (cx === this.centerCx && cz === this.centerCz) return;
    this.centerCx = cx;
    this.centerCz = cz;

    const wanted = new Set<string>();
    const r = this.renderDistance;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dz * dz > r * r) continue; // circular render distance
        const wx = cx + dx;
        const wz = cz + dz;
        wanted.add(key(wx, wz));
        this.requestChunk(wx, wz);
      }
    }

    const unloadDistance = r + 2;
    for (const k of Array.from(this.chunks.keys())) {
      if (wanted.has(k)) continue;
      const entry = this.chunks.get(k)!;
      const dx = entry.cx - cx;
      const dz = entry.cz - cz;
      if (dx * dx + dz * dz > unloadDistance * unloadDistance) {
        this.unloadChunk(k);
      }
    }
  }

  /** World-space block lookup. Unloaded chunks read as air (0) so physics
   * simply doesn't collide there rather than treating it as solid ground. */
  getBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return 0;
    const cx = Math.floor(wx / CHUNK_SIZE_X);
    const cz = Math.floor(wz / CHUNK_SIZE_Z);
    const entry = this.chunks.get(key(cx, cz));
    if (!entry || !entry.blocks) return 0;
    const lx = ((wx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((wz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    return entry.blocks[Chunk.index(lx, wy, lz)];
  }

  isSolid(wx: number, wy: number, wz: number): boolean {
    if (wy < 0) return true; // treat below-bedrock as solid so nothing falls through the world
    const id = this.getBlock(wx, wy, wz);
    return id !== 0 && getBlockDef(id).solid;
  }

  /** 0..15 combined sky+block light, used for mob spawn gating and (later)
   * any other light-driven gameplay. Unloaded chunks read as fully lit so
   * mobs don't treat the render-distance edge as "dark". */
  getLightLevel(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return 0;
    const cx = Math.floor(wx / CHUNK_SIZE_X);
    const cz = Math.floor(wz / CHUNK_SIZE_Z);
    const entry = this.chunks.get(key(cx, cz));
    if (!entry || !entry.light) return OUT_OF_CHUNK_LIGHT;
    const lx = ((wx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((wz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    return entry.light[Chunk.index(lx, wy, lz)];
  }

  /** Edits one block and remeshes just its owning chunk on the main thread
   * (cheap for a single 16x16x128 chunk, and keeps edits latency-free without
   * a worker round trip). Returns false if the chunk isn't loaded yet. */
  setBlock(wx: number, wy: number, wz: number, id: number): boolean {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return false;
    const cx = Math.floor(wx / CHUNK_SIZE_X);
    const cz = Math.floor(wz / CHUNK_SIZE_Z);
    const entry = this.chunks.get(key(cx, cz));
    if (!entry || !entry.blocks) return false;
    const lx = ((wx % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((wz % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    entry.blocks[Chunk.index(lx, wy, lz)] = id;
    this.edits.set(`${wx},${wy},${wz}`, id);
    this.remeshChunk(entry);
    return true;
  }

  getEdits(): [string, number][] {
    return Array.from(this.edits.entries());
  }

  /** Restores a previously-saved diff. Call before any chunks are requested
   * (i.e. right after construction) so it's ready to replay as they load. */
  loadEdits(entries: [string, number][]) {
    this.edits = new Map(entries);
  }

  private remeshChunk(entry: LoadedChunk) {
    if (!entry.blocks) return;
    const blocks = entry.blocks;
    const getBlock = (x: number, y: number, z: number) => {
      if (x < 0 || x >= CHUNK_SIZE_X || z < 0 || z >= CHUNK_SIZE_Z || y < 0 || y >= CHUNK_HEIGHT) return 0;
      return blocks[Chunk.index(x, y, z)];
    };
    entry.light = computeChunkLight(blocks);
    const light = entry.light;
    const getLight = (x: number, y: number, z: number) => {
      if (x < 0 || x >= CHUNK_SIZE_X || z < 0 || z >= CHUNK_SIZE_Z || y < 0 || y >= CHUNK_HEIGHT) return OUT_OF_CHUNK_LIGHT;
      return light[Chunk.index(x, y, z)];
    };
    const { opaque, transparent } = buildChunkMesh(getBlock, CHUNK_SIZE_X, CHUNK_HEIGHT, CHUNK_SIZE_Z, getBlockDef, getLight);

    if (entry.opaqueMesh) {
      this.scene.remove(entry.opaqueMesh);
      entry.opaqueMesh.geometry.dispose();
      entry.opaqueMesh = null;
    }
    if (entry.transparentMesh) {
      this.scene.remove(entry.transparentMesh);
      entry.transparentMesh.geometry.dispose();
      entry.transparentMesh = null;
    }

    const opaqueGeo = buffersToGeometry(opaque);
    if (opaqueGeo) {
      const mesh = new THREE.Mesh(opaqueGeo, this.materials.opaque);
      mesh.position.set(entry.cx * CHUNK_SIZE_X, 0, entry.cz * CHUNK_SIZE_Z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      entry.opaqueMesh = mesh;
    }
    const transparentGeo = buffersToGeometry(transparent);
    if (transparentGeo) {
      const mesh = new THREE.Mesh(transparentGeo, this.materials.transparent);
      mesh.position.set(entry.cx * CHUNK_SIZE_X, 0, entry.cz * CHUNK_SIZE_Z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      entry.transparentMesh = mesh;
    }
  }

  getLoadedChunkCount() {
    return this.chunks.size;
  }

  getReadyChunkCount() {
    let n = 0;
    for (const c of this.chunks.values()) if (c.state === 'ready') n++;
    return n;
  }

  dispose() {
    for (const k of Array.from(this.chunks.keys())) this.unloadChunk(k);
    for (const w of this.workers) w.terminate();
  }
}

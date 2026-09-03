import type { RenderType } from '../../game/items/blockDefs';
import type { TileRect } from './textureAtlas';

export interface MeshBuffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

function emptyBuffers(): MeshBuffers {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] };
}

// Classic blocky baked face shading (Minecraft-style: top brightest, bottom
// darkest, N/S/E/W sides vary) instead of real-time dynamic lighting. This
// also gives Phase 7 (block/sky light propagation) a ready slot: multiply
// these base values by the propagated light level per-vertex later.
const FACE_SHADE: Record<'top' | 'bottom' | 'side', number> = {
  top: 1.0,
  bottom: 0.5,
  side: 0.75,
};
const DIR_SHADE: Record<string, number> = {
  '1,0,0': 0.6,
  '-1,0,0': 0.6,
  '0,0,1': 0.8,
  '0,0,-1': 0.8,
};

export type Getter = (x: number, y: number, z: number) => number;
/** 0..15 combined sky+block light at a cell (see lightPropagation.ts). */
export type LightGetter = (x: number, y: number, z: number) => number;

// Never fully pure black: at 0.04-0.18 unlit faces were still barely
// distinguishable from the void behind them (read as "transparent holes"
// rather than dark rock -- confirmed by screenshotting an enclosed unlit
// room, where the near wall all but disappeared into the background). 0.4
// keeps caves clearly darker than lit terrain while staying legible as
// solid geometry against the sky/fog/void.
const MIN_LIGHT_FACTOR = 0.4;

/** Minimal per-block info the mesher needs. Both main thread (blocks.ts,
 * with real texture tiles) and the mesh worker (blockDefs.ts meta + a
 * postMessage'd tile table) can produce this shape. */
export interface MeshBlockInfo {
  solid: boolean;
  opaque: boolean;
  transparent: boolean;
  renderType: RenderType;
  top: TileRect;
  side: TileRect;
  bottom: TileRect;
}

export type BlockInfoResolver = (id: number) => MeshBlockInfo;

interface FaceSpec {
  dir: [number, number, number];
  corners: [number, number, number][];
  which: 'top' | 'bottom' | 'side';
}

const FACES: FaceSpec[] = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]], which: 'side' },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]], which: 'side' },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], which: 'top' },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], which: 'bottom' },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], which: 'side' },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], which: 'side' },
];

function faceUVs(info: MeshBlockInfo, which: 'top' | 'bottom' | 'side') {
  const tile = which === 'top' ? info.top : which === 'bottom' ? info.bottom : info.side;
  return [
    [tile.u0, tile.v1],
    [tile.u1, tile.v1],
    [tile.u1, tile.v0],
    [tile.u0, tile.v0],
  ];
}

const CROSS_CORNERS: [number, number, number][][] = [
  [[0.1464, 0, 0.1464], [0.8536, 0, 0.8536], [0.8536, 1, 0.8536], [0.1464, 1, 0.1464]],
  [[0.8536, 0, 0.1464], [0.1464, 0, 0.8536], [0.1464, 1, 0.8536], [0.8536, 1, 0.1464]],
];

export function buildChunkMesh(
  getBlock: Getter,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  getInfo: BlockInfoResolver,
  getLight: LightGetter = () => 15
): { opaque: MeshBuffers; transparent: MeshBuffers } {
  const opaque = emptyBuffers();
  const transparent = emptyBuffers();

  for (let y = 0; y < sizeY; y++) {
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const id = getBlock(x, y, z);
        if (id === 0) continue;
        const info = getInfo(id);

        if (info.renderType === 'cross') {
          const target = transparent;
          const ownLight = Math.max(MIN_LIGHT_FACTOR, getLight(x, y, z) / 15);
          for (const plane of CROSS_CORNERS) {
            const startIndex = target.positions.length / 3;
            for (const corner of plane) {
              target.positions.push(x + corner[0], y + corner[1], z + corner[2]);
              target.normals.push(0, 1, 0);
              target.colors.push(0.85 * ownLight, 0.85 * ownLight, 0.85 * ownLight);
            }
            for (const uv of faceUVs(info, 'side')) target.uvs.push(uv[0], uv[1]);
            target.indices.push(
              startIndex, startIndex + 1, startIndex + 2,
              startIndex, startIndex + 2, startIndex + 3,
              startIndex, startIndex + 2, startIndex + 1,
              startIndex, startIndex + 3, startIndex + 2
            );
          }
          continue;
        }

        const target = info.transparent ? transparent : opaque;

        for (const face of FACES) {
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];
          const neighborId = getBlock(nx, ny, nz);
          if (neighborId === id && info.transparent) continue;
          if (neighborId !== 0) {
            const neighborInfo = getInfo(neighborId);
            if (neighborInfo.opaque) continue;
          }

          const startIndex = target.positions.length / 3;
          const shade =
            face.which === 'side'
              ? DIR_SHADE[`${face.dir[0]},${face.dir[1]},${face.dir[2]}`] ?? FACE_SHADE.side
              : FACE_SHADE[face.which];
          // Faces are lit by the light level stored in the (transparent)
          // neighbor cell they face into, not their own (solid blocks don't
          // hold light) -- same rule vanilla Minecraft uses.
          const lightFactor = Math.max(MIN_LIGHT_FACTOR, getLight(nx, ny, nz) / 15);
          const finalShade = shade * lightFactor;
          for (const corner of face.corners) {
            target.positions.push(x + corner[0], y + corner[1], z + corner[2]);
            target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
            target.colors.push(finalShade, finalShade, finalShade);
          }
          for (const uv of faceUVs(info, face.which)) {
            target.uvs.push(uv[0], uv[1]);
          }
          target.indices.push(
            startIndex,
            startIndex + 1,
            startIndex + 2,
            startIndex,
            startIndex + 2,
            startIndex + 3
          );
        }
      }
    }
  }

  return { opaque, transparent };
}

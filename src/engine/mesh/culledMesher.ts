import type { RenderType } from '../../game/items/blockDefs';
import type { TileRect } from './textureAtlas';

export interface MeshBuffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
  /** Per-vertex animation hint consumed by the transparent material's custom
   * vertex shader (see blockMaterials.ts): 0 = static, 1 = cross-plant top
   * vertex (wind sway), 2 = liquid top-surface vertex (gentle wave). Always
   * populated 1:1 with positions, including for the opaque bucket (which is
   * always 0 there) so buffersToGeometry can set it unconditionally. */
  sway: number[];
}

function emptyBuffers(): MeshBuffers {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [], sway: [] };
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
const MIN_LIGHT_FACTOR = 0.58;

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
  flipWinding?: boolean;
}

const FACES: FaceSpec[] = [
  // flipWinding faces (+X/-X) have a corner order whose forward triangle
  // winding (cross(corners[1]-corners[0], corners[2]-corners[0])) points
  // opposite to `dir` -- the other 4 faces' windings already match. With
  // the opaque material's default `side: FrontSide`, that made every
  // east/west block face a back face and get culled outright, i.e. every
  // single cube in the game rendered "see-through" on exactly those two
  // sides. Reversing the corner array would fix the winding but also
  // silently flips which UV corner lands where (faceUVs assigns UVs by
  // position in this array, not by content), turning the texture upside
  // down instead -- so the winding is flipped in the triangle indices
  // below (buildChunkMesh) instead, leaving these corners/UVs untouched.
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]], which: 'side', flipWinding: true },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]], which: 'side', flipWinding: true },
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

/** Classic voxel-engine vertex AO (see e.g. the 0fps.net writeup): darkens a
 * face's corner based on the up-to-3 opaque neighbor cells that touch it in
 * the layer the face opens into -- two edge-adjacent cells plus the diagonal
 * between them. Gives Minecraft's "smooth lighting" corner-darkening look
 * (concave corners read as recessed) instead of every vertex on a face
 * sharing one flat baked shade. Returns 0.68 (fully occluded) .. 1.0 (open),
 * floored so corners never crush to pure black on top of the light/shade
 * multipliers already applied. */
function computeVertexAO(
  isOpaqueAt: (x: number, y: number, z: number) => boolean,
  nx: number,
  ny: number,
  nz: number,
  dir: [number, number, number],
  corner: [number, number, number]
): number {
  const off: [number, number, number] = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    if (dir[axis] !== 0) continue; // the normal axis isn't a tangent -- leave at 0
    off[axis] = corner[axis] > 0.5 ? 1 : -1;
  }
  const sideA: [number, number, number] = [nx, ny, nz];
  const sideB: [number, number, number] = [nx, ny, nz];
  const cornerCell: [number, number, number] = [nx, ny, nz];
  let pickedFirst = false;
  for (let axis = 0; axis < 3; axis++) {
    if (off[axis] === 0) continue;
    cornerCell[axis] += off[axis];
    if (!pickedFirst) {
      sideA[axis] += off[axis];
      pickedFirst = true;
    } else {
      sideB[axis] += off[axis];
    }
  }
  const s1 = isOpaqueAt(sideA[0], sideA[1], sideA[2]);
  const s2 = isOpaqueAt(sideB[0], sideB[1], sideB[2]);
  const ao = s1 && s2 ? 0 : 3 - (s1 ? 1 : 0) - (s2 ? 1 : 0) - (isOpaqueAt(cornerCell[0], cornerCell[1], cornerCell[2]) ? 1 : 0);
  return 0.68 + 0.32 * (ao / 3);
}

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
  const isOpaqueAt = (x: number, y: number, z: number) => {
    const cellId = getBlock(x, y, z);
    return cellId !== 0 && getInfo(cellId).opaque;
  };

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
              target.sway.push(corner[1] > 0.5 ? 1 : 0); // only the top of the plant sways, base stays planted
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
          // Only a liquid's exposed top surface (not its walls/floor) gets
          // the wave animation -- the same neighbor-culling above already
          // means a stacked water/lava column only ever exposes a 'top'
          // face at its actual surface.
          const swayValue = info.renderType === 'liquid' && face.which === 'top' ? 2 : 0;
          for (const corner of face.corners) {
            const ao = computeVertexAO(isOpaqueAt, nx, ny, nz, face.dir, corner);
            const cornerShade = finalShade * ao;
            target.positions.push(x + corner[0], y + corner[1], z + corner[2]);
            target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
            target.colors.push(cornerShade, cornerShade, cornerShade);
            target.sway.push(swayValue);
          }
          for (const uv of faceUVs(info, face.which)) {
            target.uvs.push(uv[0], uv[1]);
          }
          if (face.flipWinding) {
            target.indices.push(
              startIndex,
              startIndex + 3,
              startIndex + 2,
              startIndex,
              startIndex + 2,
              startIndex + 1
            );
          } else {
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
  }

  return { opaque, transparent };
}

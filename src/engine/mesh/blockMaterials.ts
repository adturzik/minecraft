import * as THREE from 'three';
import { atlasBuilder } from './textureAtlas';
import '../../game/items/blocks'; // ensure all tiles are registered before building the atlas texture
import type { MeshBuffers } from './culledMesher';

let materials: { opaque: THREE.Material; transparent: THREE.Material } | null = null;

// Blocky voxel look = baked per-face vertex shading (see culledMesher),
// not dynamic PBR lighting. MeshBasicMaterial + vertexColors keeps it fast
// and gives Phase 7 (light propagation) a direct multiply-in slot.
export function getBlockMaterials() {
  if (materials) return materials;
  const { map } = atlasBuilder.buildTextures();

  const opaque = new THREE.MeshBasicMaterial({
    map,
    vertexColors: true,
  });

  const transparent = new THREE.MeshBasicMaterial({
    map,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  materials = { opaque, transparent };
  return materials;
}

export interface AnyMeshBuffers {
  positions: MeshBuffers['positions'] | Float32Array;
  normals: MeshBuffers['normals'] | Float32Array;
  uvs: MeshBuffers['uvs'] | Float32Array;
  colors: MeshBuffers['colors'] | Float32Array;
  indices: MeshBuffers['indices'] | Uint32Array;
}

export function buffersToGeometry(buffers: AnyMeshBuffers): THREE.BufferGeometry | null {
  if (buffers.positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffers.colors, 3));
  // Always wrap explicitly: setIndex()'s plain-Array auto-sizing path does
  // NOT run for a raw TypedArray (e.g. the Uint32Array a worker posts back),
  // which would otherwise be assigned straight to geometry.index and break.
  geometry.setIndex(new THREE.Uint32BufferAttribute(buffers.indices, 1));
  return geometry;
}

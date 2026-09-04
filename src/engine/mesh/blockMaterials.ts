import * as THREE from 'three';
import { atlasBuilder } from './textureAtlas';
import '../../game/items/blocks'; // ensure all tiles are registered before building the atlas texture
import type { MeshBuffers } from './culledMesher';

let materials: { opaque: THREE.MeshLambertMaterial; transparent: THREE.MeshLambertMaterial } | null = null;
let swayShader: { uniforms: Record<string, { value: unknown }> } | null = null;

// Baked per-face vertex shading (see culledMesher) still supplies the
// Minecraft-style AO/light-level base, but the material itself is now a real
// lit material (MeshLambertMaterial) driven by a scene sun + hemisphere
// light in main.ts -- the mesher already emitted real face normals from day
// one for exactly this, they just went unused under MeshBasicMaterial.
//
// The transparent bucket (liquids + cross-billboard plants) additionally
// gets a small onBeforeCompile vertex shader patch that reads the `sway`
// per-vertex attribute the mesher writes: 1 = a plant's top vertex (wind
// sway), 2 = a liquid's exposed top surface (gentle wave). Everything else
// (0) is left untouched, so solid ground/plant bases never move.
function addSwayShader(material: THREE.MeshLambertMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sway;\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        if (sway > 1.5) {
          transformed.y += sin(uTime * 1.6 + transformed.x * 0.6 + transformed.z * 0.6) * 0.045;
        } else if (sway > 0.5) {
          float windPhase = sin(uTime * 1.8 + transformed.x * 1.3 + transformed.z * 1.3);
          transformed.x += windPhase * 0.09;
          transformed.z += windPhase * 0.05;
        }`
      );
    swayShader = shader;
  };
}

/** Advances the wind/wave animation. Call once per frame from main.ts with a
 * free-running elapsed-seconds counter (not GameClock's day-cycle time,
 * which wraps and would jump the phase once per in-game day). */
export function updateSwayTime(elapsedSeconds: number) {
  if (swayShader) swayShader.uniforms.uTime.value = elapsedSeconds;
}

export function getBlockMaterials() {
  if (materials) return materials;
  const { map } = atlasBuilder.buildTextures();

  const opaque = new THREE.MeshLambertMaterial({
    map,
    vertexColors: true,
  });

  const transparent = new THREE.MeshLambertMaterial({
    map,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  addSwayShader(transparent);

  materials = { opaque, transparent };
  return materials;
}

export interface AnyMeshBuffers {
  positions: MeshBuffers['positions'] | Float32Array;
  normals: MeshBuffers['normals'] | Float32Array;
  uvs: MeshBuffers['uvs'] | Float32Array;
  colors: MeshBuffers['colors'] | Float32Array;
  indices: MeshBuffers['indices'] | Uint32Array;
  sway: MeshBuffers['sway'] | Float32Array;
}

export function buffersToGeometry(buffers: AnyMeshBuffers): THREE.BufferGeometry | null {
  if (buffers.positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setAttribute('sway', new THREE.Float32BufferAttribute(buffers.sway, 1));
  // Always wrap explicitly: setIndex()'s plain-Array auto-sizing path does
  // NOT run for a raw TypedArray (e.g. the Uint32Array a worker posts back),
  // which would otherwise be assigned straight to geometry.index and break.
  geometry.setIndex(new THREE.Uint32BufferAttribute(buffers.indices, 1));
  return geometry;
}

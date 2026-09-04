import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Hyperrealistic PBR tool/weapon/armor/mob models the user generated
// externally and dropped into public/models/ -- loaded once, cached, and
// handed out as clones (cheap: clone() shares geometry/material, only the
// transform hierarchy is duplicated) so every held-item view and every mob
// instance gets its own independent Object3D to move/animate.

const loader = new GLTFLoader();
const cache = new Map<string, THREE.Group>();
const pending = new Map<string, Promise<THREE.Group>>();

function modelUrl(name: string): string {
  return `${import.meta.env.BASE_URL}models/${name}.glb`;
}

async function loadOnce(name: string): Promise<THREE.Group> {
  const cached = cache.get(name);
  if (cached) return cached;
  const existing = pending.get(name);
  if (existing) return existing;

  const promise = new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      modelUrl(name),
      (gltf) => {
        const scene = gltf.scene;
        scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        cache.set(name, scene);
        resolve(scene);
      },
      undefined,
      (err) => reject(err)
    );
  });
  pending.set(name, promise);
  return promise;
}

/** Kicks off loading every model up front (called once at game start) so
 * later synchronous getModel() calls almost always hit a warm cache instead
 * of popping in a frame or two late. Failures are swallowed per-model (a
 * missing/broken glb falls back to whatever the caller does when getModel
 * returns null) rather than blocking the whole game on one bad file. */
export async function preloadModels(names: string[]): Promise<void> {
  await Promise.all(names.map((name) => loadOnce(name).catch(() => null)));
}

/** Synchronous accessor for already-cached models -- returns a fresh clone
 * ready to add to the scene, or null if it hasn't finished loading yet
 * (callers should have preloaded first; null is a "not ready" signal, not
 * a permanent failure, since loadOnce populates the cache in the
 * background regardless of whether anyone's called preloadModels). */
export function getModel(name: string): THREE.Group | null {
  const base = cache.get(name);
  if (base) return base.clone(true);
  loadOnce(name).catch(() => null); // opportunistically start loading for next time
  return null;
}

export function isModelReady(name: string): boolean {
  return cache.has(name);
}

/** Every GLB the user generated and dropped into public/models/ -- kept as
 * one list so main.ts can kick off a single preload at game start instead
 * of each caller inventing its own subset. */
export const ALL_MODEL_NAMES: string[] = [
  'wood_pickaxe', 'wood_axe', 'wood_shovel', 'wood_sword', 'wood_hoe',
  'stone_pickaxe', 'stone_axe', 'stone_shovel', 'stone_sword', 'stone_hoe',
  'iron_pickaxe', 'iron_axe', 'iron_shovel', 'iron_sword', 'iron_hoe',
  'diamond_pickaxe', 'diamond_axe', 'diamond_shovel', 'diamond_sword', 'diamond_hoe',
  'bow', 'arrow', 'shears', 'bucket', 'water_bucket', 'lava_bucket',
  'leather_helmet', 'leather_chestplate', 'leather_leggings', 'leather_boots',
  'iron_helmet', 'iron_chestplate', 'iron_leggings', 'iron_boots',
  'gold_helmet', 'gold_chestplate', 'gold_leggings', 'gold_boots',
  'diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots',
  'cow', 'pig', 'sheep', 'chicken', 'zombie', 'skeleton', 'spider', 'creeper',
];

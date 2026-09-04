import * as THREE from 'three';
import { getModel } from '../../engine/assets/models';
import type { MobKind } from './mob';

/** Wraps a mob's GLB model (see engine/assets/models.ts, preloaded at game
 * start) to a synchronous buildMesh() -- scaled so its height matches the
 * mob's existing hitbox height, and repositioned so its lowest point sits
 * at local y=0 (feet), the same convention the old procedural mob meshes
 * in mobMeshes.ts used, since Mob/Entity place mesh.position at the
 * entity's feet, not its center. Falls back to the original procedural
 * builder if the model isn't loaded yet (should be rare -- mobs only start
 * spawning a few seconds into a session, well after preload finishes). */
export function buildMobMeshFrom(kind: MobKind, targetHeight: number, fallback: () => THREE.Group): () => THREE.Group {
  return () => {
    const model = getModel(kind);
    if (!model) return fallback();

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    if (!isFinite(size.y) || size.y < 1e-4) return fallback(); // degenerate/empty model -- don't divide into an absurd scale
    const scale = targetHeight / size.y;
    model.scale.setScalar(scale);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x * scale;
    model.position.z -= center.z * scale;
    model.position.y -= box.min.y * scale;

    const group = new THREE.Group();
    group.add(model);
    return group;
  };
}

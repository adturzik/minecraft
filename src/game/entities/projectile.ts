import * as THREE from 'three';
import { SolidTest } from '../../engine/physics/voxelPhysics';
import type { Mob } from './mob';

const GRAVITY = -20;
const SPEED = 28;
const LIFETIME = 4;
const HIT_RADIUS = 0.6;

function pointToSegmentDistance(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 0.0001), 0, 1);
  const closest = a.clone().addScaledVector(ab, t);
  return p.distanceTo(closest);
}

/** A fired arrow: straight-line travel with light gravity drop, checked each
 * frame against mobs (segment-to-point distance, since it moves several
 * units per frame at this speed) and world blocks. No physical arrow entity
 * embedded in walls -- it just vanishes on the first solid block it enters,
 * which is enough to read as "the shot connected with the wall". */
export class Arrow {
  readonly mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  dead = false;
  private age = 0;

  constructor(origin: THREE.Vector3, direction: THREE.Vector3) {
    this.position = origin.clone();
    this.velocity = direction.clone().normalize().multiplyScalar(SPEED);
    const geo = new THREE.BoxGeometry(0.07, 0.07, 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0x8a6a3a });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
  }

  update(dt: number, isSolid: SolidTest, mobs: readonly Mob[], onHitMob: (mob: Mob, velocity: THREE.Vector3) => void) {
    if (this.dead) return;
    this.age += dt;
    if (this.age > LIFETIME) {
      this.dead = true;
      return;
    }

    this.velocity.y += GRAVITY * dt;
    const prev = this.position.clone();
    this.position.addScaledVector(this.velocity, dt);

    for (const mob of mobs) {
      if (mob.dead) continue;
      const center = mob.position.clone();
      center.y += mob.size.height / 2;
      if (pointToSegmentDistance(center, prev, this.position) < HIT_RADIUS) {
        onHitMob(mob, this.velocity);
        this.dead = true;
        return;
      }
    }

    if (isSolid(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z))) {
      this.dead = true;
      return;
    }

    this.mesh.position.copy(this.position);
    this.mesh.lookAt(this.position.clone().add(this.velocity));
  }
}

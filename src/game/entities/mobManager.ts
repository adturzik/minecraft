import * as THREE from 'three';
import { Mob } from './mob';
import { MOB_CONFIGS, PASSIVE_KINDS, HOSTILE_KINDS } from './mobConfigs';
import type { MobKind } from './mob';
import type { SolidTest } from '../../engine/physics/voxelPhysics';

const MAX_PASSIVE = 12;
const MAX_HOSTILE = 8;
const SPAWN_RADIUS = 22;
const MIN_SPAWN_DIST = 8;
const DESPAWN_RADIUS = 48;

export interface MobHit {
  mob: Mob;
}

export class MobManager {
  private mobs: Mob[] = [];
  private scene: THREE.Scene;
  private spawnTimer = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  private trySpawn(
    playerPos: THREE.Vector3,
    isNight: boolean,
    findSurfaceY: (x: number, z: number) => number | null,
    getLightLevel: (x: number, y: number, z: number) => number
  ) {
    const passiveCount = this.mobs.filter((m) => m.config.behavior === 'passive').length;
    const hostileCount = this.mobs.filter((m) => m.config.behavior === 'hostile').length;

    const wantPassive = passiveCount < MAX_PASSIVE && !isNight;
    const wantHostile = hostileCount < MAX_HOSTILE;
    if (!wantPassive && !wantHostile) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = MIN_SPAWN_DIST + Math.random() * (SPAWN_RADIUS - MIN_SPAWN_DIST);
    const x = Math.floor(playerPos.x + Math.cos(angle) * dist);
    const z = Math.floor(playerPos.z + Math.sin(angle) * dist);
    const y = findSurfaceY(x, z);
    if (y === null) return;

    // Hostiles need a dark spot (light <= 7, same threshold vanilla uses) --
    // works for both night-time surface spots and permanently-dark caves.
    const dark = getLightLevel(x, y + 1, z) <= 7;
    const canHostileHere = wantHostile && dark;
    if (!wantPassive && !canHostileHere) return;

    const kind: MobKind = canHostileHere && (!wantPassive || Math.random() < 0.5)
      ? HOSTILE_KINDS[Math.floor(Math.random() * HOSTILE_KINDS.length)]
      : PASSIVE_KINDS[Math.floor(Math.random() * PASSIVE_KINDS.length)];

    this.spawn(kind, x + 0.5, y + 1, z + 0.5);
  }

  spawn(kind: MobKind, x: number, y: number, z: number): Mob {
    const config = MOB_CONFIGS[kind];
    const mob = new Mob(config, new THREE.Vector3(x, y, z));
    this.scene.add(mob.mesh);
    this.mobs.push(mob);
    return mob;
  }

  tick(
    dt: number,
    playerPos: THREE.Vector3,
    isSolid: SolidTest,
    isNight: boolean,
    findSurfaceY: (x: number, z: number) => number | null,
    getLightLevel: (x: number, y: number, z: number) => number,
    onExplosion: (x: number, y: number, z: number, radius: number, damage: number) => void,
    onDeath: (mob: Mob) => void
  ) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      this.trySpawn(playerPos, isNight, findSurfaceY, getLightLevel);
    }

    for (const mob of this.mobs) {
      if (mob.dead) continue;
      mob.update(dt, isSolid, playerPos);
      if (mob.pendingExplosion) {
        const e = mob.pendingExplosion;
        onExplosion(e.x, e.y, e.z, e.radius, e.damage);
        mob.pendingExplosion = null;
      }
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      const distToPlayer = mob.position.distanceTo(playerPos);
      if (mob.dead) {
        onDeath(mob);
        this.scene.remove(mob.mesh);
        this.mobs.splice(i, 1);
      } else if (distToPlayer > DESPAWN_RADIUS) {
        this.scene.remove(mob.mesh);
        this.mobs.splice(i, 1);
      }
    }
  }

  /** Simple ray-vs-mob-bounding-sphere hit test (see PROGRESS.md for why:
   * mob meshes are THREE.Group instances of several boxes, not one
   * raycastable geometry, and there are few enough mobs at once that a
   * brute-force distance check per mob is plenty fast). */
  raycastMobs(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): Mob | null {
    let best: Mob | null = null;
    let bestDist = Infinity;
    for (const mob of this.mobs) {
      if (mob.dead) continue;
      const center = mob.position.clone();
      center.y += mob.size.height / 2;
      const toCenter = center.clone().sub(origin);
      const t = THREE.MathUtils.clamp(toCenter.dot(dir), 0, maxDist);
      const closest = origin.clone().addScaledVector(dir, t);
      const dist = closest.distanceTo(center);
      const radius = Math.max(mob.size.halfWidth, 0.5) + 0.15;
      if (dist < radius && t < bestDist) {
        bestDist = t;
        best = mob;
      }
    }
    return best;
  }

  getMobs(): readonly Mob[] {
    return this.mobs;
  }
}

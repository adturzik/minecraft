import * as THREE from 'three';
import { Entity } from './entity';
import { PlayerAABB, SolidTest } from '../../engine/physics/voxelPhysics';

export type MobKind = 'cow' | 'pig' | 'sheep' | 'chicken' | 'zombie' | 'skeleton' | 'spider' | 'creeper';
export type MobBehavior = 'passive' | 'hostile';

export interface MobDrop {
  itemId: string;
  min: number;
  max: number;
}

export interface MobConfig {
  kind: MobKind;
  behavior: MobBehavior;
  maxHealth: number;
  speed: number;
  size: PlayerAABB;
  buildMesh: () => THREE.Group;
  attackDamage: number;
  attackRange: number;
  sightRange: number;
  drops: MobDrop[];
  explodes?: boolean;
}

type State = 'idle' | 'wander' | 'chase' | 'attack' | 'flee' | 'fuse';

const ATTACK_COOLDOWN = 1.0;
const FUSE_TIME = 1.5;
const FUSE_TRIGGER_RANGE = 3.5;
const EXPLOSION_RADIUS = 3.5;
const EXPLOSION_DAMAGE = 10;

export class Mob extends Entity {
  readonly config: MobConfig;
  private state: State = 'idle';
  private stateTimer = 0;
  private wanderDir = new THREE.Vector3();
  private attackCooldown = 0;
  private fuseTime = 0;
  /** Set by MobManager for the one frame an explosion should apply damage. */
  pendingExplosion: { x: number; y: number; z: number; radius: number; damage: number } | null = null;

  constructor(config: MobConfig, position: THREE.Vector3) {
    super(config.size, config.maxHealth, config.buildMesh());
    this.config = config;
    this.position.copy(position);
    this.mesh.position.copy(position);
  }

  private pickWanderDir() {
    const angle = Math.random() * Math.PI * 2;
    this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
  }

  update(dt: number, isSolid: SolidTest, playerPos: THREE.Vector3): void {
    if (this.dead) return;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.stateTimer -= dt;

    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
    toPlayer.y = 0;
    const distToPlayer = toPlayer.length();

    if (this.config.explodes) {
      this.updateCreeper(dt, distToPlayer, toPlayer, playerPos);
    } else if (this.config.behavior === 'hostile') {
      this.updateHostile(dt, distToPlayer, toPlayer, playerPos);
    } else {
      this.updatePassive(dt, distToPlayer, toPlayer);
    }

    this.applyPhysics(dt, isSolid);
  }

  private moveToward(dir: THREE.Vector3, speed: number) {
    if (dir.lengthSq() > 0.0001) {
      const n = dir.clone().normalize();
      this.velocity.x = n.x * speed;
      this.velocity.z = n.z * speed;
      this.yaw = Math.atan2(n.x, n.z);
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
  }

  private updatePassive(dt: number, distToPlayer: number, toPlayer: THREE.Vector3) {
    if (this.state === 'flee') {
      this.moveToward(toPlayer.clone().negate(), this.config.speed * 1.4);
      if (this.stateTimer <= 0) this.state = 'idle';
      return;
    }
    if (this.stateTimer <= 0) {
      this.state = this.state === 'wander' ? 'idle' : 'wander';
      this.stateTimer = 1.5 + Math.random() * 2.5;
      if (this.state === 'wander') this.pickWanderDir();
    }
    if (this.state === 'wander') this.moveToward(this.wanderDir, this.config.speed);
    else this.moveToward(new THREE.Vector3(), 0);
  }

  private updateHostile(dt: number, distToPlayer: number, toPlayer: THREE.Vector3, playerPos: THREE.Vector3) {
    void playerPos;
    if (distToPlayer < this.config.attackRange) {
      this.state = 'attack';
      this.moveToward(new THREE.Vector3(), 0);
      if (this.attackCooldown <= 0) {
        this.attackCooldown = ATTACK_COOLDOWN;
        this.pendingExplosion = { x: this.position.x, y: this.position.y, z: this.position.z, radius: 0.1, damage: this.config.attackDamage };
      }
      return;
    }
    if (distToPlayer < this.config.sightRange) {
      this.state = 'chase';
      this.moveToward(toPlayer, this.config.speed);
      return;
    }
    if (this.stateTimer <= 0) {
      this.state = this.state === 'wander' ? 'idle' : 'wander';
      this.stateTimer = 1.5 + Math.random() * 2.5;
      if (this.state === 'wander') this.pickWanderDir();
    }
    if (this.state === 'wander') this.moveToward(this.wanderDir, this.config.speed * 0.6);
    else this.moveToward(new THREE.Vector3(), 0);
  }

  private updateCreeper(dt: number, distToPlayer: number, toPlayer: THREE.Vector3, playerPos: THREE.Vector3) {
    if (this.state === 'fuse') {
      this.moveToward(new THREE.Vector3(), 0);
      this.fuseTime -= dt;
      const pulse = 1 + Math.sin(this.fuseTime * 20) * 0.08;
      this.mesh.scale.setScalar(pulse);
      if (distToPlayer > FUSE_TRIGGER_RANGE * 1.5) {
        this.state = 'chase';
        this.mesh.scale.setScalar(1);
      } else if (this.fuseTime <= 0) {
        this.pendingExplosion = { x: this.position.x, y: this.position.y, z: this.position.z, radius: EXPLOSION_RADIUS, damage: EXPLOSION_DAMAGE };
        this.dead = true;
      }
      return;
    }
    if (distToPlayer < FUSE_TRIGGER_RANGE) {
      this.state = 'fuse';
      this.fuseTime = FUSE_TIME;
      return;
    }
    if (distToPlayer < this.config.sightRange) {
      this.moveToward(toPlayer, this.config.speed);
      return;
    }
    if (this.stateTimer <= 0) {
      this.state = this.state === 'wander' ? 'idle' : 'wander';
      this.stateTimer = 1.5 + Math.random() * 2.5;
      if (this.state === 'wander') this.pickWanderDir();
    }
    if (this.state === 'wander') this.moveToward(this.wanderDir, this.config.speed * 0.5);
    else this.moveToward(new THREE.Vector3(), 0);
    void playerPos;
  }

  fleeFrom() {
    this.state = 'flee';
    this.stateTimer = 2.5;
  }
}

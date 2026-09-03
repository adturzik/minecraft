import * as THREE from 'three';
import { stepPhysics, PlayerAABB, SolidTest } from '../../engine/physics/voxelPhysics';

const GRAVITY = -28;

export abstract class Entity {
  position = new THREE.Vector3();
  velocity = new THREE.Vector3();
  yaw = 0;
  grounded = false;
  health: number;
  maxHealth: number;
  readonly size: PlayerAABB;
  readonly mesh: THREE.Group;
  dead = false;
  private invulnTimer = 0;

  constructor(size: PlayerAABB, maxHealth: number, mesh: THREE.Group) {
    this.size = size;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.mesh = mesh;
  }

  takeDamage(amount: number, knockback?: THREE.Vector3): boolean {
    if (this.dead || this.invulnTimer > 0) return false;
    this.health -= amount;
    this.invulnTimer = 0.5;
    if (knockback) this.velocity.add(knockback);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
    return true;
  }

  /** Applies gravity + AABB collision (shared with the player) and syncs
   * the visual mesh transform. Subclasses call this after setting
   * velocity.x/z from their own AI each tick. */
  protected applyPhysics(dt: number, isSolid: SolidTest) {
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    this.velocity.y += GRAVITY * dt;
    const result = stepPhysics(
      this.position.x,
      this.position.y,
      this.position.z,
      this.velocity.x * dt,
      this.velocity.y * dt,
      this.velocity.z * dt,
      this.size,
      isSolid
    );
    this.position.set(result.x, result.y, result.z);
    if (result.collidedX) this.velocity.x = 0;
    if (result.collidedY) this.velocity.y = 0;
    if (result.collidedZ) this.velocity.z = 0;
    this.grounded = result.grounded;

    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    this.mesh.rotation.y = this.yaw;
  }

  abstract update(dt: number, isSolid: SolidTest, playerPos: THREE.Vector3): void;
}

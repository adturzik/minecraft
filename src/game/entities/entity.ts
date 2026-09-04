import * as THREE from 'three';
import { stepPhysics, PlayerAABB, SolidTest } from '../../engine/physics/voxelPhysics';

const GRAVITY = -28;

// GLB mob models (see engine/assets/models.ts) use MeshStandardMaterial,
// not the MeshLambertMaterial the old procedural mob meshes used -- the
// hit-flash effect below needs to recognize both, or it silently stops
// working for every mob that has a real model.
type ColorMaterial = THREE.MeshLambertMaterial | THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
function isColorMaterial(material: THREE.Material): material is ColorMaterial {
  return (
    material instanceof THREE.MeshLambertMaterial ||
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshBasicMaterial
  );
}

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
  /** While > 0, AI movement (Mob.moveToward) must not overwrite
   * velocity.x/z, so the knockback pushed into velocity by takeDamage
   * actually plays out instead of being stomped the very next tick. */
  protected knockbackTimer = 0;
  private hitFlashTimer = 0;
  private preFlashColors: THREE.Color[] | null = null;

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
    this.hitFlashTimer = 0.15;
    if (knockback) {
      this.velocity.add(knockback);
      this.knockbackTimer = 0.3;
    }
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
    return true;
  }

  private updateHitFlash(dt: number) {
    if (this.hitFlashTimer <= 0) return;
    if (!this.preFlashColors) {
      this.preFlashColors = [];
      this.mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh && isColorMaterial(obj.material)) {
          this.preFlashColors!.push(obj.material.color.clone());
          obj.material.color.set(0xff3333);
        }
      });
    }
    this.hitFlashTimer -= dt;
    if (this.hitFlashTimer <= 0) {
      const colors = this.preFlashColors;
      this.preFlashColors = null;
      let i = 0;
      this.mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh && isColorMaterial(obj.material)) {
          obj.material.color.copy(colors![i++]);
        }
      });
    }
  }

  /** Applies gravity + AABB collision (shared with the player) and syncs
   * the visual mesh transform. Subclasses call this after setting
   * velocity.x/z from their own AI each tick. */
  protected applyPhysics(dt: number, isSolid: SolidTest) {
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.knockbackTimer > 0) this.knockbackTimer -= dt;
    this.updateHitFlash(dt);
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

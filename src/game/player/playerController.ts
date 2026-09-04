import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { stepPhysics, PlayerAABB, SolidTest } from '../../engine/physics/voxelPhysics';
import { BlockId } from '../items/blockDefs';

const WALK_SPEED = 4.3;
const SPRINT_SPEED = 7.2;
const SNEAK_SPEED = 1.6;
const FLY_SPEED = 10;
const SWIM_SPEED = 2.2;
const JUMP_VELOCITY = 8.4;
const GRAVITY = -28;
const WATER_GRAVITY = -6;
const SWIM_UP_SPEED = 3.2;
const EYE_HEIGHT = 1.62;

export type BlockIdGetter = (x: number, y: number, z: number) => number;

export class PlayerController {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: PointerLockControls;
  readonly size: PlayerAABB = { halfWidth: 0.3, height: 1.8 };

  position = new THREE.Vector3(0.5, 90, 0.5); // feet position, world space
  velocity = new THREE.Vector3();
  grounded = false;
  flying = false;
  /** Survival sets this false so F does nothing -- free flight is a
   * creative-only privilege in vanilla too. */
  flightAllowed = true;
  sprinting = false;
  sneaking = false;
  /** Fall damage (HP) incurred this frame from landing, if any — read and
   * applied by whatever owns a SurvivalState (kept out of this class so
   * physics/movement stays independent of the survival/HP system). */
  fallDamageThisFrame = 0;
  /** True when the camera/eye position is inside a water block — used for
   * the breath meter (SurvivalState lives outside this class, same reason
   * as fallDamageThisFrame). */
  headUnderwater = false;
  inWater = false;
  inLava = false;

  private keys = new Set<string>();
  private flyToggleLatch = false;
  private highestYSinceGrounded = this.position.y;
  // View bob: a small footstep-timed head sway while walking on the ground,
  // faded in/out via bobAmount rather than switched on/off so it never pops.
  private bobPhase = 0;
  private bobAmount = 0;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyF' && !this.flyToggleLatch) {
        this.flyToggleLatch = true;
        if (this.flightAllowed) {
          this.flying = !this.flying;
          if (this.flying) this.velocity.y = 0;
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyF') this.flyToggleLatch = false;
    });
  }

  get isLocked() {
    return this.controls.isLocked;
  }

  lock() {
    this.controls.lock();
  }

  update(dt: number, isSolid: SolidTest, getBlockId?: BlockIdGetter) {
    dt = Math.min(dt, 0.05); // clamp to avoid physics blowing up after a tab-switch stall

    if (getBlockId) {
      const eyeY = this.position.y + EYE_HEIGHT;
      const eyeBlock = getBlockId(Math.floor(this.position.x), Math.floor(eyeY), Math.floor(this.position.z));
      const feetBlock = getBlockId(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
      this.headUnderwater = eyeBlock === BlockId.Water;
      this.inWater = eyeBlock === BlockId.Water || feetBlock === BlockId.Water;
      this.inLava = eyeBlock === BlockId.Lava || feetBlock === BlockId.Lava;
    } else {
      this.headUnderwater = false;
      this.inWater = false;
      this.inLava = false;
    }
    const swimming = (this.inWater || this.inLava) && !this.flying;

    const forwardInput = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const strafeInput = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    this.sneaking = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    this.sprinting = (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) && !this.sneaking;

    const camForward = new THREE.Vector3();
    this.camera.getWorldDirection(camForward);
    camForward.y = 0;
    if (camForward.lengthSq() > 0) camForward.normalize();
    const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0));

    const move = new THREE.Vector3();
    move.addScaledVector(camForward, forwardInput);
    move.addScaledVector(camRight, strafeInput);
    if (move.lengthSq() > 0) move.normalize();

    const speed = this.flying
      ? FLY_SPEED
      : swimming
        ? SWIM_SPEED * (this.inLava ? 0.5 : 1)
        : this.sneaking
          ? SNEAK_SPEED
          : this.sprinting
            ? SPRINT_SPEED
            : WALK_SPEED;
    this.velocity.x = move.x * speed;
    this.velocity.z = move.z * speed;

    if (this.flying) {
      const up = (this.keys.has('Space') ? 1 : 0) - (this.sneaking ? 1 : 0);
      this.velocity.y = up * FLY_SPEED;
    } else if (swimming) {
      this.velocity.y += WATER_GRAVITY * dt;
      if (this.keys.has('Space')) this.velocity.y = Math.max(this.velocity.y, SWIM_UP_SPEED * 0.5);
      this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -3, SWIM_UP_SPEED);
    } else {
      this.velocity.y += GRAVITY * dt;
      if (this.grounded && this.keys.has('Space')) {
        this.velocity.y = JUMP_VELOCITY;
      }
    }

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

    const wasGrounded = this.grounded;
    this.position.set(result.x, result.y, result.z);
    if (result.collidedX) this.velocity.x = 0;
    if (result.collidedY) this.velocity.y = 0;
    if (result.collidedZ) this.velocity.z = 0;
    this.grounded = result.grounded;

    this.fallDamageThisFrame = 0;
    if (!this.flying && !swimming) {
      if (!this.grounded) {
        this.highestYSinceGrounded = Math.max(this.highestYSinceGrounded, this.position.y);
      } else if (!wasGrounded) {
        const fallDistance = this.highestYSinceGrounded - this.position.y;
        if (fallDistance > 3) this.fallDamageThisFrame = Math.floor(fallDistance - 3);
        this.highestYSinceGrounded = this.position.y;
      }
    } else {
      this.highestYSinceGrounded = this.position.y;
    }

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const bobbing = this.grounded && !this.flying && !swimming && horizSpeed > 0.5;
    this.bobPhase += horizSpeed * dt * 1.5;
    this.bobAmount += ((bobbing ? 1 : 0) - this.bobAmount) * Math.min(1, dt * 8);
    const bobY = Math.abs(Math.sin(this.bobPhase * 2)) * 0.045 * this.bobAmount;
    const bobX = Math.sin(this.bobPhase) * 0.03 * this.bobAmount;
    this.camera.position.set(this.position.x + bobX, this.position.y + EYE_HEIGHT + bobY, this.position.z);
  }
}

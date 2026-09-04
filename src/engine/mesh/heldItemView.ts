import * as THREE from 'three';
import { getItemDef } from '../../game/items/items';
import { itemIconUrl } from '../../ui/itemIcons';

// First-person "what's in your hand" view model. A flat icon (reusing the
// same per-item art as the inventory slots) held in front of the camera --
// not a full 3D tool model, but enough to actually see what's equipped
// instead of only checking the hotbar.
const textureCache = new Map<string, THREE.Texture>();

function getIconTexture(itemId: string): THREE.Texture {
  let tex = textureCache.get(itemId);
  if (tex) return tex;
  const img = new Image();
  tex = new THREE.Texture(img);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  img.onload = () => {
    tex!.needsUpdate = true;
  };
  img.src = itemIconUrl(getItemDef(itemId));
  textureCache.set(itemId, tex);
  return tex;
}

// Classic FPS hand position: lower-right corner, angled slightly.
const REST_POSITION = new THREE.Vector3(0.42, -0.32, -0.7);
const REST_ROTATION = new THREE.Euler(-0.2, -0.5, -0.15);
const SWING_DURATION = 0.22;

export class HeldItemView {
  readonly mesh: THREE.Group;
  private plane: THREE.Mesh;
  private currentId: string | null = null;
  private swingTimer = 0;

  constructor() {
    this.mesh = new THREE.Group();
    const geo = new THREE.PlaneGeometry(0.45, 0.45);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide });
    this.plane = new THREE.Mesh(geo, mat);
    this.plane.visible = false;
    this.plane.renderOrder = 999;
    this.plane.position.copy(REST_POSITION);
    this.plane.rotation.copy(REST_ROTATION);
    this.mesh.add(this.plane);
  }

  setItem(itemId: string | null) {
    if (itemId === this.currentId) return;
    this.currentId = itemId;
    if (!itemId) {
      this.plane.visible = false;
      return;
    }
    this.plane.visible = true;
    const mat = this.plane.material as THREE.MeshBasicMaterial;
    mat.map = getIconTexture(itemId);
    mat.needsUpdate = true;
  }

  /** Triggers (or restarts) a swing -- call on every mining tick/hit so
   * continuous mining reads as repeated swings, same as vanilla's arm
   * animation, instead of the hand sitting frozen while blocks crack. */
  swing() {
    this.swingTimer = SWING_DURATION;
  }

  /** Call once per frame regardless of swing state so the hand eases back
   * to rest after the animation finishes. */
  update(dt: number) {
    if (this.swingTimer <= 0) {
      this.plane.position.copy(REST_POSITION);
      this.plane.rotation.copy(REST_ROTATION);
      return;
    }
    this.swingTimer = Math.max(0, this.swingTimer - dt);
    const progress = 1 - this.swingTimer / SWING_DURATION;
    const arc = Math.sin(progress * Math.PI); // 0 -> 1 -> 0, a down-forward-back swing
    this.plane.position.set(
      REST_POSITION.x - arc * 0.1,
      REST_POSITION.y - arc * 0.08,
      REST_POSITION.z + arc * 0.1
    );
    this.plane.rotation.set(
      REST_ROTATION.x - arc * 0.6,
      REST_ROTATION.y + arc * 0.3,
      REST_ROTATION.z - arc * 0.35
    );
  }
}

import * as THREE from 'three';
import { getItemDef } from '../../game/items/items';
import { itemIconUrl } from '../../ui/itemIcons';
import { getModel, isModelReady } from '../assets/models';

// First-person "what's in your hand" view model. Items with a real GLB
// model (see engine/assets/models.ts -- tools/weapons the user generated
// externally) render as an actual 3D object; everything else (blocks,
// food, materials, ...) falls back to a flat icon plane, same as before.
// Holding nothing shows a simple procedural hand rather than nothing at
// all -- no dedicated hand asset was provided, so this is a placeholder
// built from a few shaded boxes, lit by the same real scene lighting as
// everything else.
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

// Longest dimension a held tool/weapon model is uniformly scaled to, in
// world units -- the generated models came in at whatever scale their
// source tool used (a sword and a pickaxe were not authored to any shared
// unit), so every model is re-fit to this size rather than trusting its
// native scale.
const TOOL_TARGET_SIZE = 0.6;
// Extra rotation on top of REST_ROTATION so an imported model (authored
// upright, blade/head pointing +Y) reads as "gripped and angled toward the
// camera" the way the old icon plane did, instead of standing bolt upright.
const MODEL_EXTRA_ROTATION = new THREE.Euler(0.5, 0, 0.15);

function fitToSize(model: THREE.Object3D, targetSize: number) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / largest;
  model.scale.setScalar(scale);
  // Re-center so the model's own geometric middle sits at the local
  // origin -- otherwise an off-center pivot would throw off the
  // REST_POSITION/swing-arc placement in unpredictable per-model ways.
  const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
  model.position.sub(center);
}

function buildHandModel(): THREE.Group {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.75, metalness: 0 });
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.24), skin);
  group.add(palm);
  const fingerLen = [0.1, 0.115, 0.11, 0.09];
  const fingerX = [-0.06, -0.02, 0.02, 0.06];
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.04, fingerLen[i]), skin);
    finger.position.set(fingerX[i], -0.002, 0.12 + fingerLen[i] / 2 - 0.02);
    finger.rotation.x = -0.15;
    group.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.09), skin);
  thumb.position.set(-0.105, 0, 0.03);
  thumb.rotation.y = 0.85;
  group.add(thumb);
  const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.14), skin);
  wrist.position.set(0, -0.005, -0.16);
  group.add(wrist);
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  group.rotation.set(0.1, 0.3, 0);
  return group;
}

export class HeldItemView {
  readonly mesh: THREE.Group;
  private container: THREE.Group;
  private plane: THREE.Mesh;
  private handModel: THREE.Group;
  private toolModel: THREE.Object3D | null = null;
  private currentId: string | null = null;
  private swingTimer = 0;

  constructor() {
    this.mesh = new THREE.Group();
    this.container = new THREE.Group();
    this.container.position.copy(REST_POSITION);
    this.container.rotation.copy(REST_ROTATION);
    this.mesh.add(this.container);

    const geo = new THREE.PlaneGeometry(0.45, 0.45);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide });
    this.plane = new THREE.Mesh(geo, mat);
    this.plane.visible = false;
    this.plane.renderOrder = 999;
    this.container.add(this.plane);

    this.handModel = buildHandModel();
    this.handModel.visible = false;
    this.container.add(this.handModel);
  }

  private showModel(itemId: string): boolean {
    const model = getModel(itemId);
    if (!model) return false;
    // fitToSize centers the model on its own local origin *before* any
    // rotation is applied. Rotating the model directly afterward would
    // throw that centering off (rotation happens before translation in the
    // local matrix, so a translation computed for the unrotated case no
    // longer lands the pivot at the origin once rotated) -- wrapping it in
    // a pivot group and rotating the pivot instead rotates the
    // already-centered model around its own center, which stays correct
    // regardless of the rotation.
    fitToSize(model, TOOL_TARGET_SIZE);
    const pivot = new THREE.Group();
    pivot.add(model);
    pivot.rotation.copy(MODEL_EXTRA_ROTATION);
    this.toolModel = pivot;
    this.container.add(pivot);
    return true;
  }

  private clearVisuals() {
    this.plane.visible = false;
    this.handModel.visible = false;
    if (this.toolModel) {
      this.container.remove(this.toolModel);
      this.toolModel = null;
    }
  }

  setItem(itemId: string | null) {
    if (itemId === this.currentId) return;
    this.currentId = itemId;
    this.clearVisuals();

    if (!itemId) {
      this.handModel.visible = true;
      return;
    }

    if (isModelReady(itemId) && this.showModel(itemId)) return;

    // Fallback: flat icon plane -- either this item has no 3D model at all
    // (blocks, food, ...) or its model just hasn't finished loading yet.
    // update() below promotes it to the real model the moment it's ready.
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
    // A model that finished loading after setItem() already fell back to
    // the icon plane gets swapped in here instead of waiting for the next
    // item switch.
    if (this.currentId && !this.toolModel && this.plane.visible && isModelReady(this.currentId)) {
      if (this.showModel(this.currentId)) this.plane.visible = false;
    }

    if (this.swingTimer <= 0) {
      this.container.position.copy(REST_POSITION);
      this.container.rotation.copy(REST_ROTATION);
      return;
    }
    this.swingTimer = Math.max(0, this.swingTimer - dt);
    const progress = 1 - this.swingTimer / SWING_DURATION;
    const arc = Math.sin(progress * Math.PI); // 0 -> 1 -> 0, a down-forward-back swing
    this.container.position.set(
      REST_POSITION.x - arc * 0.1,
      REST_POSITION.y - arc * 0.08,
      REST_POSITION.z + arc * 0.1
    );
    this.container.rotation.set(
      REST_ROTATION.x - arc * 0.6,
      REST_ROTATION.y + arc * 0.3,
      REST_ROTATION.z - arc * 0.35
    );
  }
}

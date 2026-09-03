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
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  img.onload = () => {
    tex!.needsUpdate = true;
  };
  img.src = itemIconUrl(getItemDef(itemId));
  textureCache.set(itemId, tex);
  return tex;
}

export class HeldItemView {
  readonly mesh: THREE.Group;
  private plane: THREE.Mesh;
  private currentId: string | null = null;

  constructor() {
    this.mesh = new THREE.Group();
    const geo = new THREE.PlaneGeometry(0.45, 0.45);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide });
    this.plane = new THREE.Mesh(geo, mat);
    this.plane.visible = false;
    this.plane.renderOrder = 999;
    // Classic FPS hand position: lower-right corner, angled slightly.
    this.plane.position.set(0.42, -0.32, -0.7);
    this.plane.rotation.set(-0.2, -0.5, -0.15);
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
}

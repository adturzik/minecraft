import * as THREE from 'three';

// Visible, progressive block-damage overlay for the block currently being
// mined (see main.ts's hold-to-mine tick) -- a thin box slightly larger
// than the target block, textured with an increasingly cracked/blackened
// pattern and faded in via material opacity as progress climbs, so digging
// reads as actual damage accumulating rather than just a HUD bar filling.
//
// Every stage texture is fully opaque (alpha=255 everywhere) and built via
// getImageData -> DataTexture, deliberately avoiding both known texture
// pitfalls already documented elsewhere in this codebase: a live
// CanvasTexture uploads as solid black in some headless/software-WebGL
// environments (see blockMaterials.ts), and the *shared* block atlas goes
// solid black everywhere if any pixel in it carries alpha<255 (see
// textureAtlas.ts). Fading is done with the material's `opacity` float
// instead of per-pixel alpha -- the same safe mechanism already used for
// water/glass in blockMaterials.ts -- so neither pitfall applies here.

const STAGES = 8;
const TILE = 16;

function mulberry32(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStageTexture(stage: number): THREE.DataTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Black base (not a mid-gray wash) so that, blended at the low opacity
  // early stages use (see getStageMaterials), the block underneath barely
  // changes at all -- a uniform gray base at even modest opacity visibly
  // lightened dark blocks, which read as "the block brightens" instead of
  // "cracks are forming".
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, TILE, TILE);

  // A handful of branching fracture lines radiating from the block's
  // center, more of them (and longer) each stage -- reads as real fissures
  // spreading across the face rather than a flat tint growing darker.
  const rng = mulberry32(stage * 7919 + 13);
  const branches = 2 + stage;
  for (let b = 0; b < branches; b++) {
    let x = TILE / 2 + (rng() - 0.5) * 3;
    let y = TILE / 2 + (rng() - 0.5) * 3;
    let angle = rng() * Math.PI * 2;
    const steps = 3 + Math.floor(rng() * 3) + stage;
    for (let s = 0; s < steps; s++) {
      angle += (rng() - 0.5) * 1.3;
      x += Math.cos(angle) * 1.3;
      y += Math.sin(angle) * 1.3;
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || px >= TILE || py < 0 || py >= TILE) break;
      const dark = 8 + Math.floor(rng() * 14);
      ctx.fillStyle = `rgb(${dark},${dark},${dark})`;
      ctx.fillRect(px, py, 1, 1);
      if (rng() < 0.5) ctx.fillRect(px + (rng() < 0.5 ? 1 : -1), py, 1, 1); // slightly thicker lines
    }
  }

  const imageData = ctx.getImageData(0, 0, TILE, TILE);
  const tex = new THREE.DataTexture(imageData.data, TILE, TILE, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

let stageMaterials: THREE.MeshBasicMaterial[] | null = null;

function getStageMaterials(): THREE.MeshBasicMaterial[] {
  if (stageMaterials) return stageMaterials;
  stageMaterials = [];
  for (let i = 0; i < STAGES; i++) {
    // Power curve, not linear: stays faint for the first few stages (barely
    // more than a hint of cracking) and only really darkens near the end,
    // so mining reads as "cracks gradually spreading, then the block gives
    // way" like vanilla, instead of "the whole face lightens uniformly".
    const t = i / (STAGES - 1);
    stageMaterials.push(
      new THREE.MeshBasicMaterial({
        map: buildStageTexture(i),
        transparent: true,
        opacity: 0.06 + 0.85 * Math.pow(t, 1.6),
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      })
    );
  }
  return stageMaterials;
}

export class CrackOverlay {
  readonly mesh: THREE.Mesh;

  constructor() {
    const geo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    this.mesh = new THREE.Mesh(geo, getStageMaterials()[0]);
    this.mesh.visible = false;
    this.mesh.renderOrder = 10;
  }

  /** progress/required in [0,1); hides itself at 0 or when not mining. */
  update(x: number, y: number, z: number, fraction: number) {
    if (fraction <= 0) {
      this.mesh.visible = false;
      return;
    }
    const stage = Math.min(STAGES - 1, Math.floor(fraction * STAGES));
    this.mesh.material = getStageMaterials()[stage];
    this.mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.mesh.visible = true;
  }

  hide() {
    this.mesh.visible = false;
  }
}

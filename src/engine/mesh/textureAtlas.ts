import * as THREE from 'three';

export const TILE_SIZE = 16;
export const ATLAS_TILES = 16; // 16x16 grid
export const ATLAS_SIZE = TILE_SIZE * ATLAS_TILES;

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  rng: () => number
) => void;

function mulberry32(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

export interface TileRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  index: number;
}

class TextureAtlasBuilder {
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private emissiveCanvas = document.createElement('canvas');
  private emissiveCtx: CanvasRenderingContext2D;
  private nextIndex = 0;
  private tiles = new Map<string, TileRect>();
  private built: { map: THREE.DataTexture; emissiveMap: THREE.DataTexture } | null = null;

  constructor() {
    this.canvas.width = this.canvas.height = ATLAS_SIZE;
    this.emissiveCanvas.width = this.emissiveCanvas.height = ATLAS_SIZE;
    this.ctx = this.canvas.getContext('2d')!;
    this.emissiveCtx = this.emissiveCanvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.emissiveCtx.imageSmoothingEnabled = false;
    // Fully-transparent (alpha=0) regions in the atlas render as solid black
    // in some WebGL environments once uploaded as a texture. Pre-fill both
    // canvases fully opaque so unused tile slots never carry alpha=0.
    this.ctx.fillStyle = '#ff00ff';
    this.ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
    this.emissiveCtx.fillStyle = '#000000';
    this.emissiveCtx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  }

  register(key: string, draw: DrawFn, emissiveDraw?: DrawFn): TileRect {
    const existing = this.tiles.get(key);
    if (existing) return existing;
    const index = this.nextIndex++;
    if (index >= ATLAS_TILES * ATLAS_TILES) throw new Error(`Texture atlas full (key=${key})`);
    const col = index % ATLAS_TILES;
    const row = Math.floor(index / ATLAS_TILES);
    const px = col * TILE_SIZE;
    const py = row * TILE_SIZE;
    draw(this.ctx, px, py, TILE_SIZE, mulberry32(hashString(key)));
    if (emissiveDraw) {
      emissiveDraw(this.emissiveCtx, px, py, TILE_SIZE, mulberry32(hashString(key + ':em')));
    }
    const pad = 0; // no padding needed: NearestFilter + no mipmaps avoids bleeding
    const u0 = (px + pad) / ATLAS_SIZE;
    const v0 = (py + pad) / ATLAS_SIZE;
    const u1 = (px + TILE_SIZE - pad) / ATLAS_SIZE;
    const v1 = (py + TILE_SIZE - pad) / ATLAS_SIZE;
    const rect: TileRect = { u0, v0, u1, v1, index };
    this.tiles.set(key, rect);
    return rect;
  }

  private toDataTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.DataTexture {
    // NOTE: a plain CanvasTexture (GPU-backed 2D canvas handed straight to WebGL)
    // uploads as solid black in some browser/headless environments because the
    // 2D-canvas and WebGL backends don't share pixel data reliably there. Reading
    // the pixels back via getImageData and building a DataTexture sidesteps that
    // sharing path entirely and is robust everywhere.
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tex = new THREE.DataTexture(imageData.data, canvas.width, canvas.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    // Our u0/v0/v1 tile-rect math (register()) assumes a direct top-row=0
    // mapping with no flip, unlike CanvasTexture's flipY=true default.
    tex.flipY = false;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  buildTextures() {
    if (this.built) return this.built;
    const map = this.toDataTexture(this.canvas, true);
    const emissiveMap = this.toDataTexture(this.emissiveCanvas, true);
    this.built = { map, emissiveMap };
    return this.built;
  }

  get debugCanvas() {
    return this.canvas;
  }
}

export const atlasBuilder = new TextureAtlasBuilder();

// ---------------- draw helpers ----------------

function clampByte(v: number) {
  return Math.max(0, Math.min(255, v));
}

function shadeRGB(color: [number, number, number], amt: number): [number, number, number] {
  return [clampByte(color[0] + amt), clampByte(color[1] + amt), clampByte(color[2] + amt)];
}

export function solid(color: [number, number, number], noise = 14): DrawFn {
  return (ctx, px, py, size, rng) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = (rng() - 0.5) * noise;
        const [r, g, b] = shadeRGB(color, n);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(px + x, py + y, 1, 1);
      }
    }
  };
}

export function speckled(
  base: [number, number, number],
  speck: [number, number, number],
  density = 0.12
): DrawFn {
  return (ctx, px, py, size, rng) => {
    solid(base, 10)(ctx, px, py, size, rng);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (rng() < density) {
          const n = (rng() - 0.5) * 20;
          const [r, g, b] = shadeRGB(speck, n);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(px + x, py + y, 1, 1);
        }
      }
    }
  };
}

export function grain(base: [number, number, number], lineColor: [number, number, number]): DrawFn {
  return (ctx, px, py, size, rng) => {
    solid(base, 8)(ctx, px, py, size, rng);
    for (let y = 0; y < size; y++) {
      if (rng() < 0.45) {
        ctx.fillStyle = `rgba(${lineColor[0]},${lineColor[1]},${lineColor[2]},0.5)`;
        const len = 3 + Math.floor(rng() * (size - 3));
        const startX = Math.floor(rng() * Math.max(1, size - len));
        ctx.fillRect(px + startX, py + y, len, 1);
      }
    }
  };
}

export function rings(base: [number, number, number], ringColor: [number, number, number]): DrawFn {
  return (ctx, px, py, size, rng) => {
    solid(base, 8)(ctx, px, py, size, rng);
    const cx = px + size / 2;
    const cy = py + size / 2;
    ctx.strokeStyle = `rgb(${ringColor[0]},${ringColor[1]},${ringColor[2]})`;
    for (let r = 1.5; r < size / 2; r += 2) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    void rng;
  };
}

// NOTE: every draw helper here paints fully opaque (alpha=255) pixels only.
// In this renderer/environment, a shared texture atlas containing ANY
// alpha<255 pixels anywhere samples as solid black everywhere once uploaded
// to the GPU (confirmed empirically) -- so true alpha-cutout sprites (cross
// foliage gaps) and per-pixel translucency (glass/water) are NOT done via
// atlas alpha. Cross-shaped billboards (Phase 2) and liquid/glass see-through
// look (materials) get their transparency from the *material* (opacity /
// dedicated non-atlas texture) instead, never from this shared canvas.
export function crossFoliage(base: [number, number, number]): DrawFn {
  return (ctx, px, py, size, rng) => {
    // Placeholder solid fill until Phase 2 implements real cross-mesh
    // billboards with their own non-shared alpha-cutout texture.
    solid(base, 20)(ctx, px, py, size, rng);
  };
}

export function liquid(base: [number, number, number]): DrawFn {
  return (ctx, px, py, size, rng) => {
    solid(base, 16)(ctx, px, py, size, rng);
  };
}

export function glassTile(base: [number, number, number]): DrawFn {
  return (ctx, px, py, size, rng) => {
    solid(base, 8)(ctx, px, py, size, rng);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    void rng;
  };
}

export function emissiveGlow(color: [number, number, number]): DrawFn {
  return (ctx, px, py, size) => {
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.fillRect(px, py, size, size);
  };
}

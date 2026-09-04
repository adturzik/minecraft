import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export const TILE_SIZE = 16;
export const ATLAS_TILES = 16; // 16x16 grid
// Each tile's actual 16x16 content sits inside a larger padded cell, with
// its edge pixels extruded into the padding (see register()). Without this,
// enabling mipmaps (needed to fix severe aliasing/flicker on these noisy
// textures at a distance -- busy per-pixel noise + NearestFilter + no
// mipmaps reads as "static"/holes rather than a solid surface) would blend
// each tile's lower mip levels with its neighbors' unrelated pixels in the
// atlas. Padding of 8 (cell size 32, a power of two) keeps that bleed
// contained to the padding itself even several mip levels down.
const PADDING = 8;
const CELL_SIZE = TILE_SIZE + PADDING * 2;
export const ATLAS_SIZE = CELL_SIZE * ATLAS_TILES;

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
    const px = col * CELL_SIZE + PADDING;
    const py = row * CELL_SIZE + PADDING;
    draw(this.ctx, px, py, TILE_SIZE, mulberry32(hashString(key)));
    this.extrudeEdges(this.ctx, px, py);
    if (emissiveDraw) {
      emissiveDraw(this.emissiveCtx, px, py, TILE_SIZE, mulberry32(hashString(key + ':em')));
      this.extrudeEdges(this.emissiveCtx, px, py);
    }
    const u0 = px / ATLAS_SIZE;
    const v0 = py / ATLAS_SIZE;
    const u1 = (px + TILE_SIZE) / ATLAS_SIZE;
    const v1 = (py + TILE_SIZE) / ATLAS_SIZE;
    const rect: TileRect = { u0, v0, u1, v1, index };
    this.tiles.set(key, rect);
    return rect;
  }

  /** Repeats a tile's own edge pixels outward into its padding border, so
   * mipmap generation never blends in a neighboring tile's unrelated
   * content (see the ATLAS_SIZE comment above). */
  private extrudeEdges(ctx: CanvasRenderingContext2D, px: number, py: number) {
    const last = TILE_SIZE - 1;
    for (let p = 1; p <= PADDING; p++) {
      ctx.drawImage(ctx.canvas, px, py, TILE_SIZE, 1, px, py - p, TILE_SIZE, 1); // top
      ctx.drawImage(ctx.canvas, px, py + last, TILE_SIZE, 1, px, py + last + p, TILE_SIZE, 1); // bottom
      ctx.drawImage(ctx.canvas, px, py, 1, TILE_SIZE, px - p, py, 1, TILE_SIZE); // left
      ctx.drawImage(ctx.canvas, px + last, py, 1, TILE_SIZE, px + last + p, py, 1, TILE_SIZE); // right
      ctx.drawImage(ctx.canvas, px, py, 1, 1, px - p, py - p, 1, 1); // corners
      ctx.drawImage(ctx.canvas, px + last, py, 1, 1, px + last + p, py - p, 1, 1);
      ctx.drawImage(ctx.canvas, px, py + last, 1, 1, px - p, py + last + p, 1, 1);
      ctx.drawImage(ctx.canvas, px + last, py + last, 1, 1, px + last + p, py + last + p, 1, 1);
    }
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
    // NearestFilter keeps the pixel-art look crisp up close; mipmapping
    // (safe now that register() pads+extrudes every tile, see ATLAS_SIZE)
    // is what actually fixes the aliasing/flicker these busy noise textures
    // showed at a distance without it.
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.generateMipmaps = true;
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

const avgColorCache = new Map<number, [number, number, number]>();
/** Average RGB of a registered tile -- used to tint block-break particle
 * debris so it reads as a real chunk of that block instead of a generic
 * gray cube. */
export function averageTileColor(tile: TileRect): [number, number, number] {
  const hit = avgColorCache.get(tile.index);
  if (hit) return hit;
  const sx = Math.round(tile.u0 * ATLAS_SIZE);
  const sy = Math.round(tile.v0 * ATLAS_SIZE);
  const data = atlasBuilder.debugCanvas.getContext('2d')!.getImageData(sx, sy, TILE_SIZE, TILE_SIZE).data;
  let r = 0, g = 0, b = 0;
  const n = TILE_SIZE * TILE_SIZE;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  const avg: [number, number, number] = [r / n, g / n, b / n];
  avgColorCache.set(tile.index, avg);
  return avg;
}

// ---------------- draw helpers ----------------

function clampByte(v: number) {
  return Math.max(0, Math.min(255, v));
}

function shadeRGB(color: [number, number, number], amt: number): [number, number, number] {
  return [clampByte(color[0] + amt), clampByte(color[1] + amt), clampByte(color[2] + amt)];
}

// Organic value-noise shading (two octaves of simplex noise) instead of
// independent per-pixel randomness -- reads as a natural, slightly uneven
// rock/soil/sand surface rather than TV-static speckle, even at this small
// tile resolution.
export function solid(color: [number, number, number], noise = 14): DrawFn {
  return (ctx, px, py, size, rng) => {
    const n2 = createNoise2D(rng);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const large = n2(x * 0.28, y * 0.28);
        const fine = n2(x * 0.9 + 40, y * 0.9 + 40) * 0.5;
        const n = (large + fine) * noise * 0.55;
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
    // Speckle placement follows a noise field rather than uniform
    // independent chance, so grains/flecks cluster into small natural
    // patches (like real ore veins or grain in stone) instead of an even
    // digital scatter.
    const n2 = createNoise2D(rng);
    const threshold = density * 2 - 1;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const field = n2(x * 0.55 + 100, y * 0.55 + 100);
        if (field < threshold) {
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
    solid(base, 7)(ctx, px, py, size, rng);
    // A shared noise field wobbles every grain line's start/length together,
    // so lines read as one continuous flowing wood grain instead of
    // independently-random streaks on each row.
    const n2 = createNoise2D(rng);
    for (let y = 0; y < size; y++) {
      const wobble = n2(0, y * 0.35) * 3;
      if (rng() < 0.55) {
        ctx.fillStyle = `rgba(${lineColor[0]},${lineColor[1]},${lineColor[2]},0.5)`;
        const len = 4 + Math.floor(rng() * (size - 4));
        const startX = Math.max(0, Math.round(wobble + rng() * Math.max(1, size - len)));
        ctx.fillRect(px + startX, py + y, Math.min(len, size - startX), 1);
      }
    }
  };
}

export function rings(base: [number, number, number], ringColor: [number, number, number]): DrawFn {
  return (ctx, px, py, size, rng) => {
    solid(base, 7)(ctx, px, py, size, rng);
    const cx = px + size / 2;
    const cy = py + size / 2;
    // Jitter each ring's radius per-angle via noise instead of drawing a
    // perfect circle, giving the hand-cut, slightly-irregular look of a
    // real cross-cut tree trunk.
    const n2 = createNoise2D(rng);
    ctx.strokeStyle = `rgb(${ringColor[0]},${ringColor[1]},${ringColor[2]})`;
    for (let r = 1.5; r < size / 2; r += 2) {
      const steps = 20;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const jitter = n2(Math.cos(a) * 1.5, Math.sin(a) * 1.5) * 0.9;
        const rr = r + jitter;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
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
    solid(base, 20)(ctx, px, py, size, rng);
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

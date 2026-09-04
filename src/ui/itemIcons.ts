// Recognizable per-item inventory icons, procedurally drawn (no external
// assets, matching the rest of the game's art pipeline). Two families:
//  - block items reuse the block's own real top-face texture straight out
//    of the shared world atlas, so e.g. dirt in your hotbar looks like the
//    dirt under your feet.
//  - everything else (tools, food, ingots, ...) gets a small hand-drawn
//    pixel shape via the generic shape functions below, reused across
//    color variants (tiers/dyes/tool types) the same way items.ts already
//    factors tool()/armor() into one shape per family.
import { getBlockDef } from '../game/items/blocks';
import { atlasBuilder, TILE_SIZE, ATLAS_SIZE } from '../engine/mesh/textureAtlas';
import type { ItemDef } from '../game/items/items';

const ICON_SIZE = 16;
const cache = new Map<string, string>();

function toDataUrl(draw: (ctx: CanvasRenderingContext2D) => void): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return canvas.toDataURL();
}

function cached(key: string, draw: (ctx: CanvasRenderingContext2D) => void): string {
  let url = cache.get(key);
  if (!url) {
    url = toDataUrl(draw);
    cache.set(key, url);
  }
  return url;
}

type RGB = [number, number, number];
function css([r, g, b]: RGB, a = 1): string {
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}
function clampByte(v: number) {
  return Math.max(0, Math.min(255, v));
}
function shade(c: RGB, amt: number): RGB {
  return [clampByte(c[0] + amt), clampByte(c[1] + amt), clampByte(c[2] + amt)];
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: RGB, a = 1) {
  ctx.fillStyle = css(color, a);
  ctx.fillRect(x, y, w, h);
}

/** Draws a mask string array (rows of chars) at (ox,oy), 1 canvas px per
 * mask cell. '.' = transparent, any other char looked up via colorFor. */
function drawMask(ctx: CanvasRenderingContext2D, mask: string[], ox: number, oy: number, colorFor: (ch: string) => RGB | null) {
  for (let y = 0; y < mask.length; y++) {
    for (let x = 0; x < mask[y].length; x++) {
      const ch = mask[y][x];
      if (ch === '.') continue;
      const c = colorFor(ch);
      if (!c) continue;
      px(ctx, ox + x, oy + y, 1, 1, c);
    }
  }
}

// ---------------- block items: real world texture ----------------

export function blockIconUrl(blockId: number): string {
  return cached(`block_${blockId}`, (ctx) => {
    const def = getBlockDef(blockId);
    const tile = def.top;
    const sx = Math.round(tile.u0 * ATLAS_SIZE);
    const sy = Math.round(tile.v0 * ATLAS_SIZE);
    ctx.drawImage(atlasBuilder.debugCanvas, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, ICON_SIZE, ICON_SIZE);
  });
}

// ---------------- shared shape families ----------------

const HANDLE: RGB = [140, 100, 60];

function stickShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -40);
  for (let i = 0; i < 11; i++) {
    px(ctx, 2 + i, 12 - i, 2, 2, color);
  }
  px(ctx, 2, 12, 1, 1, dark);
  px(ctx, 12, 2, 1, 1, dark);
}

function ingotShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -35);
  const light = shade(color, 30);
  px(ctx, 3, 6, 10, 1, light);
  px(ctx, 2, 7, 12, 5, color);
  px(ctx, 3, 12, 10, 1, dark);
  px(ctx, 2, 7, 1, 5, dark);
  px(ctx, 13, 7, 1, 5, dark);
}

function nuggetShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  const light = shade(color, 25);
  const cells: [number, number][] = [
    [5, 4], [6, 4], [7, 4],
    [4, 5], [5, 5], [6, 5], [7, 5], [8, 5],
    [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6],
    [5, 7], [6, 7], [7, 7], [8, 7], [9, 7],
    [6, 8], [7, 8], [8, 8],
  ];
  for (const [x, y] of cells) px(ctx, x, y, 1, 1, color);
  px(ctx, 5, 4, 1, 1, light);
  px(ctx, 9, 7, 1, 1, dark);
  px(ctx, 6, 8, 1, 1, dark);
}

function gemShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -40);
  const light = shade(color, 50);
  px(ctx, 6, 3, 4, 1, light);
  px(ctx, 4, 4, 8, 1, color);
  px(ctx, 3, 5, 10, 2, color);
  px(ctx, 4, 7, 8, 2, color);
  px(ctx, 5, 9, 6, 1, color);
  px(ctx, 6, 10, 4, 1, dark);
  px(ctx, 7, 11, 2, 1, dark);
  px(ctx, 7, 5, 2, 2, light);
}

function dustShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  const dots: [number, number, RGB][] = [
    [4, 5, color], [7, 4, color], [10, 6, color], [5, 8, dark],
    [8, 9, color], [11, 9, dark], [6, 11, color], [9, 12, dark], [3, 9, dark], [12, 5, dark],
  ];
  for (const [x, y, c] of dots) px(ctx, x, y, 2, 2, c);
}

function blobShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  const light = shade(color, 25);
  px(ctx, 5, 4, 5, 1, light);
  px(ctx, 3, 5, 9, 2, color);
  px(ctx, 2, 7, 11, 3, color);
  px(ctx, 3, 10, 9, 2, color);
  px(ctx, 5, 12, 5, 1, dark);
  px(ctx, 2, 7, 1, 3, dark);
}

function boneShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -25);
  px(ctx, 6, 6, 4, 4, color);
  px(ctx, 2, 3, 3, 3, color);
  px(ctx, 2, 3, 1, 1, dark);
  px(ctx, 4, 5, 3, 3, color);
  px(ctx, 11, 10, 3, 3, color);
  px(ctx, 13, 12, 1, 1, dark);
  px(ctx, 9, 8, 3, 3, color);
}

function featherShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -35);
  const cells = ['....1...', '...111..', '..11111.', '.1111111', '..11111.', '...111..', '....11..', '.....1..'];
  drawMask(ctx, cells, 4, 2, (ch) => (ch === '1' ? color : null));
  px(ctx, 6, 9, 1, 3, dark);
}

function stringShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const pts: [number, number][] = [[3, 3], [4, 4], [5, 5], [5, 6], [6, 7], [7, 8], [7, 9], [8, 10], [9, 11], [9, 12]];
  for (const [x, y] of pts) px(ctx, x, y, 1, 1, color);
}

function leatherShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  px(ctx, 3, 3, 10, 10, color);
  ctx.strokeStyle = css(dark);
  ctx.strokeRect(3.5, 3.5, 9, 9);
  px(ctx, 5, 5, 1, 6, dark);
  px(ctx, 8, 5, 1, 6, dark);
  px(ctx, 10, 5, 1, 6, dark);
}

function wheatShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  for (let i = 0; i < 3; i++) {
    const x = 4 + i * 4;
    px(ctx, x, 3, 1, 9, dark);
    px(ctx, x - 1, 3, 1, 1, color);
    px(ctx, x + 1, 3, 1, 1, color);
    px(ctx, x - 1, 5, 1, 1, color);
    px(ctx, x + 1, 5, 1, 1, color);
    px(ctx, x - 1, 7, 1, 1, color);
    px(ctx, x + 1, 7, 1, 1, color);
  }
}

function dyeDropShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  const light = shade(color, 30);
  px(ctx, 6, 3, 3, 1, color);
  px(ctx, 5, 4, 5, 2, color);
  px(ctx, 4, 6, 7, 5, color);
  px(ctx, 5, 11, 5, 1, dark);
  px(ctx, 6, 6, 2, 2, light);
}

function bucketShape(ctx: CanvasRenderingContext2D, metal: RGB, fill: RGB | null) {
  const dark = shade(metal, -30);
  px(ctx, 4, 3, 1, 2, metal);
  px(ctx, 10, 3, 1, 2, metal);
  px(ctx, 5, 2, 5, 1, metal);
  if (fill) px(ctx, 4, 6, 7, 4, fill);
  px(ctx, 3, 5, 9, 1, metal);
  px(ctx, 3, 5, 1, 5, metal);
  px(ctx, 11, 5, 1, 5, metal);
  px(ctx, 4, 10, 7, 1, dark);
  px(ctx, 4, 9, 7, 1, metal);
}

function toolHandle(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, len: number) {
  for (let i = 0; i < len; i++) px(ctx, fromX + i, fromY + i, 1, 1, HANDLE);
}

function pickaxeShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  px(ctx, 3, 3, 8, 2, color);
  px(ctx, 2, 3, 1, 1, dark);
  px(ctx, 11, 3, 1, 1, dark);
  px(ctx, 4, 5, 1, 1, color);
  px(ctx, 10, 5, 1, 1, color);
  toolHandle(ctx, 5, 5, 8);
}

function axeShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  px(ctx, 5, 2, 6, 3, color);
  px(ctx, 5, 5, 4, 2, color);
  px(ctx, 4, 3, 1, 3, dark);
  px(ctx, 11, 2, 1, 2, dark);
  toolHandle(ctx, 5, 6, 8);
}

function shovelShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  px(ctx, 6, 2, 4, 5, color);
  px(ctx, 6, 2, 1, 5, dark);
  px(ctx, 9, 2, 1, 5, dark);
  toolHandle(ctx, 4, 6, 9);
}

function swordShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  for (let i = 0; i < 8; i++) px(ctx, 9 - i, 2 + i, 2, 2, color);
  px(ctx, 2, 9, 1, 1, dark);
  px(ctx, 3, 10, 3, 1, HANDLE);
  px(ctx, 2, 11, 1, 1, HANDLE);
  px(ctx, 3, 12, 1, 1, HANDLE);
}

function hoeShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  px(ctx, 4, 3, 6, 2, color);
  px(ctx, 3, 3, 1, 2, dark);
  toolHandle(ctx, 7, 5, 8);
}

function shearsShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -35);
  // two crossed blades pivoting at center, handle behind
  for (let i = 0; i < 7; i++) {
    px(ctx, 4 + i, 3 + i, 2, 2, color);
    px(ctx, 10 - i, 3 + i, 2, 2, color);
  }
  px(ctx, 6, 9, 4, 2, dark);
  px(ctx, 4, 11, 3, 2, HANDLE);
  px(ctx, 9, 11, 3, 2, HANDLE);
}

function helmetShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  px(ctx, 4, 3, 8, 1, color);
  px(ctx, 3, 4, 10, 4, color);
  px(ctx, 3, 8, 2, 2, color);
  px(ctx, 11, 8, 2, 2, color);
  px(ctx, 3, 4, 1, 4, dark);
  px(ctx, 12, 4, 1, 4, dark);
}

function chestplateShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  px(ctx, 5, 2, 6, 2, color);
  px(ctx, 3, 4, 10, 8, color);
  px(ctx, 3, 4, 1, 8, dark);
  px(ctx, 12, 4, 1, 8, dark);
  px(ctx, 7, 6, 2, 6, dark);
}

function leggingsShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  px(ctx, 3, 2, 10, 5, color);
  px(ctx, 3, 7, 4, 6, color);
  px(ctx, 9, 7, 4, 6, color);
  px(ctx, 7, 2, 2, 5, dark);
}

function bootsShape(ctx: CanvasRenderingContext2D, color: RGB) {
  const dark = shade(color, -30);
  px(ctx, 4, 3, 3, 7, color);
  px(ctx, 9, 3, 3, 7, color);
  px(ctx, 3, 10, 5, 2, color);
  px(ctx, 8, 10, 5, 2, color);
  px(ctx, 3, 11, 5, 1, dark);
  px(ctx, 8, 11, 5, 1, dark);
}

const TOOL_HEAD_SHAPE: Record<string, (ctx: CanvasRenderingContext2D, color: RGB) => void> = {
  pickaxe: pickaxeShape,
  axe: axeShape,
  shovel: shovelShape,
  sword: swordShape,
  hoe: hoeShape,
};

const ARMOR_SHAPE: Record<string, (ctx: CanvasRenderingContext2D, color: RGB) => void> = {
  helmet: helmetShape,
  chestplate: chestplateShape,
  leggings: leggingsShape,
  boots: bootsShape,
};

// Items whose look doesn't fit a single shared shape family get an explicit
// per-id shape here; everything else falls into the id-prefix rules below.
const EXPLICIT_SHAPE: Record<string, (ctx: CanvasRenderingContext2D, color: RGB) => void> = {
  stick: stickShape,
  shears: shearsShape,
  bone: boneShape,
  feather: featherShape,
  string: stringShape,
  leather: leatherShape,
  wheat: wheatShape,
  bucket: (ctx) => bucketShape(ctx, [190, 190, 195], null),
  water_bucket: (ctx) => bucketShape(ctx, [190, 190, 195], [60, 110, 220]),
  lava_bucket: (ctx) => bucketShape(ctx, [190, 190, 195], [220, 90, 20]),
  coal: nuggetShape,
  charcoal: nuggetShape,
  raw_iron: nuggetShape,
  raw_gold: nuggetShape,
  iron_ingot: ingotShape,
  gold_ingot: ingotShape,
  diamond: gemShape,
  emerald: gemShape,
  lapis_lazuli: gemShape,
  redstone_dust: dustShape,
  gunpowder: dustShape,
  carrot: (ctx, color) => {
    const dark = shade(color, -30);
    px(ctx, 7, 3, 2, 2, [70, 150, 40]);
    px(ctx, 6, 6, 4, 2, color);
    px(ctx, 6, 8, 3, 2, color);
    px(ctx, 7, 10, 2, 2, color);
    px(ctx, 8, 12, 1, 1, dark);
  },
  potato: blobShape,
  baked_potato: blobShape,
  apple: blobShape,
  golden_apple: blobShape,
  bread: (ctx, color) => {
    const dark = shade(color, -30);
    px(ctx, 3, 6, 10, 1, dark);
    px(ctx, 3, 7, 10, 4, color);
    px(ctx, 4, 5, 8, 1, color);
    px(ctx, 5, 11, 6, 1, dark);
    px(ctx, 5, 8, 1, 2, dark);
    px(ctx, 8, 8, 1, 2, dark);
    px(ctx, 11, 8, 1, 2, dark);
  },
  raw_beef: blobShape,
  cooked_beef: blobShape,
  raw_porkchop: blobShape,
  cooked_porkchop: blobShape,
  raw_chicken: blobShape,
  cooked_chicken: blobShape,
  rotten_flesh: blobShape,
  dye_red: dyeDropShape,
  dye_yellow: dyeDropShape,
  dye_blue: dyeDropShape,
  dye_black: dyeDropShape,
  dye_white: dyeDropShape,
  dye_green: dyeDropShape,
};

export function itemIconUrl(def: ItemDef): string {
  if (def.isBlock && def.blockId !== undefined) return blockIconUrl(def.blockId);

  return cached(`item_${def.id}`, (ctx) => {
    const color = def.color;

    if (def.armorType && ARMOR_SHAPE[def.armorType]) {
      ARMOR_SHAPE[def.armorType](ctx, color);
      return;
    }
    if (def.toolType && TOOL_HEAD_SHAPE[def.toolType]) {
      TOOL_HEAD_SHAPE[def.toolType](ctx, color);
      return;
    }
    const explicit = EXPLICIT_SHAPE[def.id];
    if (explicit) {
      explicit(ctx, color);
      return;
    }
    // Fallback: a plain swatch (covers any future item added without a
    // dedicated shape — keeps the game from ever crashing on a missing icon).
    px(ctx, 2, 2, 12, 12, color);
    ctx.strokeStyle = css(shade(color, -50));
    ctx.strokeRect(2.5, 2.5, 11, 11);
  });
}

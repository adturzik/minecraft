// Small hand-authored pixel-art bitmaps (heart / drumstick / bubble) drawn
// on a tiny canvas and exported as data-URLs, scaled up crisply via CSS
// `image-rendering: pixelated` (set globally in index.html). Fully original
// pixel art, not traced from any existing game's icon set.

const HEART_MASK = ['.11.11.', '1111111', '1111111', '1111111', '.11111.', '..111..', '...1...'];
const DRUMSTICK_MASK = ['...11...', '..1111..', '.111111.', '11111111', '.111111.', '..1111..', '...11...', '....1...'];

function renderMask(mask: string[], colorFor: (x: number, y: number) => string): string {
  const h = mask.length;
  const w = mask[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y][x] === '.') continue;
      ctx.fillStyle = colorFor(x, y);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas.toDataURL();
}

const cache = new Map<string, string>();
function cached(key: string, build: () => string): string {
  let url = cache.get(key);
  if (!url) {
    url = build();
    cache.set(key, url);
  }
  return url;
}

const RED = '#d02020';
const RED_DARK = '#8a1414';
const EMPTY = '#3a3a3a';
const GOLD = '#c68958';
const GOLD_DARK = '#8a5c38';
const HUNGER_EMPTY = '#3a3a3a';
const BLUE = '#5aa8e0';
const BUBBLE_EMPTY = '#2a3540';

export function heartIcon(state: 'full' | 'half' | 'empty'): string {
  return cached(`heart_${state}`, () =>
    renderMask(HEART_MASK, (x) => {
      if (state === 'empty') return EMPTY;
      if (state === 'half') return x < 3 ? RED : x === 3 ? RED_DARK : EMPTY;
      return x < 5 ? RED : RED_DARK;
    })
  );
}

export function drumstickIcon(state: 'full' | 'empty'): string {
  return cached(`drum_${state}`, () =>
    renderMask(DRUMSTICK_MASK, (x) => {
      if (state === 'empty') return HUNGER_EMPTY;
      return x < 5 ? GOLD : GOLD_DARK;
    })
  );
}

export function bubbleIcon(state: 'full' | 'empty'): string {
  return cached(`bubble_${state}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = state === 'full' ? BLUE : BUBBLE_EMPTY;
    ctx.beginPath();
    ctx.arc(4, 4, 3, 0, Math.PI * 2);
    ctx.fill();
    return canvas.toDataURL();
  });
}

export function makeIcon(src: string, sizePx: number): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;
  img.style.cssText = `width:${sizePx}px;height:${sizePx}px;display:block;`;
  img.draggable = false;
  return img;
}

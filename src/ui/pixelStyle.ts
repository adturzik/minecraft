// Shared "chunky beveled stone GUI" look used across the main menu, pause
// menu, inventory/crafting/furnace screens and hotbar — modeled on classic
// blocky-voxel-game UI conventions (raised buttons / sunken slots, thick
// pixel borders), built entirely from CSS so there's no external UI
// spritesheet to license.

export const TITLE_FONT = "'Press Start 2P', monospace";
export const BODY_FONT = "'Segoe UI', Verdana, sans-serif";

export const STONE = '#8b8b8b';
export const STONE_DARK = '#565656';
export const STONE_LIGHT = '#c6c6c6';
export const PANEL_BG = '#c6c6c6';

/** 2px beveled border: 'raised' reads as a button popping out, 'sunken' as
 * a slot pressed in. Wrap with a solid pixel black outline via boxShadow
 * for the classic double-border look. */
export function bevel(mode: 'raised' | 'sunken', width = 2): string {
  const light = mode === 'raised' ? '#ffffff' : '#3f3f3f';
  const dark = mode === 'raised' ? '#3f3f3f' : '#ffffff';
  return `border-style:solid;border-width:${width}px;border-top-color:${light};border-left-color:${light};border-right-color:${dark};border-bottom-color:${dark};`;
}

export function panelStyle(): string {
  return `background:linear-gradient(155deg, #d6d6d6 0%, ${PANEL_BG} 55%, #a8a8a8 100%);${bevel('raised', 3)}border-radius:5px;box-shadow:0 0 0 3px #000, 0 10px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25);box-sizing:border-box;`;
}

export function buttonStyle(size: 'normal' | 'small' = 'normal'): string {
  const pad = size === 'small' ? '6px 12px' : '11px 22px';
  const font = size === 'small' ? '12px' : '15px';
  return `background:linear-gradient(160deg, #a3a3a3 0%, ${STONE} 55%, #737373 100%);${bevel('raised', 2)}border-radius:4px;box-shadow:0 0 0 2px #000, 0 3px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3);color:#fff;font-family:${BODY_FONT};font-weight:bold;font-size:${font};padding:${pad};cursor:pointer;text-align:center;box-sizing:border-box;transition:filter 0.1s, transform 0.08s, box-shadow 0.08s;`;
}

export function slotStyle(size = 40): string {
  return `width:${size}px;height:${size}px;background:linear-gradient(160deg, #6d6d6d 0%, #838383 100%);${bevel('sunken', 2)}border-radius:3px;box-shadow:0 0 0 1px #000, inset 0 2px 5px rgba(0,0,0,0.55);box-sizing:border-box;position:relative;`;
}

export function inputStyle(): string {
  return `background:#fff;${bevel('sunken', 2)}border-radius:3px;box-shadow:0 0 0 2px #000, inset 0 2px 4px rgba(0,0,0,0.2);padding:8px;font-family:${BODY_FONT};box-sizing:border-box;`;
}

export function attachButtonHover(el: HTMLElement) {
  el.addEventListener('mouseenter', () => {
    el.style.filter = 'brightness(1.2)';
    el.style.transform = 'translateY(-1px)';
  });
  el.addEventListener('mouseleave', () => {
    el.style.filter = 'none';
    el.style.transform = 'none';
  });
  el.addEventListener('mousedown', () => {
    el.style.transform = 'translateY(1px)';
    el.style.filter = 'brightness(0.95)';
  });
  el.addEventListener('mouseup', () => {
    el.style.transform = 'translateY(-1px)';
    el.style.filter = 'brightness(1.2)';
  });
}

/** The blocky carved-letters logo look (stacked hard-edged shadow layers
 * instead of a blur, matching pixel-art title conventions). `accent` is the
 * color peeking out from the bottom-right shadow offset. */
export function logoTextShadow(accent = '#3f3f3f'): string {
  const layers: string[] = [];
  for (let i = 1; i <= 5; i++) layers.push(`${i}px ${i}px 0 ${accent}`);
  return layers.join(',');
}

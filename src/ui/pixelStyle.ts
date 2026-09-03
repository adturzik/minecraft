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
  return `background:${PANEL_BG};${bevel('raised', 3)}box-shadow:0 0 0 3px #000, 6px 6px 0 rgba(0,0,0,0.35);box-sizing:border-box;`;
}

export function buttonStyle(size: 'normal' | 'small' = 'normal'): string {
  const pad = size === 'small' ? '6px 12px' : '11px 22px';
  const font = size === 'small' ? '12px' : '15px';
  return `background:${STONE};${bevel('raised', 2)}box-shadow:0 0 0 2px #000;color:#fff;font-family:${BODY_FONT};font-weight:bold;font-size:${font};padding:${pad};cursor:pointer;text-align:center;box-sizing:border-box;transition:filter 0.1s;`;
}

export function slotStyle(size = 40): string {
  return `width:${size}px;height:${size}px;background:${STONE};${bevel('sunken', 2)}box-shadow:0 0 0 1px #000;box-sizing:border-box;position:relative;`;
}

export function inputStyle(): string {
  return `background:#fff;${bevel('sunken', 2)}box-shadow:0 0 0 2px #000;padding:8px;font-family:${BODY_FONT};box-sizing:border-box;`;
}

export function attachButtonHover(el: HTMLElement) {
  el.addEventListener('mouseenter', () => {
    el.style.filter = 'brightness(1.25)';
  });
  el.addEventListener('mouseleave', () => {
    el.style.filter = 'none';
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

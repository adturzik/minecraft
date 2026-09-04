import { SurvivalState } from '../../game/player/survival';
import type { GameMode } from '../../game/player/gameMode';
import { heartIcon, drumstickIcon, bubbleIcon, makeIcon } from '../pixelIcons';
import { panelStyle, buttonStyle, attachButtonHover, BODY_FONT, TITLE_FONT, logoTextShadow } from '../pixelStyle';

const ICON_COUNT = 10;
const ICON_SIZE = 18;

function makeIconRow(side: 'left' | 'right'): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = `position:fixed;bottom:74px;display:flex;gap:1px;z-index:10;left:50%;transform:translateX(${side === 'left' ? '-186px' : '2px'});`;
  return row;
}

export class SurvivalHUD {
  private healthRow = makeIconRow('left');
  private hungerRow = makeIconRow('right');
  private breathRow: HTMLDivElement;
  private deathScreen: HTMLDivElement;
  private onRespawnClick: (() => void) | null = null;

  constructor() {
    this.breathRow = makeIconRow('left');
    this.breathRow.style.bottom = '96px';
    document.body.appendChild(this.healthRow);
    document.body.appendChild(this.hungerRow);
    document.body.appendChild(this.breathRow);

    this.deathScreen = document.createElement('div');
    this.deathScreen.style.cssText =
      'position:fixed;inset:0;background:rgba(60,0,0,0.6);display:none;align-items:center;justify-content:center;flex-direction:column;gap:20px;color:#fff;font-family:' +
      BODY_FONT +
      ';z-index:2000;';

    const title = document.createElement('div');
    title.textContent = 'ZEMŘEL JSI';
    title.style.cssText = `font-family:${TITLE_FONT};font-size:28px;color:#ff5555;text-shadow:${logoTextShadow('#5a0000')};`;
    this.deathScreen.appendChild(title);

    const btn = document.createElement('button');
    btn.textContent = 'Respawn';
    btn.style.cssText = buttonStyle() + 'font-size:16px;padding:12px 30px;';
    attachButtonHover(btn);
    btn.addEventListener('click', () => this.onRespawnClick?.());
    this.deathScreen.appendChild(btn);
    document.body.appendChild(this.deathScreen);
  }

  setRespawnHandler(fn: () => void) {
    this.onRespawnClick = fn;
  }

  update(state: SurvivalState, gameMode: GameMode = 'survival') {
    // Creative has no health/hunger/breath to track (matches vanilla, which
    // hides these bars entirely in creative).
    const show = gameMode === 'survival' ? 'flex' : 'none';
    this.healthRow.style.display = show;
    this.hungerRow.style.display = show;
    if (gameMode === 'creative') {
      this.breathRow.style.display = 'none';
      this.deathScreen.style.display = 'none';
      return;
    }
    this.healthRow.innerHTML = '';
    for (let i = 0; i < ICON_COUNT; i++) {
      const filled = state.health >= (i + 1) * 2;
      const half = !filled && state.health > i * 2;
      this.healthRow.appendChild(makeIcon(heartIcon(filled ? 'full' : half ? 'half' : 'empty'), ICON_SIZE));
    }
    this.hungerRow.innerHTML = '';
    for (let i = 0; i < ICON_COUNT; i++) {
      const filled = state.hunger >= (i + 1) * 2;
      this.hungerRow.appendChild(makeIcon(drumstickIcon(filled ? 'full' : 'empty'), ICON_SIZE));
    }

    this.breathRow.style.display = state.breath < state.maxBreath ? 'flex' : 'none';
    this.breathRow.innerHTML = '';
    for (let i = 0; i < ICON_COUNT; i++) {
      const filled = state.breath >= i + 1;
      this.breathRow.appendChild(makeIcon(bubbleIcon(filled ? 'full' : 'empty'), 12));
    }

    this.deathScreen.style.display = state.dead ? 'flex' : 'none';
  }
}

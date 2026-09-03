import { listWorlds, loadWorld, deleteWorld, newWorldId, WorldSummary, WorldSaveData } from '../persistence/saveSystem';
import { loadSettings, saveSettings, Settings } from '../persistence/settings';
import { seedFromString } from '../engine/worldgen/random';
import { soundEngine } from '../audio/soundEngine';
import { panelStyle, buttonStyle, inputStyle, attachButtonHover, TITLE_FONT, BODY_FONT, logoTextShadow } from './pixelStyle';

export interface PlayOptions {
  seed: number;
  worldId: string;
  worldName: string;
  existingSave: WorldSaveData | null;
}

const LOADING_TIPS = [
  'Kari se nejlépe sklízí za úsvitu.',
  'Curry blok svítí, i když to nikdo nečekal.',
  'Diamanty se skrývají hluboko pod kari polem.',
  'Zombie nesnáší kari — a světlo.',
  'Vždy si vezmi kýbl na cestu... až budou kýble.',
  'Stromy rostou rychleji, když se na ně nedíváš.',
  'CurryCraft doporučuje: nejez syrové kuře.',
];

const SPLASH_TEXTS = [
  'Teď s extra kari!',
  '100% originální!',
  'Také zkuste Bramboráček!',
  'Blokově pikantní!',
  'Žádné externí assety!',
  'Vyrobeno v Claude Code!',
];

function btn(label: string, onClick: () => void, size: 'normal' | 'small' = 'normal'): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = buttonStyle(size);
  attachButtonHover(b);
  b.addEventListener('mouseenter', () => soundEngine.uiClick());
  b.addEventListener('click', () => {
    soundEngine.ensureStarted();
    soundEngine.uiClick();
    onClick();
  });
  return b;
}

function styledInput(placeholder: string, value = ''): HTMLInputElement {
  const input = document.createElement('input');
  input.placeholder = placeholder;
  input.value = value;
  input.style.cssText = inputStyle() + 'width:280px;';
  return input;
}

function renderSettingsPanel(container: HTMLElement, onChange?: (s: Settings) => void) {
  const settings = loadSettings();
  container.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Nastavení';
  title.style.cssText = `font-family:${BODY_FONT};font-size:18px;font-weight:bold;margin-bottom:10px;color:#fff;`;
  container.appendChild(title);

  const rows: [string, keyof Settings, number, number, number][] = [
    ['Render distance (chunků)', 'renderDistance', 3, 12, 1],
    ['Citlivost myši', 'mouseSensitivity', 0.2, 3, 0.1],
    ['FOV', 'fov', 60, 100, 1],
    ['Hlasitost - master', 'masterVolume', 0, 1, 0.05],
    ['Hlasitost - efekty', 'sfxVolume', 0, 1, 0.05],
    ['Hlasitost - hudba', 'musicVolume', 0, 1, 0.05],
  ];

  for (const [label, keyName, min, max, step] of rows) {
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:10px;margin:8px 0;color:#fff;font-family:${BODY_FONT};`;
    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.cssText = 'width:200px;font-size:12px;';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(settings[keyName]);
    input.style.flex = '1';
    const valSpan = document.createElement('span');
    valSpan.textContent = String(settings[keyName]);
    valSpan.style.cssText = 'width:36px;text-align:right;font-size:12px;';
    input.addEventListener('input', () => {
      (settings[keyName] as number) = parseFloat(input.value);
      valSpan.textContent = input.value;
      saveSettings(settings);
      soundEngine.setVolumes(settings.masterVolume, settings.sfxVolume, settings.musicVolume);
      onChange?.(settings);
    });
    row.append(lbl, input, valSpan);
    container.appendChild(row);
  }
}

export class MainMenu {
  private root: HTMLDivElement;
  private onPlay: (opts: PlayOptions) => void;

  constructor(onPlay: (opts: PlayOptions) => void) {
    this.onPlay = onPlay;
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;inset:0;background:linear-gradient(#5b8fd4 0%,#a9cdf0 55%,#c9e3b8 100%);display:flex;flex-direction:column;align-items:center;z-index:3000;overflow:hidden;';
    document.body.appendChild(this.root);
    this.showHome();
  }

  hide() {
    this.root.remove();
  }

  private clear(): HTMLDivElement {
    this.root.innerHTML = '';
    const content = document.createElement('div');
    content.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;margin-top:8%;';
    this.root.appendChild(content);

    const version = document.createElement('div');
    version.style.cssText = `position:absolute;left:8px;bottom:6px;color:#fff;font-family:${BODY_FONT};font-size:11px;text-shadow:1px 1px 0 #000;`;
    version.textContent = 'CurryCraft 0.1.0 (Fáze 8 / MVP)';
    const credit = document.createElement('div');
    credit.style.cssText = `position:absolute;right:8px;bottom:6px;color:#fff;font-family:${BODY_FONT};font-size:11px;text-shadow:1px 1px 0 #000;`;
    credit.textContent = 'Originální hra — žádné assety třetích stran';
    this.root.append(version, credit);

    return content;
  }

  private showHome() {
    const content = this.clear();

    const logoWrap = document.createElement('div');
    logoWrap.style.cssText = 'position:relative;margin-bottom:26px;';
    const title = document.createElement('div');
    title.textContent = 'CURRYCRAFT';
    title.style.cssText = `font-family:${TITLE_FONT};font-size:46px;color:#ffcf4a;text-shadow:${logoTextShadow('#5a3d00')};letter-spacing:2px;`;
    logoWrap.appendChild(title);

    const splash = document.createElement('div');
    splash.textContent = SPLASH_TEXTS[Math.floor(Math.random() * SPLASH_TEXTS.length)];
    splash.style.cssText = `position:absolute;top:-14px;right:-30px;transform:rotate(-18deg);color:#fff400;font-family:${TITLE_FONT};font-size:11px;text-shadow:2px 2px 0 #000;`;
    logoWrap.appendChild(splash);
    content.appendChild(logoWrap);

    const buttonCol = document.createElement('div');
    buttonCol.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:320px;';
    const wide = (b: HTMLButtonElement) => {
      b.style.width = '100%';
      b.style.boxSizing = 'border-box';
      return b;
    };
    buttonCol.appendChild(wide(btn('Nová hra', () => this.showNewWorld())));
    buttonCol.appendChild(wide(btn('Načíst hru', () => this.showLoadWorld())));
    buttonCol.appendChild(wide(btn('Nastavení', () => this.showSettings())));
    content.appendChild(buttonCol);
  }

  private showNewWorld() {
    const content = this.clear();
    const panel = document.createElement('div');
    panel.style.cssText = panelStyle() + 'padding:24px 30px;display:flex;flex-direction:column;gap:12px;align-items:center;';
    content.appendChild(panel);

    const title = document.createElement('div');
    title.textContent = 'Nová hra';
    title.style.cssText = `font-family:${BODY_FONT};font-size:20px;font-weight:bold;color:#222;`;
    panel.appendChild(title);

    const nameInput = styledInput('Název světa', 'Nový svět');
    panel.appendChild(nameInput);
    const seedInput = styledInput('Seed (nepovinné)');
    panel.appendChild(seedInput);

    panel.appendChild(
      btn('Vytvořit svět', () => {
        const seedText = seedInput.value.trim();
        const seed = seedText ? seedFromString(seedText) : Math.floor(Math.random() * 1e9);
        this.hide();
        this.onPlay({ seed, worldId: newWorldId(), worldName: nameInput.value.trim() || 'Nový svět', existingSave: null });
      })
    );
    panel.appendChild(btn('Zpět', () => this.showHome(), 'small'));
  }

  private async showLoadWorld() {
    const content = this.clear();
    const panel = document.createElement('div');
    panel.style.cssText = panelStyle() + 'padding:22px 26px;display:flex;flex-direction:column;gap:10px;align-items:center;';
    content.appendChild(panel);

    const title = document.createElement('div');
    title.textContent = 'Načíst hru';
    title.style.cssText = `font-family:${BODY_FONT};font-size:20px;font-weight:bold;color:#222;`;
    panel.appendChild(title);

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto;width:320px;';
    panel.appendChild(list);

    const worlds: WorldSummary[] = await listWorlds();
    if (worlds.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'Zatím žádné uložené světy.';
      empty.style.cssText = `opacity:0.7;font-family:${BODY_FONT};color:#333;`;
      list.appendChild(empty);
    }
    for (const w of worlds) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:center;background:rgba(0,0,0,0.15);padding:6px 8px;';
      const label = document.createElement('div');
      label.style.cssText = `flex:1;font-family:${BODY_FONT};color:#fff;`;
      label.innerHTML = `<div style="font-weight:bold;">${w.name}</div><div style="font-size:11px;opacity:0.8;">seed ${w.seed} · ${new Date(w.lastPlayedAt).toLocaleString()}</div>`;
      row.appendChild(label);
      const playBtn = btn('Hrát', async () => {
        const save = await loadWorld(w.id);
        this.hide();
        this.onPlay({ seed: w.seed, worldId: w.id, worldName: w.name, existingSave: save });
      }, 'small');
      row.appendChild(playBtn);
      const delBtn = btn('Smazat', async () => {
        await deleteWorld(w.id);
        this.showLoadWorld();
      }, 'small');
      delBtn.style.background = '#7a2a2a';
      row.appendChild(delBtn);
      list.appendChild(row);
    }

    panel.appendChild(btn('Zpět', () => this.showHome(), 'small'));
  }

  private showSettings() {
    const content = this.clear();
    const panel = document.createElement('div');
    panel.style.cssText = panelStyle() + 'padding:22px 26px;display:flex;flex-direction:column;gap:8px;align-items:center;';
    content.appendChild(panel);
    const inner = document.createElement('div');
    inner.style.width = '360px';
    panel.appendChild(inner);
    renderSettingsPanel(inner);
    panel.appendChild(btn('Zpět', () => this.showHome(), 'small'));
  }
}

export { LOADING_TIPS, renderSettingsPanel };

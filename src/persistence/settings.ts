export interface Settings {
  renderDistance: number;
  mouseSensitivity: number;
  fov: number;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
}

const DEFAULTS: Settings = {
  renderDistance: 6,
  mouseSensitivity: 1,
  fov: 75,
  masterVolume: 0.8,
  sfxVolume: 0.8,
  musicVolume: 0.35,
};

const KEY = 'currycraft_settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignore (private browsing / storage disabled)
  }
}

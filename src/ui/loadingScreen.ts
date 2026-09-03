import { LOADING_TIPS } from './mainMenu';

export class LoadingScreen {
  private root: HTMLDivElement;
  private barFill: HTMLDivElement;
  private tipEl: HTMLDivElement;
  private tipTimer: ReturnType<typeof setInterval> | null = null;

  constructor(worldName: string) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;inset:0;background:#12141a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;z-index:4000;color:#fff;font:14px sans-serif;';

    const title = document.createElement('div');
    title.textContent = `Načítání světa "${worldName}"…`;
    title.style.cssText = 'font-size:20px;font-weight:bold;';

    const barOuter = document.createElement('div');
    barOuter.style.cssText = 'width:360px;height:14px;border:1px solid rgba(255,255,255,0.4);border-radius:3px;overflow:hidden;';
    this.barFill = document.createElement('div');
    this.barFill.style.cssText = 'height:100%;width:0%;background:#6fae3e;transition:width 0.2s;';
    barOuter.appendChild(this.barFill);

    this.tipEl = document.createElement('div');
    this.tipEl.style.cssText = 'opacity:0.75;font-style:italic;max-width:420px;text-align:center;';
    this.pickTip();

    this.root.append(title, barOuter, this.tipEl);
    document.body.appendChild(this.root);

    this.tipTimer = setInterval(() => this.pickTip(), 2500);
  }

  private pickTip() {
    this.tipEl.textContent = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
  }

  setProgress(fraction: number) {
    this.barFill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  }

  destroy() {
    if (this.tipTimer) clearInterval(this.tipTimer);
    this.root.remove();
  }
}

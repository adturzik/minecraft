import { Inventory, Slot, HOTBAR_SIZE, ARMOR_TYPES } from '../game/player/inventory';
import { getItemDef } from '../game/items/items';
import { matchRecipe } from '../game/crafting/craftingMatcher';
import { FurnaceState } from '../game/crafting/furnaceManager';
import { slotStyle, panelStyle, BODY_FONT, bevel, STONE } from './pixelStyle';
import { soundEngine } from '../audio/soundEngine';
import { itemIconUrl } from './itemIcons';

function styleSlotEl(el: HTMLDivElement, size = 40) {
  el.style.cssText = slotStyle(size) + 'cursor:pointer;user-select:none;';
}

function renderSlotContent(el: HTMLDivElement, slot: Slot) {
  // keep the sunken slot bevel, only replace the item content underneath
  const existing = el.querySelector('.slot-content');
  if (existing) existing.remove();
  if (!slot) return;
  const def = getItemDef(slot.itemId);
  const content = document.createElement('div');
  content.className = 'slot-content';
  content.style.cssText = 'position:absolute;inset:0;pointer-events:none;';

  const swatch = document.createElement('div');
  // Icon art is drawn on a transparent canvas and already carries its own
  // color, so the slot backdrop stays neutral -- an opaque same-color fill
  // here used to sit right behind it and swallow the shape entirely.
  swatch.style.cssText = `position:absolute;inset:3px;${bevel('raised', 1)}box-sizing:border-box;image-rendering:pixelated;background-image:url(${itemIconUrl(def)});background-size:contain;background-repeat:no-repeat;background-position:center;`;
  content.appendChild(swatch);

  if (slot.count > 1) {
    const badge = document.createElement('div');
    badge.style.cssText = `position:absolute;bottom:0px;right:2px;font:bold 12px ${BODY_FONT};color:#fff;text-shadow:1px 1px 0 #000;`;
    badge.textContent = String(slot.count);
    content.appendChild(badge);
  }
  if (slot.durability !== undefined && def.maxDurability) {
    const bar = document.createElement('div');
    const pct = Math.max(0, slot.durability / def.maxDurability);
    bar.style.cssText = `position:absolute;left:3px;right:3px;bottom:2px;height:3px;background:#111;`;
    const fill = document.createElement('div');
    fill.style.cssText = `height:100%;width:${pct * 100}%;background:${pct > 0.5 ? '#6c6' : pct > 0.2 ? '#cc6' : '#c66'};`;
    bar.appendChild(fill);
    content.appendChild(bar);
  }
  el.appendChild(content);
}

type ClickHandler = (index: number, rightClick: boolean) => void;

function makeSlotGrid(count: number, cols: number, onClick: ClickHandler): { root: HTMLDivElement; els: HTMLDivElement[] } {
  const root = document.createElement('div');
  root.style.cssText = `display:grid;grid-template-columns:repeat(${cols},40px);gap:2px;background:rgba(0,0,0,0.15);padding:4px;`;
  const els: HTMLDivElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    styleSlotEl(el);
    el.addEventListener('click', () => {
      soundEngine.uiClick();
      onClick(i, false);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      soundEngine.uiClick();
      onClick(i, true);
    });
    root.appendChild(el);
    els.push(el);
  }
  return { root, els };
}

function armorPieceColor(slot: Slot): string | null {
  if (!slot) return null;
  const def = getItemDef(slot.itemId);
  return `rgb(${def.color[0]},${def.color[1]},${def.color[2]})`;
}

const SKIN_COLOR = '#d9a066';
const SHIRT_COLOR = '#4a7fc9';
const PANTS_COLOR = '#3a4a6b';
const BOOTS_COLOR = '#2a2a2a';

/** Blocky front-facing character silhouette (head/torso/arms/legs/boots as
 * flat rectangles, matching the rest of the UI's flat-swatch look). Colors
 * reflect whatever's equipped in armorSlots, and the right hand shows the
 * currently-selected hotbar item, so equipping gear is actually visible. */
function buildCharacterPreview(inventory: Inventory): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';

  const stage = document.createElement('div');
  stage.style.cssText = `position:relative;width:84px;height:132px;background:rgba(0,0,0,0.15);${bevel('sunken', 2)}box-sizing:border-box;`;

  const helmetColor = armorPieceColor(inventory.armorSlots[0]) ?? SKIN_COLOR;
  const chestColor = armorPieceColor(inventory.armorSlots[1]) ?? SHIRT_COLOR;
  const legsColor = armorPieceColor(inventory.armorSlots[2]) ?? PANTS_COLOR;
  const bootsColor = armorPieceColor(inventory.armorSlots[3]) ?? BOOTS_COLOR;

  const part = (css: string, bg: string) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.4);background:${bg};${css}`;
    stage.appendChild(d);
  };

  part('left:30px;top:4px;width:24px;height:24px;', helmetColor); // head
  part('left:22px;top:30px;width:40px;height:44px;', chestColor); // torso
  part('left:10px;top:30px;width:12px;height:44px;', chestColor); // left arm (sleeve)
  part('left:62px;top:30px;width:12px;height:44px;', SKIN_COLOR); // right arm (bare, holds item)
  part('left:22px;top:76px;width:18px;height:30px;', legsColor); // left leg
  part('left:44px;top:76px;width:18px;height:30px;', legsColor); // right leg
  part('left:22px;top:106px;width:18px;height:8px;', bootsColor);
  part('left:44px;top:106px;width:18px;height:8px;', bootsColor);

  const heldStack = inventory.selectedStack;
  if (heldStack) {
    const def = getItemDef(heldStack.itemId);
    const hand = document.createElement('div');
    hand.style.cssText = `position:absolute;left:60px;top:66px;width:16px;height:16px;box-shadow:0 0 0 1px #000;image-rendering:pixelated;background-image:url(${itemIconUrl(def)});background-size:cover;`;
    stage.appendChild(hand);
  }

  wrap.appendChild(stage);
  const label = document.createElement('div');
  label.style.cssText = `font-size:10px;font-family:${BODY_FONT};color:#333;`;
  label.textContent = 'Postava';
  wrap.appendChild(label);
  return wrap;
}

function craftArrow(): HTMLDivElement {
  const arrow = document.createElement('div');
  arrow.style.cssText = `width:0;height:0;border-top:10px solid transparent;border-bottom:10px solid transparent;border-left:16px solid ${STONE};filter:drop-shadow(1px 1px 0 #000);`;
  return arrow;
}

export type WorldBlockTarget = { x: number; y: number; z: number };

/** Owns the inventory + hotbar HUD + inventory/crafting-table/furnace
 * screens and the shared "held stack follows the cursor" interaction model
 * (same click-pick-up-then-click-place UX as vanilla Minecraft). */
export class GameUI {
  readonly inventory = new Inventory();
  private held: Slot = null;

  private hotbarEls: HTMLDivElement[] = [];
  private heldCursorEl: HTMLDivElement;

  private screenRoot: HTMLDivElement;
  private screenOpen = false;

  private craftGrid: Slot[] = [];
  private craftGridSize = 2; // 2 while using the personal grid, 3 with a table
  private craftOutput: Slot = null;
  private hasTable = false;

  private activeFurnacePos: WorldBlockTarget | null = null;
  private getFurnace: ((pos: WorldBlockTarget) => FurnaceState) | null = null;

  onCloseScreen: (() => void) | null = null;
  /** Fired whenever any screen (inventory/crafting table/furnace) opens —
   * the caller should release pointer lock here, otherwise the mouse stays
   * captured for camera-look and can't click on slots. */
  onOpenScreen: (() => void) | null = null;

  constructor() {
    this.buildHotbar();
    this.heldCursorEl = document.createElement('div');
    // Must render above screenRoot (z-index 1600) — this follows the cursor
    // while an item is picked up inside the inventory/crafting/furnace
    // screens, so a lower z-index made it invisible behind the panel the
    // moment you clicked a slot (looked like the item just vanished).
    this.heldCursorEl.style.cssText = 'position:fixed;width:36px;height:36px;pointer-events:none;z-index:1700;display:none;';
    document.body.appendChild(this.heldCursorEl);
    window.addEventListener('mousemove', (e) => {
      this.heldCursorEl.style.left = `${e.clientX - 18}px`;
      this.heldCursorEl.style.top = `${e.clientY - 18}px`;
    });

    this.screenRoot = document.createElement('div');
    this.screenRoot.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:none;align-items:center;justify-content:center;z-index:1600;font:13px monospace;color:#fff;';
    document.body.appendChild(this.screenRoot);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        if (this.screenOpen && this.craftGridSize === 2) this.close();
        else if (!this.screenOpen) this.openInventory();
      } else if (e.code === 'Escape' && this.screenOpen) {
        this.close();
      } else if (/^Digit[1-9]$/.test(e.code)) {
        this.inventory.selectedHotbarIndex = parseInt(e.code.replace('Digit', ''), 10) - 1;
        this.refreshHotbar();
      }
    });
    window.addEventListener('wheel', (e) => {
      if (this.screenOpen) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      this.inventory.selectedHotbarIndex = (this.inventory.selectedHotbarIndex + dir + HOTBAR_SIZE) % HOTBAR_SIZE;
      this.refreshHotbar();
    });
  }

  private buildHotbar() {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:50%;bottom:10px;transform:translateX(-50%);display:flex;gap:2px;z-index:10;background:rgba(0,0,0,0.25);padding:3px;';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = document.createElement('div');
      styleSlotEl(el, 44);
      bar.appendChild(el);
      this.hotbarEls.push(el);
    }
    document.body.appendChild(bar);
    this.refreshHotbar();
  }

  refreshHotbar() {
    const hotbar = this.inventory.getHotbar();
    hotbar.forEach((slot, i) => {
      renderSlotContent(this.hotbarEls[i], slot);
      this.hotbarEls[i].style.boxShadow = i === this.inventory.selectedHotbarIndex ? '0 0 0 1px #000, 0 0 0 3px #fff' : '0 0 0 1px #000';
    });
  }

  get isOpen() {
    return this.screenOpen;
  }

  get selectedItemId(): string | null {
    return this.inventory.selectedStack?.itemId ?? null;
  }

  /** Player broke a block / picked up an item drop. */
  giveItem(itemId: string, count = 1) {
    this.inventory.addItem(itemId, count);
    this.refreshHotbar();
  }

  /** Consumes one durability point off the currently-held tool, if any;
   * removes it from the hotbar slot once depleted. */
  damageSelectedTool() {
    const slot = this.inventory.selectedStack;
    if (!slot || slot.durability === undefined) return;
    slot.durability -= 1;
    if (slot.durability <= 0) this.inventory.slots[this.inventory.selectedHotbarIndex] = null;
    this.refreshHotbar();
  }

  private close() {
    this.screenOpen = false;
    this.screenRoot.style.display = 'none';
    this.returnCraftGridToInventory();
    // Whatever's still picked up on the cursor (e.g. a just-crafted item)
    // has to go back into the inventory here too — otherwise closing the
    // screen while holding something silently deleted it.
    if (this.held) {
      this.inventory.addItem(this.held.itemId, this.held.count);
      this.held = null;
      this.refreshHotbar();
    }
    this.activeFurnacePos = null;
    this.onCloseScreen?.();
  }

  private returnCraftGridToInventory() {
    for (const s of this.craftGrid) if (s) this.inventory.addItem(s.itemId, s.count);
    this.craftGrid = [];
    this.craftOutput = null;
  }

  openInventory() {
    this.hasTable = false;
    this.craftGridSize = 2;
    this.craftGrid = new Array(4).fill(null);
    this.craftOutput = null;
    this.screenOpen = true;
    this.onOpenScreen?.();
    this.render();
  }

  openCraftingTable() {
    this.hasTable = true;
    this.craftGridSize = 3;
    this.craftGrid = new Array(9).fill(null);
    this.craftOutput = null;
    this.screenOpen = true;
    this.onOpenScreen?.();
    this.render();
  }

  openFurnace(pos: WorldBlockTarget, getFurnace: (p: WorldBlockTarget) => FurnaceState) {
    this.activeFurnacePos = pos;
    this.getFurnace = getFurnace;
    this.screenOpen = true;
    this.onOpenScreen?.();
    this.renderFurnace();
  }

  /** Call once per frame while a furnace screen is open, so the progress bar animates. */
  tickFurnaceUI() {
    if (this.screenOpen && this.activeFurnacePos && this.getFurnace) this.renderFurnace();
  }

  private updateCraftOutput() {
    const match = matchRecipe(this.craftGrid, this.craftGridSize, this.craftGridSize, this.hasTable);
    this.craftOutput = match ? { itemId: match.resultItemId, count: match.resultCount } : null;
  }

  private onArmorSlotClick(slotIndex: number, right: boolean) {
    const expectedType = ARMOR_TYPES[slotIndex];
    const current = this.inventory.armorSlots[slotIndex];
    // Only let armor of the matching type (or nothing) land in this slot;
    // otherwise just let the pick-up/half-stack rules run normally.
    if (this.held && !current) {
      const heldDef = getItemDef(this.held.itemId);
      if (heldDef.armorType !== expectedType) return;
    }
    const res = Inventory.clickSlot(this.held, current, right);
    this.held = res.held;
    this.inventory.armorSlots[slotIndex] = res.slot;
    this.render();
  }

  private onInventorySlotClick(index: number, right: boolean) {
    const res = Inventory.clickSlot(this.held, this.inventory.slots[index], right);
    this.held = res.held;
    this.inventory.slots[index] = res.slot;
    this.render();
    this.refreshHotbar();
  }

  private onCraftSlotClick(index: number, right: boolean) {
    const res = Inventory.clickSlot(this.held, this.craftGrid[index], right);
    this.held = res.held;
    this.craftGrid[index] = res.slot;
    this.updateCraftOutput();
    this.render();
  }

  private onCraftOutputClick() {
    if (!this.craftOutput) return;
    if (this.held && (this.held.itemId !== this.craftOutput.itemId || this.held.durability !== undefined)) return;
    const takeCount = this.craftOutput.count;
    this.held = this.held
      ? { ...this.held, count: this.held.count + takeCount }
      : { itemId: this.craftOutput.itemId, count: takeCount };
    for (let i = 0; i < this.craftGrid.length; i++) {
      if (this.craftGrid[i]) {
        this.craftGrid[i]!.count -= 1;
        if (this.craftGrid[i]!.count <= 0) this.craftGrid[i] = null;
      }
    }
    this.updateCraftOutput();
    this.render();
  }

  private renderHeldCursor() {
    if (this.held) {
      this.heldCursorEl.style.display = 'block';
      const def = getItemDef(this.held.itemId);
      this.heldCursorEl.innerHTML = `<div style="width:100%;height:100%;background:${STONE};${bevel('raised', 1)}box-shadow:0 0 0 1px #000;box-sizing:border-box;image-rendering:pixelated;background-image:url(${itemIconUrl(def)});background-size:contain;background-repeat:no-repeat;background-position:center;display:flex;align-items:flex-end;justify-content:flex-end;font:bold 11px ${BODY_FONT};color:#fff;text-shadow:1px 1px 0 #000;"><span style="margin:2px;">${this.held.count > 1 ? this.held.count : ''}</span></div>`;
    } else {
      this.heldCursorEl.style.display = 'none';
    }
  }

  private render() {
    this.renderHeldCursor();
    this.screenRoot.style.display = 'flex';
    this.screenRoot.innerHTML = '';

    const panel = document.createElement('div');
    panel.style.cssText = panelStyle() + 'padding:16px;display:flex;flex-direction:column;gap:12px;';
    panel.addEventListener('click', (e) => e.stopPropagation());

    const title = document.createElement('div');
    title.textContent = this.hasTable ? 'Kombinovací stůl' : 'Inventář';
    title.style.cssText = `font-weight:bold;font-size:15px;font-family:${BODY_FONT};color:#222;`;
    panel.appendChild(title);

    const craftRow = document.createElement('div');
    craftRow.style.cssText = 'display:flex;align-items:center;gap:10px;';

    if (!this.hasTable) {
      const characterPanel = document.createElement('div');
      characterPanel.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin-right:6px;';
      characterPanel.appendChild(buildCharacterPreview(this.inventory));

      const armorCol = document.createElement('div');
      armorCol.style.cssText = 'display:grid;grid-template-columns:repeat(1,40px);gap:2px;background:rgba(0,0,0,0.15);padding:4px;';
      const ARMOR_LABEL: Record<string, string> = { helmet: 'HL', chestplate: 'CH', leggings: 'LG', boots: 'BT' };
      ARMOR_TYPES.forEach((type, i) => {
        const el = document.createElement('div');
        styleSlotEl(el);
        renderSlotContent(el, this.inventory.armorSlots[i]);
        if (!this.inventory.armorSlots[i]) {
          const placeholder = document.createElement('div');
          placeholder.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:8px ${BODY_FONT};color:rgba(0,0,0,0.35);pointer-events:none;`;
          placeholder.textContent = ARMOR_LABEL[type];
          el.appendChild(placeholder);
        }
        el.addEventListener('click', () => {
          soundEngine.uiClick();
          this.onArmorSlotClick(i, false);
        });
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          soundEngine.uiClick();
          this.onArmorSlotClick(i, true);
        });
        armorCol.appendChild(el);
      });
      characterPanel.appendChild(armorCol);
      craftRow.appendChild(characterPanel);
    }

    const craftGridWidget = makeSlotGrid(this.craftGrid.length, this.craftGridSize, (i, r) => this.onCraftSlotClick(i, r));
    craftGridWidget.els.forEach((el, i) => renderSlotContent(el, this.craftGrid[i]));
    craftRow.appendChild(craftGridWidget.root);
    craftRow.appendChild(craftArrow());

    const outputEl = document.createElement('div');
    styleSlotEl(outputEl);
    renderSlotContent(outputEl, this.craftOutput);
    outputEl.addEventListener('click', () => {
      soundEngine.craft();
      this.onCraftOutputClick();
    });
    craftRow.appendChild(outputEl);
    panel.appendChild(craftRow);

    const storageGrid = makeSlotGrid(this.inventory.getStorage().length, 9, (i, r) => this.onInventorySlotClick(i + HOTBAR_SIZE, r));
    storageGrid.els.forEach((el, i) => renderSlotContent(el, this.inventory.getStorage()[i]));
    panel.appendChild(storageGrid.root);

    const hotbarGrid = makeSlotGrid(HOTBAR_SIZE, 9, (i, r) => this.onInventorySlotClick(i, r));
    hotbarGrid.els.forEach((el, i) => renderSlotContent(el, this.inventory.getHotbar()[i]));
    panel.appendChild(hotbarGrid.root);

    const hint = document.createElement('div');
    hint.style.cssText = `font-size:11px;opacity:0.75;font-family:${BODY_FONT};color:#333;`;
    hint.textContent = 'E / Esc zavřít · levé tlačítko sebrat/položit celý stack · pravé tlačítko polovinu';
    panel.appendChild(hint);

    this.screenRoot.appendChild(panel);
    this.screenRoot.onclick = () => this.close();
  }

  private renderFurnace() {
    if (!this.activeFurnacePos || !this.getFurnace) return;
    const state = this.getFurnace(this.activeFurnacePos);
    this.renderHeldCursor();
    this.screenRoot.style.display = 'flex';
    this.screenRoot.innerHTML = '';

    const panel = document.createElement('div');
    panel.style.cssText = panelStyle() + 'padding:16px;display:flex;flex-direction:column;gap:12px;';
    panel.addEventListener('click', (e) => e.stopPropagation());

    const title = document.createElement('div');
    title.textContent = 'Pec';
    title.style.cssText = `font-weight:bold;font-size:15px;font-family:${BODY_FONT};color:#222;`;
    panel.appendChild(title);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;';

    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:4px;align-items:center;';
    const inputEl = document.createElement('div');
    styleSlotEl(inputEl);
    renderSlotContent(inputEl, state.input);
    inputEl.addEventListener('click', () => {
      soundEngine.uiClick();
      const res = Inventory.clickSlot(this.held, state.input, false);
      this.held = res.held;
      state.input = res.slot;
      this.renderFurnace();
    });
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `width:36px;height:6px;background:#111;${bevel('sunken', 1)}box-sizing:border-box;`;
    const progressFill = document.createElement('div');
    progressFill.style.cssText = `width:${state.smeltProgress * 100}%;height:100%;background:#e94;`;
    progressBar.appendChild(progressFill);
    const fuelEl = document.createElement('div');
    styleSlotEl(fuelEl);
    renderSlotContent(fuelEl, state.fuel);
    fuelEl.addEventListener('click', () => {
      soundEngine.uiClick();
      const res = Inventory.clickSlot(this.held, state.fuel, false);
      this.held = res.held;
      state.fuel = res.slot;
      this.renderFurnace();
    });
    const flame = document.createElement('div');
    flame.textContent = state.burnTimeRemaining > 0 ? '🔥' : '·';
    col.append(inputEl, progressBar, flame, fuelEl);
    row.appendChild(col);
    row.appendChild(craftArrow());

    const outputEl = document.createElement('div');
    styleSlotEl(outputEl);
    renderSlotContent(outputEl, state.output);
    outputEl.addEventListener('click', () => {
      soundEngine.craft();
      const res = Inventory.clickSlot(this.held, state.output, false);
      this.held = res.held;
      state.output = res.slot;
      this.renderFurnace();
    });
    row.appendChild(outputEl);
    panel.appendChild(row);

    const hotbarGrid = makeSlotGrid(HOTBAR_SIZE, 9, (i, r) => {
      this.onInventorySlotClick(i, r);
      this.renderFurnace();
    });
    hotbarGrid.els.forEach((el, i) => renderSlotContent(el, this.inventory.getHotbar()[i]));
    panel.appendChild(hotbarGrid.root);

    const hint = document.createElement('div');
    hint.style.cssText = `font-size:11px;opacity:0.75;font-family:${BODY_FONT};color:#333;`;
    hint.textContent = 'E / Esc zavřít';
    panel.appendChild(hint);

    this.screenRoot.appendChild(panel);
    this.screenRoot.onclick = () => this.close();
  }
}

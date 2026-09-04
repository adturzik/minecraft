import { Inventory, Slot, HOTBAR_SIZE, ARMOR_TYPES } from '../game/player/inventory';
import { getItemDef, ItemDef, ITEMS } from '../game/items/items';
import { matchRecipe } from '../game/crafting/craftingMatcher';
import { FurnaceState } from '../game/crafting/furnaceManager';
import { slotStyle, panelStyle, BODY_FONT, bevel, STONE, buttonStyle, attachButtonHover } from './pixelStyle';
import { soundEngine } from '../audio/soundEngine';
import { itemIconUrl } from './itemIcons';
import type { GameMode } from '../game/player/gameMode';

type CreativeTab = 'blocks' | 'tools' | 'combat' | 'food' | 'materials';
const CREATIVE_TAB_LABEL: Record<CreativeTab, string> = {
  blocks: 'Bloky',
  tools: 'Nástroje',
  combat: 'Boj',
  food: 'Jídlo',
  materials: 'Materiály',
};

function itemCategory(def: ItemDef): CreativeTab {
  if (def.armorType || def.toolType === 'sword' || def.id === 'bow' || def.id === 'arrow') return 'combat';
  if (def.toolType) return 'tools';
  if (def.foodRestore) return 'food';
  if (def.isBlock) return 'blocks';
  return 'materials';
}

const CREATIVE_ITEMS_BY_TAB: Record<CreativeTab, ItemDef[]> = { blocks: [], tools: [], combat: [], food: [], materials: [] };
for (const def of ITEMS) CREATIVE_ITEMS_BY_TAB[itemCategory(def)].push(def);

// One shared floating tooltip element for every item slot in the game --
// hotbar, inventory, crafting, furnace, armor, and the creative palette all
// funnel through renderSlotContent/styleSlotEl below, so wiring it there
// covers every screen at once instead of once per widget.
let tooltipEl: HTMLDivElement | null = null;
function getTooltipEl(): HTMLDivElement {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.style.cssText = `position:fixed;pointer-events:none;z-index:1800;${panelStyle()}padding:4px 8px;font:12px ${BODY_FONT};color:#fff;white-space:nowrap;display:none;`;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}
function positionTooltip(e: MouseEvent) {
  const el = getTooltipEl();
  el.style.left = `${e.clientX + 14}px`;
  el.style.top = `${e.clientY + 14}px`;
}
function hideTooltip() {
  if (tooltipEl) tooltipEl.style.display = 'none';
}

/** Small pop-in transition for a freshly (re)built screen panel -- every
 * inventory/crafting/furnace render() call rebuilds screenRoot from scratch,
 * so this runs once per open/tab-switch rather than being a persistent
 * animation. */
function animateIn(panel: HTMLDivElement) {
  panel.style.transition = 'opacity 0.1s ease-out, transform 0.1s ease-out';
  panel.style.opacity = '0';
  panel.style.transform = 'scale(0.96)';
  requestAnimationFrame(() => {
    panel.style.opacity = '1';
    panel.style.transform = 'scale(1)';
  });
}

type SlotEl = HTMLDivElement & { _slotItem?: Slot };

function styleSlotEl(el: HTMLDivElement, size = 40) {
  el.style.cssText = slotStyle(size) + 'cursor:pointer;user-select:none;';
  el.addEventListener('mouseenter', (e) => {
    const slot = (el as SlotEl)._slotItem;
    if (!slot) return;
    const def = getItemDef(slot.itemId);
    const tip = getTooltipEl();
    tip.textContent = def.name;
    tip.style.display = 'block';
    positionTooltip(e as MouseEvent);
  });
  el.addEventListener('mousemove', (e) => {
    if ((el as SlotEl)._slotItem) positionTooltip(e as MouseEvent);
  });
  el.addEventListener('mouseleave', hideTooltip);
}

function renderSlotContent(el: HTMLDivElement, slot: Slot) {
  (el as SlotEl)._slotItem = slot;
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
  private gameMode: GameMode;
  private creativeTab: CreativeTab = 'blocks';

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

  constructor(gameMode: GameMode = 'survival') {
    this.gameMode = gameMode;
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
    hideTooltip();
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
    if (this.gameMode === 'creative') this.renderCreative();
    else this.render();
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

  private buildCharacterPanel(): HTMLDivElement {
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
    return characterPanel;
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

    if (!this.hasTable) craftRow.appendChild(this.buildCharacterPanel());

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
    animateIn(panel);
    this.screenRoot.onclick = () => this.close();
  }

  /** Creative has no hand-crafting grid -- instead a tabbed item palette
   * (matching vanilla's creative inventory) lets you click any item/block
   * to get a full stack of it straight away. Storage/armor/hotbar stay the
   * same widgets as survival so mob drops and equipped gear still work. */
  private renderCreative() {
    this.renderHeldCursor();
    this.screenRoot.style.display = 'flex';
    this.screenRoot.innerHTML = '';

    const panel = document.createElement('div');
    panel.style.cssText = panelStyle() + 'padding:16px;display:flex;flex-direction:column;gap:10px;width:400px;';
    panel.addEventListener('click', (e) => e.stopPropagation());

    const title = document.createElement('div');
    title.textContent = 'Kreativní inventář';
    title.style.cssText = `font-weight:bold;font-size:15px;font-family:${BODY_FONT};color:#222;`;
    panel.appendChild(title);

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';
    topRow.appendChild(this.buildCharacterPanel());

    const paletteCol = document.createElement('div');
    paletteCol.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:1;';

    const tabRow = document.createElement('div');
    tabRow.style.cssText = 'display:flex;gap:2px;';
    (Object.keys(CREATIVE_TAB_LABEL) as CreativeTab[]).forEach((tab) => {
      const b = document.createElement('button');
      b.textContent = CREATIVE_TAB_LABEL[tab];
      b.style.cssText = buttonStyle('small') + `flex:1;padding:4px 2px;font-size:10px;${tab === this.creativeTab ? 'filter:brightness(1.3);' : ''}`;
      attachButtonHover(b);
      b.addEventListener('click', () => {
        soundEngine.uiClick();
        this.creativeTab = tab;
        this.renderCreative();
      });
      tabRow.appendChild(b);
    });
    paletteCol.appendChild(tabRow);

    const paletteGrid = document.createElement('div');
    paletteGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,40px);gap:2px;background:rgba(0,0,0,0.15);padding:4px;max-height:180px;overflow-y:auto;';
    for (const def of CREATIVE_ITEMS_BY_TAB[this.creativeTab]) {
      const el = document.createElement('div');
      styleSlotEl(el);
      renderSlotContent(el, { itemId: def.id, count: 1 });
      el.addEventListener('click', () => {
        soundEngine.uiClick();
        this.giveItem(def.id, def.stackSize);
        this.renderCreative();
      });
      paletteGrid.appendChild(el);
    }
    paletteCol.appendChild(paletteGrid);
    topRow.appendChild(paletteCol);
    panel.appendChild(topRow);

    const storageGrid = makeSlotGrid(this.inventory.getStorage().length, 9, (i, r) => {
      this.onInventorySlotClick(i + HOTBAR_SIZE, r);
      this.renderCreative();
    });
    storageGrid.els.forEach((el, i) => renderSlotContent(el, this.inventory.getStorage()[i]));
    panel.appendChild(storageGrid.root);

    const hotbarGrid = makeSlotGrid(HOTBAR_SIZE, 9, (i, r) => {
      this.onInventorySlotClick(i, r);
      this.renderCreative();
    });
    hotbarGrid.els.forEach((el, i) => renderSlotContent(el, this.inventory.getHotbar()[i]));
    panel.appendChild(hotbarGrid.root);

    const hint = document.createElement('div');
    hint.style.cssText = `font-size:11px;opacity:0.75;font-family:${BODY_FONT};color:#333;`;
    hint.textContent = 'E / Esc zavřít · klikni na věc v paletě pro celý stack · nekonečné bloky, žádné poškození';
    panel.appendChild(hint);

    this.screenRoot.appendChild(panel);
    animateIn(panel);
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
    animateIn(panel);
    this.screenRoot.onclick = () => this.close();
  }
}

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

/** Small pop-in transition for a freshly built screen panel. Screens are now
 * built once per open (see GameUI's builtScreen tracking) and merely have
 * their slot *contents* refreshed on every click/tick after that, so this
 * only ever runs once per open/tab-switch instead of on every interaction --
 * running it on every click (the previous behavior, when every click tore
 * the whole panel down and rebuilt it) was what made the whole screen
 * visibly flicker/re-pop-in constantly. */
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
  swatch.style.cssText = `position:absolute;inset:3px;${bevel('raised', 1)}box-sizing:border-box;image-rendering:auto;background-image:url(${itemIconUrl(def)});background-size:contain;background-repeat:no-repeat;background-position:center;`;
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

interface CharacterPreview {
  el: HTMLDivElement;
  refresh: () => void;
}

/** Blocky front-facing character silhouette (head/torso/arms/legs/boots as
 * flat rectangles, matching the rest of the UI's flat-swatch look). Colors
 * reflect whatever's equipped in armorSlots, and the right hand shows the
 * currently-selected hotbar item. Built once; `refresh()` re-colors the same
 * DOM nodes in place instead of tearing the preview down on every change. */
function buildCharacterPreview(inventory: Inventory): CharacterPreview {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';

  const stage = document.createElement('div');
  stage.style.cssText = `position:relative;width:84px;height:132px;background:rgba(0,0,0,0.15);${bevel('sunken', 2)}box-sizing:border-box;`;

  type PartKind = 'helmet' | 'chest' | 'legs' | 'boots';
  const parts: { el: HTMLDivElement; kind: PartKind }[] = [];
  const part = (css: string, kind: PartKind) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.4);${css}`;
    stage.appendChild(d);
    parts.push({ el: d, kind });
  };

  part('left:30px;top:4px;width:24px;height:24px;', 'helmet');
  part('left:22px;top:30px;width:40px;height:44px;', 'chest'); // torso
  part('left:10px;top:30px;width:12px;height:44px;', 'chest'); // left arm sleeve
  const rightArm = document.createElement('div'); // bare arm holding the item, never re-tinted
  rightArm.style.cssText = `position:absolute;left:62px;top:30px;width:12px;height:44px;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.4);background:${SKIN_COLOR};`;
  stage.appendChild(rightArm);
  part('left:22px;top:76px;width:18px;height:30px;', 'legs');
  part('left:44px;top:76px;width:18px;height:30px;', 'legs');
  part('left:22px;top:106px;width:18px;height:8px;', 'boots');
  part('left:44px;top:106px;width:18px;height:8px;', 'boots');

  const hand = document.createElement('div');
  hand.style.cssText = 'position:absolute;left:60px;top:66px;width:16px;height:16px;box-shadow:0 0 0 1px #000;background-size:cover;display:none;';
  stage.appendChild(hand);

  wrap.appendChild(stage);
  const label = document.createElement('div');
  label.style.cssText = `font-size:10px;font-family:${BODY_FONT};color:#333;`;
  label.textContent = 'Postava';
  wrap.appendChild(label);

  const COLOR_FOR: Record<PartKind, () => string> = {
    helmet: () => armorPieceColor(inventory.armorSlots[0]) ?? SKIN_COLOR,
    chest: () => armorPieceColor(inventory.armorSlots[1]) ?? SHIRT_COLOR,
    legs: () => armorPieceColor(inventory.armorSlots[2]) ?? PANTS_COLOR,
    boots: () => armorPieceColor(inventory.armorSlots[3]) ?? BOOTS_COLOR,
  };

  const refresh = () => {
    for (const { el, kind } of parts) el.style.background = COLOR_FOR[kind]();
    const heldStack = inventory.selectedStack;
    if (heldStack) {
      const def = getItemDef(heldStack.itemId);
      hand.style.display = 'block';
      hand.style.backgroundImage = `url(${itemIconUrl(def)})`;
    } else {
      hand.style.display = 'none';
    }
  };
  refresh();

  return { el: wrap, refresh };
}

function craftArrow(): HTMLDivElement {
  const arrow = document.createElement('div');
  arrow.style.cssText = `width:0;height:0;border-top:10px solid transparent;border-bottom:10px solid transparent;border-left:16px solid ${STONE};filter:drop-shadow(1px 1px 0 #000);`;
  return arrow;
}

export type WorldBlockTarget = { x: number; y: number; z: number };

const ARMOR_LABEL: Record<string, string> = { helmet: 'HL', chestplate: 'CH', leggings: 'LG', boots: 'BT' };

interface CharacterPanel {
  el: HTMLDivElement;
  refresh: () => void;
}

interface InventoryScreenRefs {
  craftEls: HTMLDivElement[];
  outputEl: HTMLDivElement;
  storageEls: HTMLDivElement[];
  hotbarEls: HTMLDivElement[];
}

interface CreativeScreenRefs {
  paletteGrid: HTMLDivElement;
  storageEls: HTMLDivElement[];
  hotbarEls: HTMLDivElement[];
  tabButtons: HTMLButtonElement[];
}

interface FurnaceScreenRefs {
  inputEl: HTMLDivElement;
  fuelEl: HTMLDivElement;
  outputEl: HTMLDivElement;
  progressFill: HTMLDivElement;
  flame: HTMLDivElement;
  hotbarEls: HTMLDivElement[];
}

type BuiltScreen = 'inventory' | 'creative' | 'furnace' | null;

/** Owns the inventory + hotbar HUD + inventory/crafting-table/furnace
 * screens and the shared "held stack follows the cursor" interaction model
 * (same click-pick-up-then-click-place UX as vanilla Minecraft).
 *
 * Each screen is built once per open (see builtScreen) and every later
 * click/tick only updates the already-built slot elements' *contents* in
 * place -- never re-running screenRoot.innerHTML='' -- since a full
 * teardown+rebuild on every interaction (and, for the furnace, on every
 * single frame via tickFurnaceUI) is what made these screens visibly
 * flicker/re-pop-in constantly. */
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

  private builtScreen: BuiltScreen = null;
  private characterPanel: CharacterPanel | null = null;
  private inventoryRefs: InventoryScreenRefs | null = null;
  private creativeRefs: CreativeScreenRefs | null = null;
  private furnaceRefs: FurnaceScreenRefs | null = null;

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
    this.builtScreen = null;
    this.characterPanel = null;
    this.inventoryRefs = null;
    this.creativeRefs = null;
    this.furnaceRefs = null;
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
    this.builtScreen = null; // force a fresh build for this screen shape
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
    this.builtScreen = null;
    this.onOpenScreen?.();
    this.render();
  }

  openFurnace(pos: WorldBlockTarget, getFurnace: (p: WorldBlockTarget) => FurnaceState) {
    this.activeFurnacePos = pos;
    this.getFurnace = getFurnace;
    this.screenOpen = true;
    this.builtScreen = null;
    this.onOpenScreen?.();
    this.renderFurnace();
  }

  /** Call once per frame while a furnace screen is open, so the progress bar
   * animates. Cheap now: the screen was already built on open, this just
   * refreshes slot contents/progress in place. */
  tickFurnaceUI() {
    if (this.screenOpen && this.activeFurnacePos && this.getFurnace) this.renderFurnace();
  }

  private updateCraftOutput() {
    const match = matchRecipe(this.craftGrid, this.craftGridSize, this.craftGridSize, this.hasTable);
    this.craftOutput = match ? { itemId: match.resultItemId, count: match.resultCount } : null;
  }

  /** Refreshes whichever screen is currently built, without rebuilding it —
   * used by handlers (armor equip, crafting) that can fire from more than
   * one screen. */
  private refreshCurrentScreen() {
    this.renderHeldCursor();
    if (this.builtScreen === 'inventory') this.refreshInventoryScreen();
    else if (this.builtScreen === 'creative') this.refreshCreativeScreen();
    else if (this.builtScreen === 'furnace' && this.activeFurnacePos && this.getFurnace) {
      this.refreshFurnaceScreen(this.getFurnace(this.activeFurnacePos));
    }
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
    this.refreshCurrentScreen();
  }

  private onInventorySlotClick(index: number, right: boolean) {
    const res = Inventory.clickSlot(this.held, this.inventory.slots[index], right);
    this.held = res.held;
    this.inventory.slots[index] = res.slot;
    this.refreshHotbar();
  }

  private onCraftSlotClick(index: number, right: boolean) {
    const res = Inventory.clickSlot(this.held, this.craftGrid[index], right);
    this.held = res.held;
    this.craftGrid[index] = res.slot;
    this.updateCraftOutput();
    this.refreshCurrentScreen();
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
    this.refreshCurrentScreen();
  }

  private renderHeldCursor() {
    if (this.held) {
      this.heldCursorEl.style.display = 'block';
      const def = getItemDef(this.held.itemId);
      this.heldCursorEl.innerHTML = `<div style="width:100%;height:100%;background:${STONE};${bevel('raised', 1)}box-shadow:0 0 0 1px #000;box-sizing:border-box;image-rendering:auto;background-image:url(${itemIconUrl(def)});background-size:contain;background-repeat:no-repeat;background-position:center;display:flex;align-items:flex-end;justify-content:flex-end;font:bold 11px ${BODY_FONT};color:#fff;text-shadow:1px 1px 0 #000;"><span style="margin:2px;">${this.held.count > 1 ? this.held.count : ''}</span></div>`;
    } else {
      this.heldCursorEl.style.display = 'none';
    }
  }

  /** Builds the character preview + armor slots once; returns a refresh()
   * that re-colors/re-icons the same nodes for later armor/held-item
   * changes. Stored on `this.characterPanel` by whichever screen builds it. */
  private buildCharacterPanel(): CharacterPanel {
    const characterPanel = document.createElement('div');
    characterPanel.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin-right:6px;';
    const preview = buildCharacterPreview(this.inventory);
    characterPanel.appendChild(preview.el);

    const armorCol = document.createElement('div');
    armorCol.style.cssText = 'display:grid;grid-template-columns:repeat(1,40px);gap:2px;background:rgba(0,0,0,0.15);padding:4px;';
    const armorEls: HTMLDivElement[] = [];
    ARMOR_TYPES.forEach((type, i) => {
      const el = document.createElement('div');
      styleSlotEl(el);
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
      armorEls.push(el);
    });
    characterPanel.appendChild(armorCol);

    const refresh = () => {
      preview.refresh();
      armorEls.forEach((el, i) => {
        const type = ARMOR_TYPES[i];
        renderSlotContent(el, this.inventory.armorSlots[i]);
        let placeholder = el.querySelector('.armor-placeholder') as HTMLDivElement | null;
        if (!this.inventory.armorSlots[i]) {
          if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'armor-placeholder';
            placeholder.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:8px ${BODY_FONT};color:rgba(0,0,0,0.35);pointer-events:none;`;
            el.appendChild(placeholder);
          }
          placeholder.textContent = ARMOR_LABEL[type];
        } else {
          placeholder?.remove();
        }
      });
    };
    refresh();

    return { el: characterPanel, refresh };
  }

  // ---------------- inventory / crafting-table screen ----------------

  private render() {
    this.renderHeldCursor();
    this.screenRoot.style.display = 'flex';
    if (this.builtScreen !== 'inventory' || !this.inventoryRefs) {
      this.buildInventoryScreen();
      this.builtScreen = 'inventory';
    }
    this.refreshInventoryScreen();
  }

  private buildInventoryScreen() {
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
      this.characterPanel = this.buildCharacterPanel();
      craftRow.appendChild(this.characterPanel.el);
    } else {
      this.characterPanel = null;
    }

    const craftGridWidget = makeSlotGrid(this.craftGrid.length, this.craftGridSize, (i, r) => {
      this.onCraftSlotClick(i, r);
    });
    craftRow.appendChild(craftGridWidget.root);
    craftRow.appendChild(craftArrow());

    const outputEl = document.createElement('div');
    styleSlotEl(outputEl);
    outputEl.addEventListener('click', () => {
      soundEngine.craft();
      this.onCraftOutputClick();
    });
    craftRow.appendChild(outputEl);
    panel.appendChild(craftRow);

    const storageGrid = makeSlotGrid(this.inventory.getStorage().length, 9, (i, r) => {
      this.onInventorySlotClick(i + HOTBAR_SIZE, r);
      this.refreshInventoryScreen();
    });
    panel.appendChild(storageGrid.root);

    const hotbarGrid = makeSlotGrid(HOTBAR_SIZE, 9, (i, r) => {
      this.onInventorySlotClick(i, r);
      this.refreshInventoryScreen();
    });
    panel.appendChild(hotbarGrid.root);

    const hint = document.createElement('div');
    hint.style.cssText = `font-size:11px;opacity:0.75;font-family:${BODY_FONT};color:#333;`;
    hint.textContent = 'E / Esc zavřít · levé tlačítko sebrat/položit celý stack · pravé tlačítko polovinu';
    panel.appendChild(hint);

    this.screenRoot.appendChild(panel);
    animateIn(panel);
    this.screenRoot.onclick = () => this.close();

    this.inventoryRefs = {
      craftEls: craftGridWidget.els,
      outputEl,
      storageEls: storageGrid.els,
      hotbarEls: hotbarGrid.els,
    };
  }

  private refreshInventoryScreen() {
    this.renderHeldCursor();
    const refs = this.inventoryRefs;
    if (!refs) return;
    refs.craftEls.forEach((el, i) => renderSlotContent(el, this.craftGrid[i]));
    renderSlotContent(refs.outputEl, this.craftOutput);
    refs.storageEls.forEach((el, i) => renderSlotContent(el, this.inventory.getStorage()[i]));
    refs.hotbarEls.forEach((el, i) => renderSlotContent(el, this.inventory.getHotbar()[i]));
    this.characterPanel?.refresh();
  }

  // ---------------- creative palette screen ----------------

  /** Creative has no hand-crafting grid -- instead a tabbed item palette
   * (matching vanilla's creative inventory) lets you click any item/block
   * to get a full stack of it straight away. Storage/armor/hotbar stay the
   * same widgets as survival so mob drops and equipped gear still work. */
  private renderCreative() {
    this.renderHeldCursor();
    this.screenRoot.style.display = 'flex';
    if (this.builtScreen !== 'creative' || !this.creativeRefs) {
      this.buildCreativeScreen();
      this.builtScreen = 'creative';
    }
    this.refreshCreativeScreen();
  }

  private buildCreativeScreen() {
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
    this.characterPanel = this.buildCharacterPanel();
    topRow.appendChild(this.characterPanel.el);

    const paletteCol = document.createElement('div');
    paletteCol.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:1;';

    const tabRow = document.createElement('div');
    tabRow.style.cssText = 'display:flex;gap:2px;';
    const tabButtons: HTMLButtonElement[] = [];
    (Object.keys(CREATIVE_TAB_LABEL) as CreativeTab[]).forEach((tab) => {
      const b = document.createElement('button');
      b.textContent = CREATIVE_TAB_LABEL[tab];
      b.style.cssText = buttonStyle('small') + 'flex:1;padding:4px 2px;font-size:10px;';
      attachButtonHover(b);
      b.addEventListener('click', () => {
        soundEngine.uiClick();
        this.creativeTab = tab;
        this.rebuildCreativePalette();
        this.refreshCreativeTabHighlight();
      });
      tabRow.appendChild(b);
      tabButtons.push(b);
    });
    paletteCol.appendChild(tabRow);

    const paletteGrid = document.createElement('div');
    paletteGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,40px);gap:2px;background:rgba(0,0,0,0.15);padding:4px;max-height:180px;overflow-y:auto;';
    paletteCol.appendChild(paletteGrid);
    topRow.appendChild(paletteCol);
    panel.appendChild(topRow);

    const storageGrid = makeSlotGrid(this.inventory.getStorage().length, 9, (i, r) => {
      this.onInventorySlotClick(i + HOTBAR_SIZE, r);
      this.refreshCreativeScreen();
    });
    panel.appendChild(storageGrid.root);

    const hotbarGrid = makeSlotGrid(HOTBAR_SIZE, 9, (i, r) => {
      this.onInventorySlotClick(i, r);
      this.refreshCreativeScreen();
    });
    panel.appendChild(hotbarGrid.root);

    const hint = document.createElement('div');
    hint.style.cssText = `font-size:11px;opacity:0.75;font-family:${BODY_FONT};color:#333;`;
    hint.textContent = 'E / Esc zavřít · klikni na věc v paletě pro celý stack · nekonečné bloky, žádné poškození';
    panel.appendChild(hint);

    this.screenRoot.appendChild(panel);
    animateIn(panel);
    this.screenRoot.onclick = () => this.close();

    this.creativeRefs = { paletteGrid, storageEls: storageGrid.els, hotbarEls: hotbarGrid.els, tabButtons };
    this.rebuildCreativePalette();
    this.refreshCreativeTabHighlight();
  }

  /** Only the item palette grid needs rebuilding on a tab switch (different
   * item list) -- everything else in the screen stays untouched. */
  private rebuildCreativePalette() {
    const refs = this.creativeRefs;
    if (!refs) return;
    refs.paletteGrid.innerHTML = '';
    for (const def of CREATIVE_ITEMS_BY_TAB[this.creativeTab]) {
      const el = document.createElement('div');
      styleSlotEl(el);
      renderSlotContent(el, { itemId: def.id, count: 1 });
      el.addEventListener('click', () => {
        soundEngine.uiClick();
        this.giveItem(def.id, def.stackSize);
        this.refreshCreativeScreen();
      });
      refs.paletteGrid.appendChild(el);
    }
  }

  private refreshCreativeTabHighlight() {
    const refs = this.creativeRefs;
    if (!refs) return;
    const tabs = Object.keys(CREATIVE_TAB_LABEL) as CreativeTab[];
    refs.tabButtons.forEach((b, i) => {
      b.style.filter = tabs[i] === this.creativeTab ? 'brightness(1.3)' : 'none';
    });
  }

  private refreshCreativeScreen() {
    this.renderHeldCursor();
    const refs = this.creativeRefs;
    if (!refs) return;
    refs.storageEls.forEach((el, i) => renderSlotContent(el, this.inventory.getStorage()[i]));
    refs.hotbarEls.forEach((el, i) => renderSlotContent(el, this.inventory.getHotbar()[i]));
    this.characterPanel?.refresh();
  }

  // ---------------- furnace screen ----------------

  private renderFurnace() {
    if (!this.activeFurnacePos || !this.getFurnace) return;
    const state = this.getFurnace(this.activeFurnacePos);
    this.renderHeldCursor();
    this.screenRoot.style.display = 'flex';
    if (this.builtScreen !== 'furnace' || !this.furnaceRefs) {
      this.buildFurnaceScreen();
      this.builtScreen = 'furnace';
    }
    this.refreshFurnaceScreen(state);
  }

  private buildFurnaceScreen() {
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
    inputEl.addEventListener('click', () => {
      soundEngine.uiClick();
      const st = this.getFurnace!(this.activeFurnacePos!);
      const res = Inventory.clickSlot(this.held, st.input, false);
      this.held = res.held;
      st.input = res.slot;
      this.refreshFurnaceScreen(st);
    });
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `width:36px;height:6px;background:#111;${bevel('sunken', 1)}box-sizing:border-box;`;
    const progressFill = document.createElement('div');
    progressFill.style.cssText = 'height:100%;background:#e94;';
    progressBar.appendChild(progressFill);
    const fuelEl = document.createElement('div');
    styleSlotEl(fuelEl);
    fuelEl.addEventListener('click', () => {
      soundEngine.uiClick();
      const st = this.getFurnace!(this.activeFurnacePos!);
      const res = Inventory.clickSlot(this.held, st.fuel, false);
      this.held = res.held;
      st.fuel = res.slot;
      this.refreshFurnaceScreen(st);
    });
    const flame = document.createElement('div');
    col.append(inputEl, progressBar, flame, fuelEl);
    row.appendChild(col);
    row.appendChild(craftArrow());

    const outputEl = document.createElement('div');
    styleSlotEl(outputEl);
    outputEl.addEventListener('click', () => {
      soundEngine.craft();
      const st = this.getFurnace!(this.activeFurnacePos!);
      const res = Inventory.clickSlot(this.held, st.output, false);
      this.held = res.held;
      st.output = res.slot;
      this.refreshFurnaceScreen(st);
    });
    row.appendChild(outputEl);
    panel.appendChild(row);

    const hotbarGrid = makeSlotGrid(HOTBAR_SIZE, 9, (i, r) => {
      this.onInventorySlotClick(i, r);
      if (this.activeFurnacePos && this.getFurnace) this.refreshFurnaceScreen(this.getFurnace(this.activeFurnacePos));
    });
    panel.appendChild(hotbarGrid.root);

    const hint = document.createElement('div');
    hint.style.cssText = `font-size:11px;opacity:0.75;font-family:${BODY_FONT};color:#333;`;
    hint.textContent = 'E / Esc zavřít';
    panel.appendChild(hint);

    this.screenRoot.appendChild(panel);
    animateIn(panel);
    this.screenRoot.onclick = () => this.close();

    this.furnaceRefs = { inputEl, fuelEl, outputEl, progressFill, flame, hotbarEls: hotbarGrid.els };
  }

  private refreshFurnaceScreen(state: FurnaceState) {
    this.renderHeldCursor();
    const refs = this.furnaceRefs;
    if (!refs) return;
    renderSlotContent(refs.inputEl, state.input);
    renderSlotContent(refs.fuelEl, state.fuel);
    renderSlotContent(refs.outputEl, state.output);
    refs.progressFill.style.width = `${state.smeltProgress * 100}%`;
    refs.flame.textContent = state.burnTimeRemaining > 0 ? '🔥' : '·';
    refs.hotbarEls.forEach((el, i) => renderSlotContent(el, this.inventory.getHotbar()[i]));
  }
}

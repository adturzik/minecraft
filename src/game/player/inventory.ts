import { getItemDef } from '../items/items';

export interface ItemStack {
  itemId: string;
  count: number;
  durability?: number; // present only for tools; current remaining uses
}
export type Slot = ItemStack | null;

export const HOTBAR_SIZE = 9;
export const STORAGE_SIZE = 27;
export const TOTAL_SLOTS = HOTBAR_SIZE + STORAGE_SIZE;

export const ARMOR_TYPES = ['helmet', 'chestplate', 'leggings', 'boots'] as const;

/** Slots 0-8 = hotbar, 9-35 = main storage (matches vanilla Minecraft's
 * layout closely enough for a single flat array to back both views).
 * Armor lives in its own 4-slot array (helmet/chestplate/leggings/boots),
 * separate from the 36 general-purpose slots. */
export class Inventory {
  slots: Slot[] = new Array(TOTAL_SLOTS).fill(null);
  armorSlots: Slot[] = new Array(4).fill(null);
  selectedHotbarIndex = 0;

  /** Sum of every equipped piece's `defense` stat. No durability loss on
   * armor yet (kept simple for MVP) — see PROGRESS.md. */
  getTotalDefense(): number {
    let total = 0;
    for (const slot of this.armorSlots) {
      if (!slot) continue;
      total += getItemDef(slot.itemId).defense ?? 0;
    }
    return total;
  }

  get selectedStack(): Slot {
    return this.slots[this.selectedHotbarIndex];
  }

  getHotbar(): Slot[] {
    return this.slots.slice(0, HOTBAR_SIZE);
  }

  getStorage(): Slot[] {
    return this.slots.slice(HOTBAR_SIZE);
  }

  /** Adds up to `count` of itemId, merging into existing stacks first, then
   * empty slots. Returns how many items did NOT fit (0 = all added). */
  addItem(itemId: string, count: number): number {
    const def = getItemDef(itemId);
    let remaining = count;

    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.itemId === itemId && s.durability === undefined) {
        const space = def.stackSize - s.count;
        if (space > 0) {
          const add = Math.min(space, remaining);
          s.count += add;
          remaining -= add;
        }
      }
    }

    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (this.slots[i] === null) {
        const add = Math.min(def.stackSize, remaining);
        this.slots[i] = { itemId, count: add };
        remaining -= add;
      }
    }

    return remaining;
  }

  removeFromSlot(index: number, count: number): void {
    const s = this.slots[index];
    if (!s) return;
    s.count -= count;
    if (s.count <= 0) this.slots[index] = null;
  }

  /** Click-to-hold-then-place slot interaction (same model as vanilla MC):
   * pass the currently-held stack and the clicked slot's contents, get back
   * the new held stack and the new slot contents. `splitHalf` = right-click. */
  static clickSlot(held: Slot, slot: Slot, splitHalf: boolean): { held: Slot; slot: Slot } {
    if (!held && !slot) return { held: null, slot: null };

    if (!held && slot) {
      if (splitHalf) {
        const takeCount = Math.ceil(slot.count / 2);
        const remain = slot.count - takeCount;
        return {
          held: { itemId: slot.itemId, count: takeCount, durability: slot.durability },
          slot: remain > 0 ? { itemId: slot.itemId, count: remain, durability: slot.durability } : null,
        };
      }
      return { held: slot, slot: null };
    }

    if (held && !slot) {
      if (splitHalf && held.count > 1) {
        return { held: { ...held, count: held.count - 1 }, slot: { itemId: held.itemId, count: 1, durability: held.durability } };
      }
      return { held: null, slot: held };
    }

    // both occupied
    if (held!.itemId === slot!.itemId && held!.durability === undefined) {
      const def = getItemDef(held!.itemId);
      const space = def.stackSize - slot!.count;
      if (space > 0) {
        const move = splitHalf ? 1 : Math.min(space, held!.count);
        const newSlot = { itemId: slot!.itemId, count: slot!.count + move, durability: slot!.durability };
        const leftover = held!.count - move;
        return { held: leftover > 0 ? { ...held!, count: leftover } : null, slot: newSlot };
      }
    }
    // different items (or unstackable tools): swap
    return { held: slot, slot: held };
  }
}

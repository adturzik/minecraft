import { getSmeltRecipe, getFuel } from './smelting';
import { getItemDef } from '../items/items';
import type { Slot } from '../player/inventory';

export interface FurnaceState {
  input: Slot;
  fuel: Slot;
  output: Slot;
  burnTimeRemaining: number;
  burnTimeTotal: number;
  smeltProgress: number; // 0..1
}

function newFurnace(): FurnaceState {
  return { input: null, fuel: null, output: null, burnTimeRemaining: 0, burnTimeTotal: 0, smeltProgress: 0 };
}

/** Furnace block-entity state keyed by world position. Only furnaces that
 * are actually open (or actively burning) need ticking; ticking a large
 * number of idle furnaces is cheap enough to just do them all each frame
 * for this scale of world. */
export class FurnaceManager {
  private furnaces = new Map<string, FurnaceState>();

  private key(x: number, y: number, z: number) {
    return `${x},${y},${z}`;
  }

  get(x: number, y: number, z: number): FurnaceState {
    const k = this.key(x, y, z);
    let f = this.furnaces.get(k);
    if (!f) {
      f = newFurnace();
      this.furnaces.set(k, f);
    }
    return f;
  }

  remove(x: number, y: number, z: number) {
    this.furnaces.delete(this.key(x, y, z));
  }

  tick(dt: number) {
    for (const f of this.furnaces.values()) {
      const recipe = f.input ? getSmeltRecipe(f.input.itemId) : null;

      if (f.burnTimeRemaining <= 0 && recipe && f.fuel) {
        const fuelSpec = getFuel(f.fuel.itemId);
        if (fuelSpec) {
          f.burnTimeRemaining = fuelSpec.burnSeconds;
          f.burnTimeTotal = fuelSpec.burnSeconds;
          f.fuel.count -= 1;
          if (f.fuel.count <= 0) f.fuel = null;
        }
      }

      if (f.burnTimeRemaining > 0) {
        f.burnTimeRemaining = Math.max(0, f.burnTimeRemaining - dt);

        if (recipe) {
          const outputDef = getItemDef(recipe.output);
          const outputFits = !f.output || (f.output.itemId === recipe.output && f.output.count < outputDef.stackSize);
          if (outputFits) {
            f.smeltProgress += dt / recipe.timeSeconds;
            if (f.smeltProgress >= 1) {
              f.smeltProgress = 0;
              f.input!.count -= 1;
              if (f.input!.count <= 0) f.input = null;
              f.output = f.output
                ? { itemId: f.output.itemId, count: f.output.count + recipe.count }
                : { itemId: recipe.output, count: recipe.count };
            }
          }
        } else {
          f.smeltProgress = 0;
        }
      } else {
        f.smeltProgress = Math.max(0, f.smeltProgress - dt / 20); // slowly cool progress when unfueled
      }
    }
  }
}

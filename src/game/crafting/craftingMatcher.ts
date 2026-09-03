import { Recipe, RECIPES, IngredientSpec } from './recipes';
import type { Slot } from '../player/inventory';

function ingredientMatches(spec: IngredientSpec | null, itemId: string | null): boolean {
  if (spec === null) return itemId === null;
  if (itemId === null) return false;
  return Array.isArray(spec) ? spec.includes(itemId) : spec === itemId;
}

function trimGrid(ids: (string | null)[][]): { grid: (string | null)[][]; rows: number; cols: number } {
  let minR = ids.length,
    maxR = -1,
    minC = ids[0]?.length ?? 0,
    maxC = -1;
  for (let r = 0; r < ids.length; r++) {
    for (let c = 0; c < ids[r].length; c++) {
      if (ids[r][c] !== null) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
  }
  if (maxR === -1) return { grid: [], rows: 0, cols: 0 };
  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;
  const grid: (string | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    grid.push(ids[minR + r].slice(minC, minC + cols));
  }
  return { grid, rows, cols };
}

function mirrorCols(grid: (IngredientSpec | null)[][]): (IngredientSpec | null)[][] {
  return grid.map((row) => [...row].reverse());
}

function shapeMatches(a: (IngredientSpec | null)[][], b: (string | null)[][]): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (!ingredientMatches(a[r][c], b[r][c])) return false;
    }
  }
  return true;
}

export interface CraftMatch {
  recipe: Recipe;
  resultItemId: string;
  resultCount: number;
}

/** `grid` is row-major, `width`/`height` describe its shape (2x2 for the
 * player's own inventory, 3x3 for a crafting table). */
export function matchRecipe(grid: Slot[], width: number, height: number, hasTable: boolean): CraftMatch | null {
  const ids: (string | null)[][] = [];
  for (let r = 0; r < height; r++) {
    const row: (string | null)[] = [];
    for (let c = 0; c < width; c++) row.push(grid[r * width + c]?.itemId ?? null);
    ids.push(row);
  }
  const { grid: trimmed, rows, cols } = trimGrid(ids);
  if (rows === 0) return null;

  const nonEmptyCount = trimmed.flat().filter((v) => v !== null).length;

  for (const recipe of RECIPES) {
    if (recipe.requiresTable && !hasTable) continue;

    if (recipe.type === 'shaped') {
      const patternTrim = trimGrid(recipe.pattern as unknown as (string | null)[][]);
      if (patternTrim.rows !== rows || patternTrim.cols !== cols) continue;
      const pattern = recipe.pattern as (IngredientSpec | null)[][];
      // re-trim pattern the same way (bbox) but keep IngredientSpec values
      const trimmedPattern = trimIngredientGrid(pattern);
      if (shapeMatches(trimmedPattern, trimmed) || shapeMatches(mirrorCols(trimmedPattern), trimmed)) {
        return { recipe, resultItemId: recipe.result.itemId, resultCount: recipe.result.count };
      }
    } else {
      if (recipe.ingredients.length !== nonEmptyCount) continue;
      const pool = [...recipe.ingredients];
      const flatIds = trimmed.flat().filter((v): v is string => v !== null);
      let ok = true;
      for (const id of flatIds) {
        const idx = pool.findIndex((spec) => ingredientMatches(spec, id));
        if (idx === -1) {
          ok = false;
          break;
        }
        pool.splice(idx, 1);
      }
      if (ok && pool.length === 0) {
        return { recipe, resultItemId: recipe.result.itemId, resultCount: recipe.result.count };
      }
    }
  }
  return null;
}

function trimIngredientGrid(pattern: (IngredientSpec | null)[][]): (IngredientSpec | null)[][] {
  let minR = pattern.length,
    maxR = -1,
    minC = pattern[0]?.length ?? 0,
    maxC = -1;
  for (let r = 0; r < pattern.length; r++) {
    for (let c = 0; c < pattern[r].length; c++) {
      if (pattern[r][c] !== null) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
  }
  if (maxR === -1) return [];
  const out: (IngredientSpec | null)[][] = [];
  for (let r = minR; r <= maxR; r++) out.push(pattern[r].slice(minC, maxC + 1));
  return out;
}

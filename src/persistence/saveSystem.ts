import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Slot } from '../game/player/inventory';

export interface PlayerSaveData {
  x: number;
  y: number;
  z: number;
  yawRad: number;
  pitchRad: number;
  health: number;
  hunger: number;
  breath: number;
}

export interface WorldSaveData {
  id: string;
  name: string;
  seed: number;
  createdAt: number;
  lastPlayedAt: number;
  gameTimeElapsed: number;
  player: PlayerSaveData;
  inventorySlots: Slot[];
  /** Sparse diff of every block the player has changed vs. the freshly
   * generated terrain for that seed -- NOT the whole world. Keyed
   * "x,y,z" -> blockId. Loading replays these on top of regenerated
   * chunks, matching the "seed + diff" design in CURRYCRAFT_PROMPT.md §14. */
  blockEdits: [string, number][];
}

interface CurryCraftDB extends DBSchema {
  worlds: {
    key: string;
    value: WorldSaveData;
  };
}

let dbPromise: Promise<IDBPDatabase<CurryCraftDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CurryCraftDB>('currycraft', 1, {
      upgrade(db) {
        db.createObjectStore('worlds', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export interface WorldSummary {
  id: string;
  name: string;
  seed: number;
  lastPlayedAt: number;
}

export async function listWorlds(): Promise<WorldSummary[]> {
  const db = await getDB();
  const all = await db.getAll('worlds');
  return all
    .map((w) => ({ id: w.id, name: w.name, seed: w.seed, lastPlayedAt: w.lastPlayedAt }))
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
}

export async function saveWorld(data: WorldSaveData): Promise<void> {
  const db = await getDB();
  await db.put('worlds', data);
}

export async function loadWorld(id: string): Promise<WorldSaveData | null> {
  const db = await getDB();
  return (await db.get('worlds', id)) ?? null;
}

export async function deleteWorld(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('worlds', id);
}

export function newWorldId(): string {
  return `world_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

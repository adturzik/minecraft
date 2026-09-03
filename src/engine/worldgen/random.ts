// Deterministic PRNG + hashing helpers shared by world generation. Pure
// functions only (no DOM) so this is safe to use from a Web Worker too.

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

/** Deterministic 0..1 pseudo-random value for a 3D integer coordinate + seed.
 * Order-independent (no sequential state), so it's safe to call for any
 * block position from any chunk/worker without needing to replay a stream. */
export function hash3D(seed: number, x: number, y: number, z: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ x, 0x27d4eb2d);
  h = Math.imul(h ^ y, 0x165667b1);
  h = Math.imul(h ^ z, 0x9e3779b9);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000000) / 1000000;
}

export function seedFromString(seedInput: string | number): number {
  return typeof seedInput === 'number' ? seedInput | 0 : hashString(seedInput);
}

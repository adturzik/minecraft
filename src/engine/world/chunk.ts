export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_HEIGHT = 128;

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint16Array;
  dirty = true;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint16Array(CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_HEIGHT);
  }

  static index(x: number, y: number, z: number): number {
    return (y * CHUNK_SIZE_Z + z) * CHUNK_SIZE_X + x;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < CHUNK_SIZE_X && z >= 0 && z < CHUNK_SIZE_Z && y >= 0 && y < CHUNK_HEIGHT;
  }

  getBlock(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    return this.blocks[Chunk.index(x, y, z)];
  }

  setBlock(x: number, y: number, z: number, id: number): void {
    if (!this.inBounds(x, y, z)) return;
    this.blocks[Chunk.index(x, y, z)] = id;
    this.dirty = true;
  }

  get worldOriginX(): number {
    return this.cx * CHUNK_SIZE_X;
  }
  get worldOriginZ(): number {
    return this.cz * CHUNK_SIZE_Z;
  }
}

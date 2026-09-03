export interface RaycastHit {
  x: number;
  y: number;
  z: number;
  normal: [number, number, number];
}

/** Amanatides & Woo voxel DDA traversal — walks the ray one grid cell at a
 * time so it works directly against block data, no mesh raycasting needed. */
export function raycastVoxels(
  originX: number,
  originY: number,
  originZ: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  maxDistance: number,
  isSolid: (x: number, y: number, z: number) => boolean
): RaycastHit | null {
  let x = Math.floor(originX);
  let y = Math.floor(originY);
  let z = Math.floor(originZ);

  const stepX = dirX > 0 ? 1 : -1;
  const stepY = dirY > 0 ? 1 : -1;
  const stepZ = dirZ > 0 ? 1 : -1;

  const tDeltaX = dirX !== 0 ? Math.abs(1 / dirX) : Infinity;
  const tDeltaY = dirY !== 0 ? Math.abs(1 / dirY) : Infinity;
  const tDeltaZ = dirZ !== 0 ? Math.abs(1 / dirZ) : Infinity;

  const nextBoundaryX = stepX > 0 ? x + 1 : x;
  const nextBoundaryY = stepY > 0 ? y + 1 : y;
  const nextBoundaryZ = stepZ > 0 ? z + 1 : z;

  let tMaxX = dirX !== 0 ? (nextBoundaryX - originX) / dirX : Infinity;
  let tMaxY = dirY !== 0 ? (nextBoundaryY - originY) / dirY : Infinity;
  let tMaxZ = dirZ !== 0 ? (nextBoundaryZ - originZ) / dirZ : Infinity;

  let normal: [number, number, number] = [0, 0, 0];
  let traveled = 0;

  for (let i = 0; i < 512 && traveled < maxDistance; i++) {
    if (isSolid(x, y, z)) {
      return { x, y, z, normal };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      traveled = tMaxX;
      tMaxX += tDeltaX;
      normal = [-stepX, 0, 0];
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      traveled = tMaxY;
      tMaxY += tDeltaY;
      normal = [0, -stepY, 0];
    } else {
      z += stepZ;
      traveled = tMaxZ;
      tMaxZ += tDeltaZ;
      normal = [0, 0, -stepZ];
    }
  }
  return null;
}

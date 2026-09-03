export interface PlayerAABB {
  halfWidth: number; // X/Z half-extent
  height: number; // from feet (position.y) to head
}

export type SolidTest = (x: number, y: number, z: number) => boolean;

function collidesAt(px: number, py: number, pz: number, size: PlayerAABB, isSolid: SolidTest): boolean {
  const minX = Math.floor(px - size.halfWidth);
  const maxX = Math.floor(px + size.halfWidth - 1e-6);
  const minY = Math.floor(py);
  const maxY = Math.floor(py + size.height - 1e-6);
  const minZ = Math.floor(pz - size.halfWidth);
  const maxZ = Math.floor(pz + size.halfWidth - 1e-6);
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (isSolid(x, y, z)) return true;
      }
    }
  }
  return false;
}

/** Moves `current` by `delta` along a single axis, binary-searching back to
 * the collision boundary if the full move would intersect solid blocks.
 * Returns the resolved coordinate and whether a collision occurred. */
function moveAxis(
  px: number,
  py: number,
  pz: number,
  axis: 'x' | 'y' | 'z',
  delta: number,
  size: PlayerAABB,
  isSolid: SolidTest
): { value: number; collided: boolean } {
  if (delta === 0) return { value: axis === 'x' ? px : axis === 'y' ? py : pz, collided: false };

  const at = (t: number) => {
    const x = axis === 'x' ? px + t : px;
    const y = axis === 'y' ? py + t : py;
    const z = axis === 'z' ? pz + t : pz;
    return collidesAt(x, y, z, size, isSolid);
  };

  const base = axis === 'x' ? px : axis === 'y' ? py : pz;
  if (!at(delta)) return { value: base + delta, collided: false };

  let lo = 0;
  let hi = delta;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid)) hi = mid;
    else lo = mid;
  }
  return { value: base + lo, collided: true };
}

export interface PhysicsStepResult {
  x: number;
  y: number;
  z: number;
  collidedX: boolean;
  collidedY: boolean;
  collidedZ: boolean;
  grounded: boolean;
}

/** Moves the player AABB by the given per-frame displacement (velocity*dt on
 * each axis), resolving collisions one axis at a time (Y first, so ground
 * detection works before horizontal movement is attempted). */
export function stepPhysics(
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  size: PlayerAABB,
  isSolid: SolidTest
): PhysicsStepResult {
  const stepY = moveAxis(x, y, z, 'y', dy, size, isSolid);
  const newY = stepY.value;
  const grounded = dy <= 0 && stepY.collided;

  const stepX = moveAxis(x, newY, z, 'x', dx, size, isSolid);
  const newX = stepX.value;

  const stepZ = moveAxis(newX, newY, z, 'z', dz, size, isSolid);
  const newZ = stepZ.value;

  return {
    x: newX,
    y: newY,
    z: newZ,
    collidedX: stepX.collided,
    collidedY: stepY.collided,
    collidedZ: stepZ.collided,
    grounded,
  };
}

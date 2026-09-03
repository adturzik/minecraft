import { MobConfig, MobKind } from './mob';
import {
  buildCowMesh,
  buildPigMesh,
  buildSheepMesh,
  buildChickenMesh,
  buildZombieMesh,
  buildSkeletonMesh,
  buildSpiderMesh,
  buildCreeperMesh,
} from './mobMeshes';

export const MOB_CONFIGS: Record<MobKind, MobConfig> = {
  cow: {
    kind: 'cow', behavior: 'passive', maxHealth: 10, speed: 1.6,
    size: { halfWidth: 0.45, height: 1.4 }, buildMesh: buildCowMesh,
    attackDamage: 0, attackRange: 0, sightRange: 0,
    // wheat here (rather than a full farming/crop system) is what keeps the
    // bread recipe from being permanently uncraftable -- nothing else in
    // the game currently produces wheat.
    drops: [{ itemId: 'raw_beef', min: 1, max: 3 }, { itemId: 'leather', min: 0, max: 2 }, { itemId: 'wheat', min: 0, max: 2 }],
  },
  pig: {
    kind: 'pig', behavior: 'passive', maxHealth: 10, speed: 1.6,
    size: { halfWidth: 0.4, height: 1.0 }, buildMesh: buildPigMesh,
    attackDamage: 0, attackRange: 0, sightRange: 0,
    drops: [{ itemId: 'raw_porkchop', min: 1, max: 3 }],
  },
  sheep: {
    kind: 'sheep', behavior: 'passive', maxHealth: 8, speed: 1.5,
    size: { halfWidth: 0.4, height: 1.1 }, buildMesh: buildSheepMesh,
    attackDamage: 0, attackRange: 0, sightRange: 0,
    drops: [{ itemId: 'wool', min: 1, max: 2 }],
  },
  chicken: {
    kind: 'chicken', behavior: 'passive', maxHealth: 4, speed: 1.4,
    size: { halfWidth: 0.25, height: 0.7 }, buildMesh: buildChickenMesh,
    attackDamage: 0, attackRange: 0, sightRange: 0,
    drops: [{ itemId: 'raw_chicken', min: 1, max: 1 }, { itemId: 'feather', min: 0, max: 2 }],
  },
  zombie: {
    kind: 'zombie', behavior: 'hostile', maxHealth: 20, speed: 1.9,
    size: { halfWidth: 0.3, height: 1.8 }, buildMesh: buildZombieMesh,
    attackDamage: 3, attackRange: 1.3, sightRange: 14,
    drops: [{ itemId: 'rotten_flesh', min: 0, max: 2 }, { itemId: 'carrot', min: 0, max: 1 }, { itemId: 'potato', min: 0, max: 1 }],
  },
  skeleton: {
    kind: 'skeleton', behavior: 'hostile', maxHealth: 20, speed: 1.8,
    size: { halfWidth: 0.3, height: 1.8 }, buildMesh: buildSkeletonMesh,
    attackDamage: 2, attackRange: 1.3, sightRange: 14,
    drops: [{ itemId: 'bone', min: 0, max: 2 }],
  },
  spider: {
    kind: 'spider', behavior: 'hostile', maxHealth: 16, speed: 2.4,
    size: { halfWidth: 0.5, height: 0.7 }, buildMesh: buildSpiderMesh,
    attackDamage: 2, attackRange: 1.4, sightRange: 12,
    drops: [{ itemId: 'string', min: 0, max: 2 }],
  },
  creeper: {
    kind: 'creeper', behavior: 'hostile', maxHealth: 20, speed: 1.5,
    size: { halfWidth: 0.35, height: 1.7 }, buildMesh: buildCreeperMesh,
    attackDamage: 0, attackRange: 0, sightRange: 14,
    drops: [{ itemId: 'gunpowder', min: 0, max: 2 }],
    explodes: true,
  },
};

export const PASSIVE_KINDS: MobKind[] = ['cow', 'pig', 'sheep', 'chicken'];
export const HOSTILE_KINDS: MobKind[] = ['zombie', 'skeleton', 'spider', 'creeper'];

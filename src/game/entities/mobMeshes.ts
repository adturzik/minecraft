import * as THREE from 'three';

// Simple, fully original low-poly/blocky mob silhouettes built from boxes —
// same flat-shaded, no-external-assets philosophy as the block textures
// (see the Phase 1 copyright note). Not trying to be pixel-identical to any
// existing game's mob models, just recognizable silhouettes in the same
// voxel-blocky spirit.

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  return mesh;
}

function quadruped(bodyColor: number, headColor: number, legColor: number, bodyLen = 0.9): THREE.Group {
  const g = new THREE.Group();
  const body = box(0.6, 0.6, bodyLen, bodyColor);
  body.position.set(0, 0.7, 0);
  g.add(body);
  const head = box(0.4, 0.4, 0.4, headColor);
  head.position.set(0, 0.75, bodyLen / 2 + 0.2);
  g.add(head);
  const legPositions: [number, number][] = [
    [0.2, bodyLen / 2 - 0.1],
    [-0.2, bodyLen / 2 - 0.1],
    [0.2, -bodyLen / 2 + 0.1],
    [-0.2, -bodyLen / 2 + 0.1],
  ];
  for (const [x, z] of legPositions) {
    const leg = box(0.15, 0.4, 0.15, legColor);
    leg.position.set(x, 0.2, z);
    g.add(leg);
  }
  return g;
}

function humanoid(bodyColor: number, headColor: number): THREE.Group {
  const g = new THREE.Group();
  const head = box(0.4, 0.4, 0.4, headColor);
  head.position.set(0, 1.6, 0);
  g.add(head);
  const body = box(0.5, 0.7, 0.3, bodyColor);
  body.position.set(0, 1.1, 0);
  g.add(body);
  for (const x of [0.35, -0.35]) {
    const arm = box(0.15, 0.7, 0.15, bodyColor);
    arm.position.set(x, 1.1, 0);
    g.add(arm);
  }
  for (const x of [0.15, -0.15]) {
    const leg = box(0.15, 0.7, 0.15, headColor);
    leg.position.set(x, 0.4, 0);
    g.add(leg);
  }
  return g;
}

export function buildCowMesh() {
  return quadruped(0x3a2a1a, 0x3a2a1a, 0x2a1c10, 1.0);
}
export function buildPigMesh() {
  return quadruped(0xe8a0a8, 0xe8a0a8, 0xc07880, 0.8);
}
export function buildSheepMesh() {
  return quadruped(0xf0f0e8, 0xd8c0a0, 0xd8c0a0, 0.8);
}
export function buildChickenMesh() {
  const g = new THREE.Group();
  const body = box(0.4, 0.4, 0.4, 0xffffff);
  body.position.set(0, 0.5, 0);
  g.add(body);
  const head = box(0.2, 0.2, 0.2, 0xffffff);
  head.position.set(0, 0.75, 0.25);
  g.add(head);
  const beak = box(0.1, 0.08, 0.15, 0xe8a020);
  beak.position.set(0, 0.72, 0.42);
  g.add(beak);
  for (const x of [0.1, -0.1]) {
    const leg = box(0.08, 0.3, 0.08, 0xe8a020);
    leg.position.set(x, 0.2, 0);
    g.add(leg);
  }
  return g;
}
export function buildZombieMesh() {
  return humanoid(0x3c7a4a, 0x2f5f3a);
}
export function buildSkeletonMesh() {
  return humanoid(0xd8d0c0, 0xe8e0d0);
}
export function buildSpiderMesh() {
  const g = new THREE.Group();
  const body = box(0.6, 0.4, 0.9, 0x1a1410);
  body.position.set(0, 0.4, 0);
  g.add(body);
  const head = box(0.35, 0.3, 0.35, 0x1a1410);
  head.position.set(0, 0.4, 0.55);
  g.add(head);
  for (let i = 0; i < 4; i++) {
    for (const side of [1, -1]) {
      const leg = box(0.5, 0.08, 0.08, 0x0f0c08);
      leg.position.set(side * 0.45, 0.4, -0.3 + i * 0.2);
      leg.rotation.y = side * 0.5;
      g.add(leg);
    }
  }
  return g;
}
export function buildCreeperMesh() {
  const g = new THREE.Group();
  const body = box(0.5, 1.1, 0.3, 0x3fa93f);
  body.position.set(0, 0.7, 0);
  g.add(body);
  const head = box(0.4, 0.4, 0.4, 0x2f8f2f);
  head.position.set(0, 1.5, 0);
  g.add(head);
  const face = box(0.2, 0.25, 0.05, 0x111111);
  face.position.set(0, 1.45, 0.2);
  g.add(face);
  return g;
}

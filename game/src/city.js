// SOLMAR — city: builds the whole coastal city from the district plan.
// Roads, buildings, beach, pier, lighthouse, marina, park and street props.
// Returns the colliders (building footprints) and the road graph the cars use.

import * as THREE from 'three';
import { WORLD, DISTRICTS, PALETTE } from './settings.js';

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return null;
}

export function buildCity(scene) {
  const rand = seededRand(20261118);
  const colliders = []; // {x0,z0,x1,z1} building footprints the cars and player collide with
  const roads = []; // {x0,z0,x1,z1} road strips, for traffic routing and the minimap

  const mats = {
    asphalt: new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
    walk: new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk }),
    sand: new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
    sea: new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
    grass: new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
    glass: new THREE.MeshLambertMaterial({ color: PALETTE.towerGlass }),
    brick: new THREE.MeshLambertMaterial({ color: PALETTE.towerBrick }),
    low: new THREE.MeshLambertMaterial({ color: PALETTE.lowRoof }),
    marina: new THREE.MeshLambertMaterial({ color: PALETTE.marinaRoof }),
    wood: new THREE.MeshLambertMaterial({ color: 0x8a6a44 }),
    white: new THREE.MeshLambertMaterial({ color: 0xf2f0e8 }),
    red: new THREE.MeshLambertMaterial({ color: 0xc0392b }),
    trunk: new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
    leaf: new THREE.MeshLambertMaterial({ color: 0x3f7a34 }),
    lamp: new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x664411 }),
  };

  // --- ground: grass base, sand strip along the south, sea to the east ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.groundSize, WORLD.groundSize),
    mats.grass,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.1, 0);
  scene.add(ground);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(380, 46), mats.sand);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, -0.05, 189);
  scene.add(sand);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(240, 520), mats.sea);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(330, WORLD.seaLevel, 0);
  scene.add(sea);
  const seaSouth = new THREE.Mesh(new THREE.PlaneGeometry(520, 60), mats.sea);
  seaSouth.rotation.x = -Math.PI / 2;
  seaSouth.position.set(0, WORLD.seaLevel, 240);
  scene.add(seaSouth);

  // --- road grid: 9 vertical and 9 horizontal roads across the 8x8 blocks ---
  const step = WORLD.blockSize;
  const half = (WORLD.blocks * step) / 2; // 168
  const roadGeo = new THREE.BoxGeometry(1, 0.12, 1);
  for (let i = 0; i <= WORLD.blocks; i++) {
    const c = -half + i * step;
    const v = new THREE.Mesh(roadGeo, mats.asphalt);
    v.scale.set(WORLD.roadWidth, 1, half * 2 + WORLD.roadWidth);
    v.position.set(c, 0.02, 0);
    scene.add(v);
    const h = new THREE.Mesh(roadGeo, mats.asphalt);
    h.scale.set(half * 2 + WORLD.roadWidth, 1, WORLD.roadWidth);
    h.position.set(0, 0.02, c);
    scene.add(h);
    roads.push({ x0: c - 6, z0: -half, x1: c + 6, z1: half });
    roads.push({ x0: -half, z0: c - 6, x1: half, z1: c + 6 });
  }

  // centre dashes along every road, cheap instanced boxes
  const dashGeo = new THREE.BoxGeometry(2.2, 0.14, 0.5);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
  const dashCount = WORLD.blocks * 2 * 22;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  {
    const m = new THREE.Matrix4();
    let n = 0;
    for (let i = 0; i <= WORLD.blocks; i++) {
      const c = -half + i * step;
      for (let k = -10; k <= 10; k++) {
        if (n >= dashCount) break;
        m.makeTranslation(c, 0.1, k * 16);
        dashes.setMatrixAt(n++, m);
        if (n >= dashCount) break;
        m.makeRotationY(Math.PI / 2);
        m.setPosition(k * 16, 0.1, c);
        dashes.setMatrixAt(n++, m);
      }
    }
    dashes.count = n;
  }
  scene.add(dashes);

  // --- buildings: one or two per block, height and style by district ---
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 0.6, 1);
  for (let bx = 0; bx < WORLD.blocks; bx++) {
    for (let bz = 0; bz < WORLD.blocks; bz++) {
      const cx = -half + bx * step + step / 2;
      const cz = -half + bz * step + step / 2;
      const d = districtAt(cx, cz);
      if (!d || d.kind === 'park' || d.kind === 'sand') continue;
      if (d.kind === 'marina' && rand() < 0.45) continue; // open water-side lots
      const tall = d.kind === 'tower';
      const h = tall ? 18 + rand() * 42 : 6 + rand() * 9;
      const w = 16 + rand() * 10;
      const dep = 16 + rand() * 10;
      const mat = tall ? (rand() < 0.6 ? mats.glass : mats.brick) : (d.kind === 'marina' ? mats.marina : mats.low);
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, dep);
      b.position.set(cx, h / 2, cz);
      scene.add(b);
      const roof = new THREE.Mesh(roofGeo, tall ? mats.white : mats.red);
      roof.scale.set(w * 0.55, 1, dep * 0.55);
      roof.position.set(cx, h + 0.3, cz);
      scene.add(roof);
      colliders.push({ x0: cx - w / 2, z0: cz - dep / 2, x1: cx + w / 2, z1: cz + dep / 2 });
      // a second small shop on the same block in low districts
      if (!tall && rand() < 0.5) {
        const sx = cx + (rand() < 0.5 ? -13 : 13);
        const sz = cz + (rand() < 0.5 ? -13 : 13);
        const sh = 4 + rand() * 3;
        const shop = new THREE.Mesh(boxGeo, mats.white);
        shop.scale.set(9, sh, 8);
        shop.position.set(sx, sh / 2, sz);
        scene.add(shop);
        colliders.push({ x0: sx - 4.5, z0: sz - 4, x1: sx + 4.5, z1: sz + 4 });
      }
    }
  }

  // --- park: trees, paths and a pond ---
  {
    const pond = new THREE.Mesh(new THREE.CircleGeometry(16, 24), mats.sea);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(0, 0.05, 0);
    scene.add(pond);
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3, 6);
    const crownGeo = new THREE.SphereGeometry(2.4, 8, 6);
    for (let i = 0; i < 26; i++) {
      const tx = -36 + rand() * 72;
      const tz = -36 + rand() * 72;
      if (Math.hypot(tx, tz) < 19) continue;
      const trunk = new THREE.Mesh(trunkGeo, mats.trunk);
      trunk.position.set(tx, 1.5, tz);
      scene.add(trunk);
      const crown = new THREE.Mesh(crownGeo, mats.leaf);
      crown.position.set(tx, 4.2, tz);
      scene.add(crown);
    }
  }

  // --- marina: docks and boats on the east water ---
  const boatHull = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 5; i++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 26), mats.wood);
    dock.position.set(176 + i * 2, 0.2, -60 + i * 26);
    scene.add(dock);
    const boat = new THREE.Mesh(boatHull, i % 2 ? mats.white : mats.red);
    boat.scale.set(3.4, 1.6, 9);
    boat.position.set(182 + i * 2, 0.4, -52 + i * 26);
    scene.add(boat);
  }

  // --- pier and lighthouse, south-east into the sea ---
  {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 60), mats.wood);
    pier.position.set(168, 0.3, 192);
    scene.add(pier);
    for (let k = 0; k < 6; k++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 6), mats.wood);
      post.position.set(164, -0.8, 168 + k * 10);
      scene.add(post);
      const post2 = post.clone();
      post2.position.x = 172;
      scene.add(post2);
    }
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 22, 10), mats.white);
    tower.position.set(186, 11, 214);
    scene.add(tower);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 2.4, 10), mats.red);
    cap.position.set(186, 23, 214);
    scene.add(cap);
    const lampMesh = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), mats.lamp);
    lampMesh.position.set(186, 25, 214);
    lampMesh.name = 'lighthouseLamp';
    scene.add(lampMesh);
  }

  // --- street lamps along the main avenue ---
  {
    const poleGeo = new THREE.CylinderGeometry(0.18, 0.18, 6, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    for (let k = -7; k <= 7; k++) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(7.5, 3, k * 24);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), mats.lamp);
      bulb.position.set(7.5, 6.2, k * 24);
      scene.add(bulb);
    }
  }

  return { colliders, roads, half };
}

export function collideCircle(colliders, x, z, r) {
  // Push a circle out of every building footprint it overlaps. Returns corrected {x, z, hit}.
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(x, c.x1));
    const nz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      } else {
        // centre inside the footprint: push out along the smallest penetration
        const pl = x - c.x0 + r;
        const pr = c.x1 - x + r;
        const pt = z - c.z0 + r;
        const pb = c.z1 - z + r;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.x0 - r;
        else if (m === pr) x = c.x1 + r;
        else if (m === pt) z = c.z0 - r;
        else z = c.z1 + r;
      }
    }
  }
  return { x, z, hit };
}

export function onRoad(roads, x, z) {
  for (const r of roads) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  }
  return false;
}

// Pedestrians: Solmar locals strolling the sidewalks. Each one walks the
// road grid on foot — an axis, a lane (a road coordinate) and a direction,
// turning at intersections like traffic, so they never cut through a
// building. If a car or a fist catches them they go down, which the law
// notices; after a while they get up somewhere else, a little wiser.
import * as THREE from 'three';
import { CITY } from './config.js';

const SHIRTS = [0xd84a5a, 0x4a90d8, 0x50b878, 0xe8a13c, 0x9a5fd0, 0xe8e4da, 0x3cb8c8, 0xd86a9a];
const SKINS = [0xe8b88a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0];

export function createPeds(scene, city, rng, count) {
  const peds = [];
  const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.75, 3, 8);
  const headGeo = new THREE.SphereGeometry(0.24, 10, 8);
  const legGeo = new THREE.BoxGeometry(0.16, 0.5, 0.16);

  function spawn() {
    const p = city.randomSidewalkPoint();
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(rng.next() * SHIRTS.length)] });
    const body = new THREE.Mesh(bodyGeo, shirt);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);
    const skin = new THREE.MeshLambertMaterial({ color: SKINS[Math.floor(rng.next() * SKINS.length)] });
    const head = new THREE.Mesh(headGeo, skin);
    head.position.y = 1.75;
    head.castShadow = true;
    group.add(head);
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
    const legL = new THREE.Mesh(legGeo, pants);
    legL.position.set(-0.12, 0.35, 0);
    group.add(legL);
    const legR = new THREE.Mesh(legGeo, pants);
    legR.position.set(0.12, 0.35, 0);
    group.add(legR);
    scene.add(group);
    // The ped walks along the road its sidewalk point belongs to, so its
    // axis follows the point's orientation and its lane is the road
    // coordinate (see randomSidewalkPoint).
    const ped = {
      group, body, head, legL, legR,
      x: p.x, z: p.z, heading: 0,
      speed: rng.range(0.9, 1.6), wait: 0,
      axis: p.horizontal ? 'x' : 'z',
      dir: rng.next() < 0.5 ? 1 : -1,
      lane: p.road,
      down: false, downTimer: 0, walkPhase: rng.next() * 6,
    };
    ped.heading = ped.axis === 'x'
      ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (ped.dir > 0 ? 0 : Math.PI);
    peds.push(ped);
    return ped;
  }

  function spawnAt(x, z) {
    const ped = spawn();
    ped.x = x;
    ped.z = z;
    ped.group.position.set(x, 0, z);
    return ped;
  }

  function remove(ped) {
    scene.remove(ped.group);
    const i = peds.indexOf(ped);
    if (i >= 0) peds.splice(i, 1);
  }

  for (let i = 0; i < count; i += 1) spawn();

  function knockDown(ped) {
    if (ped.down) return;
    ped.down = true;
    ped.downTimer = 6;
    ped.group.rotation.x = -Math.PI / 2 + 0.15;
    ped.group.position.y = 0.3;
  }

  function update(dt, time) {
    for (const ped of peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.down = false;
          ped.group.rotation.x = 0;
          ped.group.position.y = 0;
          const p = city.randomSidewalkPoint();
          ped.x = p.x;
          ped.z = p.z;
          ped.axis = p.horizontal ? 'x' : 'z';
          ped.dir = rng.next() < 0.5 ? 1 : -1;
          ped.lane = p.road;
          ped.heading = ped.axis === 'x'
            ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
            : (ped.dir > 0 ? 0 : Math.PI);
        }
        continue;
      }
      if (ped.wait > 0) {
        ped.wait -= dt;
        continue;
      }
      // Turn at an intersection sometimes.
      const nearX = CITY.roads.find((c) => Math.abs(ped.x - c) < 1.5);
      const nearZ = CITY.roads.find((c) => Math.abs(ped.z - c) < 1.5);
      if (nearX !== undefined && nearZ !== undefined && rng.next() < 0.004) {
        if (ped.axis === 'x' && rng.next() < 0.5) {
          ped.axis = 'z';
          ped.dir = rng.next() < 0.5 ? 1 : -1;
          ped.lane = nearX;
        } else if (ped.axis === 'z') {
          ped.axis = 'x';
          ped.dir = rng.next() < 0.5 ? 1 : -1;
          ped.lane = nearZ;
        }
        if (rng.next() < 0.25) ped.wait = rng.range(1, 3);
      }
      // Steer onto the sidewalk lane (just outside the road edge).
      const side = ped.axis === 'x' ? (ped.dir > 0 ? 1 : -1) : (ped.dir > 0 ? -1 : 1);
      const lanePos = ped.axis === 'x' ? ped.z : ped.x;
      const laneTarget = ped.lane + side * (CITY.road / 2 + 1.6);
      const err = laneTarget - lanePos;
      const desired = ped.axis === 'x'
        ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.max(-0.3, Math.min(0.3, err * 0.15))
        : (ped.dir > 0 ? 0 : Math.PI) + Math.max(-0.3, Math.min(0.3, err * 0.15));
      let dh = desired - ped.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ped.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.z += Math.cos(ped.heading) * ped.speed * dt;
      // Keep inside the city and out of the water.
      if (Math.abs(ped.x) > 200 || ped.z > 205 || ped.z < -200) {
        ped.dir *= -1;
        ped.heading += Math.PI;
      }
      ped.walkPhase += dt * ped.speed * 4;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.legL.rotation.x = swing;
      ped.legR.rotation.x = -swing;
      ped.group.position.set(ped.x, 0, ped.z);
      ped.group.rotation.y = ped.heading;
    }
  }

  function nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const ped of peds) {
      if (ped.down) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  return { peds, update, nearest, knockDown, spawnAt, remove };
}

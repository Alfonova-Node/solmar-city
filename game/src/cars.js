// SOLMAR — cars: traffic, police cruisers and the player's driven car.
// Arcade handling: accelerate, steer, brake, reverse, building collision,
// car-to-car bumps, and stealing a parked or traffic car with E.

import * as THREE from 'three';
import { CAR, WANTED } from './settings.js';
import { collideCircle, onRoad } from './city.js';

const CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1a1a1a, 0x7f8c8d, 0x16a085];

function makeCarMesh(color, isPolice, isSport) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const len = isSport ? 4.6 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, len), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, len * 0.5), glassMat);
  cabin.position.set(0, 1.2, -len * 0.06);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, len * 0.32], [0.95, len * 0.32], [-0.95, -len * 0.32], [0.95, -len * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.4), new THREE.MeshLambertMaterial({ color: 0x2222aa, emissive: 0x111166 }));
    bar.position.set(0, 1.62, -0.1);
    bar.name = 'lightbar';
    g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, len * 0.9), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62;
    g.add(stripe);
  }
  if (isSport) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), darkMat);
    spoiler.position.set(0, 1.05, -len / 2 + 0.15);
    g.add(spoiler);
  }
  g.userData.wheels = wheels;
  return g;
}

function randPick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

export function createCarWorld(scene, city) {
  const rand = (() => {
    let s = 777001;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })();
  const traffic = [];
  const police = [];
  const freeCars = []; // parked stealable cars, including the mission Comet

  function spawnOnRoad() {
    // pick a random road crossing point
    const step = 42;
    const half = 168;
    const vertical = rand() < 0.5;
    const line = -half + Math.floor(rand() * 9) * step;
    const along = -half + 8 + rand() * (half * 2 - 16);
    return vertical ? { x: line, z: along, heading: rand() < 0.5 ? 0 : Math.PI } : { x: along, z: line, heading: rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  }

  function addTraffic() {
    const p = spawnOnRoad();
    const mesh = makeCarMesh(randPick(rand, CAR_COLORS), false, false);
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = p.heading;
    scene.add(mesh);
    const car = {
      mesh, x: p.x, z: p.z, heading: p.heading,
      speed: 6 + rand() * 5, kind: 'traffic', alive: true,
    };
    traffic.push(car);
    return car;
  }

  for (let i = 0; i < CAR.trafficCount; i++) addTraffic();

  // parked cars along the kerbs, stealable
  const parkedSpots = [
    { x: 48, z: 24 }, { x: -60, z: 60 }, { x: 120, z: -84 }, { x: -144, z: -108 },
    { x: 24, z: 144 }, { x: -24, z: -60 }, { x: 96, z: 84 }, { x: -96, z: 120 },
  ];
  for (const s of parkedSpots) {
    const mesh = makeCarMesh(randPick(rand, CAR_COLORS), false, false);
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = (rand() < 0.5 ? 0 : Math.PI / 2);
    scene.add(mesh);
    freeCars.push({ mesh, x: s.x, z: s.z, heading: mesh.rotation.y, speed: 0, kind: 'parked', alive: true, taken: false });
  }

  // the crimson Comet GT for the Hot Wheels mission, parked by the Park
  const cometMesh = makeCarMesh(0xd4122a, false, true);
  cometMesh.position.set(48, 0, 30);
  cometMesh.rotation.y = Math.PI / 2;
  scene.add(cometMesh);
  const comet = { mesh: cometMesh, x: 48, z: 30, heading: Math.PI / 2, speed: 0, kind: 'comet', alive: true, taken: false };
  freeCars.push(comet);

  function addPolice(x, z) {
    const mesh = makeCarMesh(0x1a1a2e, true, false);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const car = { mesh, x, z, heading: 0, speed: 0, kind: 'police', alive: true };
    police.push(car);
    return car;
  }

  function stepTraffic(dt, playerX, playerZ) {
    for (const c of traffic) {
      if (!c.alive || c.taken) continue; // a stolen car is driven by the player, not traffic
      // drive straight along the current heading; at a junction, sometimes turn
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const nearJunction = Math.abs(((nx % 42) + 42) % 42 - 21) > 19 || Math.abs(((nz % 42) + 42) % 42 - 21) > 19;
      if (nearJunction && rand() < dt * 0.9) {
        c.heading += (rand() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
      // keep inside the city, turn around at the edge
      if (Math.abs(nx) > 172 || Math.abs(nz) > 172) {
        c.heading += Math.PI;
      } else {
        c.x = nx;
        c.z = nz;
      }
      // slow down if the player is right ahead
      const dx = playerX - c.x;
      const dz = playerZ - c.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 9 && Math.abs(Math.atan2(dx, dz) - c.heading) < 0.6) {
        c.speed = Math.max(2, c.speed - 8 * dt);
      } else if (c.speed < 9) {
        c.speed = Math.min(9, c.speed + 2 * dt);
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2;
    }
  }

  function stepPolice(dt, targetX, targetZ, wanted) {
    // trim or grow the fleet to the wanted level
    const want = WANTED.maxCops[Math.min(wanted, WANTED.max)] || 0;
    while (police.length < want) {
      const a = rand() * Math.PI * 2;
      addPolice(targetX + Math.sin(a) * 55, targetZ + Math.cos(a) * 55);
    }
    while (police.length > want) {
      const p = police.pop();
      scene.remove(p.mesh);
    }
    for (const p of police) {
      const dx = targetX - p.x;
      const dz = targetZ - p.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      p.speed = Math.min(CAR.policeTopSpeed, p.speed + 14 * dt);
      if (dist < 6) p.speed = Math.max(4, p.speed - 10 * dt);
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      const fixed = collideCircle(city.colliders, p.x, p.z, 2.2);
      p.x = fixed.x;
      p.z = fixed.z;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      for (const w of p.mesh.userData.wheels) w.rotation.x += p.speed * dt * 2;
      const bar = p.mesh.getObjectByName('lightbar');
      if (bar) bar.material.emissive.setHex(Math.floor(performance.now() / 300) % 2 ? 0xaa0000 : 0x0000aa);
    }
  }

  function driveCar(car, dt, fwd, steer, handbrake) {
    // arcade bicycle-ish model: speed along the heading, steering scaled by speed
    const speedFactor = Math.min(1, Math.abs(car.speed) / 10);
    if (fwd > 0) car.speed += CAR.accel * fwd * dt;
    else if (fwd < 0) {
      if (car.speed > 0.5) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.accel * 0.6 * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    }
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
    car.speed = Math.max(-CAR.reverseTop, Math.min(CAR.topSpeed, car.speed));
    car.heading += steer * CAR.steer * speedFactor * dt * Math.sign(car.speed || 1);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const fixed = collideCircle(city.colliders, nx, nz, 2.1);
    if (fixed.hit) car.speed *= 0.55;
    car.x = Math.max(-205, Math.min(230, fixed.x));
    car.z = Math.max(-205, Math.min(235, fixed.z));
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
  }

  function nearestStealable(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of [...traffic, ...freeCars]) {
      if (!c.alive || c.taken) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  return {
    traffic, police, freeCars, comet,
    addTraffic, addPolice, stepTraffic, stepPolice, driveCar, nearestStealable,
    makeCarMesh,
  };
}

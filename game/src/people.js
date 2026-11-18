// SOLMAR — people: Marco on foot, the city's pedestrians, and combat.
// Punch with F, pistol with a mouse click; peds flee from gunfire and cars.

import * as THREE from 'three';
import { PLAYER, PEDS } from './settings.js';
import { collideCircle } from './city.js';

function makePersonMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.4), shirtMat);
  torso.position.y = 1.25;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.9;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), pantsMat);
  legL.position.set(-0.18, 0.42, 0);
  legL.name = 'legL';
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  legR.name = 'legR';
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirtMat);
  armL.position.set(-0.46, 1.25, 0);
  armL.name = 'armL';
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.46;
  armR.name = 'armR';
  g.add(armR);
  return g;
}

export function createPeople(scene, city) {
  const rand = (() => {
    let s = 424242;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })();
  const shirts = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xe67e22, 0xecf0f1, 0x1abc9c];
  const peds = [];

  const player = {
    mesh: makePersonMesh(0x222831, 0x2f3542, 0xe8b98a),
    x: -120, z: 12, heading: Math.PI / 2,
    health: PLAYER.health, ammo: PLAYER.pistolAmmo,
    walkPhase: 0, moving: false,
  };
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  scene.add(player.mesh);

  function randomSidewalkSpot() {
    // a point on a sidewalk: just off a road line
    const step = 42;
    const half = 168;
    const line = -half + Math.floor(rand() * 9) * step;
    const along = -half + 10 + rand() * (half * 2 - 20);
    const off = (rand() < 0.5 ? -1 : 1) * (7.5 + rand() * 3);
    return rand() < 0.5 ? { x: line + off, z: along } : { x: along, z: line + off };
  }

  for (let i = 0; i < PEDS.count; i++) {
    const s = randomSidewalkSpot();
    const mesh = makePersonMesh(
      shirts[Math.floor(rand() * shirts.length)],
      0x2c3e50, 0xd8a06a + Math.floor(rand() * 0x202020),
    );
    mesh.position.set(s.x, 0, s.z);
    scene.add(mesh);
    peds.push({
      mesh, x: s.x, z: s.z, heading: rand() * Math.PI * 2,
      speed: PEDS.walkSpeed * (0.7 + rand() * 0.6),
      target: randomSidewalkSpot(), state: 'walk', fleeT: 0, alive: true, phase: rand() * 6,
    });
  }

  function stepPlayer(dt, fwd, steer, running, inCar) {
    if (inCar) {
      player.moving = false;
      return;
    }
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    player.heading += steer * 2.6 * dt;
    const mx = Math.sin(player.heading) * fwd * speed;
    const mz = Math.cos(player.heading) * fwd * speed;
    const fixed = collideCircle(city.colliders, player.x + mx * dt, player.z + mz * dt, 0.6);
    player.x = Math.max(-205, Math.min(230, fixed.x));
    player.z = Math.max(-205, Math.min(235, fixed.z));
    player.moving = Math.abs(fwd) > 0.1;
    if (player.moving) player.walkPhase += dt * (running ? 11 : 8);
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.heading;
    const swing = player.moving ? Math.sin(player.walkPhase) * 0.5 : 0;
    const legL = player.mesh.getObjectByName('legL');
    const legR = player.mesh.getObjectByName('legR');
    const armL = player.mesh.getObjectByName('armL');
    const armR = player.mesh.getObjectByName('armR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
    if (armL) armL.rotation.x = -swing * 0.7;
    if (armR) armR.rotation.x = swing * 0.7;
  }

  function stepPeds(dt, dangerX, dangerZ, dangerR) {
    for (const p of peds) {
      if (!p.alive) continue;
      const dDanger = Math.hypot(p.x - dangerX, p.z - dangerZ);
      if (dDanger < dangerR) {
        p.state = 'flee';
        p.fleeT = 2.5;
        p.target = {
          x: p.x + (p.x - dangerX) * 2,
          z: p.z + (p.z - dangerZ) * 2,
        };
      } else if (p.fleeT > 0) {
        p.fleeT -= dt;
        if (p.fleeT <= 0) p.state = 'walk';
      }
      const dx = p.target.x - p.x;
      const dz = p.target.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.2) {
        if (p.state === 'walk') p.target = randomSidewalkSpot();
        else p.state = 'walk';
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
      const sp = p.state === 'flee' ? p.speed * 2.4 : p.speed;
      const fixed = collideCircle(city.colliders, p.x + Math.sin(p.heading) * sp * dt, p.z + Math.cos(p.heading) * sp * dt, 0.5);
      p.x = fixed.x;
      p.z = fixed.z;
      p.phase += dt * (p.state === 'flee' ? 12 : 7);
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      const swing = Math.sin(p.phase) * 0.45;
      const legL = p.mesh.getObjectByName('legL');
      const legR = p.mesh.getObjectByName('legR');
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
    }
  }

  function punch(attackerX, attackerZ, heading, range, damage, onHit, cops) {
    // hits the nearest ped or cop in front of the attacker, within range and a wide arc
    let best = null;
    let bestD = range;
    const candidates = [];
    for (const p of peds) if (p.alive) candidates.push({ kind: 'ped', obj: p });
    for (const c of cops || []) if (c.alive) candidates.push({ kind: 'cop', obj: c });
    for (const c of candidates) {
      const dx = c.obj.x - attackerX;
      const dz = c.obj.z - attackerZ;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const ang = Math.atan2(dx, dz);
      let da = ang - heading;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > 0.9) continue;
      bestD = d;
      best = c;
    }
    if (best) {
      if (best.kind === 'ped') {
        best.obj.alive = false;
        best.obj.mesh.visible = false;
        // the ped drops and gets back up after a while, off to the side
        window.setTimeout(() => {
          best.obj.alive = true;
          best.obj.mesh.visible = true;
          best.obj.target = randomSidewalkSpot();
        }, 9000);
      }
      if (onHit) onHit(best.kind, best.obj);
      return best.kind;
    }
    return null;
  }

  function shoot(fromX, fromZ, heading, range, damage, cops) {
    // a pistol shot: hits the nearest ped or cop roughly in the aim line
    if (player.ammo <= 0) return { hit: null, outOfAmmo: true };
    player.ammo -= 1;
    let best = null;
    let bestD = range;
    const candidates = [];
    for (const p of peds) if (p.alive) candidates.push({ kind: 'ped', obj: p });
    for (const c of cops || []) if (c.alive) candidates.push({ kind: 'cop', obj: c });
    for (const c of candidates) {
      const dx = c.obj.x - fromX;
      const dz = c.obj.z - fromZ;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const ang = Math.atan2(dx, dz);
      let da = ang - heading;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > 0.16 + 2.2 / Math.max(d, 4)) continue;
      bestD = d;
      best = c;
    }
    if (best) {
      if (best.kind === 'ped') {
        best.obj.alive = false;
        best.obj.mesh.visible = false;
        window.setTimeout(() => {
          best.obj.alive = true;
          best.obj.mesh.visible = true;
          best.obj.target = randomSidewalkSpot();
        }, 12000);
      }
      return { hit: best.kind, target: best.obj, outOfAmmo: false };
    }
    return { hit: null, outOfAmmo: false };
  }

  return { player, peds, stepPlayer, stepPeds, punch, shoot, makePersonMesh };
}

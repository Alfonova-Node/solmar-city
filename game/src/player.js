// Marco Vale, the player on foot: a teal jacket, a quick step, a short fuse.
// Walks camera-relative (W is away from the camera), runs with Shift, gets in
// and out of cars with E, punches with F, fires the pistol with G. Health
// comes back slowly when nobody is hitting him.
import * as THREE from 'three';
import { PLAYER, CAR } from './config.js';

export function createPlayer(scene, city) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1f8a7a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.8, 3, 8), jacket);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.27, 0.1, 10),
    new THREE.MeshLambertMaterial({ color: 0xd8402e }),
  );
  cap.position.y = 1.95;
  group.add(cap);
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
  const legGeo = new THREE.BoxGeometry(0.17, 0.55, 0.17);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.13, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.13, 0.35, 0);
  group.add(legR);
  scene.add(group);

  const state = {
    group, x: -6, z: 60, heading: 0, speed: 0,
    health: PLAYER.health, maxHealth: PLAYER.health,
    inCar: null, punchCooldown: 0, ammo: 24,
    hurtTimer: 0, regenTimer: 0, walkPhase: 0,
    // A tracer line for the pistol, reused every shot.
    tracer: null,
  };
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1),
  ]);
  state.tracer = new THREE.Line(tracerGeo, tracerMat);
  state.tracer.visible = false;
  scene.add(state.tracer);
  let tracerTimer = 0;

  function hurt(amount) {
    if (state.hurtTimer > 0) return;
    state.health = Math.max(0, state.health - amount);
    state.hurtTimer = 0.8;
    state.regenTimer = 10;
  }

  function punch(peds, onCrime) {
    if (state.punchCooldown > 0 || state.inCar) return false;
    state.punchCooldown = PLAYER.punchCooldown;
    const fx = Math.sin(state.heading);
    const fz = Math.cos(state.heading);
    const ped = peds.nearest(state.x + fx * 1.2, state.z + fz * 1.2, PLAYER.punchRange);
    if (ped) {
      peds.knockDown(ped);
      onCrime(1, 'You knocked someone down.');
      return true;
    }
    return false;
  }

  function fire(peds, vehicles, onCrime) {
    if (state.ammo <= 0 || state.inCar) return false;
    state.ammo -= 1;
    const fx = Math.sin(state.heading);
    const fz = Math.cos(state.heading);
    const ox = state.x;
    const oz = state.z;
    // Nearest ped in a forward cone.
    let hitPed = null;
    let hitD = 16;
    for (const ped of peds.peds) {
      if (ped.down) continue;
      const dx = ped.x - ox;
      const dz = ped.z - oz;
      const d = Math.hypot(dx, dz);
      const dot = (dx * fx + dz * fz) / Math.max(d, 0.001);
      if (d < hitD && dot > 0.85) {
        hitD = d;
        hitPed = ped;
      }
    }
    let hitCar = null;
    let hitCarD = 16;
    for (const car of vehicles.cars) {
      if (car.kind !== 'police') continue;
      const dx = car.x - ox;
      const dz = car.z - oz;
      const d = Math.hypot(dx, dz);
      const dot = (dx * fx + dz * fz) / Math.max(d, 0.001);
      if (d < hitCarD && dot > 0.8) {
        hitCarD = d;
        hitCar = car;
      }
    }
    let endX = ox + fx * 16;
    let endZ = oz + fz * 16;
    if (hitPed && (!hitCar || hitD <= hitCarD)) {
      peds.knockDown(hitPed);
      endX = hitPed.x;
      endZ = hitPed.z;
      onCrime(1, 'You shot someone.');
    } else if (hitCar) {
      hitCar.health -= 25;
      endX = hitCar.x;
      endZ = hitCar.z;
      onCrime(1, 'You shot at the police.');
    }
    const pos = state.tracer.geometry.attributes.position;
    pos.setXYZ(0, ox, 1.4, oz);
    pos.setXYZ(1, endX, 1.2, endZ);
    pos.needsUpdate = true;
    state.tracer.visible = true;
    tracerMat.opacity = 0.9;
    tracerTimer = 0.08;
    return true;
  }

  function update(dt, input, camYaw, city, vehicles, peds, onCrime, canEnter) {
    state.punchCooldown = Math.max(0, state.punchCooldown - dt);
    state.hurtTimer = Math.max(0, state.hurtTimer - dt);
    state.regenTimer -= dt;
    if (state.regenTimer <= 0 && state.health > 0 && state.health < state.maxHealth) {
      state.health = Math.min(state.maxHealth, state.health + 2 * dt);
    }
    if (tracerTimer > 0) {
      tracerTimer -= dt;
      tracerMat.opacity = Math.max(0, tracerTimer / 0.08) * 0.9;
      if (tracerTimer <= 0) state.tracer.visible = false;
    }
    if (state.inCar) return;
    const move = input.move();
    const wantRun = input.run();
    const speed = wantRun ? PLAYER.runSpeed : PLAYER.walkSpeed;
    // Camera-relative movement: W walks away from the camera.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    let mx = sin * move.forward + cos * move.right;
    let mz = cos * move.forward - sin * move.right;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const target = Math.atan2(mx, mz);
      let dh = target - state.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      state.heading += Math.max(-8 * dt, Math.min(8 * dt, dh));
      state.speed = Math.min(speed, state.speed + PLAYER.accel * dt);
    } else {
      state.speed = Math.max(0, state.speed - PLAYER.accel * 1.6 * dt);
    }
    state.x += Math.sin(state.heading) * state.speed * dt;
    state.z += Math.cos(state.heading) * state.speed * dt;
    // World bounds, water, buildings.
    state.x = Math.max(-202, Math.min(202, state.x));
    state.z = Math.max(-202, Math.min(232, state.z));
    if (city.inWater(state.x, state.z)) {
      // The pier ends at z 234; everywhere else the water starts at 208.
      const edge = Math.abs(state.x - 150) < 4.2 ? 233.5 : 207.5;
      state.z = Math.min(state.z, edge);
    }
    const push = city.collideCircle(state.x, state.z, PLAYER.radius);
    state.x += push.x;
    state.z += push.z;
    state.walkPhase += dt * state.speed * 2.2;
    const swing = state.speed > 0.2 ? Math.sin(state.walkPhase) * 0.55 : 0;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    group.position.set(state.x, 0, state.z);
    group.rotation.y = state.heading;
  }

  function enterCar(car) {
    state.inCar = car;
    group.visible = false;
  }

  function exitCar() {
    const car = state.inCar;
    if (!car) return;
    state.inCar = null;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    state.x = car.x + side.x * 2.6;
    state.z = car.z + side.z * 2.6;
    state.heading = car.heading;
    group.visible = true;
    group.position.set(state.x, 0, state.z);
    group.rotation.y = state.heading;
  }

  function teleport(x, z, heading = 0) {
    state.x = x;
    state.z = z;
    state.heading = heading;
    state.speed = 0;
    group.position.set(x, 0, z);
    group.rotation.y = heading;
  }

  return { state, update, punch, fire, hurt, enterCar, exitCar, teleport };
}

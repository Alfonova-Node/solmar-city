// Cars: the player's ride, traffic and the police. Arcade physics — no
// suspension model, just acceleration, steering that fades with speed, and
// circle push-out against buildings and each other. Traffic follows the road
// grid on the right-hand lane and turns at intersections; police chase the
// player and ram. Wheels are one InstancedMesh for the whole fleet.
import * as THREE from 'three';
import { CITY, CAR } from './config.js';

const BODY_COLORS = [0xd8402e, 0x2e6fd8, 0xe8b820, 0x37b24d, 0x8a5fd0, 0xe8e8e8, 0x222226, 0xe87a20, 0x20b8c8];
const MAX_CARS = 26;

function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

export function createVehicles(scene, city, rng) {
  const cars = [];
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = new THREE.InstancedMesh(wheelGeo, wheelMat, MAX_CARS * 4);
  wheels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(wheels);

  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xffedb0, emissiveIntensity: 0.25 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0xcc0000, emissiveIntensity: 0.4 });
  const barRedMat = new THREE.MeshLambertMaterial({ color: 0xcc0000, emissive: 0xff0000, emissiveIntensity: 0 });
  const barBlueMat = new THREE.MeshLambertMaterial({ color: 0x0000cc, emissive: 0x2244ff, emissiveIntensity: 0 });

  function makeMeshes(car) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: car.color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.55, CAR.length), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);
    const cabinMat = new THREE.MeshLambertMaterial({ color: car.kind === 'police' ? 0x181818 : 0x1c2733 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.1), cabinMat);
    cabin.position.set(0, 1.05, -0.25);
    cabin.castShadow = true;
    group.add(cabin);
    const lightGeo = new THREE.BoxGeometry(0.32, 0.14, 0.1);
    for (const sx of [-0.6, 0.6]) {
      const head = new THREE.Mesh(lightGeo, headMat);
      head.position.set(sx, 0.6, CAR.length / 2 + 0.02);
      group.add(head);
      const tail = new THREE.Mesh(lightGeo, tailMat);
      tail.position.set(sx, 0.6, -CAR.length / 2 - 0.02);
      group.add(tail);
    }
    if (car.kind === 'police') {
      const barGeo = new THREE.BoxGeometry(0.55, 0.18, 0.5);
      const red = new THREE.Mesh(barGeo, barRedMat);
      red.position.set(-0.35, 1.38, -0.25);
      group.add(red);
      const blue = new THREE.Mesh(barGeo, barBlueMat);
      blue.position.set(0.35, 1.38, -0.25);
      group.add(blue);
      car.barRed = red;
      car.barBlue = blue;
    }
    scene.add(group);
    return group;
  }

  function addCar(kind, x, z, heading, color) {
    const car = {
      kind, x, z, heading, speed: 0, steer: 0,
      color: color ?? (kind === 'police' ? 0xf0f0f0 : BODY_COLORS[Math.floor(rng.next() * BODY_COLORS.length)]),
      health: 100, wrecked: false, wreckTimer: 0,
      axis: 'x', dir: 1, lane: z, // traffic state
      target: null, // police chase target {x,z}
      bustTimer: 0,
    };
    car.group = makeMeshes(car);
    cars.push(car);
    return car;
  }

  function removeCar(car) {
    scene.remove(car.group);
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
  }

  function syncMesh(car) {
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
  }

  // --- Road following: lane steering shared by traffic and the police ------
  // A car drives along one road (axis + lane) on the right-hand side and, at
  // an intersection, may turn onto the crossing road. `chooseTurn` decides:
  // traffic turns at random, the police pick the turn that gets them closest
  // to the player. Returns nothing; the car steers toward its lane.
  function followRoad(car, dt, targetSpeed, chooseTurn) {
    const fwd = forwardOf(car.heading);
    // Find the closest car ahead and slow down for it.
    let slow = false;
    for (const other of cars) {
      if (other === car || other.wrecked) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const ahead = dx * fwd.x + dz * fwd.z;
      const side = Math.abs(dx * fwd.z - dz * fwd.x);
      if (ahead > 0 && ahead < 11 && side < 2.6) { slow = true; break; }
    }
    const want = slow ? 0 : targetSpeed;
    car.speed += Math.max(-14 * dt, Math.min(8 * dt, want - car.speed));
    car.turnCooldown = Math.max(0, (car.turnCooldown ?? 0) - dt);
    const nearX = CITY.roads.find((c) => Math.abs(car.x - c) < 2.2);
    const nearZ = CITY.roads.find((c) => Math.abs(car.z - c) < 2.2);
    if (nearX !== undefined && nearZ !== undefined && car.turnCooldown <= 0) {
      const turn = chooseTurn(car, nearX, nearZ);
      if (turn === 'left' || turn === 'right') {
        if (car.axis === 'x') {
          // Facing east (dir +1): left is north, right is south. Facing west
          // it is the other way round. The new lane is the crossing road.
          const north = (car.dir > 0) === (turn === 'left');
          car.axis = 'z';
          car.dir = north ? -1 : 1;
          car.lane = nearX;
        } else {
          // Facing south (dir +1): left is east, right is west.
          const east = (car.dir > 0) === (turn === 'left');
          car.axis = 'x';
          car.dir = east ? 1 : -1;
          car.lane = nearZ;
        }
        car.turnCooldown = 2.5;
      }
    }
    // Steer back onto the lane (right-hand side of the road).
    const right = car.axis === 'x' ? (car.dir > 0 ? 1 : -1) : (car.dir > 0 ? -1 : 1);
    const lanePos = car.axis === 'x' ? car.z : car.x;
    const laneTarget = car.lane + right * 3;
    const err = laneTarget - lanePos;
    const desired = car.axis === 'x'
      ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.max(-0.2, Math.min(0.2, err * 0.06))
      : (car.dir > 0 ? 0 : Math.PI) + Math.max(-0.2, Math.min(0.2, err * 0.06));
    let dh = desired - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const turnAmount = Math.max(-1.4 * dt, Math.min(1.4 * dt, dh));
    car.steer = turnAmount / Math.max(dt, 0.001) / 2;
    car.heading += turnAmount;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
  }

  // --- Traffic: follow the road grid, turning at random ----------------------
  function trafficStep(car, dt) {
    followRoad(car, dt, CAR.trafficSpeed, (c, nearX, nearZ) => {
      if (rng.next() < 0.006) return rng.next() < 0.5 ? 'left' : 'right';
      return 'straight';
    });
  }

  // --- Police: chase the player along the roads, then ram up close ----------
  function policeStep(car, dt, target, time) {
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 18) {
      // Close in: steer straight at the player so the cruiser can touch him.
      const desired = Math.atan2(dx, dz);
      let dh = desired - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const turnAmount = Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      car.steer = turnAmount / Math.max(dt, 0.001) / 2;
      car.heading += turnAmount;
      const want = dist > 60 ? CAR.policeSpeed : CAR.policeSpeed * 0.85;
      car.speed += Math.max(-18 * dt, Math.min(14 * dt, want - car.speed));
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
    } else {
      // Far off: follow the roads, and at each intersection take the turn
      // that puts the cruiser closest to the player 30 m down the road.
      followRoad(car, dt, CAR.policeSpeed, (c, nearX, nearZ) => {
        const candidates = [];
        const fwd = forwardOf(c.heading);
        candidates.push({ turn: 'straight', x: c.x + fwd.x * 30, z: c.z + fwd.z * 30 });
        // Left and right from the current heading.
        const leftDir = c.axis === 'x'
          ? { x: 0, z: c.dir > 0 ? -1 : 1 }
          : { x: c.dir > 0 ? 1 : -1, z: 0 };
        const rightDir = { x: -leftDir.x, z: -leftDir.z };
        candidates.push({ turn: 'left', x: nearX + leftDir.x * 30, z: nearZ + leftDir.z * 30 });
        candidates.push({ turn: 'right', x: nearX + rightDir.x * 30, z: nearZ + rightDir.z * 30 });
        let best = candidates[0];
        let bestD = Infinity;
        for (const cand of candidates) {
          const d = Math.hypot(cand.x - target.x, cand.z - target.z);
          if (d < bestD) {
            bestD = d;
            best = cand;
          }
        }
        return best.turn;
      });
    }
    const phase = Math.floor(time * 4) % 2 === 0;
    barRedMat.emissiveIntensity = phase ? 2.2 : 0.1;
    barBlueMat.emissiveIntensity = phase ? 0.1 : 2.2;
    return dist;
  }

  // Snap a car onto the road grid at its current position, so road following
  // starts from a real road instead of the middle of a block.
  function snapToRoad(car) {
    const onX = CITY.roads.find((c) => Math.abs(car.x - c) < 6);
    const onZ = CITY.roads.find((c) => Math.abs(car.z - c) < 6);
    if (onX !== undefined && (onZ === undefined || Math.abs(car.x - onX) <= Math.abs(car.z - onZ))) {
      car.axis = 'z';
      car.lane = onX;
      car.dir = rng.next() < 0.5 ? 1 : -1;
      car.heading = car.dir > 0 ? 0 : Math.PI;
    } else if (onZ !== undefined) {
      car.axis = 'x';
      car.lane = onZ;
      car.dir = rng.next() < 0.5 ? 1 : -1;
      car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    return car;
  }

  // --- Player driving --------------------------------------------------------
  function driveStep(car, dt, input) {
    let move = input.move();
    // Cruise: a staged shot car keeps its throttle open with no keys pressed.
    if (car.cruise) move = { forward: 1, right: 0 };
    const accel = move.forward * (move.forward > 0 ? CAR.accel : CAR.reverseAccel);
    if (move.forward !== 0) {
      car.speed += accel * dt;
    } else {
      const drag = 8 * dt;
      car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
    }
    if (input.handbrake()) car.speed *= Math.max(0, 1 - 3.2 * dt);
    const maxSpeed = car.topSpeed ?? CAR.maxSpeed;
    car.speed = Math.max(-10, Math.min(maxSpeed, car.speed));
    const steerAmount = move.right * CAR.steer * Math.max(0.35, 1 - Math.abs(car.speed) / (maxSpeed * 1.6));
    car.steer = steerAmount;
    car.heading += steerAmount * Math.sign(car.speed || 1) * dt * Math.min(1, Math.abs(car.speed) / 4 + 0.25);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    return move;
  }

  function collideWorld(car) {
    // City bounds and the water.
    car.x = Math.max(-202, Math.min(202, car.x));
    if (city.inWater(car.x, car.z)) {
      // The pier ends at z 234; everywhere else the water starts at 208.
      const edge = Math.abs(car.x - 150) < 4.2 ? 233.5 : CITY.oceanZ - 2.5;
      car.z = Math.min(car.z, edge);
      car.speed *= 0.4;
    }
    car.z = Math.max(-202, Math.min(232, car.z));
    const push = city.collideCircle(car.x, car.z, CAR.radius);
    if (push.x !== 0 || push.z !== 0) {
      car.x += push.x;
      car.z += push.z;
      car.speed *= 0.55;
    }
  }

  function collideCars() {
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        if (a.wrecked || b.wrecked) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = CAR.radius * 2 - 0.4;
        if (d > 0.01 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.x -= nx * push;
          a.z -= nz * push;
          b.x += nx * push;
          b.z += nz * push;
          const rel = Math.abs(a.speed - b.speed);
          if (rel > 6) {
            a.speed *= 0.7;
            b.speed *= 0.7;
            a.health -= rel * 0.6;
            b.health -= rel * 0.6;
          }
        }
      }
    }
  }

  function spawnTraffic(count, near) {
    for (let i = 0; i < count; i += 1) {
      const p = city.randomRoadPoint();
      if (near && Math.hypot(p.x - near.x, p.z - near.z) < 25) continue;
      const horizontal = rng.next() < 0.5;
      const car = addCar('traffic', p.x, p.z, horizontal ? Math.PI / 2 : 0, undefined);
      car.axis = horizontal ? 'x' : 'z';
      car.dir = rng.next() < 0.5 ? 1 : -1;
      car.lane = horizontal ? p.z : p.x;
      car.heading = horizontal ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.speed = CAR.trafficSpeed * rng.range(0.7, 1);
      syncMesh(car);
    }
  }

  function nearestCar(x, z, maxDist, kinds) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (kinds && !kinds.includes(car.kind)) continue;
      if (car.wrecked) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function update(dt, time, playerCar, input, target) {
    for (const car of [...cars]) {
      if (car.wrecked) {
        car.wreckTimer -= dt;
        if (car.wreckTimer <= 0) removeCar(car);
        continue;
      }
      // A parked car (the Comet GT at the marina) stays put until someone
      // gets in and drives it.
      if (car.parked) {
        syncMesh(car);
        continue;
      }
      if (car === playerCar && input) driveStep(car, dt, input);
      else if (car.kind === 'traffic') trafficStep(car, dt);
      else if (car.kind === 'police' && target) policeStep(car, dt, target, time);
      else if (car.kind === 'police') { /* parked, waiting */ }
      if (car.health <= 0 && car.kind !== 'player') {
        car.wrecked = true;
        car.wreckTimer = 6;
        car.speed = 0;
      }
      collideWorld(car);
      syncMesh(car);
    }
    collideCars();
    // Wheels: spin with speed, front pair steers.
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    let wi = 0;
    for (const car of cars) {
      if (car.wrecked) continue;
      const fwd = forwardOf(car.heading);
      const right = { x: fwd.z, z: -fwd.x };
      const spin = (car.speed * time) / 0.34;
      for (const [wx, wz, steer] of [
        [-0.85, 1.45, car.steer ?? 0], [0.85, 1.45, car.steer ?? 0],
        [-0.85, -1.45, 0], [0.85, -1.45, 0],
      ]) {
        const px = car.x + right.x * wx + fwd.x * wz;
        const pz = car.z + right.z * wx + fwd.z * wz;
        e.set(spin, car.heading + (steer ? steer * 0.4 : 0), 0, 'YXZ');
        q.setFromEuler(e);
        m4.compose(v.set(px, 0.34, pz), q, s);
        wheels.setMatrixAt(wi, m4);
        wi += 1;
      }
    }
    wheels.count = wi;
    wheels.instanceMatrix.needsUpdate = true;
  }

  function setDusk(dusk) {
    headMat.emissiveIntensity = dusk ? 1.6 : 0.25;
  }

  return {
    cars, addCar, removeCar, spawnTraffic, nearestCar, update, syncMesh, setDusk, snapToRoad,
  };
}

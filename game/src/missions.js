// The story: Marco Vale drives for Rico, a fixer in Old Town. Five jobs,
// then free roam. Each step points at a glowing beacon in the world and a
// line on the HUD; the step completes when Marco reaches it, picks something
// up, steals the right car, delivers it, loses the heat or beats the clock.
import * as THREE from 'three';
import { MISSIONS, FARE_MIN, FARE_MAX } from './config.js';

export function createMissions(scene, city, vehicles, peds, rng, game) {
  // The beacon: a column of light and a turning diamond over the target.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffe14d, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 22, 12, 1, true), beaconMat);
  beacon.position.y = 11;
  beacon.visible = false;
  scene.add(beacon);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  gem.visible = false;
  scene.add(gem);

  const state = {
    index: 0, // which mission
    step: 0, // which step of it
    done: false, // the whole story is finished
    timer: 0, // seconds left on a timed step
    fare: null, // the side-activity taxi fare
    fareCooldown: 0,
    passenger: null, // the Lena ped for mission 1
    comet: null, // the car to steal in mission 2
  };

  function current() {
    return MISSIONS[state.index];
  }

  function currentStep() {
    const m = current();
    return m ? m.steps[state.step] : null;
  }

  function targetOf(step) {
    return step ? { x: step.x, z: step.z } : null;
  }

  function placeBeacon(x, z) {
    beacon.position.set(x, 11, z);
    beacon.visible = true;
    gem.position.set(x, 5, z);
    gem.visible = true;
  }

  function hideBeacon() {
    beacon.visible = false;
    gem.visible = false;
  }

  function beginStep() {
    const step = currentStep();
    if (!step) return;
    if (step.type === 'evade') game.setWanted(step.stars);
    if (step.type === 'timed') {
      game.setWanted(step.heat);
      state.timer = step.seconds;
    }
    if (step.type === 'pickup' && state.index === 0) {
      // Lena waits at the pier — she stands still until Marco picks her up,
      // instead of drifting off along her sidewalk lane.
      state.passenger = peds.spawnAt(step.x + 1, step.z + 1);
      state.passenger.wait = 9999;
    }
    const t = targetOf(step);
    if (t) placeBeacon(t.x, t.z);
    game.toast(`${current().title}: ${step.label}`);
  }

  function startMission(i) {
    state.index = i;
    state.step = 0;
    beginStep();
  }

  function advance() {
    const m = current();
    state.step += 1;
    if (state.step >= m.steps.length) {
      // Advance the mission index FIRST: addCash/save write the mission
      // number to the save, and it must be the new one, not the finished one.
      state.index += 1;
      state.step = 0;
      game.addCash(m.reward);
      game.toast(`Job done: ${m.title} — +$${m.reward}`);
      if (state.index >= MISSIONS.length) {
        state.done = true;
        hideBeacon();
        game.toast('Story complete — Solmar is yours. Free roam, Marco.');
        game.save();
        return;
      }
      game.save();
      game.toast(`New job: ${current().title} — ${current().brief}`);
      beginStep();
    } else {
      beginStep();
    }
  }

  function failMission(reason) {
    game.toast(`Job failed: ${reason} — try it again.`);
    game.setWanted(0);
    startMission(state.index);
  }

  // The E key near a pickup target: returns true when it did something.
  function tryInteract(player) {
    const step = currentStep();
    if (!step) return false;
    const d = Math.hypot(player.x - step.x, player.z - step.z);
    if (step.type === 'pickup' && d < 5) {
      if (state.passenger) {
        peds.remove(state.passenger);
        state.passenger = null;
      }
      game.toast('Passenger aboard.');
      advance();
      return true;
    }
    if (state.fare && state.fare.stage === 'pickup') {
      const fd = Math.hypot(player.x - state.fare.x, player.z - state.fare.z);
      if (fd < 5) {
        state.fare.stage = 'deliver';
        placeBeacon(state.fare.dx, state.fare.dz);
        game.toast('Passenger aboard — take them to the marker.');
        return true;
      }
    }
    return false;
  }

  function spawnFare() {
    const a = city.randomSidewalkPoint();
    const b = city.randomSidewalkPoint();
    state.fare = {
      x: a.x, z: a.z, dx: b.x, dz: b.z,
      stage: 'pickup',
      pay: Math.floor(FARE_MIN + rng.next() * (FARE_MAX - FARE_MIN)),
    };
    placeBeacon(a.x, a.z);
  }

  function update(dt, player, playerCar, time) {
    gem.rotation.y = time * 1.5;
    gem.position.y = 5 + Math.sin(time * 2) * 0.5;
    beaconMat.opacity = 0.11 + Math.sin(time * 2) * 0.04;
    const step = currentStep();
    const px = playerCar ? playerCar.x : player.x;
    const pz = playerCar ? playerCar.z : player.z;
    if (step) {
      const d = Math.hypot(px - step.x, pz - step.z);
      if (step.type === 'goto' && d < 9) {
        if (step.passenger) game.toast('Lena: "Thanks, Marco. You drive like the city owes you."');
        advance();
      } else if (step.type === 'deliver' && d < 10) {
        if (!step.car) advance();
        else if (playerCar && playerCar.missionCar === step.car) advance();
      } else if (step.type === 'evade') {
        if (game.wanted() === 0) advance();
      } else if (step.type === 'timed') {
        state.timer -= dt;
        if (d < 10) advance();
        else if (state.timer <= 0) failMission('Out of time.');
      }
    } else if (state.done) {
      // Free roam: taxi fares keep the meter running.
      if (!state.fare) {
        state.fareCooldown -= dt;
        if (state.fareCooldown <= 0) spawnFare();
      } else if (state.fare.stage === 'deliver') {
        const d = Math.hypot(px - state.fare.dx, pz - state.fare.dz);
        if (d < 9) {
          game.addCash(state.fare.pay);
          game.toast(`Fare complete — +$${state.fare.pay}`);
          game.save();
          state.fare = null;
          state.fareCooldown = 20;
          hideBeacon();
        }
      }
    }
  }

  function objective() {
    const step = currentStep();
    if (step) {
      return {
        label: `${current().title} — ${step.label}`,
        x: step.x, z: step.z,
        timer: step.type === 'timed' ? Math.max(0, state.timer) : null,
      };
    }
    if (state.fare) {
      return {
        label: state.fare.stage === 'pickup' ? 'Taxi fare — pick up the passenger' : 'Taxi fare — drop them off',
        x: state.fare.stage === 'pickup' ? state.fare.x : state.fare.dx,
        z: state.fare.stage === 'pickup' ? state.fare.z : state.fare.dz,
        timer: null,
      };
    }
    return { label: 'Free roam — explore Solmar', x: null, z: null, timer: null };
  }

  // Called when Marco gets into a car: stealing the marked car is a crime
  // and finishes a steal step.
  function onEnterCar(car) {
    const step = currentStep();
    if (step && step.type === 'steal' && car.missionCar === step.car) {
      game.onCrime(1, 'You stole the Comet GT.');
      advance();
    }
  }

  return {
    state, current, currentStep, startMission, advance, failMission, onEnterCar,
    tryInteract, update, objective, placeBeacon, hideBeacon,
  };
}

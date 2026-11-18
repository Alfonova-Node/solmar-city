// SOLMAR — missions: Rico's five-job chain, then taxi fares in free roam.
// Each mission is a list of steps (go to a place, steal a car, survive, race).
// The module owns the objective text, the marker position and the payout.

import * as THREE from 'three';
import { MISSIONS, TAXI_FARES } from './settings.js';

export function createMissions(scene) {
  // the objective marker: a tall golden beam plus a floating diamond
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  beam.visible = false;
  scene.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: 0xffd34d }),
  );
  diamond.visible = false;
  scene.add(diamond);

  let missionIndex = 0; // which of the five missions is active
  let stepIndex = 0;
  let surviveLeft = 0;
  let raceLeft = 0;
  let taxi = null; // active taxi fare {pickup, drop, pay, state}
  let fareIndex = 0;
  let done = false; // all five missions finished
  let message = '';
  let messageT = 0;

  function currentMission() {
    return MISSIONS[missionIndex] || null;
  }

  function currentStep() {
    const m = currentMission();
    return m ? m.steps[stepIndex] : null;
  }

  function setMarker(x, z) {
    beam.visible = true;
    diamond.visible = true;
    beam.position.x = x;
    beam.position.z = z;
    diamond.position.set(x, 8, z);
  }

  function clearMarker() {
    beam.visible = false;
    diamond.visible = false;
  }

  function showMessage(text, seconds) {
    message = text;
    messageT = seconds || 4;
  }

  function objectiveText() {
    if (done && !taxi) return 'All missions done — pick up taxi fares around the city (E near a waiting passenger).';
    if (taxi) {
      if (taxi.state === 'pickup') return `Taxi fare: pick up the passenger in ${taxi.fare.from}.`;
      return `Taxi fare: take the passenger to ${taxi.fare.to} — $${taxi.fare.pay}.`;
    }
    const m = currentMission();
    const s = currentStep();
    if (!m || !s) return '';
    if (s.kind === 'survive') return `${m.name}: ${s.label} — ${Math.ceil(surviveLeft)}s left.`;
    if (s.kind === 'race') return `${m.name}: ${s.label} — ${Math.ceil(raceLeft)}s left.`;
    return `${m.name}: ${s.label}.`;
  }

  function stepPosition() {
    if (taxi) {
      const t = taxi.state === 'pickup' ? { x: taxi.fare.x, z: taxi.fare.z } : { x: taxi.fare.tx, z: taxi.fare.tz };
      return t;
    }
    const s = currentStep();
    return s && s.x !== undefined ? { x: s.x, z: s.z } : null;
  }

  function startMission(i) {
    missionIndex = i;
    stepIndex = 0;
    const m = currentMission();
    if (!m) return;
    const s = currentStep();
    if (s && s.kind === 'survive') surviveLeft = s.seconds;
    if (s && s.kind === 'race') raceLeft = s.seconds;
    showMessage(`${m.name} — ${m.brief}`, 6);
  }

  function advance(state) {
    // state: {x, z, inCar, carKind, wanted} — returns an event or null
    const m = currentMission();
    if (!m) return null;
    const s = currentStep();
    if (!s) return null;
    if (s.kind === 'goto' || s.kind === 'race') {
      const d = Math.hypot(state.x - s.x, state.z - s.z);
      if (d < 7) {
        return completeStep();
      }
    }
    if (s.kind === 'steal') {
      if (state.inCar && state.carKind === 'comet') return completeStep();
    }
    if (s.kind === 'survive') {
      if (surviveLeft <= 0) return completeStep();
    }
    return null;
  }

  function completeStep() {
    const m = currentMission();
    const s = currentStep();
    stepIndex += 1;
    if (stepIndex >= m.steps.length) {
      // mission complete
      const pay = m.pay;
      missionIndex += 1;
      stepIndex = 0;
      if (missionIndex >= MISSIONS.length) {
        done = true;
        clearMarker();
        showMessage(`All missions complete! Rico trusts you now. Taxi fares pay the bills.`, 6);
        return { type: 'missionDone', pay, mission: m };
      }
      const next = currentMission();
      const ns = currentStep();
      if (ns && ns.kind === 'survive') surviveLeft = ns.seconds;
      if (ns && ns.kind === 'race') raceLeft = ns.seconds;
      showMessage(`${m.name} complete — $${pay}. Next: ${next.name}.`, 5);
      return { type: 'missionDone', pay, mission: m };
    }
    const ns = currentStep();
    if (ns && ns.kind === 'survive') surviveLeft = ns.seconds;
    if (ns && ns.kind === 'race') raceLeft = ns.seconds;
    showMessage(`Objective done — ${ns ? ns.label : ''}`, 3);
    return { type: 'stepDone', step: s };
  }

  function tick(dt, state) {
    // per-frame: timers, marker bob, taxi logic
    if (messageT > 0) messageT -= dt;
    const s = currentStep();
    if (s && s.kind === 'survive') {
      surviveLeft -= dt;
      if (surviveLeft < 0) surviveLeft = 0;
    }
    if (s && s.kind === 'race') {
      raceLeft -= dt;
      if (raceLeft < 0) {
        raceLeft = 0;
        return { type: 'raceFailed' };
      }
    }
    diamond.rotation.y += dt * 2;
    diamond.position.y = 8 + Math.sin(performance.now() / 350) * 0.7;
    const pos = stepPosition();
    if (pos) setMarker(pos.x, pos.z);
    else clearMarker();
    return null;
  }

  function startTaxiFare() {
    if (taxi || !done) return false;
    const fare = TAXI_FARES[fareIndex % TAXI_FARES.length];
    fareIndex += 1;
    taxi = { fare, state: 'pickup' };
    showMessage(`Taxi fare: pick up the passenger in ${fare.from} — $${fare.pay}.`, 4);
    return true;
  }

  function taxiStep(state) {
    if (!taxi) return null;
    if (taxi.state === 'pickup') {
      const d = Math.hypot(state.x - taxi.fare.x, state.z - taxi.fare.z);
      if (d < 7) {
        taxi.state = 'drop';
        showMessage('Passenger aboard — take them to ' + taxi.fare.to + '.', 3);
        return { type: 'taxiPickup' };
      }
    } else {
      const d = Math.hypot(state.x - taxi.fare.tx, state.z - taxi.fare.tz);
      if (d < 7) {
        const pay = taxi.fare.pay;
        taxi = null;
        showMessage(`Fare complete — $${pay}.`, 3);
        return { type: 'taxiDone', pay };
      }
    }
    return null;
  }

  function restore(index) {
    if (index >= MISSIONS.length) {
      missionIndex = MISSIONS.length;
      done = true;
      clearMarker();
      showMessage('Welcome back — all missions done. Taxi fares pay the bills.', 5);
    } else if (index > 0) {
      startMission(index);
    }
  }

  function reset() {
    missionIndex = 0;
    stepIndex = 0;
    taxi = null;
    done = false;
    startMission(0);
  }

  startMission(0);

  return {
    get missionIndex() { return missionIndex; },
    get done() { return done; },
    get taxi() { return taxi; },
    get message() { return messageT > 0 ? message : ''; },
    currentMission, currentStep, objectiveText, stepPosition,
    advance, tick, startTaxiFare, taxiStep, startMission, reset, restore, showMessage,
    get surviveLeft() { return surviveLeft; },
    get raceLeft() { return raceLeft; },
    set surviveLeft(v) { surviveLeft = v; },
    set raceLeft(v) { raceLeft = v; },
  };
}

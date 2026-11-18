// SOLMAR — boot: the entry point. Renderer, lights, camera, game loop,
// state machine (menu / playing / paused / busted / wasted), car theft,
// combat triggers, wanted updates, HUD wiring, save and the shot director.

import * as THREE from 'three';
import { WORLD, PALETTE, PLAYER, SPAWN, KEYS } from './settings.js';
import { buildCity, onRoad } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCarWorld } from './cars.js';
import { createPeople } from './people.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { shotFromUrl, applyShot } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.skyDay);
scene.fog = new THREE.Fog(PALETTE.fogDay, 120, 420);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a4a3a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(PALETTE.sunDay, 1.6);
sun.position.set(120, 180, 60);
scene.add(sun);

const city = buildCity(scene);
const input = createInput(canvas);
const audio = createAudio();
const cars = createCarWorld(scene, city);
const people = createPeople(scene, city);
const police = createPolice();
const missions = createMissions(scene);
const hud = createHud();

// --- game state ---
const saved = loadSave();
let state = 'menu'; // menu | playing | paused | busted | wasted
let money = saved ? saved.money : PLAYER.startMoney;
let inCar = null; // the car object Marco is driving, or null
let orbitYaw = 0;
let orbitPitch = 0.32;
let cameraMode = 'chase'; // chase | fixed
let fixedCam = null;
let shotAutoDrive = false; // the cover shot drives itself so the chase is moving
let timeOfDay = 'day';
let lastCrimeAt = 0;
let saveTimer = 0;
let frame = 0;
let playSeconds = 0;

if (saved) {
  people.player.x = saved.x;
  people.player.z = saved.z;
  people.player.health = saved.health;
  missions.restore(saved.missionIndex);
}

function setTimeOfDay(mode) {
  timeOfDay = mode;
  if (mode === 'dusk') {
    scene.background.setHex(PALETTE.skyDusk);
    scene.fog.color.setHex(PALETTE.fogDusk);
    sun.color.setHex(PALETTE.sunDusk);
    sun.position.set(-140, 70, 90);
    sun.intensity = 1.1;
    hemi.intensity = 0.55;
  } else {
    scene.background.setHex(PALETTE.skyDay);
    scene.fog.color.setHex(PALETTE.fogDay);
    sun.color.setHex(PALETTE.sunDay);
    sun.position.set(120, 180, 60);
    sun.intensity = 1.6;
    hemi.intensity = 0.9;
  }
}

function playerPos() {
  if (inCar) return { x: inCar.x, z: inCar.z, heading: inCar.heading };
  return { x: people.player.x, z: people.player.z, heading: people.player.heading };
}

function startPlaying() {
  if (state === 'menu' || state === 'paused' || state === 'busted' || state === 'wasted') {
    state = 'playing';
    hud.showGame();
    audio.unlock();
  }
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  hud.showPause();
  autosave();
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  hud.showGame();
}

function bustPlayer() {
  state = 'busted';
  hud.showBusted();
  audio.busted();
  police.reset();
  autosave();
}

function wastePlayer() {
  state = 'wasted';
  hud.showWasted();
  audio.busted();
  autosave();
}

function respawn() {
  people.player.health = PLAYER.health;
  people.player.x = SPAWN.x;
  people.player.z = SPAWN.z;
  people.player.heading = SPAWN.heading;
  people.player.mesh.position.set(SPAWN.x, 0, SPAWN.z);
  if (inCar) {
    inCar.speed = 0;
    inCar = null;
  }
  police.reset();
  state = 'playing';
  hud.showGame();
  missions.showMessage('Back on the streets. Rico is still waiting.', 4);
}

function autosave() {
  const p = playerPos();
  writeSave({
    money,
    missionIndex: missions.missionIndex,
    x: p.x,
    z: p.z,
    health: people.player.health,
  });
}

function enterCar(car, stolen) {
  inCar = car;
  car.taken = true;
  car.speed = 0;
  people.player.mesh.visible = false;
  if (stolen) {
    const crime = police.addCrime(1, 'stole a car');
    missions.showMessage(crime.wanted > 0 ? 'Stolen! The cops saw that — wanted level ' + crime.wanted + '.' : 'Car stolen.', 3);
  }
}

function exitCar() {
  if (!inCar) return;
  const car = inCar;
  car.speed = 0;
  car.taken = false;
  const px = car.x - Math.sin(car.heading) * 3;
  const pz = car.z - Math.cos(car.heading) * 3;
  people.player.x = px;
  people.player.z = pz;
  people.player.heading = car.heading;
  people.player.mesh.position.set(px, 0, pz);
  people.player.mesh.visible = true;
  inCar = null;
}

function nearestCopDist() {
  const p = playerPos();
  let best = null;
  for (const c of cars.police) {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (best === null || d < best) best = d;
  }
  return best;
}

// --- buttons on the menu screens ---
document.getElementById('btn-start').addEventListener('click', () => {
  audio.unlock();
  startPlaying();
});
document.getElementById('btn-continue').addEventListener('click', () => {
  audio.unlock();
  startPlaying();
});
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-retry-busted').addEventListener('click', respawn);
document.getElementById('btn-retry-wasted').addEventListener('click', respawn);
document.getElementById('btn-menu-busted').addEventListener('click', () => { state = 'menu'; hud.showStart(); });
document.getElementById('btn-menu-wasted').addEventListener('click', () => { state = 'menu'; hud.showStart(); });
document.getElementById('btn-newgame').addEventListener('click', () => {
  clearSave();
  money = PLAYER.startMoney;
  missions.reset();
  respawn();
  state = 'playing';
  hud.showGame();
});

// --- the public handle the shot director and the play-test use ---
const game = {
  startPlaying,
  teleportPlayer(x, z, heading) {
    if (inCar) exitCar();
    people.player.x = x;
    people.player.z = z;
    people.player.heading = heading;
    people.player.mesh.position.set(x, 0, z);
  },
  spawnPlayerCar(x, z, heading) {
    const mesh = cars.makeCarMesh(0x2e86c1, false, false);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = { mesh, x, z, heading, speed: 0, kind: 'player', alive: true, taken: false };
    cars.freeCars.push(car);
    return car;
  },
  putPlayerInCar(car) {
    enterCar(car, false);
  },
  setWanted(n) {
    police.wanted = n;
  },
  setMission(i) {
    missions.startMission(i);
  },
  setTimeOfDay,
  setAutoDrive(v) {
    shotAutoDrive = !!v;
  },
  fixCamera(x, y, z, tx, ty, tz) {
    cameraMode = 'fixed';
    fixedCam = { pos: new THREE.Vector3(x, y, z), target: new THREE.Vector3(tx, ty, tz) };
  },
  useChaseCamera() {
    cameraMode = 'chase';
    fixedCam = null;
    orbitYaw = 0;
  },
  state() {
    const p = playerPos();
    return {
      mode: state, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10,
      heading: Math.round(p.heading * 100) / 100,
      health: Math.round(people.player.health), money,
      wanted: police.wanted, inCar: !!inCar,
      speed: inCar ? Math.round(inCar.speed * 10) / 10 : 0,
      missionIndex: missions.missionIndex,
    };
  },
};

window.__solmar = game;
window.__solmarErrors = [];
window.addEventListener('error', (e) => window.__solmarErrors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__solmarErrors.push('rejection: ' + String(e.reason)));

// --- main loop ---
const clock = new THREE.Clock();
let lastHud = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1); // 0.1 keeps the game near real time on slow software renderers
  frame += 1;

  // menu keys
  if (state === 'menu' && (input.wasPressed('Enter') || input.wasPressed('Space'))) {
    audio.unlock();
    startPlaying();
  }
  if (state === 'playing' && input.wasPressed(...KEYS.pause)) pauseGame();
  else if (state === 'paused' && input.wasPressed(...KEYS.pause)) resumeGame();
  if (input.wasPressed(...KEYS.mute)) {
    const m = audio.toggleMute();
    missions.showMessage(m ? 'Sound muted.' : 'Sound on.', 2);
  }

  if (state === 'playing') {
    playSeconds += dt;
    const fwd = shotAutoDrive && inCar ? 1 : input.forwardAxis();
    const steer = input.steerAxis();
    const orbit = input.takeOrbit();
    orbitYaw -= orbit.dx * 0.004;
    orbitPitch = Math.max(0.08, Math.min(1.1, orbitPitch + orbit.dy * 0.003));

    if (inCar) {
      cars.driveCar(inCar, dt, fwd, steer, input.isDown('Space'));
      // running over a pedestrian is a crime
      for (const p of people.peds) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - inCar.x, p.z - inCar.z);
        if (d < 2.1 && Math.abs(inCar.speed) > 4) {
          p.alive = false;
          p.mesh.visible = false;
          window.setTimeout(() => { p.alive = true; p.mesh.visible = true; }, 12000);
          police.addCrime(1, 'hit a pedestrian');
          missions.showMessage('You hit a pedestrian! Wanted level ' + police.wanted + '.', 3);
        }
      }
      // police ramming damages the car and Marco
      for (const c of cars.police) {
        const d = Math.hypot(c.x - inCar.x, c.z - inCar.z);
        if (d < 3.4) {
          inCar.speed *= 0.94;
          people.player.health -= 6 * dt;
        }
      }
    } else {
      people.stepPlayer(dt, fwd, steer, input.running, false);
      // police on foot close in and rough Marco up
      for (const c of cars.police) {
        const d = Math.hypot(c.x - people.player.x, c.z - people.player.z);
        if (d < 2.4) people.player.health -= 9 * dt;
      }
    }

    // enter / exit a car
    if (input.wasPressed(...KEYS.enterCar)) {
      if (inCar) {
        exitCar();
      } else {
        const car = cars.nearestStealable(people.player.x, people.player.z, 4.5);
        if (car) {
          const stolen = car.kind === 'traffic' || car.kind === 'parked' || car.kind === 'comet';
          enterCar(car, stolen);
          if (car.kind === 'comet') missions.showMessage('The Comet GT is yours. Get it to Rico\'s garage!', 4);
        }
      }
    }

    // combat on foot
    const p = playerPos();
    if (!inCar && input.wasPressed(...KEYS.punch)) {
      audio.punch();
      const hit = people.punch(p.x, p.z, p.heading, 2.4, PLAYER.punchDamage, (kind) => {
        if (kind === 'cop') police.addCrime(2, 'punched a cop');
      }, cars.police);
      if (hit === 'cop') missions.showMessage('You punched a cop! Wanted level ' + police.wanted + '.', 3);
    }
    if (!inCar && input.takeClick()) {
      audio.gunshot();
      const res = people.shoot(p.x, p.z, p.heading, PLAYER.pistolRange, PLAYER.pistolDamage, cars.police);
      if (res.outOfAmmo) {
        missions.showMessage('Out of ammo — press R to reload at a gun shop... (reloads free for now).', 3);
        people.player.ammo = PLAYER.pistolAmmo;
      } else if (res.hit) {
        police.addCrime(2, 'fired a weapon');
        for (const ped of people.peds) {
          const d = Math.hypot(ped.x - p.x, ped.z - p.z);
          if (d < 40) ped.state = 'flee';
        }
        if (res.hit === 'cop') missions.showMessage('You shot a cop! Wanted level ' + police.wanted + '.', 3);
      }
    }
    if (input.wasPressed(...KEYS.reload)) {
      people.player.ammo = PLAYER.pistolAmmo;
      missions.showMessage('Pistol reloaded.', 2);
    }

    // world simulation
    cars.stepTraffic(dt, p.x, p.z);
    cars.stepPolice(dt, p.x, p.z, police.wanted);
    const dangerR = inCar ? Math.abs(inCar.speed) * 1.2 + 6 : 0;
    people.stepPeds(dt, p.x, p.z, dangerR);

    // wanted + bust
    const committing = false;
    const pol = police.update(dt, committing, !!inCar, inCar ? Math.abs(inCar.speed) : 0, nearestCopDist());
    if (pol.busted) {
      bustPlayer();
    }
    if (people.player.health <= 0) {
      wastePlayer();
    }

    // missions
    const mstate = { x: p.x, z: p.z, inCar: !!inCar, carKind: inCar ? inCar.kind : null, wanted: police.wanted };
    const cs = missions.currentStep();
    if (cs && cs.kind === 'survive' && police.wanted < 3) {
      police.wanted = 3; // the Heat mission starts with the whole PD after Marco
      missions.showMessage('Wanted level 3! Lose the police, then reach the hideout.', 4);
    }
    const raceFail = missions.tick(dt, mstate);
    if (raceFail && raceFail.type === 'raceFailed') {
      missions.showMessage('Out of time! The sprint failed — Rico gives you one more shot.', 5);
      missions.startMission(missions.missionIndex);
    }
    const ev = missions.advance(mstate);
    if (ev && ev.type === 'missionDone') {
      money += ev.pay;
      audio.missionDone();
      autosave();
    }
    const tev = missions.taxiStep(mstate);
    if (tev && tev.type === 'taxiDone') {
      money += tev.pay;
      audio.pickup();
      autosave();
    }
    // taxi: standing near a fare pickup with no active fare starts one
    if (missions.done && !missions.taxi && !inCar) {
      const pos = { x: p.x, z: p.z };
      const fares = [
        { x: -12, z: -120 }, { x: 132, z: -30 }, { x: 0, z: 0 }, { x: 60, z: 138 },
      ];
      for (const f of fares) {
        if (Math.hypot(pos.x - f.x, pos.z - f.z) < 6) {
          missions.startTaxiFare();
          break;
        }
      }
    }

    // audio
    audio.setEngine(inCar ? Math.abs(inCar.speed) / 42 : 0, !!inCar);
    audio.setSiren(police.wanted > 0);

    // hint line
    let hint = '';
    if (!inCar) {
      const car = cars.nearestStealable(p.x, p.z, 4.5);
      if (car) hint = 'Press E to ' + (car.kind === 'comet' ? 'steal the Comet GT' : 'take the car');
      else hint = 'WASD move · Shift run · E enter car · F punch · Click shoot · P pause';
    } else {
      hint = 'W/S drive · A/D steer · Space handbrake · E exit car';
    }
    hud.setHint(hint);

    // periodic autosave
    saveTimer += dt;
    if (saveTimer > 15) {
      saveTimer = 0;
      autosave();
    }
  } else {
    // frozen world: traffic still drifts a little on the menu so the city feels alive
    if (state === 'menu') {
      const p = playerPos();
      cars.stepTraffic(dt * 0.5, p.x, p.z);
      people.stepPeds(dt * 0.5, p.x, p.z, 0);
    }
    audio.setEngine(0, false);
    audio.setSiren(false);
  }

  // --- camera ---
  const target = playerPos();
  if (cameraMode === 'fixed' && fixedCam) {
    camera.position.copy(fixedCam.pos);
    camera.lookAt(fixedCam.target);
  } else {
    const camHeading = target.heading + orbitYaw + Math.PI;
    const dist = inCar ? 13 : 9;
    const height = 4.2 + orbitPitch * 7;
    const cx = target.x + Math.sin(camHeading) * dist;
    const cz = target.z + Math.cos(camHeading) * dist;
    camera.position.set(cx, height, cz);
    camera.lookAt(target.x, 2.2, target.z);
  }

  // --- HUD, throttled to every 6th frame ---
  if (frame % 6 === 0) {
    const p = playerPos();
    hud.setMoney(money);
    hud.setHealth(people.player.health);
    hud.setAmmo(people.player.ammo);
    hud.setWanted(police.wanted);
    hud.setObjective(missions.objectiveText());
    hud.setMessage(missions.message);
    hud.setSpeed(inCar ? Math.abs(inCar.speed) * 3.6 : 0, !!inCar);
    hud.drawMinimap({
      playerX: p.x,
      playerZ: p.z,
      heading: target.heading,
      marker: missions.stepPosition(),
      police: cars.police,
      traffic: cars.traffic,
    });
    hud.setTitle(state === 'menu' ? 'SOLMAR' : 'SOLMAR — ' + (missions.currentMission() ? missions.currentMission().name : 'Free Roam'));
  }

  input.endFrame();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// shot mode: stage the requested scene, otherwise show the start screen
const shot = shotFromUrl();
if (shot) {
  applyShot(game, shot);
  // let the world settle for a few frames, then let police close in a touch
  hud.showGame();
} else {
  hud.showStart();
  window.__solmarReady = true;
}

animate();

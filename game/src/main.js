// SOLMAR — a sunny coastal open world. Marco Vale drives for Rico, a fixer
// in Old Town. Five jobs, then the city is yours. This file wires the
// systems together: the loop, the camera, the screens, save/load, and the
// deterministic screenshot staging.
// Rebuilt file-by-file in the recorded session (recording 01a1eef8).
import * as THREE from 'three';
import { CITY, PLAYER, CAR, PLACES, SAVE_KEY, START_CASH } from './config.js';
import { createInput, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_FIRE } from './input.js';
import { createRandom as createRng } from './random.js';
import { createCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPeds } from './peds.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed') ?? 20261118);
const shotParam = params.get('shot');
let shotWarmupSteps = 240;
const rng = createRng(Number.isFinite(seedParam) ? seedParam : 20261118);

// --- Renderer and scene ------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8d8);
scene.fog = new THREE.Fog(0x9fc4dc, 180, 520);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
// Lighting lives in the city module (createCity adds the sun, the hemisphere
// light and the sky/fog); this file only switches it day/dusk through
// city.setTimeOfDay.

// --- Systems -----------------------------------------------------------------
const city = createCity(scene, rng);
const vehicles = createVehicles(scene, city, rng);
const peds = createPeds(scene, city, rng, 26);
const player = createPlayer(scene, city);
const police = createPolice(vehicles, city, rng);
const hud = createHud(city);
const audio = createAudio();
const input = createInput(renderer.domElement);

let cash = START_CASH;
let playerCar = null;
let screen = 'title';
let timeOfDay = 'day';
let time = 0;
let frames = 0;

// The camera rig: an orbit that eases behind the car when driving and
// follows Marco's back on foot. The mouse drags it; the wheel zooms it.
const cam = {
  yaw: Math.PI,
  pitch: 0.38,
  dist: 13,
  pos: new THREE.Vector3(0, 20, 80),
  setYaw(y) { this.yaw = y; },
  setPitch(p) { this.pitch = Math.max(0.12, Math.min(0.9, p)); },
  snapBehind() {
    const h = playerCar ? playerCar.heading : player.state.heading;
    this.yaw = h + Math.PI;
  },
  update(dt, target, targetHeading, driving, autoFollow) {
    if (driving) {
      let dh = (targetHeading + Math.PI) - this.yaw;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.yaw += dh * Math.min(1, 2.2 * dt);
    } else if (autoFollow) {
      let dh = (targetHeading + Math.PI) - this.yaw;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.yaw += dh * Math.min(1, 0.6 * dt);
    }
    const hd = this.dist * Math.cos(this.pitch);
    const desired = new THREE.Vector3(
      target.x + Math.sin(this.yaw) * hd,
      target.y + 1.5 + this.dist * Math.sin(this.pitch),
      target.z + Math.cos(this.yaw) * hd,
    );
    const k = 1 - Math.exp(-9 * dt);
    this.pos.lerp(desired, k);
    camera.position.copy(this.pos);
    camera.lookAt(target.x, target.y + 1.6, target.z);
  },
};

// --- Save / load ---------------------------------------------------------------
function saveGame() {
  try {
    const data = {
      cash,
      mission: missions.state.index,
      done: missions.state.done,
      x: player.state.x,
      z: player.state.z,
      health: Math.max(1, Math.round(player.state.health)),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable — the game still runs */ }
}

function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// --- The shared game object the missions and the police call into -------------
const game = {
  toast: (m) => hud.toast(m),
  addCash: (n) => {
    cash += n;
    audio.jingle();
    saveGame();
  },
  setWanted: (n) => {
    police.state.stars = n;
  },
  wanted: () => police.state.stars,
  onCrime: (n, reason) => {
    police.addStars(n, reason, (m) => hud.toast(m));
  },
  save: saveGame,
};

const missions = createMissions(scene, city, vehicles, peds, rng, game);

function setTimeOfDay(mode) {
  timeOfDay = mode;
  city.setTimeOfDay(mode === 'dusk');
  vehicles.setDusk(mode === 'dusk');
}

// --- Entering and leaving cars -------------------------------------------------
function enterCar(car, speed = 0) {
  player.enterCar(car);
  playerCar = car;
  car.speed = speed;
  car.parked = false;
  missions.onEnterCar(car);
  audio.chime();
}

function exitCar() {
  player.exitCar();
  playerCar = null;
}

// --- Busted / wasted -----------------------------------------------------------
function respawnAt(place, fine, label) {
  cash = Math.max(0, cash - fine);
  police.clear();
  player.state.health = player.state.maxHealth;
  if (playerCar) {
    playerCar = null;
  }
  player.state.inCar = null;
  player.state.group.visible = true;
  player.teleport(place.x, place.z, 0);
  cam.snapBehind();
  saveGame();
  hud.showOverlay(label);
  screen = label;
}

function onBusted() {
  respawnAt(PLACES.station, 50, 'busted');
  hud.toast('Busted — the cops took $50 and dropped you at the station.');
}

function onWasted() {
  respawnAt(PLACES.hospital, 100, 'wasted');
  hud.toast('Wasted — the hospital took $100. Rico is not impressed.');
}

// --- World setup ---------------------------------------------------------------
function setupWorld() {
  // Marco's own car, parked near the plaza, and the Comet GT at the marina.
  const marcoCar = vehicles.addCar('player', -12, 66, Math.PI / 2, 0x1f8a7a);
  vehicles.syncMesh(marcoCar);
  const comet = vehicles.addCar('traffic', PLACES.marina.x, PLACES.marina.z, 0, 0xe84a10);
  comet.missionCar = 'comet';
  comet.topSpeed = 34;
  comet.parked = true;
  comet.axis = 'z';
  comet.dir = 1;
  comet.lane = 186;
  vehicles.syncMesh(comet);
  missions.state.comet = comet;
  vehicles.spawnTraffic(14, player.state);
  player.teleport(-6, 60, Math.PI);
  missions.startMission(0);
}

setupWorld();

// --- Screens -------------------------------------------------------------------
const saved = loadGame();
if (saved) {
  document.getElementById('btn-continue').style.display = 'inline-block';
  document.getElementById('save-line').textContent =
    `Saved game: $${saved.cash}, job ${Math.min(saved.mission + 1, 5)} of 5.`;
}

function startGame(fresh) {
  audio.unlock();
  if (fresh || !loadGame()) {
    cash = START_CASH;
    player.state.health = player.state.maxHealth;
    player.state.ammo = 24;
    missions.state.index = 0;
    missions.state.step = 0;
    missions.state.done = false;
    player.teleport(-6, 60, Math.PI);
    missions.startMission(0);
    saveGame();
  } else {
    const s = loadGame();
    cash = s.cash;
    player.state.health = s.health;
    player.teleport(s.x, s.z, 0);
    missions.state.index = s.mission;
    missions.state.step = 0;
    missions.state.done = !!s.done;
    if (s.done) missions.hideBeacon();
    else missions.startMission(s.mission);
  }
  hud.showOverlay(null);
  document.getElementById('hud').style.display = 'block';
  screen = 'playing';
}

document.getElementById('btn-new').addEventListener('click', () => startGame(true));
document.getElementById('btn-continue').addEventListener('click', () => startGame(false));
document.getElementById('btn-resume').addEventListener('click', () => {
  hud.showOverlay(null);
  screen = 'playing';
});
document.getElementById('btn-title').addEventListener('click', () => {
  saveGame();
  document.getElementById('hud').style.display = 'none';
  hud.showOverlay('title');
  screen = 'title';
});
document.getElementById('btn-busted').addEventListener('click', () => {
  hud.showOverlay(null);
  screen = 'playing';
});
document.getElementById('btn-wasted').addEventListener('click', () => {
  hud.showOverlay(null);
  screen = 'playing';
});
document.getElementById('btn-complete').addEventListener('click', () => {
  hud.showOverlay(null);
  screen = 'playing';
});

// --- Screenshot staging ---------------------------------------------------------
if (shotParam) {
  const g = {
    setTimeOfDay, vehicles, peds, player, police, missions, hud, camera: cam,
    enterCar, screen,
  };
  shotWarmupSteps = applyShot(shotParam, g) ?? 240;
  screen = 'playing';
  document.getElementById('hud').style.display = 'block';
}

// --- The loop --------------------------------------------------------------------
const clock = new THREE.Clock();
let lastMouseDrag = 0;

function updateWorld(dt) {
  time += dt;
  frames += 1;

  const actionBits = input.takeActions();
  const actions = {
    pause: !!(actionBits & ACTION_PAUSE),
    enter: !!(actionBits & ACTION_ENTER),
    punch: !!(actionBits & ACTION_PUNCH),
    fire: !!(actionBits & ACTION_FIRE),
  };
  const drag = input.takeDrag();
  if (drag.dx !== 0 || drag.dy !== 0) {
    cam.yaw -= drag.dx * 0.005;
    cam.setPitch(cam.pitch + drag.dy * 0.003);
    lastMouseDrag = time;
  }
  cam.dist = Math.max(6, Math.min(20, cam.dist + drag.wheel * 0.01));

  if (screen === 'playing') {
    if (actions.pause) {
      hud.showOverlay('pause');
      screen = 'paused';
    } else {
      if (actions.enter) {
        if (playerCar) {
          exitCar();
        } else if (missions.tryInteract(player.state)) {
          // picked up a passenger — done above
        } else {
          const car = vehicles.nearestCar(player.state.x, player.state.z, 4.5);
          if (car) enterCar(car);
        }
      }
      if (actions.punch) {
        if (player.punch(peds, game.onCrime)) audio.punch();
      }
      if (actions.fire) {
        if (player.fire(peds, vehicles, game.onCrime)) audio.shot();
        else audio.denied();
      }

      const driving = !!playerCar;
      player.update(dt, input, cam.yaw, city, vehicles, peds, game.onCrime);
      const target = driving ? playerCar : player.state;
      vehicles.update(dt, time, playerCar, driving ? input : null, target);

      // The player's car hitting a pedestrian is a crime.
      if (playerCar && Math.abs(playerCar.speed) > 3) {
        for (const ped of peds.peds) {
          if (ped.down) continue;
          if (Math.hypot(ped.x - playerCar.x, ped.z - playerCar.z) < 2.1) {
            peds.knockDown(ped);
            game.onCrime(1, 'You hit a pedestrian.');
            audio.crash();
          }
        }
      }

      const event = police.update(dt, player.state, playerCar, time);
      if (event) {
        if (event.type === 'ram') {
          player.hurt(12);
          audio.crash();
          hud.toast('The cops rammed you.');
        } else if (event.type === 'busted') {
          onBusted();
        } else if (event.type === 'wasted') {
          onWasted();
        }
      }
      if (player.state.health <= 0 && screen === 'playing') onWasted();

      peds.update(dt, time);
      missions.update(dt, player.state, playerCar, time);
      if (missions.state.done && !document.getElementById('screen-complete').dataset.shown) {
        document.getElementById('screen-complete').dataset.shown = '1';
        hud.showOverlay('complete');
        screen = 'complete';
      }

      audio.setEngine(playerCar ? playerCar.speed : 0, CAR.maxSpeed, driving);
      audio.setSiren(police.state.stars > 0);
      audio.updateSiren(dt);
    }
  }

  // Camera follows the player or the car.
  const target = playerCar
    ? { x: playerCar.x, y: 0, z: playerCar.z }
    : { x: player.state.x, y: 0, z: player.state.z };
  const targetHeading = playerCar ? playerCar.heading : player.state.heading;
  const autoFollow = !shotParam && time - lastMouseDrag > 3;
  cam.update(dt, target, targetHeading, !!playerCar, autoFollow);

  if (screen === 'playing' || screen === 'paused' || screen === 'complete') {
    hud.update({
      stars: police.state.stars,
      cash,
      health: player.state.health,
      maxHealth: player.state.maxHealth,
      speed: playerCar ? playerCar.speed : 0,
      ammo: player.state.ammo,
      inCar: !!playerCar,
      objective: missions.objective(),
      player: player.state,
      cars: vehicles.cars,
      time,
    }, dt);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  updateWorld(dt);
  renderer.render(scene, camera);
  city.update(dt, time);
}

// In shot mode the headless screenshot is taken after only a few animation
// frames, so the scene would still be at its first instant. Warm the
// simulation up synchronously instead: 240 fixed steps (4 seconds of game
// time) before the first render, so traffic has moved, the police have
// closed in and the camera has settled. Deterministic for a given seed.
if (shotParam) {
  for (let i = 0; i < shotWarmupSteps; i += 1) updateWorld(1 / 60);
  window.__shotReady = true;
}

// Test/debug handle: read-only game state plus a teleport, used by the
// automated play-test. It exposes no credentials and changes no rules.
window.__solmar = {
  state() {
    return {
      screen, cash, stars: police.state.stars,
      health: player.state.health, ammo: player.state.ammo,
      player: { x: Math.round(player.state.x * 10) / 10, z: Math.round(player.state.z * 10) / 10, inCar: !!playerCar, stateInCar: player.state.inCar !== null, punchCooldown: Math.round(player.state.punchCooldown * 100) / 100 },
      car: playerCar ? { x: Math.round(playerCar.x * 10) / 10, z: Math.round(playerCar.z * 10) / 10, speed: Math.round(playerCar.speed * 10) / 10 } : null,
      mission: missions.state.index, step: missions.state.step,
      objective: missions.objective().label,
      cars: vehicles.cars.length,
      police: police.state.police.length,
      ped0: (() => { const p = peds.peds.find((q) => !q.down); return p ? { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, down: p.down } : null; })(),
    };
  },
  teleport(x, z) { player.teleport(x, z); },
  // Advance the simulation by n fixed steps synchronously. Headless Chrome
  // throttles requestAnimationFrame to ~1 fps, so the play-test drives the
  // loop this way instead of waiting on wall time; a real desktop browser
  // runs the same updateWorld() from the rAF loop.
  step(n = 1) { for (let i = 0; i < n; i += 1) updateWorld(1 / 60); },
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

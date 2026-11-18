// The law in Solmar: a wanted level from 0 to 5 stars, police cars that
// spawn at the edge of sight and chase, and two ways a run ends — BUSTED on
// foot when a slow cruiser sits on you, WASTED when your health runs out.
// Wanted cools off only when no cruiser can see you.
import { WANTED, CAR, CITY } from './config.js';

export function createPolice(vehicles, city, rng) {
  const state = {
    stars: 0,
    decayTimer: WANTED.decaySeconds,
    police: [], // the active cruisers
  };

  function wantedCount() {
    return Math.min(WANTED.maxStars, 1 + Math.floor(state.stars / 1.5));
  }

  function spawnCruiserNear(x, z) {
    const angle = rng.next() * Math.PI * 2;
    const dist = rng.range(40, 70);
    let px = x + Math.sin(angle) * dist;
    let pz = z + Math.cos(angle) * dist;
    px = Math.max(-195, Math.min(195, px));
    pz = Math.max(-195, Math.min(195, pz));
    // Snap to the nearest road so the cruiser starts on the grid, near the
    // player — not at a random point anywhere in the city.
    const nearestRoadX = CITY.roads.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a));
    const nearestRoadZ = CITY.roads.reduce((a, b) => (Math.abs(b - pz) < Math.abs(a - pz) ? b : a));
    let sx;
    let sz;
    if (Math.abs(nearestRoadX - px) <= Math.abs(nearestRoadZ - pz)) {
      sx = nearestRoadX;
      sz = pz;
    } else {
      sx = px;
      sz = nearestRoadZ;
    }
    const car = vehicles.addCar('police', sx, sz, rng.next() * Math.PI * 2, undefined);
    car.topSpeed = CAR.policeSpeed;
    vehicles.snapToRoad(car);
    state.police.push(car);
    return car;
  }

  function syncCruisers() {
    const want = state.stars > 0 ? wantedCount() : 0;
    while (state.police.length < want) spawnCruiserNear(lastX, lastZ);
    while (state.police.length > want) {
      const car = state.police.pop();
      vehicles.removeCar(car);
    }
    // Drop wrecked cruisers from the list; the fleet replaces them.
    state.police = state.police.filter((c) => vehicles.cars.includes(c));
  }

  let lastX = 0;
  let lastZ = 0;

  function addStars(n, reason, toast) {
    if (n <= 0) return;
    const before = state.stars;
    state.stars = Math.min(WANTED.maxStars, state.stars + n);
    if (state.stars > before && toast) {
      toast(`Wanted level ${'★'.repeat(state.stars)} — ${reason}`);
    }
    state.decayTimer = WANTED.decaySeconds;
  }

  function clear() {
    state.stars = 0;
    for (const car of state.police) vehicles.removeCar(car);
    state.police = [];
  }

  function nearestCruiserDist(x, z) {
    let best = Infinity;
    for (const car of state.police) {
      best = Math.min(best, Math.hypot(car.x - x, car.z - z));
    }
    return best;
  }

  // Returns 'busted' | 'wasted' | null. `player` is the player state,
  // `playerCar` the car being driven (or null).
  function update(dt, player, playerCar, time) {
    lastX = player.x;
    lastZ = player.z;
    syncCruisers();
    if (state.stars === 0) return null;
    // Wanted cools off when no cruiser is close enough to see you.
    const near = nearestCruiserDist(player.x, player.z);
    if (near > WANTED.loseSight) {
      state.decayTimer -= dt;
      if (state.decayTimer <= 0) {
        state.stars -= 1;
        state.decayTimer = WANTED.decaySeconds;
      }
    } else {
      state.decayTimer = WANTED.decaySeconds;
    }
    // Cruisers ram: damage on contact, with a per-cruiser cooldown.
    for (const car of state.police) {
      const tx = playerCar ? playerCar.x : player.x;
      const tz = playerCar ? playerCar.z : player.z;
      const d = Math.hypot(car.x - tx, car.z - tz);
      if (d < CAR.radius + 1.6 && Math.abs(car.speed) > 4) {
        if (playerCar) {
          playerCar.speed *= 0.6;
          playerCar.health -= 6;
        }
        car.speed *= 0.4;
        if (!car.hitCooldown || time - car.hitCooldown > 1) {
          car.hitCooldown = time;
          if (!playerCar) return { type: 'ram', car };
        }
      }
      // Busted: a slow cruiser sitting on a man on foot.
      if (!playerCar && d < 3.2 && Math.abs(car.speed) < 3) {
        car.bustTimer = (car.bustTimer ?? 0) + dt;
        if (car.bustTimer >= WANTED.bustSeconds) return { type: 'busted' };
      } else {
        car.bustTimer = 0;
      }
    }
    if (player.health <= 0) return { type: 'wasted' };
    return null;
  }

  return { state, addStars, clear, update, nearestCruiserDist };
}

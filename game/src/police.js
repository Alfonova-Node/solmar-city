// SOLMAR — police: the wanted system and the bust.
// Crimes raise stars, stars bring cruisers, cruisers ram and chase.
// Getting caught on foot — or boxed in while driving — means BUSTED.

import { WANTED } from './settings.js';

export function createPolice() {
  let wanted = 0;
  let decayTimer = 0;
  let bustTimer = 0; // seconds a cruiser has been touching the player

  function addCrime(level, reason) {
    wanted = Math.min(WANTED.max, wanted + level);
    decayTimer = 0;
    return { wanted, reason };
  }

  function update(dt, committingCrime, playerInCar, playerSpeed, nearestCopDist) {
    // stars fade one at a time after a quiet spell
    if (wanted > 0) {
      if (committingCrime) {
        decayTimer = 0;
      } else {
        decayTimer += dt;
        if (decayTimer >= WANTED.decaySeconds) {
          wanted -= 1;
          decayTimer = 0;
        }
      }
    }
    // bust: a cop right on top of the player
    if (wanted > 0 && nearestCopDist !== null && nearestCopDist < 3.2) {
      const boxed = playerInCar ? playerSpeed < 1.5 : true;
      if (boxed) bustTimer += dt;
      else bustTimer = Math.max(0, bustTimer - dt * 2);
    } else {
      bustTimer = Math.max(0, bustTimer - dt);
    }
    return { wanted, busted: bustTimer > 2.2 };
  }

  function reset() {
    wanted = 0;
    decayTimer = 0;
    bustTimer = 0;
  }

  return {
    get wanted() {
      return wanted;
    },
    set wanted(v) {
      wanted = Math.max(0, Math.min(WANTED.max, v));
    },
    addCrime,
    update,
    reset,
    get bustProgress() {
      return Math.min(1, bustTimer / 2.2);
    },
  };
}

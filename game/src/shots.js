// SOLMAR — shots: the screenshot director.
// Reads ?shot=<name> from the URL and stages that scene: it starts the game,
// places Marco, sets the wanted level and the mission, and frames the camera.
// The four shots are the cover and the three views the dossier hands in.

export const SHOT_NAMES = ['cover', 'downtown', 'marina', 'dusk'];

export function shotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (SHOT_NAMES.includes(shot)) return shot;
  return null;
}

export function applyShot(game, name) {
  // game: the object boot.js returns — startPlaying, teleportPlayer,
  // putPlayerInCar, setWanted, setMission, setTimeOfDay, fixCamera, setAutoDrive.
  game.startPlaying();
  if (name === 'cover') {
    // a police chase down the central avenue: wanted 3, cruisers closing in,
    // mission 2 active, the car auto-driving south so the chase is moving
    game.setMission(1);
    const car = game.spawnPlayerCar(0, -84, 0);
    game.putPlayerInCar(car);
    game.setWanted(3);
    game.setAutoDrive(true);
    game.useChaseCamera(); // chase cam follows the car down the avenue — a fixed camera kept landing inside towers
    game.setTimeOfDay('day');
  } else if (name === 'downtown') {
    // on foot on the central avenue in Downtown, towers flanking the street
    game.setMission(0);
    game.setAutoDrive(false);
    game.teleportPlayer(0, -108, Math.PI);
    game.setWanted(0);
    game.fixCamera(0, 8, -96, 0, 1.5, -110); // on the avenue itself, clear of the towers
    game.setTimeOfDay('day');
  } else if (name === 'marina') {
    // driving east toward the Marina: docks, boats and the sea in frame
    game.setMission(1);
    game.setAutoDrive(false);
    const car = game.spawnPlayerCar(120, -42, Math.PI / 2);
    game.putPlayerInCar(car);
    game.setWanted(1);
    game.fixCamera(100, 13, -70, 180, 2, -20);
    game.setTimeOfDay('day');
  } else if (name === 'dusk') {
    // dusk on the Beachfront by the pier and the lighthouse, car on the coast road
    game.setMission(3);
    game.setAutoDrive(false);
    const car = game.spawnPlayerCar(150, 168, -Math.PI / 2);
    game.putPlayerInCar(car);
    game.setWanted(0);
    game.fixCamera(132, 9, 152, 168, 4, 192);
    game.setTimeOfDay('dusk');
  }
  // the HUD shows the objective and the minimap; the game keeps simulating
  // (traffic moves, police chase) so the frame is alive, not frozen.
  window.__solmarShot = name;
  window.__solmarReady = true;
}

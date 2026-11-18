// Screenshot staging: ?shot=cover|downtown|marina|dusk&seed=N puts the game
// into a fixed, lively state — the right place, the right light, the right
// heat — so a headless screenshot shows the game at its best. The caller
// flips window.__shotReady once the scene has settled. Every position here
// is on a road, a sidewalk or open ground — never inside a building block —
// and the camera always sits over a road or empty ground too.
export function applyShot(shot, g) {
  if (shot === 'cover') {
    g.setTimeOfDay('dusk');
    // A standoff, not a drive-by: Marco's yellow car stopped at the downtown
    // intersection, two cruisers closing in from the front and the east, a
    // third on its way — the chase camera looks forward, so the police have
    // to be staged where the camera can see them.
    const car = g.vehicles.addCar('player', -6, 42, Math.PI, 0xe8b820);
    car.topSpeed = 34;
    g.enterCar(car, 0);
    g.police.addStars(3, 'Screenshot staging');
    const c1 = g.vehicles.addCar('police', -6, 20, 0, undefined);
    c1.topSpeed = 34; c1.axis = 'z'; c1.dir = 1; c1.lane = -6; c1.speed = 12;
    g.vehicles.syncMesh(c1);
    g.police.state.police.push(c1);
    const c2 = g.vehicles.addCar('police', 20, 42, -Math.PI / 2, undefined);
    c2.topSpeed = 34; c2.axis = 'x'; c2.dir = -1; c2.lane = 42; c2.speed = 12;
    g.vehicles.syncMesh(c2);
    g.police.state.police.push(c2);
    // Mission 0 is already running from world setup — do not restart it,
    // or the objective toast fires twice.
    g.camera.dist = 9;
    g.camera.setPitch(0.28);
    g.camera.snapBehind();
  } else if (shot === 'downtown') {
    g.setTimeOfDay('day');
    // Marco on the x=-6 road at the z=-54 intersection, facing the downtown
    // skyline to the north. The camera sits on the same road behind him.
    g.player.teleport(-6, -54, Math.PI);
    // Traffic on the same road and peds on the sidewalks, staged so none of
    // them reaches Marco before the screenshot is taken.
    const t1 = g.vehicles.addCar('traffic', -6, -110, Math.PI, 0x2e6fd8);
    t1.axis = 'z'; t1.dir = -1; t1.lane = -6; t1.speed = 9; g.vehicles.syncMesh(t1);
    const t2 = g.vehicles.addCar('traffic', -6, -10, 0, 0xd8402e);
    t2.axis = 'z'; t2.dir = 1; t2.lane = -6; t2.speed = 9; g.vehicles.syncMesh(t2);
    const t3 = g.vehicles.addCar('traffic', -40, -54, -Math.PI / 2, 0x37b24d);
    t3.axis = 'x'; t3.dir = -1; t3.lane = -54; t3.speed = 9; g.vehicles.syncMesh(t3);
    for (const [x, z, dir] of [[-13.5, -70, -1], [1.5, -80, -1], [-13.5, -100, 1], [1.5, -65, 1]]) {
      const ped = g.peds.spawnAt(x, z);
      ped.axis = 'z'; ped.dir = dir; ped.lane = -6;
      ped.heading = dir > 0 ? 0 : Math.PI;
      ped.group.position.set(x, 0, z);
      ped.group.rotation.y = ped.heading;
    }
    g.camera.dist = 11;
    g.camera.setYaw(0);
    g.camera.setPitch(0.3);
  } else if (shot === 'marina') {
    g.setTimeOfDay('day');
    // Marco on the x=186 road beside the orange Comet GT, facing it. The
    // camera sits on the empty grass east of the road, looking southwest —
    // the yaw is locked in shot mode, so it stays put.
    g.player.teleport(186, 68, -2.68);
    g.missions.startMission(1);
    g.camera.dist = 11;
    // South of Marco, looking north: Marco at the centre with his back to
    // the camera, the orange Comet GT 8 m ahead of him on the same road.
    // (The comet is north of Marco, so a camera north of him would put the
    // car behind him and out of the frame.)
    g.camera.setYaw(0);
    g.camera.setPitch(0.35);
  } else if (shot === 'dusk') {
    g.setTimeOfDay('dusk');
    // A chase down the beachfront road: the player eastbound in the south
    // lane, the ocean on the right, two stars of police behind.
    const car = g.vehicles.addCar('player', 60, 189, Math.PI / 2, 0xd8402e);
    car.topSpeed = 26;
    car.cruise = true;
    g.enterCar(car, 22);
    g.police.addStars(2, 'Screenshot staging');
    g.missions.startMission(4);
    g.camera.dist = 8;
    g.camera.setPitch(0.25);
    g.camera.snapBehind();
  }
  // Warmup steps per shot (default 240 = 4 s). The cover is a standoff: at
  // 240 steps the cruisers have already piled onto the player's car and hide
  // it, so it is taken earlier, while they are still converging.
  const warmupSteps = { cover: 100, downtown: 240, marina: 240, dusk: 240 }[shot] ?? 240;
  g.hud.clearToasts();
  g.hud.showOverlay(null);
  g.screen = 'playing';
  return warmupSteps;
}

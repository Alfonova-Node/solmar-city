// SOLMAR, the city itself: a sunny coastal grid built from seeded random
// numbers, so the same seed always builds the same streets. Everything is
// procedural — canvas textures, boxes, cylinders — no downloaded assets.
// Exports the colliders the cars and the player push against, helpers to find
// road and sidewalk points, and a day/dusk lighting switch for screenshots.
import * as THREE from 'three';
import { CITY, DISTRICTS, PALETTE } from './config.js';

function canvasTexture(width, height, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

function speckle(ctx, w, h, n, color, alpha) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i += 1) {
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  ctx.globalAlpha = 1;
}

// One asphalt texture, dashed centre line running down the canvas.
function roadTexture() {
  return canvasTexture(128, 512, (ctx, w, h) => {
    ctx.fillStyle = '#33363d';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 500, '#000000', 0.25);
    speckle(ctx, w, h, 300, '#ffffff', 0.06);
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(4, 0, 3, h);
    ctx.fillRect(w - 7, 0, 3, h);
    ctx.fillStyle = '#e8c832';
    for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 2, y + 8, 4, 32);
  });
}

function sidewalkTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9a9a92';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#00000022';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath(); ctx.moveTo((i * w) / 4, 0); ctx.lineTo((i * w) / 4, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 4); ctx.lineTo(w, (i * h) / 4); ctx.stroke();
    }
    speckle(ctx, w, h, 200, '#000000', 0.12);
  });
}

// A building face: base colour, a grid of windows, some of them warm-lit.
// Returns { map, emissive } — the emissive canvas holds only the lit windows.
function buildingTextures(base, rng) {
  const lit = [];
  const map = canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 12;
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const warm = rng.next() < 0.28;
        if (warm) lit.push([c, r]);
        ctx.fillStyle = warm ? '#ffd27a' : '#2a3542';
        ctx.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);
      }
    }
  });
  const emissive = canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 12;
    const cw = w / cols;
    const ch = h / rows;
    ctx.fillStyle = '#ffca6a';
    for (const [c, r] of lit) ctx.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);
  });
  return { map, emissive };
}

function districtAt(x, z) {
  for (const [name, d] of Object.entries(DISTRICTS)) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return name;
  }
  return 'oldtown';
}

export function createCity(scene, rng) {
  const colliders = [];
  const sun = new THREE.DirectionalLight(PALETTE.sunDay, 2.6);
  sun.position.set(140, 220, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -230;
  sun.shadow.camera.right = 230;
  sun.shadow.camera.top = 230;
  sun.shadow.camera.bottom = -230;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  scene.background = new THREE.Color(PALETTE.skyDay);
  scene.fog = new THREE.Fog(PALETTE.fogDay, 220, 760);

  const litMaterials = []; // materials whose emissive wakes up at dusk

  // --- Ground: grass, then the beach, then the ocean -----------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, CITY.half * 2),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, 24),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.beachZ + 12);
  sand.receiveShadow = true;
  scene.add(sand);

  const oceanMat = new THREE.MeshPhongMaterial({
    color: PALETTE.ocean, shininess: 120, specular: 0x99ccff, transparent: true, opacity: 0.94,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 500), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, CITY.oceanZ + 250);
  scene.add(ocean);

  // --- Roads ----------------------------------------------------------------
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const roadGeo = new THREE.PlaneGeometry(CITY.road, CITY.half * 2);
  for (const c of CITY.roads) {
    const alongZ = new THREE.Mesh(roadGeo, roadMat);
    alongZ.rotation.x = -Math.PI / 2;
    alongZ.position.set(c, 0.03, 0);
    alongZ.receiveShadow = true;
    scene.add(alongZ);
    const alongX = new THREE.Mesh(roadGeo, roadMat);
    alongX.rotation.x = -Math.PI / 2;
    alongX.rotation.z = Math.PI / 2;
    alongX.position.set(0, 0.04, c);
    alongX.receiveShadow = true;
    scene.add(alongX);
  }

  // --- Blocks: sidewalks, buildings, the park -------------------------------
  const walkTex = sidewalkTexture();
  const walkMat = new THREE.MeshLambertMaterial({ map: walkTex });
  const baseColors = PALETTE.building;
  const faceMats = baseColors.map((base) => {
    const { map, emissive } = buildingTextures(base, rng);
    const mat = new THREE.MeshLambertMaterial({ map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0 });
    litMaterials.push(mat);
    return mat;
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6a6a66 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const acGeo = new THREE.BoxGeometry(1, 1, 1);

  function addBuilding(cx, cz, w, d, h, matIndex) {
    const mesh = new THREE.Mesh(boxGeo, [
      faceMats[matIndex], faceMats[matIndex], roofMat, roofMat, faceMats[matIndex], faceMats[matIndex],
    ]);
    mesh.scale.set(w, h, d);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (rng.next() < 0.5) {
      const ac = new THREE.Mesh(acGeo, roofMat);
      ac.scale.set(2, 1.2, 2);
      ac.position.set(cx + w * 0.2, h + 0.6, cz - d * 0.2);
      scene.add(ac);
    }
    colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
  }

  const parkTrees = [];
  for (let i = 0; i < CITY.blocks; i += 1) {
    for (let j = 0; j < CITY.blocks; j += 1) {
      const x0 = CITY.roads[i] + CITY.road / 2;
      const x1 = CITY.roads[i + 1] - CITY.road / 2;
      const z0 = CITY.roads[j] + CITY.road / 2;
      const z1 = CITY.roads[j + 1] - CITY.road / 2;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const district = districtAt(cx, cz);
      if (district === 'park') {
        const grass = new THREE.Mesh(
          new THREE.PlaneGeometry(CITY.block, CITY.block),
          new THREE.MeshLambertMaterial({ color: 0x4c8f3e }),
        );
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(cx, 0.02, cz);
        grass.receiveShadow = true;
        scene.add(grass);
        for (let t = 0; t < 7; t += 1) {
          parkTrees.push([cx + rng.range(-14, 14), cz + rng.range(-14, 14)]);
        }
        continue;
      }
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY.block, CITY.block), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(cx, 0.015, cz);
      walk.receiveShadow = true;
      scene.add(walk);
      const d = DISTRICTS[district];
      const count = d.maxH > 40 ? 1 : rng.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(10, count === 1 ? 26 : 15);
        const dep = rng.range(10, count === 1 ? 26 : 15);
        const bx = cx + rng.range(-10, 10) * (count === 1 ? 0 : 0.5);
        const bz = cz + rng.range(-10, 10) * (count === 1 ? 0 : 0.5);
        const h = rng.range(d.minH, d.maxH);
        addBuilding(bx, bz, w, dep, h, Math.floor(rng.next() * faceMats.length));
      }
    }
  }

  // --- Palms: one instanced trunk, one instanced frond ----------------------
  const palmSpots = [...parkTrees];
  for (let x = -190; x <= 190; x += 24) palmSpots.push([x + rng.range(-4, 4), CITY.beachZ + 4 + rng.range(0, 14)]);
  for (let x = -190; x <= 190; x += 48) palmSpots.push([x, 96 + rng.range(-4, 4)]);
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const frondGeo = new THREE.ConeGeometry(2.6, 3.2, 5);
  const frondMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  palmSpots.forEach(([x, z], i) => {
    const lean = rng.range(-0.08, 0.08);
    e.set(lean, rng.range(0, Math.PI * 2), 0);
    q.setFromEuler(e);
    m4.compose(v.set(x, 3.5, z), q, s);
    trunks.setMatrixAt(i, m4);
    e.set(Math.PI, rng.range(0, Math.PI * 2), 0);
    q.setFromEuler(e);
    m4.compose(v.set(x, 7.6, z), q, s);
    fronds.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  fronds.castShadow = true;
  scene.add(trunks);
  scene.add(fronds);

  // --- Street lamps -----------------------------------------------------------
  const lampPositions = [];
  for (const c of CITY.roads) {
    for (let p = -180; p <= 180; p += 60) {
      lampPositions.push([c + 7, p]);
      lampPositions.push([c - 7, p + 30]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);
  const lampGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x555544, emissive: 0xffd27a, emissiveIntensity: 0 });
  litMaterials.push(lampMat);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampPositions.length);
  lampPositions.forEach(([x, z], i) => {
    m4.compose(v.set(x, 3, z), q.identity(), s.set(1, 1, 1));
    poles.setMatrixAt(i, m4);
    m4.compose(v.set(x, 6.1, z), q.identity(), s.set(1, 1, 1));
    lamps.setMatrixAt(i, m4);
  });
  scene.add(poles);
  scene.add(lamps);

  // --- The pier (wooden deck into the ocean) and the lighthouse --------------
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(9, 0.15, 48), pierMat);
  pier.position.set(150, 0.05, CITY.oceanZ + 20);
  pier.castShadow = true;
  pier.receiveShadow = true;
  scene.add(pier);
  colliders.push({ x0: 145.5, x1: 146.5, z0: 200, z1: 234, pier: true });
  colliders.push({ x0: 153.5, x1: 154.5, z0: 200, z1: 234, pier: true });

  const stripeTex = canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f2f2ee';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c8442e';
    ctx.fillRect(0, 0, w, 24);
    ctx.fillRect(0, 56, w, 24);
    ctx.fillRect(0, 112, w, 16);
  });
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3, 22, 12),
    new THREE.MeshLambertMaterial({ map: stripeTex }),
  );
  tower.position.set(-180, 11, 176);
  tower.castShadow = true;
  scene.add(tower);
  const lampTop = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffdf6a, emissiveIntensity: 0.4 }),
  );
  lampTop.position.set(-180, 23, 176);
  scene.add(lampTop);
  colliders.push({ x0: -183.5, x1: -176.5, z0: 172.5, z1: 179.5 });

  // --- Neon signs on downtown rooftops (glow at dusk) -----------------------
  const signTexts = [
    { text: 'CORAL HOTEL', x: -30, z: -102, color: '#ff5fa2' },
    { text: 'SOLMAR', x: -6, z: -150, color: '#53d8ff' },
    { text: "RICO'S", x: -150, z: 80, color: '#ffd23e' },
    { text: 'PIER 9', x: 150, z: 190, color: '#7dff8a' },
  ];
  for (const sign of signTexts) {
    const tex = canvasTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#101018';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = sign.color;
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sign.text, w / 2, h / 2);
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), mat);
    mesh.position.set(sign.x, 26, sign.z);
    mesh.rotation.y = rng.next() * Math.PI;
    scene.add(mesh);
    const signMat = new THREE.MeshLambertMaterial({ color: 0x111111, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
    litMaterials.push(signMat);
  }

  // --- Helpers ---------------------------------------------------------------
  function isOnRoad(x, z) {
    for (const c of CITY.roads) {
      if (Math.abs(x - c) <= CITY.road / 2 + 0.5 || Math.abs(z - c) <= CITY.road / 2 + 0.5) return true;
    }
    return false;
  }

  // Circle (x, z, r) against building colliders; returns the push-out vector.
  function collideCircle(x, z, r) {
    let px = 0;
    let pz = 0;
    for (const c of colliders) {
      const nx = Math.max(c.x0, Math.min(x, c.x1));
      const nz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (r - d) / d;
          px += dx * push;
          pz += dz * push;
        } else {
          pz += r;
        }
      }
    }
    return { x: px, z: pz };
  }

  function inWater(x, z) {
    if (z < CITY.oceanZ - 2) return false;
    if (Math.abs(x - 150) < 4.2 && z < 234) return false; // the pier
    return true;
  }

  function randomRoadPoint() {
    const horizontal = rng.next() < 0.5;
    const c = CITY.roads[Math.floor(rng.next() * CITY.roads.length)];
    const along = rng.range(-190, 190);
    return horizontal ? { x: along, z: c } : { x: c, z: along };
  }

  function randomSidewalkPoint() {
    const horizontal = rng.next() < 0.5;
    const c = CITY.roads[Math.floor(rng.next() * CITY.roads.length)];
    const along = rng.range(-190, 190);
    const off = (rng.next() < 0.5 ? -1 : 1) * (CITY.road / 2 + 1.5);
    // `road` is the road coordinate the sidewalk belongs to; pedestrians
    // steer to lane = road +/- 7.6 m, so the lane must be the road itself,
    // not the sidewalk point (road +/- 7.5) — otherwise they drift 15 m
    // off the road and walk through buildings.
    return horizontal ? { x: along, z: c + off, road: c, horizontal } : { x: c + off, z: along, road: c, horizontal };
  }

  function setTimeOfDay(mode) {
    const dusk = mode === 'dusk' || mode === true;
    sun.color.setHex(dusk ? PALETTE.sunDusk : PALETTE.sunDay);
    sun.intensity = dusk ? 1.1 : 2.6;
    sun.position.set(dusk ? -180 : 140, dusk ? 70 : 220, dusk ? -40 : 60);
    hemi.intensity = dusk ? 0.35 : 0.9;
    scene.background.setHex(dusk ? PALETTE.skyDusk : PALETTE.skyDay);
    scene.fog.color.setHex(dusk ? PALETTE.fogDusk : PALETTE.fogDay);
    for (const m of litMaterials) m.emissiveIntensity = dusk ? 1.4 : 0;
    lampTop.material.emissiveIntensity = dusk ? 2.2 : 0.4;
  }

  function update(dt, t) {
    ocean.position.y = -0.4 + Math.sin(t * 0.5) * 0.08;
  }

  return {
    colliders, collideCircle, isOnRoad, inWater, randomRoadPoint, randomSidewalkPoint,
    setTimeOfDay, update, lampPositions,
  };
}

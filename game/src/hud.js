// SOLMAR — hud: the DOM heads-up display and the 2D minimap.
// Money, health, wanted stars, speed, mission objective, messages, and the
// start / pause / busted / wasted screens. The minimap draws the road grid,
// the player arrow, the mission marker, police and traffic dots.

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    money: $('hud-money'),
    healthFill: $('hud-health-fill'),
    healthText: $('hud-health-text'),
    stars: $('hud-stars'),
    speed: $('hud-speed'),
    ammo: $('hud-ammo'),
    objective: $('hud-objective'),
    message: $('hud-message'),
    hint: $('hud-hint'),
    minimap: $('minimap'),
    start: $('screen-start'),
    pause: $('screen-pause'),
    busted: $('screen-busted'),
    wasted: $('screen-wasted'),
    title: $('hud-title'),
  };
  const mapCtx = el.minimap.getContext('2d');
  const MAP = 180; // minimap pixels; the world is 520 wide, so 1px ~ 2.9m

  function toMap(x, z) {
    return { mx: (x + 260) / 520 * MAP, my: (z + 260) / 520 * MAP };
  }

  function drawMinimap(world) {
    // world: {playerX, playerZ, heading, marker, police[], traffic[], roads}
    const c = mapCtx;
    c.clearRect(0, 0, MAP, MAP);
    c.fillStyle = '#101c26';
    c.fillRect(0, 0, MAP, MAP);
    // sea and sand on the edges
    c.fillStyle = '#1c5a7a';
    c.fillRect(MAP * 0.86, 0, MAP * 0.14, MAP);
    c.fillRect(0, MAP * 0.9, MAP, MAP * 0.1);
    c.fillStyle = '#c9b078';
    c.fillRect(0, MAP * 0.84, MAP, MAP * 0.06);
    // park
    c.fillStyle = '#2f6b2f';
    c.fillRect(MAP * 0.42, MAP * 0.42, MAP * 0.16, MAP * 0.16);
    // roads
    c.strokeStyle = '#5a6068';
    c.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      const p = (i * 42 + 12) / 520 * MAP;
      c.beginPath();
      c.moveTo(p, MAP * 0.02);
      c.lineTo(p, MAP * 0.86);
      c.stroke();
      c.beginPath();
      c.moveTo(MAP * 0.02, p);
      c.lineTo(MAP * 0.86, p);
      c.stroke();
    }
    // traffic dots
    c.fillStyle = '#e8e8e8';
    for (const t of world.traffic || []) {
      const p = toMap(t.x, t.z);
      c.fillRect(p.mx - 1, p.my - 1, 2, 2);
    }
    // police dots
    c.fillStyle = '#ff4444';
    for (const p of world.police || []) {
      const q = toMap(p.x, p.z);
      c.beginPath();
      c.arc(q.mx, q.my, 3, 0, Math.PI * 2);
      c.fill();
    }
    // mission marker
    if (world.marker) {
      const q = toMap(world.marker.x, world.marker.z);
      c.fillStyle = '#ffd34d';
      c.beginPath();
      c.arc(q.mx, q.my, 4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ffd34d';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(q.mx, q.my, 7, 0, Math.PI * 2);
      c.stroke();
    }
    // player arrow
    const p = toMap(world.playerX, world.playerZ);
    c.save();
    c.translate(p.mx, p.my);
    c.rotate(world.heading);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -6);
    c.lineTo(4.5, 5);
    c.lineTo(-4.5, 5);
    c.closePath();
    c.fill();
    c.restore();
  }

  function showOnly(name) {
    for (const key of ['start', 'pause', 'busted', 'wasted']) {
      el[key].style.display = key === name ? 'flex' : 'none';
    }
  }

  return {
    drawMinimap,
    setMoney(n) {
      el.money.textContent = '$' + n.toLocaleString('en-US');
    },
    setHealth(h) {
      const pct = Math.max(0, Math.min(100, h));
      el.healthFill.style.width = pct + '%';
      el.healthFill.style.background = pct > 50 ? '#37c978' : pct > 25 ? '#f0a832' : '#e04040';
      el.healthText.textContent = Math.ceil(pct);
    },
    setAmmo(a) {
      el.ammo.textContent = a + ' rds';
    },
    setWanted(n) {
      let s = '';
      for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
      el.stars.textContent = s;
      el.stars.style.color = n > 0 ? '#ffd34d' : '#8a929c';
    },
    setObjective(text) {
      el.objective.textContent = text;
    },
    setMessage(text) {
      el.message.textContent = text;
      el.message.style.opacity = text ? '1' : '0';
    },
    setHint(text) {
      el.hint.textContent = text;
      el.hint.style.opacity = text ? '1' : '0';
    },
    setSpeed(kmh, inCar) {
      el.speed.textContent = inCar ? Math.round(kmh) + ' km/h' : '';
    },
    showStart() { showOnly('start'); },
    showPause() { showOnly('pause'); },
    showBusted() { showOnly('busted'); },
    showWasted() { showOnly('wasted'); },
    showGame() { showOnly(null); },
    setTitle(text) { el.title.textContent = text; },
  };
}

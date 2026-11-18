// The HUD: wanted stars, cash, health, the mission line, speed, ammo and a
// live minimap of Solmar drawn on a small canvas — roads, the beach, the
// player, the traffic, the police and the yellow mission marker.
import { CITY } from './config.js';

export function createHud(city) {
  const $ = (id) => document.getElementById(id);
  const starsEl = $('stars');
  const cashEl = $('cash');
  const healthFill = $('health-fill');
  const objectiveEl = $('objective');
  const speedEl = $('speed');
  const ammoEl = $('ammo');
  const toastEl = $('toasts');
  const mapCanvas = $('minimap');
  const mapCtx = mapCanvas.getContext('2d');
  const overlays = {
    title: $('screen-title'),
    pause: $('screen-pause'),
    busted: $('screen-busted'),
    wasted: $('screen-wasted'),
    complete: $('screen-complete'),
  };

  const toasts = [];
  function toast(msg) {
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = msg;
    toastEl.appendChild(div);
    toasts.push({ el: div, t: 0 });
    while (toasts.length > 4) {
      const old = toasts.shift();
      old.el.remove();
    }
  }

  function clearToasts() {
    for (const t of toasts) t.el.remove();
    toasts.length = 0;
  }

  function showOverlay(name) {
    for (const [key, el] of Object.entries(overlays)) {
      if (el) el.style.display = key === name ? 'flex' : 'none';
    }
  }

  function drawMinimap(s) {
    const W = mapCanvas.width;
    const H = mapCanvas.height;
    const scale = W / (CITY.half * 2 + 40);
    const toMap = (x, z) => [W / 2 + x * scale, H / 2 + z * scale];
    mapCtx.fillStyle = '#12261a';
    mapCtx.fillRect(0, 0, W, H);
    // Ocean and beach (south is down).
    const [, oy] = toMap(0, CITY.oceanZ);
    mapCtx.fillStyle = '#1f7fa8';
    mapCtx.fillRect(0, oy, W, H - oy);
    const [, by] = toMap(0, CITY.beachZ);
    mapCtx.fillStyle = '#e8d29a';
    mapCtx.fillRect(0, by, W, oy - by);
    // Roads.
    mapCtx.strokeStyle = '#5a5e66';
    mapCtx.lineWidth = Math.max(2, CITY.road * scale);
    for (const c of CITY.roads) {
      const [x1, y1] = toMap(c, -CITY.half);
      const [x2, y2] = toMap(c, CITY.half);
      mapCtx.beginPath(); mapCtx.moveTo(x1, y1); mapCtx.lineTo(x2, y2); mapCtx.stroke();
      const [hx1, hy1] = toMap(-CITY.half, c);
      const [hx2, hy2] = toMap(CITY.half, c);
      mapCtx.beginPath(); mapCtx.moveTo(hx1, hy1); mapCtx.lineTo(hx2, hy2); mapCtx.stroke();
    }
    // Mission marker.
    if (s.objective && s.objective.x !== null) {
      const [mx, my] = toMap(s.objective.x, s.objective.z);
      const pulse = 5 + Math.sin(s.time * 4) * 2;
      mapCtx.fillStyle = '#ffd23e';
      mapCtx.beginPath();
      mapCtx.moveTo(mx, my - pulse);
      mapCtx.lineTo(mx + pulse, my);
      mapCtx.lineTo(mx, my + pulse);
      mapCtx.lineTo(mx - pulse, my);
      mapCtx.closePath();
      mapCtx.fill();
    }
    // Traffic as grey dots, police as red dots.
    for (const car of s.cars) {
      const [cx, cy] = toMap(car.x, car.z);
      mapCtx.fillStyle = car.kind === 'police' ? '#ff3b30' : '#c8c8c8';
      mapCtx.beginPath();
      mapCtx.arc(cx, cy, car.kind === 'police' ? 3.5 : 2, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // The player: a white arrow that turns with him.
    const [px, py] = toMap(s.player.x, s.player.z);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(Math.atan2(Math.sin(s.player.heading), -Math.cos(s.player.heading)));
    mapCtx.fillStyle = '#ffffff';
    mapCtx.strokeStyle = '#111111';
    mapCtx.lineWidth = 1;
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.restore();
  }

  function update(s, dt) {
    starsEl.textContent = '★'.repeat(s.stars) + '☆'.repeat(Math.max(0, 5 - s.stars));
    starsEl.className = s.stars > 0 ? 'hot' : '';
    cashEl.textContent = `$${s.cash}`;
    healthFill.style.width = `${Math.max(0, (s.health / s.maxHealth) * 100)}%`;
    healthFill.style.background = s.health > 50 ? '#37b24d' : s.health > 25 ? '#e8a13c' : '#e5534b';
    let obj = s.objective.label;
    if (s.objective.x !== null) {
      const d = Math.hypot(s.objective.x - s.player.x, s.objective.z - s.player.z);
      obj += ` — ${Math.round(d)} m`;
    }
    if (s.objective.timer !== null) {
      obj += ` — ${Math.ceil(s.objective.timer)}s`;
    }
    objectiveEl.textContent = obj;
    speedEl.textContent = s.inCar ? `${Math.round(Math.abs(s.speed) * 3.6)} km/h` : '';
    ammoEl.textContent = s.inCar ? '' : `Ammo ${s.ammo}`;
    for (const t of [...toasts]) {
      t.t += dt;
      t.el.style.opacity = t.t > 4 ? Math.max(0, 1 - (t.t - 4)) : 1;
      if (t.t > 5) {
        t.el.remove();
        toasts.splice(toasts.indexOf(t), 1);
      }
    }
    drawMinimap(s);
  }

  return { update, toast, clearToasts, showOverlay };
}

// SOLMAR — audio: every sound is synthesised with WebAudio, no audio files.
// Engine hum, siren, gunshot, punch, pickup chime and mission jingle.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let muted = false;
  let waveNoise = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // engine: a low sawtooth whose pitch follows the speed
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // siren: two alternating tones, started on demand
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      // looping sea wash: filtered noise, very quiet
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const washFilter = ctx.createBiquadFilter();
      washFilter.type = 'lowpass';
      washFilter.frequency.value = 320;
      waveNoise = ctx.createGain();
      waveNoise.gain.value = 0.03;
      src.connect(washFilter);
      washFilter.connect(waveNoise);
      waveNoise.connect(master);
      src.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1800;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    setEngine(speed01, inCar) {
      if (!ctx) return;
      const target = inCar ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, ctx.currentTime, 0.08);
    },
    setSiren(on) {
      if (!ctx) return;
      if (on && !sirenTimer) {
        let high = false;
        sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
        sirenTimer = window.setInterval(() => {
          high = !high;
          sirenOsc.frequency.setTargetAtTime(high ? 950 : 650, ctx.currentTime, 0.05);
        }, 420);
      } else if (!on && sirenTimer) {
        window.clearInterval(sirenTimer);
        sirenTimer = null;
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
    },
    gunshot() {
      noiseBurst(0.16, 0.5, 2400);
      blip(160, 0.1, 'square', 0.25, 60);
    },
    punch() {
      noiseBurst(0.09, 0.35, 500);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.25);
      window.setTimeout(() => blip(990, 0.18, 'sine', 0.25), 110);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => {
        window.setTimeout(() => blip(f, 0.22, 'triangle', 0.28), i * 130);
      });
    },
    busted() {
      [392, 330, 262].forEach((f, i) => {
        window.setTimeout(() => blip(f, 0.3, 'sawtooth', 0.2), i * 180);
      });
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get isMuted() {
      return muted;
    },
  };
}

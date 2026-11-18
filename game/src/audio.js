// Every sound in Solmar is synthesized live with WebAudio — no audio files
// to ship. The engine hums on two detuned oscillators that rise with speed,
// the siren wails two tones, and the rest are short envelopes of noise or
// sine. The context starts only after the first click, as browsers require.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function burst(duration, freq, type, gainValue, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainValue, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  function noiseHit(duration, filterFreq, gainValue) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainValue, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t);
  }

  function setEngine(speed, maxSpeed, running) {
    if (!ensure()) return;
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
    }
    const ratio = Math.min(1, Math.abs(speed) / Math.max(1, maxSpeed));
    const target = running ? 0.04 + ratio * 0.05 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + ratio * 130, ctx.currentTime, 0.08);
    engineOsc2.frequency.setTargetAtTime(28 + ratio * 65, ctx.currentTime, 0.08);
  }

  function setSiren(on) {
    if (!ensure()) return;
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.02;
      sirenOsc.connect(sirenGain).connect(ctx.destination);
      sirenOsc.frequency.value = 750;
      sirenOsc.start();
      sirenTimer = 0;
      sirenHigh = true;
    } else if (!on && sirenOsc) {
      sirenOsc.stop();
      sirenOsc = null;
      sirenGain = null;
    }
  }

  function updateSiren(dt) {
    if (!sirenOsc) return;
    sirenTimer += dt;
    if (sirenTimer > 0.45) {
      sirenTimer = 0;
      sirenHigh = !sirenHigh;
      sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.05);
    }
  }

  return {
    unlock() { ensure(); },
    setEngine, setSiren, updateSiren,
    punch() { noiseHit(0.12, 500, 0.5); },
    shot() { noiseHit(0.18, 1800, 0.7); burst(0.1, 220, 'square', 0.25, 60); },
    crash() { noiseHit(0.3, 400, 0.6); },
    chime() { burst(0.25, 880, 'sine', 0.3, 1320); },
    jingle() {
      if (!ensure()) return;
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => burst(0.3, f, 'sine', 0.3), i * 110);
      });
    },
    denied() { burst(0.2, 160, 'square', 0.2, 90); },
  };
}

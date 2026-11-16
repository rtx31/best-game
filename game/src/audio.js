// Synthesised sound for LUMEN DRIFT: every effect is a small WebAudio
// patch — oscillators and filtered noise, no audio files, no network.
// The context is created lazily on the first user gesture (browsers block
// audio before one) and every call is guarded, so a headless or muted
// browser simply stays silent instead of throwing.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone({ type = 'square', from = 440, to = null, dur = 0.08, vol = 0.5, when = 0 }) {
    if (muted) return;
    const c = ensure();
    if (!c || !master) return;
    try {
      const t0 = c.currentTime + when;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t0);
      if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      /* silent */
    }
  }

  function noise({ dur = 0.18, vol = 0.5, freq = 1200, when = 0 }) {
    if (muted) return;
    const c = ensure();
    if (!c || !master) return;
    try {
      const t0 = c.currentTime + when;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = c.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
    } catch {
      /* silent */
    }
  }

  return {
    ensure,
    isMuted: () => muted,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      tone({ type: 'square', from: 920, to: 420, dur: 0.06, vol: 0.22 });
    },
    kill(big = false) {
      noise({ dur: big ? 0.3 : 0.16, vol: big ? 0.6 : 0.4, freq: big ? 900 : 1600 });
      tone({ type: 'sawtooth', from: big ? 320 : 480, to: 60, dur: big ? 0.28 : 0.16, vol: 0.3 });
    },
    hit() {
      tone({ type: 'sawtooth', from: 180, to: 50, dur: 0.3, vol: 0.5 });
      noise({ dur: 0.2, vol: 0.4, freq: 700 });
    },
    pickup() {
      tone({ type: 'sine', from: 660, dur: 0.09, vol: 0.35 });
      tone({ type: 'sine', from: 990, dur: 0.12, vol: 0.35, when: 0.08 });
    },
    wave() {
      tone({ type: 'triangle', from: 330, dur: 0.1, vol: 0.3 });
      tone({ type: 'triangle', from: 440, dur: 0.1, vol: 0.3, when: 0.09 });
      tone({ type: 'triangle', from: 660, dur: 0.16, vol: 0.3, when: 0.18 });
    },
    victory() {
      [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.22, vol: 0.32, when: i * 0.12 }));
    },
    gameOver() {
      [392, 311, 233, 155].forEach((f, i) => tone({ type: 'sawtooth', from: f, dur: 0.3, vol: 0.28, when: i * 0.16 }));
    },
  };
}

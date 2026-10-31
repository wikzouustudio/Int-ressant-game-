// Synthesized sound effects and a light procedural music loop (WebAudio, no assets).

let ctx = null;
let sfxGain = null;
let musicGain = null;
let noiseBuf = null;
const last = {};
const settings = { sfx: true, music: true };

export function audioSettings() { return settings; }

export function setSfx(on) {
  settings.sfx = on;
  if (sfxGain) sfxGain.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.02);
}
export function setMusic(on) {
  settings.music = on;
  if (musicGain) musicGain.gain.setTargetAtTime(on ? 0.3 : 0, ctx.currentTime, 0.05);
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    ctx = null;
    return;
  }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 5;
  comp.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = settings.sfx ? 0.9 : 0;
  sfxGain.connect(comp);
  musicGain = ctx.createGain();
  musicGain.gain.value = settings.music ? 0.3 : 0;
  musicGain.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (pendingMusic) startMusic(pendingMusic);
}

function tone({ f = 440, f2 = 0, d = 0.15, type = 'square', v = 0.2, t = 0, at = 0, attack = 0.004, dest = null }) {
  if (!ctx) return;
  const now = (at || ctx.currentTime) + t;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, now);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(f2, 20), now + d);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(v, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  o.connect(g);
  g.connect(dest || sfxGain);
  o.start(now);
  o.stop(now + d + 0.03);
}

function noise({ d = 0.2, v = 0.3, f = 1200, f2 = 0, q = 0.8, type = 'lowpass', t = 0, at = 0, dest = null }) {
  if (!ctx) return;
  const now = (at || ctx.currentTime) + t;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const fl = ctx.createBiquadFilter();
  fl.type = type;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f, now);
  if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(f2, 30), now + d);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(v, now + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  src.connect(fl);
  fl.connect(g);
  g.connect(dest || sfxGain);
  src.start(now, Math.random() * 0.5);
  src.stop(now + d + 0.03);
}

function gate(key, ms = 35) {
  if (!ctx || !settings.sfx) return false;
  const n = performance.now();
  if (last[key] && n - last[key] < ms) return false;
  last[key] = n;
  return true;
}

const S = {
  shoot_rex() {
    noise({ d: 0.22, v: 0.45, f: 2400, f2: 260 });
    tone({ f: 150, f2: 50, d: 0.14, type: 'square', v: 0.16 });
  },
  shoot_nova() {
    tone({ f: 1500, f2: 260, d: 0.2, type: 'sawtooth', v: 0.1 });
    tone({ f: 760, f2: 130, d: 0.16, type: 'square', v: 0.06 });
    noise({ d: 0.07, v: 0.16, f: 5000, type: 'highpass' });
  },
  shoot_pip() {
    tone({ f: 220, f2: 520, d: 0.14, type: 'triangle', v: 0.26 });
    noise({ d: 0.1, v: 0.14, f: 900 });
  },
  shoot_kumo() {
    noise({ d: 0.17, v: 0.4, f: 3800, f2: 700, type: 'bandpass', q: 2.5 });
    tone({ f: 1900, f2: 2600, d: 0.08, type: 'sine', v: 0.05 });
  },
  shoot_mira() {
    tone({ f: 880, f2: 1320, d: 0.16, type: 'sine', v: 0.16 });
    tone({ f: 1320, f2: 1760, d: 0.14, type: 'triangle', v: 0.07, t: 0.05 });
  },
  shoot_bolt() {
    tone({ f: 700, f2: 180, d: 0.06, type: 'square', v: 0.08 });
    noise({ d: 0.05, v: 0.16, f: 3000, type: 'bandpass', q: 1.2 });
  },
  hit() {
    tone({ f: 260, f2: 120, d: 0.08, type: 'square', v: 0.1 });
    noise({ d: 0.05, v: 0.14, f: 2800, type: 'bandpass' });
  },
  hurt() {
    tone({ f: 160, f2: 70, d: 0.14, type: 'sawtooth', v: 0.13 });
    noise({ d: 0.08, v: 0.18, f: 900 });
  },
  explode() {
    noise({ d: 0.55, v: 0.55, f: 1500, f2: 70 });
    tone({ f: 110, f2: 32, d: 0.45, type: 'sine', v: 0.5 });
  },
  bigExplode() {
    noise({ d: 0.9, v: 0.7, f: 1800, f2: 50 });
    tone({ f: 90, f2: 25, d: 0.8, type: 'sine', v: 0.6 });
    tone({ f: 60, f2: 25, d: 0.6, type: 'square', v: 0.12 });
  },
  wall() {
    noise({ d: 0.3, v: 0.4, f: 700, f2: 120, type: 'lowpass' });
    tone({ f: 90, f2: 50, d: 0.18, type: 'triangle', v: 0.25 });
  },
  super() {
    [523, 659, 784, 1046].forEach((f, i) => tone({ f, d: 0.18, type: 'sawtooth', v: 0.07, t: i * 0.045 }));
    tone({ f: 200, f2: 900, d: 0.3, type: 'sine', v: 0.18 });
  },
  superReady() {
    tone({ f: 1046, d: 0.12, type: 'triangle', v: 0.16 });
    tone({ f: 1568, d: 0.22, type: 'triangle', v: 0.14, t: 0.09 });
  },
  ko() {
    tone({ f: 880, f2: 220, d: 0.35, type: 'square', v: 0.12 });
    noise({ d: 0.35, v: 0.35, f: 2000, f2: 200 });
    tone({ f: 1320, d: 0.12, type: 'triangle', v: 0.12, t: 0.12 });
  },
  dead() {
    tone({ f: 400, f2: 80, d: 0.6, type: 'sawtooth', v: 0.12 });
  },
  heal() {
    tone({ f: 1046, f2: 1568, d: 0.18, type: 'sine', v: 0.06 });
  },
  dash() {
    noise({ d: 0.35, v: 0.35, f: 600, f2: 3000, type: 'bandpass', q: 1.5 });
  },
  empty() {
    tone({ f: 300, d: 0.05, type: 'square', v: 0.05 });
  },
  click() {
    tone({ f: 660, f2: 990, d: 0.07, type: 'triangle', v: 0.18 });
  },
  select() {
    tone({ f: 523, d: 0.08, type: 'triangle', v: 0.16 });
    tone({ f: 784, d: 0.12, type: 'triangle', v: 0.16, t: 0.06 });
  },
  coin() {
    tone({ f: 1318, d: 0.07, type: 'square', v: 0.07 });
    tone({ f: 1760, d: 0.14, type: 'square', v: 0.07, t: 0.06 });
  },
  beep() {
    tone({ f: 660, d: 0.16, type: 'square', v: 0.12 });
  },
  go() {
    tone({ f: 990, d: 0.4, type: 'square', v: 0.13 });
    tone({ f: 1320, d: 0.4, type: 'triangle', v: 0.1 });
  },
  whoosh() {
    noise({ d: 0.45, v: 0.25, f: 300, f2: 4000, type: 'bandpass', q: 1 });
  },
  win() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone({ f, d: i === 6 ? 0.6 : 0.16, type: 'square', v: 0.09, t: i * 0.11 }));
    [262, 392, 523].forEach((f, i) => tone({ f, d: 0.5, type: 'triangle', v: 0.14, t: 0.55 + i * 0.02 }));
  },
  lose() {
    [494, 440, 392, 330].forEach((f, i) => tone({ f, d: 0.3, type: 'triangle', v: 0.14, t: i * 0.18 }));
  },
  respawn() {
    tone({ f: 392, f2: 784, d: 0.3, type: 'sine', v: 0.14 });
  },
};

export function sfx(name) {
  if (!S[name] || !gate(name)) return;
  try { S[name](); } catch (e) { /* ignore audio errors */ }
}

// ---------------- Music ----------------
let musicTimer = null;
let musicMode = null;
let pendingMusic = null;
let step = 0;
let nextTime = 0;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PROG = [
  [48, 55, 60, 64],
  [45, 52, 57, 60],
  [41, 48, 53, 57],
  [43, 50, 55, 59],
];
const MEL = [
  [72, -1, 76, -1, 79, -1, 76, 74, -1, 72, -1, 74, 76, -1, -1, -1],
  [72, -1, 69, -1, 72, -1, 76, -1, 74, -1, 72, -1, 69, -1, -1, -1],
  [69, -1, 72, -1, 77, -1, 76, 74, -1, 72, -1, 69, 72, -1, -1, -1],
  [71, -1, 74, -1, 79, -1, 77, 76, -1, 74, -1, 71, 74, -1, 79, -1],
];

function playStep(s, at) {
  const bar = Math.floor(s / 16) % 4;
  const pos = s % 16;
  const ch = PROG[bar];
  const battle = musicMode === 'battle';
  if (pos % 4 === 0) tone({ f: mtof(ch[0] - 12), d: 0.32, type: 'triangle', v: battle ? 0.32 : 0.24, at, dest: musicGain });
  if (battle && pos % 4 === 2) tone({ f: mtof(ch[0]), d: 0.12, type: 'triangle', v: 0.16, at, dest: musicGain });
  if (pos === 0 || pos === 6 || pos === 10) {
    for (let i = 1; i < 4; i++) tone({ f: mtof(ch[i]), d: 0.42, type: 'sine', v: 0.05, at, dest: musicGain });
  }
  if (battle) {
    if (pos % 8 === 0) tone({ f: 130, f2: 40, d: 0.18, type: 'sine', v: 0.5, at, dest: musicGain });
    if (pos % 8 === 4) noise({ d: 0.12, v: 0.2, f: 1800, type: 'bandpass', q: 0.8, at, dest: musicGain });
    if (pos % 2 === 0) noise({ d: 0.03, v: 0.07, f: 7000, type: 'highpass', at, dest: musicGain });
  } else if (pos % 4 === 2) {
    noise({ d: 0.03, v: 0.04, f: 8000, type: 'highpass', at, dest: musicGain });
  }
  const m = MEL[bar][pos];
  if (m > 0 && (battle || bar % 2 === 0 || pos < 8)) {
    tone({ f: mtof(m), d: 0.22, type: battle ? 'square' : 'triangle', v: battle ? 0.045 : 0.07, at, dest: musicGain });
  }
}

export function startMusic(mode) {
  if (!ctx) {
    pendingMusic = mode;
    return;
  }
  pendingMusic = null;
  if (musicMode === mode && musicTimer) return;
  stopMusic();
  musicMode = mode;
  step = 0;
  nextTime = ctx.currentTime + 0.08;
  const bpm = mode === 'battle' ? 128 : 104;
  const stepDur = 60 / bpm / 4;
  musicTimer = setInterval(() => {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.15) {
      playStep(step, nextTime);
      nextTime += stepDur;
      step++;
    }
  }, 40);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  musicMode = null;
}

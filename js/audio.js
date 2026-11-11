// Sons synthétisés en WebAudio (aucun fichier audio) + petite musique procédurale.
let ctx = null, master, sfxBus, musicBus, noiseBuf;
const state = { sfx: true, music: true, track: null, timer: null, step: 0, nextT: 0 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = state.sfx ? 0.55 : 0;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = state.music ? 0.16 : 0;
  musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (state.track) startMusic(state.track);
}

export function setSfx(on) { state.sfx = on; if (sfxBus) sfxBus.gain.value = on ? 0.55 : 0; }
export function setMusic(on) { state.music = on; if (musicBus) musicBus.gain.value = on ? 0.16 : 0; }

function tone(type, f0, f1, dur, vol = 0.3, t0 = 0, bus = sfxBus) {
  const t = ctx.currentTime + t0;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.3, freq = 1200, type = 'lowpass', t0 = 0, bus = sfxBus) {
  const t = ctx.currentTime + t0;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

const SFX = {
  pop: () => { tone('square', 520, 180, 0.12, 0.18); noise(0.08, 0.15, 2500); },
  zap: () => { tone('sawtooth', 1600, 220, 0.18, 0.14); tone('square', 2400, 900, 0.08, 0.06); },
  thud: () => { noise(0.16, 0.4, 500); tone('triangle', 160, 60, 0.15, 0.3); },
  twang: () => { tone('triangle', 880, 440, 0.12, 0.2); tone('triangle', 1320, 660, 0.08, 0.08, 0.01); },
  hit: () => { noise(0.06, 0.25, 3000, 'highpass'); tone('square', 300, 120, 0.06, 0.08); },
  hurt: () => { tone('square', 220, 90, 0.14, 0.18); noise(0.1, 0.2, 900); },
  ko: () => { [660, 520, 390, 260].forEach((f, i) => tone('square', f, f * 0.98, 0.12, 0.14, i * 0.07)); noise(0.35, 0.3, 700, 'lowpass', 0.05); },
  boom: () => { noise(0.55, 0.6, 380); tone('sine', 120, 35, 0.5, 0.5); },
  superReady: () => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.18, 0.16, i * 0.06)); },
  super: () => { tone('sawtooth', 200, 900, 0.25, 0.12); noise(0.3, 0.25, 1800, 'bandpass'); },
  heal: () => { [784, 988, 1175, 1568].forEach((f, i) => tone('sine', f, f, 0.2, 0.12, i * 0.05)); },
  jump: () => { tone('square', 180, 620, 0.25, 0.12); },
  click: () => { tone('triangle', 700, 900, 0.06, 0.15); },
  select: () => { tone('triangle', 520, 520, 0.08, 0.15); tone('triangle', 780, 780, 0.12, 0.15, 0.07); },
  beep: () => { tone('square', 660, 660, 0.14, 0.12); },
  go: () => { tone('square', 990, 990, 0.3, 0.14); tone('square', 1320, 1320, 0.3, 0.08); },
  bounce: () => { tone('sine', 900, 500, 0.06, 0.1); },
  win: () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone('square', f, f, 0.16, 0.12, i * 0.11)); },
  lose: () => { [440, 392, 349, 262].forEach((f, i) => tone('triangle', f, f * 0.97, 0.28, 0.16, i * 0.17)); },
  coin: () => { tone('square', 988, 988, 0.07, 0.1); tone('square', 1319, 1319, 0.2, 0.1, 0.07); },
};

export function sfx(name, vol = 1) {
  if (!ctx || !state.sfx || vol <= 0.02) return;
  const fn = SFX[name];
  if (!fn) return;
  if (vol < 1) {
    const prev = sfxBus;
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(prev);
    sfxBus = g;
    try { fn(); } finally { sfxBus = prev; }
  } else fn();
}

// --- Musique : boucle chiptune douce, accords I–V–vi–IV ---
const TRACKS = {
  lobby: { bpm: 104, root: 57, lead: true },
  game: { bpm: 128, root: 55, lead: true },
};
const PROG = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function startMusic(name) {
  state.track = name;
  if (!ctx) return;
  stopMusicTimer();
  state.step = 0;
  state.nextT = ctx.currentTime + 0.1;
  state.timer = setInterval(schedule, 25);
}

export function stopMusic() { state.track = null; stopMusicTimer(); }
function stopMusicTimer() { if (state.timer) clearInterval(state.timer); state.timer = null; }

function schedule() {
  const tr = TRACKS[state.track];
  if (!tr || !ctx) return;
  const stepDur = 60 / tr.bpm / 4;
  while (state.nextT < ctx.currentTime + 0.12) {
    const s = state.step;
    const bar = Math.floor(s / 16) % 4;
    const st = s % 16;
    const chord = PROG[bar];
    const t0 = state.nextT - ctx.currentTime;
    if (st % 4 === 0) tone('triangle', midi(tr.root - 12 + chord[0]), midi(tr.root - 12 + chord[0]), stepDur * 3, 0.5, t0, musicBus);
    if (st % 8 === 6) tone('triangle', midi(tr.root - 12 + chord[1]), midi(tr.root - 12 + chord[1]), stepDur * 1.5, 0.35, t0, musicBus);
    if (st === 0 || st === 8 || (state.track === 'game' && st === 10)) tone('sine', 140, 40, 0.18, 0.7, t0, musicBus);
    if (st === 4 || st === 12) noise(0.12, 0.35, 2000, 'bandpass', t0, musicBus);
    if (st % 2 === 1) noise(0.03, 0.15, 8000, 'highpass', t0, musicBus);
    if (tr.lead && st % 2 === 0) {
      const arp = [0, 1, 2, 1, 2, 0, 1, 2];
      const n = tr.root + 12 + chord[arp[(st / 2) % 8]] + (bar % 2 && st > 8 ? 12 : 0);
      tone('square', midi(n), midi(n), stepDur * 0.9, 0.09, t0, musicBus);
    }
    state.nextT += stepDur;
    state.step++;
  }
}

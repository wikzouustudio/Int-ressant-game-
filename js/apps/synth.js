/* Prisme OS — Synthé : séquenceur 16 pas avec batterie et visualiseur */
(function () {
  const { h } = OS;
  const STEPS = 16;
  // Gamme pentatonique mineure de la (deux octaves), aiguës en haut
  const NOTES = [['La5', 880], ['Sol5', 784], ['Mi5', 659.3], ['Ré5', 587.3], ['Do5', 523.3], ['La4', 440], ['Sol4', 392], ['Mi4', 329.6]];
  const DRUMS = ['Charley', 'Caisse', 'Grosse c.'];

  const PRESETS = {
    'Aurore': { mel: [[0, 5], [2, 4], [4, 2], [6, 4], [8, 5], [10, 3], [12, 1], [14, 3]], dr: { 0: [0, 4, 8, 12], 1: [4, 12], 2: [0, 8, 10] } },
    'Néon': { mel: [[0, 7], [3, 4], [6, 2], [8, 0], [11, 2], [14, 4]], dr: { 0: [0, 2, 4, 6, 8, 10, 12, 14], 1: [4, 12], 2: [0, 3, 8, 11] } },
    'Rêverie': { mel: [[0, 5], [4, 3], [8, 6], [12, 2]], dr: { 0: [2, 6, 10, 14], 1: [], 2: [0, 8] } },
  };

  OS.registerApp({
    id: 'synth', name: 'Synthé', icon: 'music', colors: ['#22d3ee', '#a855f7'],
    desc: 'Séquenceur musical', keywords: 'musique son audio beat', width: 860, height: 540, minW: 640, minH: 440, single: true,
    launch(win) {
      const ctx = OS.audio();
      const master = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const delay = ctx.createDelay();
      const fb = ctx.createGain();
      delay.delayTime.value = 0.28; fb.gain.value = 0.28;
      delay.connect(fb).connect(delay);
      master.connect(analyser).connect(ctx.destination);
      delay.connect(master);
      const setVol = () => (master.gain.value = (OS.volume / 100) * 0.6);
      setVol();
      const offVol = OS.on('volume', setVol);

      const grid = NOTES.map(() => Array(STEPS).fill(false));
      const drums = DRUMS.map(() => Array(STEPS).fill(false));
      let bpm = 112, wave = 'triangle', playing = false, step = 0, timer = null, nextTime = 0;

      function loadPreset(name) {
        grid.forEach((r) => r.fill(false)); drums.forEach((r) => r.fill(false));
        const p = PRESETS[name];
        p.mel.forEach(([s, n]) => (grid[n][s] = true));
        Object.entries(p.dr).forEach(([d, steps]) => steps.forEach((s) => (drums[d][s] = true)));
        paint();
      }

      function note(freq, t) {
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = wave; o2.type = wave; o.frequency.value = freq; o2.frequency.value = freq * 1.005;
        f.type = 'lowpass'; f.frequency.setValueAtTime(4000, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.4);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        o.connect(f); o2.connect(f); f.connect(g); g.connect(master); g.connect(delay);
        o.start(t); o2.start(t); o.stop(t + 0.55); o2.stop(t + 0.55);
      }
      function noise(dur) {
        const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const s = ctx.createBufferSource(); s.buffer = b; return s;
      }
      function drum(i, t) {
        const g = ctx.createGain();
        g.connect(master);
        if (i === 2) { // grosse caisse
          const o = ctx.createOscillator();
          o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
          g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          o.connect(g); o.start(t); o.stop(t + 0.4);
        } else {
          const n = noise(i === 1 ? 0.2 : 0.05);
          const f = ctx.createBiquadFilter();
          f.type = i === 1 ? 'bandpass' : 'highpass'; f.frequency.value = i === 1 ? 1800 : 7000;
          g.gain.setValueAtTime(i === 1 ? 0.5 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + (i === 1 ? 0.18 : 0.05));
          n.connect(f).connect(g); n.start(t);
        }
      }

      // Ordonnanceur précis (anticipe de 100 ms)
      function scheduler() {
        while (nextTime < ctx.currentTime + 0.1) {
          const s = step;
          grid.forEach((row, r) => row[s] && note(NOTES[r][1], nextTime));
          drums.forEach((row, r) => row[s] && drum(r, nextTime));
          const delayMs = Math.max(0, (nextTime - ctx.currentTime) * 1000);
          setTimeout(() => highlight(s), delayMs);
          nextTime += 60 / bpm / 4;
          step = (step + 1) % STEPS;
        }
      }
      function play() {
        if (ctx.state === 'suspended') ctx.resume();
        playing = !playing;
        playBtn.innerHTML = OS.icon(playing ? 'pause' : 'play', 18);
        playBtn.classList.toggle('on', playing);
        if (playing) { step = 0; nextTime = ctx.currentTime + 0.05; timer = setInterval(scheduler, 25); }
        else { clearInterval(timer); highlight(-1); }
      }

      // Interface
      const seq = h('div.sy-seq');
      const cells = [];
      const mkRow = (label, arr, cls, preview) => {
        const row = h('div.sy-row' + cls, h('span.sy-lbl', label));
        const rc = arr.map((_, s) => {
          const c = h('button.sy-cell' + (s % 4 === 0 ? '.beat' : ''));
          c.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            arr[s] = !arr[s];
            paintCell(c, arr[s]);
            if (arr[s] && !playing) { if (ctx.state === 'suspended') ctx.resume(); preview(ctx.currentTime); }
          });
          row.append(c);
          return c;
        });
        cells.push({ arr, rc });
        seq.append(row);
      };
      NOTES.forEach(([n, f], i) => mkRow(n, grid[i], '.mel', (t) => note(f, t)));
      seq.append(h('div.sy-gap'));
      DRUMS.forEach((n, i) => mkRow(n, drums[i], '.drum', (t) => drum(i, t)));
      const paintCell = (c, on) => c.classList.toggle('on', on);
      function paint() { cells.forEach(({ arr, rc }) => rc.forEach((c, s) => paintCell(c, arr[s]))); }
      function highlight(s) { cells.forEach(({ rc }) => rc.forEach((c, i) => c.classList.toggle('now', i === s))); }

      const playBtn = h('button.sy-play', { html: OS.icon('play', 18), onclick: play });
      const bpmIn = h('input', { type: 'range', min: 60, max: 180, value: bpm });
      const bpmLbl = h('b', bpm + ' BPM');
      bpmIn.style.setProperty('--p', ((bpm - 60) / 120) * 100 + '%');
      bpmIn.addEventListener('input', () => { bpm = +bpmIn.value; bpmLbl.textContent = bpm + ' BPM'; bpmIn.style.setProperty('--p', ((bpm - 60) / 120) * 100 + '%'); });
      const waveSel = h('select.field.sy-sel', ['triangle', 'sine', 'square', 'sawtooth'].map((w) => h('option', { value: w }, { triangle: 'Triangle', sine: 'Sinus', square: 'Carré', sawtooth: 'Dent de scie' }[w])));
      waveSel.addEventListener('change', () => (wave = waveSel.value));
      const presetSel = h('select.field.sy-sel', Object.keys(PRESETS).map((p) => h('option', p)));
      presetSel.addEventListener('change', () => loadPreset(presetSel.value));
      const rnd = h('button.btn', { html: OS.icon('sparkle', 14) + 'Aléatoire', onclick: () => {
        grid.forEach((r) => r.fill(false));
        for (let s = 0; s < STEPS; s++) if (Math.random() < 0.45) grid[Math.floor(Math.random() * NOTES.length)][s] = true;
        drums.forEach((r, i) => r.forEach((_, s) => (r[s] = i === 2 ? s % 4 === 0 || Math.random() < 0.1 : i === 1 ? s % 8 === 4 : s % 2 === 0 && Math.random() < 0.8)));
        paint();
      } });
      const clr = h('button.btn', { html: OS.icon('trash', 14) + 'Effacer', onclick: () => { grid.forEach((r) => r.fill(false)); drums.forEach((r) => r.fill(false)); paint(); } });
      const viz = h('canvas.sy-viz', { width: 800, height: 90 });

      win.body.append(h('div.sy',
        h('div.sy-top', playBtn, h('div.sy-bpm', bpmLbl, bpmIn), waveSel, presetSel, rnd, clr),
        viz, seq));

      // Visualiseur
      const vc = viz.getContext('2d');
      const data = new Uint8Array(analyser.frequencyBinCount);
      let raf;
      (function draw() {
        raf = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(data);
        vc.clearRect(0, 0, viz.width, viz.height);
        const n = 64, bw = viz.width / n;
        for (let i = 0; i < n; i++) {
          const v = data[i] / 255;
          const hgt = Math.max(2, v * viz.height);
          const g = vc.createLinearGradient(0, viz.height, 0, viz.height - hgt);
          g.addColorStop(0, OS.settings.accent); g.addColorStop(1, '#22d3ee');
          vc.fillStyle = g;
          vc.beginPath();
          vc.roundRect ? vc.roundRect(i * bw + 2, viz.height - hgt, bw - 4, hgt, 3) : vc.rect(i * bw + 2, viz.height - hgt, bw - 4, hgt);
          vc.fill();
        }
      })();

      loadPreset('Aurore');
      win.onClose(() => { clearInterval(timer); cancelAnimationFrame(raf); offVol(); master.disconnect(); });
    },
  });
})();

/* ============================================================
   Timer : le "lecteur" — minuteur de concentration lié à une tâche
   ============================================================ */
const Timer = (() => {
  const MODES = {
    focus25: { label: 'Focus', short: '25 min', sec: 25 * 60, focus: true },
    focus50: { label: 'Focus long', short: '50 min', sec: 50 * 60, focus: true },
    break5: { label: 'Pause', short: 'Pause 5', sec: 5 * 60, focus: false },
  };

  const s = {
    taskId: null,
    mode: 'focus25',
    remaining: MODES.focus25.sec,
    running: false,
    muted: U.storage.get('focustube:muted', false),
  };

  const listeners = new Set();
  let interval = null, last = 0, carry = 0, audio = null, wakeLock = null;

  const emit = (evt) => listeners.forEach(fn => fn(s, evt));
  const total = () => MODES[s.mode].sec;

  function load(taskId) {
    if (s.taskId === taskId) return;
    pause();
    Object.assign(s, { taskId, mode: 'focus25', remaining: MODES.focus25.sec });
    emit('load');
  }

  function play() {
    if (!s.taskId || s.running) return;
    s.running = true;
    last = Date.now();
    interval = setInterval(tick, 250);
    keepAwake();
    emit('play');
  }

  function pause() {
    if (!s.running) return;
    s.running = false;
    clearInterval(interval);
    releaseWake();
    emit('pause');
  }

  const toggle = () => (s.running ? pause() : play());

  function tick() {
    const now = Date.now();
    carry += now - last;
    last = now;
    const whole = Math.floor(carry / 1000);
    if (!whole) return;
    carry -= whole * 1000;
    const step = Math.min(whole, s.remaining);
    s.remaining -= step;
    if (MODES[s.mode].focus) Store.addFocus(s.taskId, step);
    if (s.remaining <= 0) finish(true);
    else emit('tick');
  }

  /** Fin de session : complete=true si le minuteur est allé au bout. */
  function finish(complete) {
    const wasFocus = MODES[s.mode].focus;
    pause();
    if (complete) {
      beep(wasFocus ? [660, 880, 1320] : [880, 660]);
      if (wasFocus) Store.logSession(s.taskId);
    }
    setMode(wasFocus ? 'break5' : 'focus25');
    emit(complete ? (wasFocus ? 'focus-done' : 'break-done') : 'skip');
  }

  function setMode(mode) {
    pause();
    s.mode = mode;
    s.remaining = MODES[mode].sec;
    carry = 0;
    emit('mode');
  }

  function restart() { s.remaining = total(); carry = 0; emit('tick'); }

  function stop() {
    pause();
    s.taskId = null;
    emit('stop');
  }

  function toggleMute() {
    s.muted = !s.muted;
    U.storage.set('focustube:muted', s.muted);
    emit('mute');
  }

  function beep(notes) {
    if (s.muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      notes.forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        const t = audio.currentTime + i * 0.18;
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + 0.4);
      });
    } catch { /* audio indisponible */ }
  }

  async function keepAwake() {
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
  }
  function releaseWake() { try { wakeLock?.release(); } catch { /* rien */ } wakeLock = null; }

  return {
    MODES,
    state: s,
    total,
    progress: () => 1 - s.remaining / total(),
    isFocus: () => MODES[s.mode].focus,
    subscribe: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    load, play, pause, toggle, setMode, restart, stop, toggleMute,
    skip: () => finish(false),
  };
})();

/* ============================================================
   Utilitaires partagés : icônes, formatage, helpers DOM
   ============================================================ */
const U = (() => {
  const ICONS = {
    menu: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z',
    search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14',
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    later: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16m.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
    history: 'M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A8.95 8.95 0 0 0 13 21a9 9 0 0 0 0-18m-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8z',
    studio: 'M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z',
    like: 'M1 21h4V9H1zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73z',
    likeOutline: 'M9 21h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2M9 9l4.34-4.34L12 10h9v2l-3 7H9zM1 9h4v12H1z',
    play: 'M8 5v14l11-7z',
    pause: 'M6 19h4V5H6zm8-14v14h4V5z',
    next: 'M6 18l8.5-6L6 6zM16 6v12h2V6z',
    replay: 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8',
    fullscreen: 'M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z',
    close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z',
    trash: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z',
    add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',
    theme: 'M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-4.4 2.26 5.4 5.4 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1',
    check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    volume: 'M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77',
    mute: 'M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63m2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71M4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9zM12 4 9.91 6.09 12 8.18z',
    channel: 'M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z',
    open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3z',
  };

  const icon = (name, cls = '') =>
    `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ''}"/></svg>`;

  const esc = (s = '') => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const hash = (s) => {
    let h = 0;
    for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) | 0;
    return Math.abs(h);
  };

  const pad = (n) => String(n).padStart(2, '0');

  /** 754 -> "12:34", 4000 -> "1:06:40" */
  const clock = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  /** Durée lisible : 5400 -> "1 h 30", 600 -> "10 min" */
  const human = (sec) => {
    const min = Math.round(sec / 60);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} h ${pad(m)}` : `${h} h`;
  };

  const timeAgo = (ts) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    const steps = [[31536000, 'an', 'ans'], [2592000, 'mois', 'mois'], [604800, 'semaine', 'semaines'],
      [86400, 'jour', 'jours'], [3600, 'heure', 'heures'], [60, 'minute', 'minutes']];
    for (const [n, one, many] of steps) {
      const v = Math.floor(s / n);
      if (v >= 1) return `il y a ${v} ${v > 1 ? many : one}`;
    }
    return "à l'instant";
  };

  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  /** Fond de miniature généré depuis la couleur de la chaîne + un décalage propre à la tâche */
  const thumbBg = (color, seed) => {
    const shift = (hash(seed) % 70) - 35;
    const angle = 110 + (hash(seed + 'a') % 100);
    return `background:
      radial-gradient(circle at ${20 + hash(seed + 'x') % 60}% ${20 + hash(seed + 'y') % 60}%, rgba(255,255,255,.28), transparent 55%),
      linear-gradient(${angle}deg, ${color}, color-mix(in oklab, ${color}, hsl(${(hash(seed) % 360) + shift} 80% 30%) 65%));`;
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const storage = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
    },
  };

  return { icon, esc, uid, hash, clock, human, timeAgo, plural, dayKey, thumbBg, $, $$, storage };
})();

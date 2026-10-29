/* Prisme OS — noyau : utilitaires, bus d'événements, stockage, réglages */
(function () {
  const OS = (window.OS = {});
  OS.version = '1.0 « Aurore »';
  OS.bootTime = Date.now();

  OS.$ = (sel, root = document) => root.querySelector(sel);
  OS.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // Création d'éléments : OS.h('div.cls#id', {attrs}, ...enfants)
  OS.h = function (spec, attrs, ...children) {
    const m = spec.match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) {
      for (const part of m[2].match(/[.#][\w-]+/g)) {
        if (part[0] === '.') el.classList.add(part.slice(1));
        else el.id = part.slice(1);
      }
    }
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      children.unshift(attrs);
      attrs = null;
    }
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  };

  OS.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  OS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  OS.rand = (a, b) => a + Math.random() * (b - a);
  OS.uid = () => Math.random().toString(36).slice(2, 9);

  // Bus d'événements
  const listeners = {};
  OS.on = (ev, fn) => ((listeners[ev] ||= []).push(fn), () => OS.off(ev, fn));
  OS.off = (ev, fn) => (listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn));
  OS.emit = (ev, data) => (listeners[ev] || []).slice().forEach((fn) => fn(data));

  // Stockage persistant (tolérant aux navigateurs privés)
  OS.store = {
    get(key, def) {
      try {
        const v = localStorage.getItem('prisme:' + key);
        return v == null ? def : JSON.parse(v);
      } catch { return def; }
    },
    set(key, val) {
      try { localStorage.setItem('prisme:' + key, JSON.stringify(val)); } catch {}
    },
    clear() {
      try { Object.keys(localStorage).filter((k) => k.startsWith('prisme:')).forEach((k) => localStorage.removeItem(k)); } catch {}
    },
  };

  // Réglages
  OS.defaults = {
    user: 'Explorateur',
    accent: '#8b5cf6',
    theme: 'dark',
    wallpaper: 'aurora',
    magnify: true,
    transparency: true,
    animations: true,
    sounds: true,
    widgets: true,
    dnd: false,
  };
  OS.settings = Object.assign({}, OS.defaults, OS.store.get('settings', {}));
  OS.setSetting = function (key, val) {
    OS.settings[key] = val;
    OS.store.set('settings', OS.settings);
    OS.applySettings();
    OS.emit('settings', { key, val });
  };

  OS.accents = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#ec4899', '#e2e8f0'];

  OS.hexToRgb = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  OS.shade = (hex, amt) => {
    const [r, g, b] = OS.hexToRgb(hex).map((c) => OS.clamp(Math.round(c + amt), 0, 255));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  };

  OS.applySettings = function () {
    const s = OS.settings;
    const root = document.documentElement;
    root.dataset.theme = s.theme;
    root.style.setProperty('--accent', s.accent);
    root.style.setProperty('--accent-rgb', OS.hexToRgb(s.accent).join(','));
    root.style.setProperty('--accent-2', OS.shade(s.accent, 60));
    root.classList.toggle('no-blur', !s.transparency);
    root.classList.toggle('no-anim', !s.animations);
    root.classList.toggle('no-widgets', !s.widgets);
  };

  // Petits sons d'interface synthétisés (aucun fichier audio)
  let actx;
  OS.audio = () => (actx ||= new (window.AudioContext || window.webkitAudioContext)());
  OS.sound = function (type) {
    if (!OS.settings.sounds) return;
    try {
      const ctx = OS.audio();
      const t = ctx.currentTime;
      const notes = {
        open: [[660, 0], [880, 0.05]],
        close: [[520, 0], [390, 0.05]],
        notify: [[880, 0], [1175, 0.08], [1568, 0.16]],
        click: [[1200, 0]],
        boot: [[262, 0], [392, 0.12], [523, 0.24], [784, 0.36]],
        error: [[220, 0], [196, 0.1]],
      }[type] || [[600, 0]];
      notes.forEach(([f, d]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type === 'error' ? 'square' : 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t + d);
        g.gain.linearRampToValueAtTime(type === 'click' ? 0.03 : 0.06, t + d + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + (type === 'boot' ? 0.6 : 0.18));
        o.connect(g).connect(ctx.destination);
        o.start(t + d);
        o.stop(t + d + 0.7);
      });
    } catch {}
  };

  OS.formatTime = (d = new Date(), sec = false) =>
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: sec ? '2-digit' : undefined });
  OS.formatDate = (d = new Date()) =>
    d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  OS.uptime = () => {
    const s = Math.floor((Date.now() - OS.bootTime) / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return (h ? h + ' h ' : '') + m + ' min ' + (s % 60) + ' s';
  };

  OS.applySettings();
})();

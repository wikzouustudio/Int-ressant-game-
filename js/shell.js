/* Prisme OS — interface système : démarrage, verrouillage, barre, dock, recherche, panneaux */
(function () {
  const { h, $, $$ } = OS;

  /* ---------------------------------------------------------------------
     Utilitaires système partagés
     --------------------------------------------------------------------- */

  // Évaluation mathématique sûre (liste blanche de symboles et de fonctions)
  OS.evalMath = function (expr) {
    let e = String(expr).trim().replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').replace(/π/g, 'pi');
    if (!e || !/[\d)]/.test(e)) return null;
    const fns = ['sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'abs', 'round', 'floor', 'ceil', 'pi', 'e', 'exp', 'min', 'max', 'pow'];
    const stripped = e.replace(/[a-z]+/gi, (w) => (fns.includes(w.toLowerCase()) ? '' : '#'));
    if (stripped.includes('#') || !/^[\d+\-*/().%\s]*$/.test(stripped)) return null;
    e = e.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)')
      .replace(/\bln\b/g, 'Math.log').replace(/\blog\b/g, 'Math.log10').replace(/\bpi\b/gi, 'Math.PI').replace(/\be\b/g, 'Math.E')
      .replace(/\b(sqrt|sin|cos|tan|abs|round|floor|ceil|exp|min|max|pow)\b/g, 'Math.$1');
    try {
      const r = Function('"use strict";return (' + e + ')')();
      return typeof r === 'number' && isFinite(r) ? +r.toPrecision(12) : null;
    } catch { return null; }
  };

  OS.openFile = function (path) {
    const node = OS.fs.get(path);
    if (!node) return;
    if (node.type === 'dir') return OS.launch('files', { path });
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(path)) return OS.launch('viewer', { path });
    return OS.launch('notes', { path });
  };

  // Statistiques système (charge estimée à partir du rythme réel de rendu)
  const stats = { cpu: 12, mem: 30, fps: 60, net: 0, history: { cpu: [], mem: [], fps: [] } };
  OS.stats = stats;
  (function sampler() {
    let frames = 0, lastT = performance.now(), worst = 0, prev = lastT;
    function loop(t) {
      frames++;
      worst = Math.max(worst, t - prev);
      prev = t;
      if (t - lastT >= 1000) {
        stats.fps = Math.round((frames * 1000) / (t - lastT));
        const lag = OS.clamp((worst - 17) / 50, 0, 1);
        const winLoad = OS.windows.filter((w) => w.state !== 'min').length * 3.5;
        stats.cpu = Math.round(OS.clamp(stats.cpu * 0.6 + (6 + winLoad + lag * 60 + Math.random() * 10) * 0.4, 1, 100));
        const pm = performance.memory;
        stats.mem = pm ? Math.round((pm.usedJSHeapSize / pm.jsHeapSizeLimit) * 100 * 8 + 18) : Math.round(OS.clamp(22 + OS.windows.length * 4 + Math.random() * 3, 0, 95));
        stats.mem = OS.clamp(stats.mem, 1, 99);
        stats.net = Math.round(Math.max(0, stats.net * 0.5 + (Math.random() < 0.3 ? Math.random() * 900 : Math.random() * 40)));
        for (const k of ['cpu', 'mem', 'fps']) {
          stats.history[k].push(stats[k]);
          if (stats.history[k].length > 60) stats.history[k].shift();
        }
        OS.emit('stats', stats);
        frames = 0; worst = 0; lastT = t;
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  })();

  // Volume global (utilisé par les apps audio)
  OS.volume = OS.store.get('volume', 70);
  OS.setVolume = (v) => { OS.volume = v; OS.store.set('volume', v); OS.emit('volume', v); };

  /* ---------------------------------------------------------------------
     Notifications
     --------------------------------------------------------------------- */
  const history = [];
  OS.notifications = history;
  OS.notify = function ({ title, body = '', icon = 'bell', onclick, silent }) {
    history.unshift({ title, body, icon, time: new Date() });
    if (history.length > 30) history.pop();
    OS.emit('notifications');
    if (OS.settings.dnd) return;
    if (!silent) OS.sound('notify');
    const t = h('div.toast', h('div.t-ico', { html: OS.icon(icon, 18) }), h('div', h('b', title), body && h('p', body)));
    const dismiss = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
    t.addEventListener('click', () => { onclick && onclick(); dismiss(); });
    $('#toasts').append(t);
    setTimeout(dismiss, 4800);
  };

  /* ---------------------------------------------------------------------
     Menu contextuel & boîte de dialogue
     --------------------------------------------------------------------- */
  const ctx = $('#ctxmenu');
  OS.contextMenu = function (x, y, items) {
    ctx.innerHTML = '';
    for (const it of items) {
      if (it === '-') { ctx.append(h('div.cm-sep')); continue; }
      ctx.append(h('button.cm-item', {
        onclick: () => { hideCtx(); it.action && it.action(); },
        html: OS.icon(it.icon || 'right', 15) + `<span>${OS.esc(it.label)}</span>` + (it.kbd ? `<kbd>${it.kbd}</kbd>` : ''),
      }));
    }
    ctx.classList.remove('hidden');
    const r = ctx.getBoundingClientRect();
    ctx.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
    ctx.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  };
  const hideCtx = () => ctx.classList.add('hidden');

  OS.prompt = function (title, value = '', okLabel = 'Valider') {
    return new Promise((resolve) => {
      const input = h('input.field', { value });
      const close = (v) => { overlay.remove(); resolve(v); };
      const overlay = h('div.modal-overlay',
        h('div.modal',
          h('h3', title),
          input,
          h('div.modal-actions',
            h('button.btn', { onclick: () => close(null) }, 'Annuler'),
            h('button.btn.primary', { onclick: () => close(input.value.trim() || null) }, okLabel)),
        ));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') close(input.value.trim() || null);
        if (e.key === 'Escape') close(null);
        e.stopPropagation();
      });
      document.body.append(overlay);
      setTimeout(() => { input.focus(); input.select(); }, 30);
    });
  };

  /* ---------------------------------------------------------------------
     Démarrage
     --------------------------------------------------------------------- */
  const boot = $('#boot');
  $('.boot-logo').innerHTML = OS.logo(96);
  const bootMsgs = [
    'Initialisation du noyau prisme-kernel…',
    'Montage du système de fichiers virtuel…',
    'Calibration du spectre chromatique…',
    'Démarrage du compositeur de fenêtres…',
    'Chargement des applications…',
    'Réveil d\'Iris…',
    'Prêt.',
  ];
  let bootStep = 0, booted = false;
  const bootTimer = setInterval(() => {
    bootStep++;
    $('.boot-bar i').style.width = Math.min(100, (bootStep / bootMsgs.length) * 100) + '%';
    $('.boot-msg').textContent = bootMsgs[Math.min(bootStep, bootMsgs.length - 1)];
    if (bootStep >= bootMsgs.length) finishBoot();
  }, 320);
  function finishBoot() {
    if (booted) return;
    booted = true;
    clearInterval(bootTimer);
    boot.classList.add('done');
    setTimeout(() => boot.remove(), 900);
    showLock();
  }
  boot.addEventListener('click', finishBoot);

  /* ---------------------------------------------------------------------
     Verrouillage
     --------------------------------------------------------------------- */
  const lock = $('#lock');
  let locked = false, firstUnlock = true;
  function renderLock() {
    $('.lock-time').textContent = OS.formatTime();
    $('.lock-date').textContent = OS.formatDate();
  }
  function showLock() {
    locked = true;
    const name = OS.settings.user;
    $('.lock-user .avatar').innerHTML = `<span>${OS.esc(name[0] || '?').toUpperCase()}</span>`;
    $('.lock-name').textContent = name;
    renderLock();
    lock.classList.remove('hidden', 'out');
    closePanels();
  }
  OS.lock = showLock;
  function unlock() {
    if (!locked) return;
    locked = false;
    lock.classList.add('out');
    setTimeout(() => lock.classList.add('hidden'), 600);
    $('#desktop').classList.remove('hidden');
    if (firstUnlock) {
      firstUnlock = false;
      OS.sound('boot');
      buildDesktop();
      setTimeout(() => {
        const visits = OS.store.get('visits', 0) + 1;
        OS.store.set('visits', visits);
        OS.notify({
          title: visits === 1 ? 'Bienvenue sur Prisme OS ✦' : `Bon retour, ${OS.settings.user} !`,
          body: visits === 1 ? 'Appuyez sur Ctrl + Espace pour tout rechercher, ou parlez à Iris.' : 'Votre session a été restaurée.',
          icon: 'sparkle',
          onclick: () => OS.launch('iris'),
        });
      }, 900);
    }
  }
  lock.addEventListener('click', unlock);
  setInterval(() => locked && renderLock(), 1000);

  /* ---------------------------------------------------------------------
     Barre supérieure
     --------------------------------------------------------------------- */
  function buildTopbar() {
    $('#tb-logo').innerHTML = OS.logo(18);
    $('#tb-search').innerHTML = OS.icon('search', 15);
    $('#tb-cc').innerHTML = OS.icon('toggles', 16);
    $('#tb-logo').onclick = (e) => {
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      OS.contextMenu(r.left, r.bottom + 6, [
        { label: 'À propos de Prisme OS', icon: 'info', action: aboutDialog },
        { label: 'Réglages…', icon: 'sliders', action: () => OS.launch('settings') },
        '-',
        { label: 'Vue d\'ensemble', icon: 'grid', kbd: 'F3', action: () => OS.toggleOverview(true) },
        { label: 'Rechercher', icon: 'search', kbd: 'Ctrl Espace', action: openLauncher },
        '-',
        { label: 'Verrouiller', icon: 'lock', kbd: 'Ctrl Alt L', action: showLock },
        { label: 'Redémarrer', icon: 'refresh', action: () => location.reload() },
      ]);
    };
    $('#tb-search').onclick = (e) => { e.stopPropagation(); openLauncher(); };
    $('#tb-cc').onclick = (e) => { e.stopPropagation(); togglePanel('cc'); };
    $('#tb-clock').onclick = (e) => { e.stopPropagation(); togglePanel('calendar'); };

    // Menus de la fenêtre active
    const menu = $('#tb-menu');
    const mk = (label, items) => h('button', { onclick: (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); OS.contextMenu(r.left, r.bottom + 6, items()); } }, label);
    menu.append(
      mk('Fichier', () => [
        { label: 'Nouvelle fenêtre', icon: 'plus', action: () => { const f = OS.focused(); OS.launch(f ? f.app.id : 'files'); } },
        { label: 'Nouvelle note', icon: 'notes', action: () => OS.launch('notes') },
        { label: 'Ouvrir le dossier personnel', icon: 'home', action: () => OS.launch('files') },
      ]),
      mk('Fenêtre', () => {
        const f = OS.focused();
        if (!f) return [{ label: 'Aucune fenêtre active', icon: 'info' }];
        return [
          { label: 'Réduire', icon: 'minus', action: f.minimize },
          { label: f.state === 'max' ? 'Restaurer' : 'Agrandir', icon: 'square', action: f.toggleMax },
          { label: 'Ancrer à gauche', icon: 'left', action: () => f.snap('left') },
          { label: 'Ancrer à droite', icon: 'right', action: () => f.snap('right') },
          '-',
          ...Array.from({ length: OS.WS_COUNT }, (_, i) => ({ label: `Déplacer vers le bureau ${i + 1}`, icon: 'desktop', action: () => OS.moveToWorkspace(f, i) })).filter((_, i) => i !== f.ws),
          '-',
          { label: 'Fermer', icon: 'x', action: f.close },
        ];
      }),
      mk('Aide', () => [
        { label: 'Demander à Iris', icon: 'sparkle', action: () => OS.launch('iris') },
        { label: 'Raccourcis clavier', icon: 'zap', action: shortcutsHelp },
        { label: 'À propos', icon: 'info', action: aboutDialog },
      ]),
    );

    // Bureaux virtuels
    const wsEl = $('#tb-workspaces');
    const renderWs = () => {
      wsEl.innerHTML = '';
      for (let i = 0; i < OS.WS_COUNT; i++) {
        const has = OS.windows.some((w) => w.ws === i);
        wsEl.append(h('button.ws-dot' + (i === OS.workspace ? '.active' : '') + (has ? '.has' : ''), { title: `Bureau ${i + 1}`, onclick: () => OS.switchWorkspace(i) }));
      }
    };
    OS.on('workspace', renderWs);
    OS.on('windows', renderWs);
    renderWs();

    // Nom de l'app active
    OS.on('focus', (w) => { $('#tb-app').textContent = w ? w.app.name : 'Bureau'; });

    // Zone de notification : réseau, volume, batterie
    const tray = $('#tb-tray');
    const net = h('span', { title: 'Réseau' });
    const vol = h('span', { title: 'Volume' });
    const bat = h('span', { title: 'Batterie' });
    tray.append(net, vol, bat);
    const renderNet = () => (net.innerHTML = OS.icon(navigator.onLine ? 'wifi' : 'plane', 15));
    const renderVol = () => (vol.innerHTML = OS.icon(OS.volume ? 'volume' : 'mute', 15));
    addEventListener('online', renderNet); addEventListener('offline', renderNet);
    OS.on('volume', renderVol);
    renderNet(); renderVol();
    vol.onclick = (e) => { e.stopPropagation(); togglePanel('cc'); };
    bat.style.display = 'none';
    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        const r = () => {
          bat.style.display = '';
          bat.innerHTML = `<span class="batt${b.charging ? ' charging' : ''}"><i style="width:${Math.round(b.level * 100)}%"></i></span>${Math.round(b.level * 100)} %`;
        };
        b.addEventListener('levelchange', r); b.addEventListener('chargingchange', r); r();
      }).catch(() => {});
    }

    const tick = () => {
      const d = new Date();
      $('#tb-clock').textContent = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + '  ' + OS.formatTime(d);
    };
    tick();
    setInterval(tick, 1000);
  }

  function aboutDialog() {
    const w = OS.launch('about');
    return w;
  }
  OS.registerApp({
    id: 'about', name: 'À propos', icon: 'info', colors: ['#64748b', '#334155'], width: 420, height: 440, single: true, hidden: true,
    launch(win) {
      const nApps = Object.values(OS.apps).filter((a) => !a.hidden).length;
      win.body.innerHTML = `
        <div class="about">
          <div class="about-logo">${OS.logo(84)}</div>
          <h2>Prisme<span>OS</span></h2>
          <p class="ver">Version ${OS.version}</p>
          <div class="about-rows">
            <div><span>Noyau</span><b>prisme-kernel 6.9</b></div>
            <div><span>Applications</span><b>${nApps}</b></div>
            <div><span>Bureaux virtuels</span><b>${OS.WS_COUNT}</b></div>
            <div><span>Moteur</span><b>${OS.esc(navigator.userAgent.match(/(Firefox|Edg|Chrome|Safari)\/[\d.]+/)?.[0] || 'Web')}</b></div>
            <div><span>Écran</span><b>${screen.width} × ${screen.height}</b></div>
          </div>
          <p class="tag">La lumière, décomposée. ✦</p>
        </div>`;
    },
  });

  function shortcutsHelp() {
    OS.notify({ title: 'Raccourcis clavier', body: 'Ctrl+Espace : recherche · F3 : vue d\'ensemble · Ctrl+Alt+←/→ : bureaux · Ctrl+Alt+T : terminal · Ctrl+Alt+L : verrouiller · Échap : fermer', icon: 'zap' });
  }

  /* ---------------------------------------------------------------------
     Dock avec effet de loupe
     --------------------------------------------------------------------- */
  const PINNED = ['files', 'terminal', 'notes', 'iris', 'studio', 'synth', 'calculator', 'monitor', 'snake', 'settings'];
  function buildDock() {
    const inner = $('#dock-inner');
    const render = () => {
      inner.innerHTML = '';
      const launcherItem = h('div.dock-item', { 'data-app': '__launcher', onclick: openLauncher },
        OS.appIcon({ icon: 'grid', colors: ['#334155', '#0f172a'] }, 52), h('span.tip', 'Applications'), h('span.dot'));
      inner.append(launcherItem, h('div.dock-sep'));
      const running = new Set(OS.windows.map((w) => w.app.id));
      const ids = [...PINNED, ...[...running].filter((id) => !PINNED.includes(id))];
      const f = OS.focused();
      for (const id of ids) {
        const app = OS.apps[id];
        if (!app) continue;
        const it = h('div.dock-item' + (running.has(id) ? '.running' : '') + (f && f.app.id === id ? '.active' : ''), { 'data-app': id },
          OS.appIcon(app, 52), h('span.tip', app.name), h('span.dot'));
        it.addEventListener('click', () => dockClick(id, it));
        it.addEventListener('contextmenu', (e) => {
          e.preventDefault(); e.stopPropagation();
          const ws = OS.windows.filter((w) => w.app.id === id);
          OS.contextMenu(e.clientX, e.clientY - 10, [
            { label: 'Nouvelle fenêtre', icon: 'plus', action: () => OS.launch(id) },
            ...(ws.length ? ['-', ...ws.map((w) => ({ label: w.el.querySelector('.win-title-text').textContent, icon: 'square', action: () => { OS.switchWorkspace(w.ws); w.restore(); w.focus(); } })), '-', { label: `Tout fermer (${ws.length})`, icon: 'x', action: () => ws.forEach((w) => w.close()) }] : []),
          ]);
        });
        inner.append(it);
      }
    };
    OS.on('windows', render);
    OS.on('focus', () => {
      const f = OS.focused();
      $$('.dock-item', inner).forEach((el) => el.classList.toggle('active', !!f && f.app.id === el.dataset.app));
    });
    render();

    // Loupe : la taille dépend de la distance au curseur
    inner.addEventListener('mousemove', (e) => {
      if (!OS.settings.magnify || innerWidth < 760) return;
      for (const it of $$('.dock-item', inner)) {
        const r = it.getBoundingClientRect();
        const d = Math.abs(e.clientX - (r.left + r.width / 2));
        const s = 52 + 30 * Math.max(0, Math.cos(Math.min(d / 150, 1) * Math.PI / 2));
        it.style.width = it.style.height = s + 'px';
      }
    });
    inner.addEventListener('mouseleave', () => $$('.dock-item', inner).forEach((it) => (it.style.width = it.style.height = '')));
  }

  function dockClick(id, el) {
    const ws = OS.windows.filter((w) => w.app.id === id);
    if (!ws.length) {
      el.classList.add('bounce');
      setTimeout(() => el.classList.remove('bounce'), 1400);
      return OS.launch(id);
    }
    const here = ws.filter((w) => w.ws === OS.workspace);
    const f = OS.focused();
    if (f && f.app.id === id && here.length === 1) return f.minimize();
    const target = here.find((w) => w.state === 'min') || here[0] || ws[0];
    if (target.ws !== OS.workspace) OS.switchWorkspace(target.ws);
    target.restore();
    target.focus();
  }
  OS.on('launching', (id) => {
    const el = $(`.dock-item[data-app="${id}"]`);
    if (el && !el.classList.contains('bounce')) { el.classList.add('bounce'); setTimeout(() => el.classList.remove('bounce'), 1400); }
  });

  /* ---------------------------------------------------------------------
     Icônes du bureau (contenu de ~/Bureau)
     --------------------------------------------------------------------- */
  const DESK = OS.fs.HOME + '/Bureau';
  function renderIcons() {
    const el = $('#icons');
    el.innerHTML = '';
    for (const e of OS.fs.list(DESK) || []) {
      const ic = h('div.desk-icon', { title: e.name },
        h('div.fi' + (e.type === 'dir' ? '.folder' : ''), { html: OS.icon(OS.fs.iconFor(e), 26, 1.8) }),
        h('span', e.name));
      ic.addEventListener('click', (ev) => { ev.stopPropagation(); $$('.desk-icon.sel').forEach((x) => x.classList.remove('sel')); ic.classList.add('sel'); });
      ic.addEventListener('dblclick', () => OS.openFile(e.path));
      ic.addEventListener('contextmenu', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        OS.contextMenu(ev.clientX, ev.clientY, [
          { label: 'Ouvrir', icon: 'eye', action: () => OS.openFile(e.path) },
          { label: 'Renommer', icon: 'pencil', action: async () => { const n = await OS.prompt('Renommer', e.name); if (n) try { OS.fs.rename(e.path, n); } catch (er) { OS.notify({ title: 'Erreur', body: er.message, icon: 'info' }); } } },
          '-',
          { label: 'Supprimer', icon: 'trash', action: () => OS.fs.remove(e.path) },
        ]);
      });
      el.append(ic);
    }
  }
  OS.on('fs', (p) => { if (p.startsWith(DESK) || p === OS.fs.HOME || p === '/') renderIcons(); });

  /* ---------------------------------------------------------------------
     Widgets
     --------------------------------------------------------------------- */
  function buildWidgets() {
    const wrap = $('#widgets');
    // Horloge analogique
    const cv = h('canvas', { width: 184, height: 184 });
    const big = h('div.big'), sm = h('div.sm');
    wrap.append(h('div.widget', h('div.w-clock', cv, h('div', big, sm))));
    const c = cv.getContext('2d');
    function drawClock() {
      const d = new Date();
      big.textContent = OS.formatTime(d);
      sm.textContent = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const accent = OS.settings.accent;
      const fg = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
      c.clearRect(0, 0, 184, 184);
      c.save(); c.translate(92, 92);
      c.beginPath(); c.arc(0, 0, 84, 0, 7); c.fillStyle = 'rgba(127,127,160,.12)'; c.fill();
      for (let i = 0; i < 60; i++) {
        c.save(); c.rotate((i / 60) * Math.PI * 2);
        c.fillStyle = fg; c.globalAlpha = i % 5 ? 0.25 : 0.8;
        c.fillRect(-1, -78, 2, i % 5 ? 4 : 9);
        c.restore();
      }
      const hand = (ang, len, w, col) => {
        c.save(); c.rotate(ang); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, 10); c.lineTo(0, -len); c.stroke(); c.restore();
      };
      const s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, hr = (d.getHours() % 12) + m / 60;
      hand((hr / 12) * Math.PI * 2, 42, 6, fg);
      hand((m / 60) * Math.PI * 2, 62, 4, fg);
      hand((s / 60) * Math.PI * 2, 68, 2, accent);
      c.beginPath(); c.arc(0, 0, 5, 0, 7); c.fillStyle = accent; c.fill();
      c.restore();
    }
    setInterval(drawClock, 100);
    drawClock();

    // Météo (simulée de façon déterministe à partir de la date)
    const day = Math.floor(Date.now() / 864e5);
    const seed = (n) => { const x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); };
    const conds = [['☀️', 'Ensoleillé'], ['⛅', 'Éclaircies'], ['☁️', 'Nuageux'], ['🌧️', 'Averses'], ['🌤️', 'Doux']];
    const month = new Date().getMonth();
    const baseT = [5, 6, 10, 13, 17, 21, 24, 24, 20, 15, 9, 6][month];
    const fc = Array.from({ length: 5 }, (_, i) => ({ c: conds[Math.floor(seed(day + i) * conds.length)], t: Math.round(baseT + (seed(day + i + 99) - 0.5) * 8) }));
    const days = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
    wrap.append(h('div.widget',
      h('h4', 'Météo · Paris (démo)'),
      h('div.w-weather', h('div', h('div.temp', fc[0].t + '°'), h('div.desc', fc[0].c[1])), h('div.emoji', fc[0].c[0])),
      h('div.w-forecast', fc.slice(1).map((f, i) => h('div', days[(new Date().getDay() + i + 1) % 7], h('b', f.c[0]), f.t + '°'))),
    ));

    // Système
    const rows = {};
    const row = (k, label) => (rows[k] = { bar: h('i'), val: h('span') }, h('div.row', h('span', label), h('div.bar', rows[k].bar), rows[k].val));
    wrap.append(h('div.widget.w-stats', h('h4', 'Système'), row('cpu', 'CPU'), row('mem', 'RAM'), row('fps', 'FPS')));
    OS.on('stats', (s) => {
      rows.cpu.bar.style.width = s.cpu + '%'; rows.cpu.val.textContent = s.cpu + '%';
      rows.mem.bar.style.width = s.mem + '%'; rows.mem.val.textContent = s.mem + '%';
      rows.fps.bar.style.width = Math.min(100, (s.fps / 60) * 100) + '%'; rows.fps.val.textContent = s.fps;
    });

    // Widgets déplaçables, positions mémorisées
    const pos = OS.store.get('widgetPos', {});
    [...wrap.children].forEach((wg, i) => {
      if (pos[i]) Object.assign(wg.style, { position: 'fixed', left: pos[i][0] + 'px', top: pos[i][1] + 'px', margin: 0 });
      wg.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const r = wg.getBoundingClientRect();
        const ox = e.clientX - r.left, oy = e.clientY - r.top;
        wg.setPointerCapture(e.pointerId);
        wg.style.cursor = 'grabbing';
        const mv = (ev) => {
          const x = OS.clamp(ev.clientX - ox, 0, innerWidth - r.width), y = OS.clamp(ev.clientY - oy, 36, innerHeight - r.height);
          Object.assign(wg.style, { position: 'fixed', left: x + 'px', top: y + 'px', margin: 0 });
          pos[i] = [x, y];
        };
        const up = () => { wg.removeEventListener('pointermove', mv); wg.removeEventListener('pointerup', up); wg.style.cursor = ''; OS.store.set('widgetPos', pos); };
        wg.addEventListener('pointermove', mv);
        wg.addEventListener('pointerup', up);
      });
    });
  }

  /* ---------------------------------------------------------------------
     Lanceur / recherche universelle
     --------------------------------------------------------------------- */
  const launcher = $('#launcher');
  const linput = $('#launcher-input');
  const lres = $('#launcher-results');
  let lItems = [], lSel = 0;

  function openLauncher() {
    closePanels();
    launcher.classList.remove('hidden');
    linput.value = '';
    renderLauncher();
    setTimeout(() => linput.focus(), 10);
  }
  OS.openLauncher = openLauncher;
  const closeLauncher = () => launcher.classList.add('hidden');
  launcher.addEventListener('mousedown', (e) => { if (e.target === launcher) closeLauncher(); });

  const fuzzy = (q, s) => {
    q = q.toLowerCase(); s = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    q = q.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (s.includes(q)) return 2;
    let i = 0;
    for (const ch of s) if (ch === q[i]) i++;
    return i === q.length ? 1 : 0;
  };

  const COMMANDS = [
    { t: 'Verrouiller la session', k: 'verrouiller lock', icon: 'lock', run: showLock },
    { t: 'Thème sombre', k: 'theme sombre dark nuit', icon: 'moon', run: () => OS.setSetting('theme', 'dark') },
    { t: 'Thème clair', k: 'theme clair light jour', icon: 'sun', run: () => OS.setSetting('theme', 'light') },
    { t: 'Vue d\'ensemble', k: 'vue ensemble overview fenetres', icon: 'grid', run: () => OS.toggleOverview(true) },
    { t: 'Ne pas déranger', k: 'ne pas deranger dnd silence', icon: 'belloff', run: () => OS.setSetting('dnd', !OS.settings.dnd) },
    { t: 'Redémarrer', k: 'redemarrer reboot restart', icon: 'refresh', run: () => location.reload() },
    ...OS.wallpapers.map((w) => ({ t: 'Fond d\'écran : ' + w.name, k: 'fond ecran wallpaper ' + w.name, icon: 'image', run: () => OS.setSetting('wallpaper', w.id) })),
    ...Array.from({ length: 4 }, (_, i) => ({ t: `Aller au bureau ${i + 1}`, k: 'bureau workspace ' + (i + 1), icon: 'desktop', run: () => OS.switchWorkspace(i) })),
  ];

  function renderLauncher() {
    const q = linput.value.trim();
    lres.innerHTML = '';
    lItems = [];
    lSel = 0;
    const apps = Object.values(OS.apps).filter((a) => !a.hidden);

    if (!q) {
      lres.append(h('div.lr-section', 'Applications'));
      const grid = h('div.lr-grid');
      apps.forEach((a) => {
        const el = h('button.lr-app', { onclick: () => { closeLauncher(); OS.launch(a.id); } }, OS.appIcon(a, 46), a.name);
        grid.append(el);
      });
      lres.append(grid);
      return;
    }

    const add = (section, list) => {
      if (!list.length) return;
      lres.append(h('div.lr-section', section));
      for (const it of list) {
        const el = h('div.lr-item', { onclick: () => { closeLauncher(); it.run(); } },
          it.iconEl || h('div.lr-ico', { html: OS.icon(it.icon, 18) }),
          h('div', h('div.lr-t' + (it.big ? '.lr-calc' : ''), it.t), it.s && h('div.lr-s', it.s)),
          h('span.lr-k', it.k || ''));
        el.addEventListener('mousemove', () => select(lItems.indexOf(el)));
        lItems.push(el);
        el._run = it.run;
        lres.append(el);
      }
    };

    const m = OS.evalMath(q);
    if (m != null && !/^\d+$/.test(q)) {
      add('Calcul', [{ t: '= ' + m.toLocaleString('fr-FR', { maximumFractionDigits: 10 }), s: q + ' · Entrée pour copier', icon: 'calc', big: true, run: () => navigator.clipboard?.writeText(String(m)).then(() => OS.notify({ title: 'Copié', body: String(m), icon: 'calc', silent: true })) }]);
    }
    add('Applications', apps.map((a) => ({ a, s: fuzzy(q, a.name) + (a.keywords ? fuzzy(q, a.keywords) * 0.5 : 0) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6)
      .map(({ a }) => ({ t: a.name, s: a.desc, iconEl: OS.appIcon(a, 34), k: 'Application', run: () => OS.launch(a.id) })));
    add('Commandes', COMMANDS.filter((c) => fuzzy(q, c.t) || fuzzy(q, c.k) === 2).slice(0, 5).map((c) => ({ ...c, k: 'Action' })));
    add('Fichiers', OS.fs.search(q).slice(0, 6).map((f) => ({ t: f.name, s: f.path.replace(OS.fs.HOME, '~'), icon: OS.fs.iconFor(f), k: f.type === 'dir' ? 'Dossier' : 'Fichier', run: () => OS.openFile(f.path) })));
    add('Iris', [{ t: `Demander à Iris : « ${q} »`, icon: 'sparkle', k: 'Assistant', run: () => OS.launch('iris', { ask: q }) }]);
    select(0);
  }
  function select(i) {
    if (!lItems.length) return;
    lSel = (i + lItems.length) % lItems.length;
    lItems.forEach((el, j) => el.classList.toggle('sel', j === lSel));
    lItems[lSel].scrollIntoView({ block: 'nearest' });
  }
  linput.addEventListener('input', renderLauncher);
  linput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); select(lSel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(lSel - 1); }
    else if (e.key === 'Enter') {
      const it = lItems[lSel];
      if (it) { closeLauncher(); it._run(); }
      else if (!linput.value.trim()) closeLauncher();
    } else if (e.key === 'Escape') closeLauncher();
  });

  /* ---------------------------------------------------------------------
     Centre de contrôle et calendrier
     --------------------------------------------------------------------- */
  const panels = { cc: $('#cc'), calendar: $('#calendar') };
  function closePanels() { Object.values(panels).forEach((p) => p.classList.add('hidden')); hideCtx(); }
  function togglePanel(id) {
    const open = panels[id].classList.contains('hidden');
    closePanels();
    if (open) { (id === 'cc' ? renderCC : renderCal)(); panels[id].classList.remove('hidden'); }
  }
  Object.values(panels).forEach((p) => p.addEventListener('mousedown', (e) => e.stopPropagation()));

  function renderCC() {
    const p = panels.cc;
    const s = OS.settings;
    p.innerHTML = '';
    const tile = (on, icon, title, sub, fn) => h('button.cc-tile' + (on ? '.on' : ''), { onclick: () => { fn(); renderCC(); } },
      h('span.cc-i', { html: OS.icon(icon, 17) }), h('span', h('b', title), h('small', sub)));
    const slider = (label, icon, val, fn) => {
      const r = h('input', { type: 'range', min: 0, max: 100, value: val });
      r.style.setProperty('--p', val + '%');
      r.addEventListener('input', () => { r.style.setProperty('--p', r.value + '%'); fn(+r.value); });
      return h('div.cc-slider', h('label', label), h('div.row', h('span', { html: OS.icon(icon, 16) }), r));
    };
    const bright = OS.store.get('brightness', 100);
    p.append(h('div.cc-grid',
      tile(navigator.onLine, 'wifi', 'Wi-Fi', navigator.onLine ? 'Connecté' : 'Hors ligne', () => OS.notify({ title: 'Wi-Fi', body: 'Le réseau est géré par votre navigateur 😉', icon: 'wifi' })),
      tile(s.theme === 'dark', s.theme === 'dark' ? 'moon' : 'sun', 'Mode sombre', s.theme === 'dark' ? 'Activé' : 'Désactivé', () => OS.setSetting('theme', s.theme === 'dark' ? 'light' : 'dark')),
      tile(s.dnd, s.dnd ? 'belloff' : 'bell', 'Ne pas déranger', s.dnd ? 'Activé' : 'Désactivé', () => OS.setSetting('dnd', !s.dnd)),
      tile(s.sounds, 'music', 'Sons système', s.sounds ? 'Activés' : 'Coupés', () => OS.setSetting('sounds', !s.sounds)),
      slider('Luminosité', 'sun', bright, (v) => { OS.store.set('brightness', v); document.body.style.filter = v < 100 ? `brightness(${0.35 + v * 0.0065})` : ''; }),
      slider('Volume', 'volume', OS.volume, (v) => OS.setVolume(v)),
      h('div.cc-accents', OS.accents.map((c) => h('button.swatch' + (c === s.accent ? '.on' : ''), { style: { background: c }, onclick: () => { OS.setSetting('accent', c); renderCC(); } }))),
    ));
    const notifs = h('div.cc-notifs', h('h5', h('span', 'Notifications'), history.length ? h('button', { onclick: () => { history.length = 0; renderCC(); } }, 'Tout effacer') : null));
    if (!history.length) notifs.append(h('div.cc-empty', 'Aucune notification'));
    history.slice(0, 8).forEach((n) => notifs.append(h('div.cc-notif', h('b', n.title), n.body, h('br'), h('small', OS.formatTime(n.time)))));
    p.append(notifs);
  }
  OS.on('notifications', () => !panels.cc.classList.contains('hidden') && renderCC());

  let calOffset = 0;
  function renderCal() {
    const p = panels.calendar;
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + calOffset, 1);
    p.innerHTML = '';
    p.append(h('div.cal-big', OS.formatTime(now)), h('div.cal-sub', OS.formatDate(now) + ' ' + now.getFullYear()));
    p.append(h('div.cal-head',
      h('button', { html: OS.icon('left', 16), onclick: () => { calOffset--; renderCal(); } }),
      h('b', d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })),
      h('button', { html: OS.icon('right', 16), onclick: () => { calOffset++; renderCal(); } })));
    const g = h('div.cal-grid');
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((n) => g.append(h('div.dn', n)));
    const start = (d.getDay() + 6) % 7;
    const first = new Date(d); first.setDate(1 - start);
    for (let i = 0; i < 42; i++) {
      const x = new Date(first); x.setDate(first.getDate() + i);
      const today = x.toDateString() === now.toDateString();
      g.append(h('div.d' + (x.getMonth() !== d.getMonth() ? '.o' : '') + (today ? '.t' : ''), x.getDate()));
    }
    p.append(g);
  }

  /* ---------------------------------------------------------------------
     Bureau : clic droit, raccourcis clavier
     --------------------------------------------------------------------- */
  function buildDesktop() {
    buildTopbar();
    buildDock();
    renderIcons();
    buildWidgets();
    const b = OS.store.get('brightness', 100);
    if (b < 100) document.body.style.filter = `brightness(${0.35 + b * 0.0065})`;
  }

  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#ctxmenu')) hideCtx();
    if (!e.target.closest('.panel,#tb-cc,#tb-clock,#tb-tray')) Object.values(panels).forEach((p) => p.classList.add('hidden'));
    if (!e.target.closest('.desk-icon')) $$('.desk-icon.sel').forEach((x) => x.classList.remove('sel'));
  });

  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.win-body input, .win-body textarea')) return;
    e.preventDefault();
    if (e.target.closest('.win, #dock, #topbar, .widget')) return;
    if ($('#desktop').classList.contains('hidden')) return;
    OS.contextMenu(e.clientX, e.clientY, [
      { label: 'Nouveau dossier', icon: 'folder', action: async () => { const n = await OS.prompt('Nom du dossier', OS.fs.uniqueName(DESK, 'Nouveau dossier')); if (n) try { OS.fs.mkdir(DESK + '/' + n); } catch (er) { OS.notify({ title: 'Erreur', body: er.message }); } } },
      { label: 'Nouvelle note', icon: 'notes', action: () => { const n = OS.fs.uniqueName(DESK, 'Note', '.txt'); OS.fs.write(DESK + '/' + n, ''); OS.openFile(DESK + '/' + n); } },
      '-',
      { label: 'Ouvrir un terminal', icon: 'terminal', kbd: 'Ctrl Alt T', action: () => OS.launch('terminal') },
      { label: 'Vue d\'ensemble', icon: 'grid', kbd: 'F3', action: () => OS.toggleOverview(true) },
      { label: 'Changer de fond d\'écran', icon: 'image', action: () => { const i = OS.wallpapers.findIndex((w) => w.id === OS.settings.wallpaper); OS.setSetting('wallpaper', OS.wallpapers[(i + 1) % OS.wallpapers.length].id); } },
      { label: OS.settings.widgets ? 'Masquer les widgets' : 'Afficher les widgets', icon: 'eye', action: () => OS.setSetting('widgets', !OS.settings.widgets) },
      '-',
      { label: 'Personnaliser…', icon: 'sliders', action: () => OS.launch('settings') },
    ]);
  });

  document.addEventListener('keydown', (e) => {
    if (locked) {
      if (!$('#boot')) unlock();
      return;
    }
    const k = e.key;
    if ((e.ctrlKey || e.altKey) && k === ' ') { e.preventDefault(); launcher.classList.contains('hidden') ? openLauncher() : closeLauncher(); return; }
    if (k === 'F3' || (e.ctrlKey && !e.altKey && k === 'ArrowUp')) { e.preventDefault(); OS.toggleOverview(); return; }
    if (e.ctrlKey && e.altKey) {
      if (k === 'ArrowLeft') { e.preventDefault(); OS.switchWorkspace(OS.workspace - 1); }
      else if (k === 'ArrowRight') { e.preventDefault(); OS.switchWorkspace(OS.workspace + 1); }
      else if (k.toLowerCase() === 't') { e.preventDefault(); OS.launch('terminal'); }
      else if (k.toLowerCase() === 'l') { e.preventDefault(); showLock(); }
      else if (k.toLowerCase() === 'w') { e.preventDefault(); OS.focused()?.close(); }
      else if (k.toLowerCase() === 'm') { e.preventDefault(); OS.focused()?.minimize(); }
      return;
    }
    if (k === 'Escape') {
      if (OS.inOverview()) OS.toggleOverview(false);
      closeLauncher();
      closePanels();
    }
  });

  OS.on('settings', ({ key }) => {
    if (key === 'user' && !$('.lock-name').closest('.hidden')) $('.lock-name').textContent = OS.settings.user;
  });
})();

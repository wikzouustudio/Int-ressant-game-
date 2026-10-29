/* Prisme OS — gestionnaire de fenêtres : apps, focus, ancrage, bureaux virtuels, vue d'ensemble */
(function () {
  const { h } = OS;
  const TOP = 34;            // hauteur de la barre supérieure
  const WS_COUNT = 4;

  OS.apps = {};
  OS.registerApp = (def) => {
    OS.apps[def.id] = Object.assign({ width: 720, height: 480, minW: 320, minH: 220, single: false, colors: ['#8b5cf6', '#6366f1'], icon: 'file' }, def);
  };

  const wins = [];
  let zTop = 10;
  let focused = null;
  OS.workspace = 0;
  OS.windows = wins;

  const layer = () => document.getElementById('windows');
  const compact = () => innerWidth < 760;

  function bounds() {
    return { x: 0, y: TOP, w: innerWidth, h: innerHeight - TOP };
  }

  OS.launch = function (id, args = {}) {
    const app = OS.apps[id];
    if (!app) return OS.notify({ title: 'Application inconnue', body: id, icon: 'info' }), null;
    if (app.single) {
      const ex = wins.find((w) => w.app.id === id);
      if (ex) {
        if (ex.ws !== OS.workspace) OS.switchWorkspace(ex.ws);
        ex.restore();
        ex.focus();
        if (app.onReopen) app.onReopen(ex, args);
        return ex;
      }
    }
    OS.emit('launching', id);
    return createWindow(app, args);
  };

  function createWindow(app, args) {
    const b = bounds();
    const w = Math.min(app.width, b.w - 40);
    const hh = Math.min(app.height, b.h - 110);
    const cascade = (wins.filter((x) => x.ws === OS.workspace).length % 7) * 28;
    const win = {
      id: OS.uid(),
      app,
      ws: OS.workspace,
      x: Math.round((b.w - w) / 2 + cascade - 60),
      y: Math.round(b.y + Math.max(10, (b.h - hh) / 2 - 40) + cascade - 40),
      w, h: hh,
      state: 'normal', // normal | max | left | right | min
      prev: null,
      closers: [],
    };
    win.x = OS.clamp(win.x, 10, b.w - w - 10);
    win.y = OS.clamp(win.y, b.y + 8, b.y + b.h - hh - 90);

    const titleText = h('span.win-title-text', app.name);
    const tools = h('div.win-tools');
    const el = h('div.win.opening', { 'data-app': app.id },
      h('div.win-titlebar',
        h('div.win-title', h('span.win-title-ico', { html: OS.icon(app.icon, 14) }), titleText),
        tools,
        h('div.win-controls',
          h('button.wc.wc-min', { title: 'Réduire', html: OS.icon('minus', 12, 2.5), onclick: (e) => { e.stopPropagation(); win.minimize(); } }),
          h('button.wc.wc-max', { title: 'Agrandir', html: OS.icon('square', 11, 2.5), onclick: (e) => { e.stopPropagation(); win.toggleMax(); } }),
          h('button.wc.wc-close', { title: 'Fermer', html: OS.icon('x', 12, 2.5), onclick: (e) => { e.stopPropagation(); win.close(); } }),
        ),
      ),
      h('div.win-body'),
      ...['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((d) => h('div.rz.rz-' + d, { 'data-dir': d })),
    );
    el.style.setProperty('--app-c1', app.colors[0]);
    el.style.setProperty('--app-c2', app.colors[1]);
    win.el = el;
    win.body = el.querySelector('.win-body');
    win.tools = tools;

    win.setTitle = (t) => { titleText.textContent = t; if (focused === win) OS.emit('focus', win); };
    win.onClose = (fn) => win.closers.push(fn);
    win.focus = () => focus(win);
    win.close = () => close(win);
    win.minimize = () => minimize(win);
    win.restore = () => restore(win);
    win.snap = (st) => setState(win, st);
    win.toggleMax = () => (win.state === 'max' ? setState(win, 'normal') : setState(win, 'max'));

    layer().append(el);
    wins.push(win);
    if (compact()) win.state = 'max';
    apply(win);
    focus(win);
    setupDrag(win);
    setupResize(win);
    el.addEventListener('pointerdown', () => focus(win), true);
    el.querySelector('.win-titlebar').addEventListener('dblclick', (e) => { if (!e.target.closest('button,input')) win.toggleMax(); });
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('opening')));

    try { app.launch(win, args); }
    catch (err) { console.error(err); win.body.append(h('div.app-error', 'Erreur : ' + err.message)); }

    OS.sound('open');
    OS.emit('windows');
    return win;
  }

  function apply(win) {
    const b = bounds();
    const el = win.el;
    let r;
    switch (win.state) {
      case 'max': r = { x: b.x, y: b.y, w: b.w, h: b.h }; break;
      case 'left': r = { x: 0, y: b.y, w: b.w / 2, h: b.h }; break;
      case 'right': r = { x: b.w / 2, y: b.y, w: b.w / 2, h: b.h }; break;
      default: r = win;
    }
    el.style.left = r.x + 'px';
    el.style.top = r.y + 'px';
    el.style.width = r.w + 'px';
    el.style.height = r.h + 'px';
    el.classList.toggle('maxed', win.state === 'max');
    el.classList.toggle('snapped', win.state === 'left' || win.state === 'right');
    el.classList.toggle('ws-hidden', win.ws !== OS.workspace);
    OS.emit('win-resize', win);
  }

  function setState(win, st) {
    win.el.classList.add('animating');
    win.state = st;
    apply(win);
    setTimeout(() => { win.el.classList.remove('animating'); OS.emit('win-resize', win); }, 260);
  }

  function focus(win) {
    if (win.state === 'min') return;
    if (focused && focused !== win) focused.el.classList.remove('focused');
    focused = win;
    win.el.style.zIndex = ++zTop;
    win.el.classList.add('focused');
    OS.emit('focus', win);
  }
  OS.focused = () => focused;

  function focusTopmost() {
    const vis = wins.filter((w) => w.ws === OS.workspace && w.state !== 'min');
    vis.sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
    if (vis[0]) focus(vis[0]);
    else { focused = null; OS.emit('focus', null); }
  }

  function close(win) {
    if (win.closing) return;
    win.closing = true;
    win.closers.forEach((fn) => { try { fn(); } catch {} });
    win.el.classList.add('closing');
    OS.sound('close');
    setTimeout(() => {
      win.el.remove();
      wins.splice(wins.indexOf(win), 1);
      if (focused === win) focusTopmost();
      OS.emit('windows');
    }, 220);
  }

  function dockTarget(win) {
    const ico = document.querySelector(`.dock-item[data-app="${win.app.id}"]`);
    if (!ico) return { x: innerWidth / 2, y: innerHeight };
    const r = ico.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function minimize(win) {
    if (win.state === 'min') return;
    const r = win.el.getBoundingClientRect();
    const t = dockTarget(win);
    win.el.style.setProperty('--min-x', t.x - (r.left + r.width / 2) + 'px');
    win.el.style.setProperty('--min-y', t.y - (r.top + r.height / 2) + 'px');
    win.prevState = win.state;
    win.state = 'min';
    win.el.classList.add('minimized');
    win.el.classList.remove('focused');
    if (focused === win) focusTopmost();
    OS.emit('windows');
  }

  function restore(win) {
    if (win.state !== 'min') return;
    win.state = win.prevState || 'normal';
    win.el.classList.remove('minimized');
    apply(win);
    focus(win);
    OS.emit('windows');
  }

  // --- Déplacement + ancrage magnétique aux bords ---
  const preview = () => document.getElementById('snap-preview');
  function showSnap(zone) {
    const p = preview();
    if (!zone) return p.classList.remove('show');
    const b = bounds();
    const r = zone === 'max' ? b : zone === 'left' ? { x: 0, y: b.y, w: b.w / 2, h: b.h } : { x: b.w / 2, y: b.y, w: b.w / 2, h: b.h };
    Object.assign(p.style, { left: r.x + 8 + 'px', top: r.y + 8 + 'px', width: r.w - 16 + 'px', height: r.h - 16 + 'px' });
    p.classList.add('show');
  }

  function setupDrag(win) {
    const bar = win.el.querySelector('.win-titlebar');
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button,input,select,.win-tools *') || compact()) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      let ox = win.x, oy = win.y, moved = false, zone = null;
      bar.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        if (!moved) {
          moved = true;
          win.el.classList.add('dragging');
          if (win.state !== 'normal') {
            // Décroche une fenêtre ancrée en gardant le curseur proportionnellement placé
            const rr = win.el.getBoundingClientRect();
            const ratio = (sx - rr.left) / rr.width;
            win.state = 'normal';
            ox = sx - win.w * ratio;
            oy = Math.max(TOP, sy - 16);
          }
        }
        win.x = ox + dx;
        win.y = Math.max(TOP, oy + dy);
        apply(win);
        zone = ev.clientY <= TOP + 2 ? 'max' : ev.clientX <= 4 ? 'left' : ev.clientX >= innerWidth - 5 ? 'right' : null;
        showSnap(zone);
      };
      const up = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        bar.removeEventListener('pointercancel', up);
        win.el.classList.remove('dragging');
        showSnap(null);
        if (zone) setState(win, zone);
        // Garde la barre de titre accessible
        win.x = OS.clamp(win.x, -win.w + 80, innerWidth - 80);
        win.y = OS.clamp(win.y, TOP, innerHeight - 60);
        if (!zone) apply(win);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
    });
  }

  function setupResize(win) {
    win.el.querySelectorAll('.rz').forEach((handle) => {
      handle.addEventListener('pointerdown', (e) => {
        if (win.state !== 'normal' || compact()) return;
        e.preventDefault();
        e.stopPropagation();
        focus(win);
        const d = handle.dataset.dir;
        const s = { x: e.clientX, y: e.clientY, l: win.x, t: win.y, w: win.w, h: win.h };
        const { minW, minH } = win.app;
        handle.setPointerCapture(e.pointerId);
        win.el.classList.add('dragging');
        const move = (ev) => {
          const dx = ev.clientX - s.x, dy = ev.clientY - s.y;
          if (d.includes('e')) win.w = Math.max(minW, s.w + dx);
          if (d.includes('s')) win.h = Math.max(minH, s.h + dy);
          if (d.includes('w')) { win.w = Math.max(minW, s.w - dx); win.x = s.l + s.w - win.w; }
          if (d.includes('n')) { win.h = Math.max(minH, s.h - dy); win.y = Math.max(TOP, s.t + s.h - win.h); }
          apply(win);
        };
        const up = () => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', up);
          win.el.classList.remove('dragging');
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
      });
    });
  }

  addEventListener('resize', () => wins.forEach(apply));

  // Mosaïque : répartit les fenêtres visibles sans chevauchement
  OS.tileWindows = function () {
    const vis = wins.filter((w) => w.ws === OS.workspace && w.state !== 'min');
    if (!vis.length) return 0;
    const b = bounds();
    const usable = { x: b.x + 10, y: b.y + 10, w: b.w - 20, h: b.h - 110 };
    const cols = Math.ceil(Math.sqrt(vis.length));
    const rows = Math.ceil(vis.length / cols);
    vis.forEach((w, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const inRow = r === rows - 1 ? vis.length - r * cols : cols;
      const cw = usable.w / inRow;
      w.x = Math.round(usable.x + c * cw + 5);
      w.y = Math.round(usable.y + r * (usable.h / rows) + 5);
      w.w = Math.round(cw - 10);
      w.h = Math.round(usable.h / rows - 10);
      setState(w, 'normal');
    });
    return vis.length;
  };

  // --- Bureaux virtuels ---
  OS.WS_COUNT = WS_COUNT;
  OS.switchWorkspace = function (n) {
    n = (n + WS_COUNT) % WS_COUNT;
    if (n === OS.workspace) return;
    const dir = n > OS.workspace ? 1 : -1;
    document.documentElement.style.setProperty('--ws-dir', dir);
    OS.workspace = n;
    wins.forEach((w) => {
      w.el.classList.add('ws-anim');
      apply(w);
      setTimeout(() => w.el.classList.remove('ws-anim'), 400);
    });
    focusTopmost();
    OS.emit('workspace', n);
    OS.emit('windows');
  };
  OS.moveToWorkspace = (win, n) => { win.ws = n; apply(win); focusTopmost(); OS.emit('windows'); };

  // --- Vue d'ensemble (toutes les fenêtres du bureau courant côte à côte) ---
  let overview = false;
  OS.toggleOverview = function (force) {
    overview = force ?? !overview;
    const desk = document.getElementById('desktop');
    desk.classList.toggle('overview', overview);
    const vis = wins.filter((w) => w.ws === OS.workspace && w.state !== 'min');
    if (!overview || !vis.length) {
      overview = false;
      desk.classList.remove('overview');
      wins.forEach((w) => { w.el.style.transform = ''; w.el.classList.remove('ov'); w.el.onclickCapture = null; });
      return;
    }
    const b = bounds();
    const cols = Math.ceil(Math.sqrt(vis.length));
    const rows = Math.ceil(vis.length / cols);
    const pad = 40, cw = (b.w - pad * 2) / cols, ch = (b.h - 120 - pad) / rows;
    vis.forEach((w, i) => {
      const r = w.el.getBoundingClientRect();
      const c = i % cols, ro = Math.floor(i / cols);
      const sc = Math.min((cw - 30) / r.width, (ch - 30) / r.height, 1);
      const tx = pad + c * cw + cw / 2 - (r.left + r.width / 2);
      const ty = b.y + pad + ro * ch + ch / 2 - (r.top + r.height / 2);
      w.el.classList.add('ov');
      w.el.style.transform = `translate(${tx}px, ${ty}px) scale(${sc})`;
      w.el.dataset.label = w.el.querySelector('.win-title-text').textContent;
    });
  };
  document.addEventListener('click', (e) => {
    if (!overview) return;
    const el = e.target.closest('.win.ov');
    e.stopPropagation();
    e.preventDefault();
    OS.toggleOverview(false);
    if (el) { const w = wins.find((x) => x.el === el); w && focus(w); }
  }, true);
  OS.inOverview = () => overview;
})();

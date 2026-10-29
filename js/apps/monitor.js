/* Prisme OS — Moniteur système */
(function () {
  const { h } = OS;

  OS.registerApp({
    id: 'monitor', name: 'Moniteur', icon: 'activity', colors: ['#34d399', '#0d9488'],
    desc: 'Performances et processus', keywords: 'systeme cpu memoire processus task manager', width: 760, height: 520, single: true,
    launch(win) {
      const card = (label, color) => {
        const val = h('b'), cv = h('canvas', { width: 400, height: 110 });
        return { el: h('div.mo-card', h('div.mo-head', h('span', label), val), cv), val, cv, color };
      };
      const cards = { cpu: card('Processeur', '#8b5cf6'), mem: card('Mémoire', '#06b6d4'), fps: card('Images / s', '#10b981') };
      const procs = h('div.mo-procs');
      const info = h('div.mo-info');
      win.body.append(h('div.mo', h('div.mo-cards', Object.values(cards).map((c) => c.el)), h('div.mo-bottom', h('div.mo-panel', h('h4', 'Processus'), procs), h('div.mo-panel', h('h4', 'Système'), info))));

      function graph({ cv, color }, data, max) {
        const c = cv.getContext('2d');
        const W = cv.width, H = cv.height;
        c.clearRect(0, 0, W, H);
        c.strokeStyle = 'rgba(127,127,160,.15)';
        c.lineWidth = 1;
        for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(0, (H / 4) * i); c.lineTo(W, (H / 4) * i); c.stroke(); }
        if (data.length < 2) return;
        const pts = data.map((v, i) => [W - (data.length - 1 - i) * (W / 59), H - (v / max) * (H - 8) - 4]);
        const g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, color + '66'); g.addColorStop(1, color + '00');
        c.beginPath();
        c.moveTo(pts[0][0], H);
        pts.forEach(([x, y]) => c.lineTo(x, y));
        c.lineTo(W, H);
        c.fillStyle = g; c.fill();
        c.beginPath();
        pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.strokeStyle = color; c.lineWidth = 2.5; c.lineJoin = 'round'; c.stroke();
        const [lx, ly] = pts[pts.length - 1];
        c.beginPath(); c.arc(lx - 3, ly, 4, 0, 7); c.fillStyle = color; c.fill();
      }

      function storageSize() {
        let n = 0;
        try { for (const k of Object.keys(localStorage)) if (k.startsWith('prisme:')) n += (localStorage.getItem(k) || '').length * 2; } catch {}
        return n;
      }

      function update(s) {
        cards.cpu.val.textContent = s.cpu + ' %';
        cards.mem.val.textContent = s.mem + ' %';
        cards.fps.val.textContent = s.fps;
        graph(cards.cpu, s.history.cpu, 100);
        graph(cards.mem, s.history.mem, 100);
        graph(cards.fps, s.history.fps, Math.max(60, ...s.history.fps));
        procs.innerHTML = '';
        OS.windows.forEach((w, i) => {
          const load = Math.max(0.1, (w === OS.focused() ? 4 : 0.6) + Math.random() * 2).toFixed(1);
          procs.append(h('div.mo-proc',
            OS.appIcon(w.app, 24),
            h('span.mo-pn', w.el.querySelector('.win-title-text').textContent),
            h('span.mo-pm', 'PID ' + (1000 + i) + ' · bureau ' + (w.ws + 1)),
            h('span.mo-pc', (w.state === 'min' ? '0.0' : load) + ' %'),
            w === win ? h('span.mo-pk') : h('button.tbtn', { html: OS.icon('x', 14), title: 'Forcer à quitter', onclick: () => w.close() })));
        });
        info.innerHTML = '';
        [
          ['Uptime', OS.uptime()],
          ['Cœurs logiques', navigator.hardwareConcurrency || '?'],
          ['Mémoire appareil', navigator.deviceMemory ? navigator.deviceMemory + ' Go' : 'n/d'],
          ['Stockage Prisme', OS.fs.fmtSize(storageSize())],
          ['Fenêtres ouvertes', OS.windows.length],
          ['Langue', navigator.language],
          ['Réseau', navigator.onLine ? 'En ligne' : 'Hors ligne'],
        ].forEach(([k, v]) => info.append(h('div.mo-row', h('span', k), h('b', String(v)))));
      }
      update(OS.stats);
      const off = OS.on('stats', update);
      win.onClose(off);
    },
  });
})();

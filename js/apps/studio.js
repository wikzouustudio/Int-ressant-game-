/* Prisme OS — Studio : dessin avec pinceau néon et symétrie kaléidoscope */
(function () {
  const { h } = OS;
  const PALETTE = ['#ffffff', '#0f172a', '#f43f5e', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#a16207', '#64748b'];

  OS.registerApp({
    id: 'studio', name: 'Studio', icon: 'brush', colors: ['#f472b6', '#8b5cf6'],
    desc: 'Dessin et peinture', keywords: 'paint dessin peinture art', width: 900, height: 600, minW: 560, minH: 380,
    launch(win) {
      const cv = h('canvas.st-canvas', { width: 1400, height: 880 });
      const c = cv.getContext('2d', { willReadFrequently: true });
      const bg = OS.settings.theme === 'dark' ? '#111018' : '#ffffff';
      c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);

      const st = { tool: 'brush', color: OS.settings.accent, size: 8, neon: false, sym: 1 };
      const undo = [];
      const pushUndo = () => { undo.push(c.getImageData(0, 0, cv.width, cv.height)); if (undo.length > 25) undo.shift(); };

      const tools = [['brush', 'brush', 'Pinceau'], ['eraser', 'eraser', 'Gomme'], ['line', 'line', 'Ligne'], ['rect', 'rect', 'Rectangle'], ['circle', 'circle', 'Ellipse'], ['fill', 'bucket', 'Remplissage']];
      const toolEls = {};
      const bar = h('div.st-bar');
      tools.forEach(([id, ic, t]) => { toolEls[id] = h('button.tbtn', { html: OS.icon(ic, 17), title: t, onclick: () => { st.tool = id; sync(); } }); bar.append(toolEls[id]); });
      bar.append(h('div.st-sep'));
      const swatches = h('div.st-swatches');
      PALETTE.forEach((col) => swatches.append(h('button.st-sw', { style: { background: col }, title: col, onclick: () => { st.color = col; picker.value = col; sync(); } })));
      const picker = h('input.st-picker', { type: 'color', value: st.color, title: 'Couleur personnalisée' });
      picker.addEventListener('input', () => { st.color = picker.value; sync(); });
      bar.append(swatches, picker, h('div.st-sep'));
      const size = h('input', { type: 'range', min: 1, max: 80, value: st.size, title: 'Épaisseur' });
      const sizeLbl = h('span.st-lbl');
      size.addEventListener('input', () => { st.size = +size.value; sync(); });
      bar.append(h('div.st-size', size, sizeLbl), h('div.st-sep'));
      const neonBtn = h('button.btn', { onclick: () => { st.neon = !st.neon; sync(); }, html: OS.icon('zap', 14) + 'Néon' });
      const symBtn = h('button.btn', { onclick: () => { st.sym = { 1: 2, 2: 6, 6: 8, 8: 12, 12: 1 }[st.sym]; sync(); } });
      bar.append(neonBtn, symBtn);

      win.tools.append(
        h('button.tbtn', { html: OS.icon('undo', 15), title: 'Annuler (Ctrl+Z)', onclick: doUndo }),
        h('button.tbtn', { html: OS.icon('trash', 15), title: 'Tout effacer', onclick: () => { pushUndo(); c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); } }),
        h('button.tbtn', { html: OS.icon('save', 15), title: 'Enregistrer dans Images', onclick: save }),
        h('button.tbtn', { html: OS.icon('download', 15), title: 'Télécharger en PNG', onclick: () => h('a', { href: cv.toDataURL('image/png'), download: 'prisme-studio.png' }).click() }));

      const overlay = h('canvas.st-overlay', { width: 1400, height: 880 });
      const oc = overlay.getContext('2d');
      win.body.append(h('div.st', bar, h('div.st-stage', h('div.st-paper', cv, overlay))));

      function sync() {
        Object.entries(toolEls).forEach(([k, el]) => el.classList.toggle('on', k === st.tool));
        swatches.querySelectorAll('.st-sw').forEach((s) => s.classList.toggle('on', s.title === st.color));
        sizeLbl.textContent = st.size + ' px';
        size.style.setProperty('--p', ((st.size - 1) / 79) * 100 + '%');
        neonBtn.classList.toggle('on', st.neon);
        symBtn.classList.toggle('on', st.sym > 1);
        symBtn.innerHTML = OS.icon('sparkle', 14) + (st.sym > 1 ? `Symétrie ×${st.sym}` : 'Symétrie');
      }
      sync();

      // Applique un tracé à chaque segment de symétrie
      function withSym(ctx, fn) {
        for (let i = 0; i < st.sym; i++) {
          ctx.save();
          ctx.translate(cv.width / 2, cv.height / 2);
          ctx.rotate((i / st.sym) * Math.PI * 2);
          if (st.sym === 2 && i === 1) { ctx.rotate(-Math.PI); ctx.scale(-1, 1); }
          ctx.translate(-cv.width / 2, -cv.height / 2);
          fn(ctx);
          ctx.restore();
        }
      }
      function styleCtx(ctx) {
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.lineWidth = st.size;
        ctx.strokeStyle = st.tool === 'eraser' ? bg : st.color;
        ctx.fillStyle = st.color;
        ctx.shadowBlur = st.neon && st.tool !== 'eraser' ? st.size * 2 + 10 : 0;
        ctx.shadowColor = st.color;
      }
      const pos = (e) => {
        const r = cv.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
      };

      let drawing = false, start, lastP, mid;
      overlay.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const p = pos(e);
        if (st.tool === 'fill') { pushUndo(); floodFill(Math.round(p.x), Math.round(p.y), st.color); return; }
        drawing = true;
        overlay.setPointerCapture(e.pointerId);
        pushUndo();
        start = lastP = mid = p;
        if (st.tool === 'brush' || st.tool === 'eraser') {
          withSym(c, (ctx) => { styleCtx(ctx); ctx.beginPath(); ctx.arc(p.x, p.y, st.size / 2, 0, 7); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); });
        }
      });
      overlay.addEventListener('pointermove', (e) => {
        const p = pos(e);
        // Curseur fantôme
        oc.clearRect(0, 0, overlay.width, overlay.height);
        if (!drawing) {
          withSym(oc, (ctx) => { ctx.strokeStyle = 'rgba(127,127,127,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, st.size / 2), 0, 7); ctx.stroke(); });
          return;
        }
        if (st.tool === 'brush' || st.tool === 'eraser') {
          const m = { x: (lastP.x + p.x) / 2, y: (lastP.y + p.y) / 2 };
          withSym(c, (ctx) => { styleCtx(ctx); ctx.beginPath(); ctx.moveTo(mid.x, mid.y); ctx.quadraticCurveTo(lastP.x, lastP.y, m.x, m.y); ctx.stroke(); });
          mid = m; lastP = p;
        } else {
          withSym(oc, (ctx) => { styleCtx(ctx); shape(ctx, start, p, e.shiftKey); });
        }
      });
      const end = (e) => {
        if (!drawing) return;
        drawing = false;
        const p = pos(e);
        oc.clearRect(0, 0, overlay.width, overlay.height);
        if (!['brush', 'eraser'].includes(st.tool)) withSym(c, (ctx) => { styleCtx(ctx); shape(ctx, start, p, e.shiftKey); });
      };
      overlay.addEventListener('pointerup', end);
      overlay.addEventListener('pointercancel', end);
      overlay.addEventListener('pointerleave', () => !drawing && oc.clearRect(0, 0, overlay.width, overlay.height));

      function shape(ctx, a, b, constrain) {
        let w = b.x - a.x, hh = b.y - a.y;
        if (constrain) { const s = Math.max(Math.abs(w), Math.abs(hh)); w = Math.sign(w || 1) * s; hh = Math.sign(hh || 1) * s; }
        ctx.beginPath();
        if (st.tool === 'line') { ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + w, a.y + hh); }
        else if (st.tool === 'rect') ctx.rect(a.x, a.y, w, hh);
        else ctx.ellipse(a.x + w / 2, a.y + hh / 2, Math.abs(w / 2), Math.abs(hh / 2), 0, 0, 7);
        ctx.stroke();
      }

      function floodFill(x, y, hex) {
        const img = c.getImageData(0, 0, cv.width, cv.height);
        const d = img.data, W = cv.width, H = cv.height;
        const i0 = (y * W + x) * 4;
        const target = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
        const [r, g, b] = OS.hexToRgb(hex);
        if (target[0] === r && target[1] === g && target[2] === b) return;
        const match = (i) => Math.abs(d[i] - target[0]) + Math.abs(d[i + 1] - target[1]) + Math.abs(d[i + 2] - target[2]) + Math.abs(d[i + 3] - target[3]) < 48;
        const stack = [[x, y]];
        while (stack.length) {
          let [cx, cy] = stack.pop();
          while (cy >= 0 && match((cy * W + cx) * 4)) cy--;
          cy++;
          let left = false, right = false;
          while (cy < H && match((cy * W + cx) * 4)) {
            const i = (cy * W + cx) * 4;
            d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
            if (cx > 0) { if (match(i - 4)) { if (!left) { stack.push([cx - 1, cy]); left = true; } } else left = false; }
            if (cx < W - 1) { if (match(i + 4)) { if (!right) { stack.push([cx + 1, cy]); right = true; } } else right = false; }
            cy++;
          }
        }
        c.putImageData(img, 0, 0);
      }

      function doUndo() { if (undo.length) c.putImageData(undo.pop(), 0, 0); }
      function save() {
        const dir = OS.fs.HOME + '/Images';
        const name = OS.fs.uniqueName(dir, 'Dessin', '.png');
        try {
          OS.fs.write(dir + '/' + name, cv.toDataURL('image/png'));
          OS.notify({ title: 'Dessin enregistré', body: '~/Images/' + name, icon: 'image', onclick: () => OS.launch('files', { path: dir }) });
        } catch (e) { OS.notify({ title: 'Stockage plein', body: 'Impossible d\'enregistrer : ' + e.message, icon: 'info' }); }
      }
      const onKey = (e) => { if (OS.focused() === win && (e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); doUndo(); } };
      document.addEventListener('keydown', onKey);
      win.onClose(() => document.removeEventListener('keydown', onKey));
    },
  });
})();

import {
  WORLD_HALF, ZCELL, ZN, CORE_HALF, ZONES, LINE_TYPES, SPECIALS, loadSpec, saveSpec, defaultSpec,
  decodeZones, encodeZones, emptyZones, inCoreCell, expandLine,
} from '../world/mapspec.js';
import { icon } from '../ui/icons.js';

// Map editor: a top-down 2D view of the whole city. Paint zones on a 10 m grid,
// draw avenues / streets / motorways / footpaths / railways (straight or curved),
// place landmarks, then apply: the 3D city is rebuilt from the edited map.

const TOOLS = [
  { id: 'pan', name: 'Déplacer', icon: 'pointer' },
  { id: 'zone', name: 'Zones', icon: 'apps' },
  { id: 'line', name: 'Routes', icon: 'crane' },
  { id: 'special', name: 'Monuments', icon: 'building' },
  { id: 'erase', name: 'Gomme', icon: 'close' },
];
const LINE_STYLE = {
  main: { color: '#4a4f57', edge: '#d9d3c7' },
  sec: { color: '#6b7079', edge: '#d9d3c7' },
  hwy: { color: '#3a3f47', edge: '#9aa4b1', center: '#f6c544' },
  path: { color: '#d9c9a8', dash: [6, 4] },
  rail: { color: '#6b5a48', ties: true },
};
const SNAP = 5;

export class MapEditor {
  constructor() {
    this.el = null;
    this.open = false;
  }

  show() {
    if (!this.el) this.build();
    const s = loadSpec();
    this.spec = { v: 1, roads: JSON.parse(JSON.stringify(s.roads)), specials: JSON.parse(JSON.stringify(s.specials || [])) };
    this.zones = decodeZones(s.zones);
    this.undoStack = [];
    this.cur = null;
    this.dirty = false;
    this.el.classList.remove('hidden');
    this.open = true;
    this.resize();
    this.fit();
    this.renderPanel();
    this.draw();
  }

  hide() {
    if (this.dirty && !confirm('Quitter l\'éditeur sans appliquer tes modifications ?')) return;
    this.el.classList.add('hidden');
    this.open = false;
  }

  // ---------------------------------------------------------------------------
  build() {
    this.tool = 'line';
    this.zone = 'res';
    this.brush = 2;
    this.lineType = 'sec';
    this.smooth = false;
    this.specialKind = 'church';
    this.rot = 0;
    const el = document.createElement('div');
    el.id = 'editor';
    el.className = 'hidden';
    el.innerHTML = `<canvas id="ed-canvas"></canvas>
      <aside class="ed-panel"><div class="ed-head">${icon('map')}<div><b>Éditeur de carte</b><small>Dessine ta ville, puis applique-la</small></div>
      <button class="ed-x" data-ed="close" title="Fermer">${icon('close')}</button></div><div class="ed-body"></div></aside>
      <div class="ed-hint"></div>`;
    document.body.appendChild(el);
    this.el = el;
    this.canvas = el.querySelector('#ed-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.body = el.querySelector('.ed-body');
    this.hint = el.querySelector('.ed-hint');
    el.addEventListener('click', (e) => this.onClick(e));
    el.addEventListener('change', (e) => this.onChange(e));
    window.addEventListener('resize', () => { if (this.open) { this.resize(); this.draw(); } });
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.bindPointer();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = this.W * dpr; this.canvas.height = this.H * dpr;
    this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px';
  }

  /** Visible map area (excluding the side panel). */
  viewRect() {
    const mobile = this.W < 760;
    return mobile ? { x: 0, y: 0, w: this.W, h: this.H * 0.58 } : { x: 300, y: 0, w: this.W - 300, h: this.H };
  }

  fit() {
    const r = this.viewRect();
    this.scale = Math.min(r.w, r.h) / (2 * WORLD_HALF + 40);
    this.cx = 0; this.cz = 0;
  }

  toScreen(x, z) {
    const r = this.viewRect();
    return [r.x + r.w / 2 + (x - this.cx) * this.scale, r.y + r.h / 2 + (z - this.cz) * this.scale];
  }
  toWorld(px, py) {
    const r = this.viewRect();
    return [this.cx + (px - r.x - r.w / 2) / this.scale, this.cz + (py - r.y - r.h / 2) / this.scale];
  }
  snapPoint(x, z, free = false) {
    // snap onto existing control points first, then to the 5 m grid
    const tol = Math.max(4, 10 / this.scale);
    let best = null, bd = tol;
    for (const l of this.spec.roads) for (const p of l.pts) {
      const d = Math.hypot(p[0] - x, p[1] - z);
      if (d < bd) { bd = d; best = p; }
    }
    if (this.cur) for (const p of this.cur.pts) { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = p; } }
    if (best) return [best[0], best[1]];
    if (free) return [x, z];
    return [Math.round(x / SNAP) * SNAP, Math.round(z / SNAP) * SNAP];
  }

  // ---------------------------------------------------------------------------
  pushUndo() {
    this.undoStack.push(JSON.stringify({ roads: this.spec.roads, specials: this.spec.specials, zones: encodeZones(this.zones) }));
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.dirty = true;
  }
  undo() {
    if (this.cur) { this.cur.pts.pop(); if (!this.cur.pts.length) this.cur = null; this.draw(); return; }
    const s = this.undoStack.pop();
    if (!s) return;
    const d = JSON.parse(s);
    this.spec.roads = d.roads; this.spec.specials = d.specials; this.zones = decodeZones(d.zones);
    this.draw();
  }

  // ---------------------------------------------------------------------------
  bindPointer() {
    const c = this.canvas;
    const pointers = new Map();
    let pan = null, painting = false, pinch = null;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mid: [(a.x + b.x) / 2, (a.y + b.y) / 2], scale: this.scale, cx: this.cx, cz: this.cz };
        painting = false; pan = null;
        return;
      }
      if (e.button === 1 || e.button === 2 || this.tool === 'pan') { pan = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz, moved: false }; return; }
      const [x, z] = this.toWorld(e.clientX, e.clientY);
      if (this.tool === 'zone' || (this.tool === 'erase' && !this.hitObject(x, z))) {
        this.pushUndo(); painting = true; this.paint(x, z, this.tool === 'erase' ? '' : this.zone);
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.mouse = [e.clientX, e.clientY];
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
        this.scale = Math.min(12, Math.max(0.4, pinch.scale * (d / pinch.d)));
        this.cx = pinch.cx - (mid[0] - pinch.mid[0]) / this.scale;
        this.cz = pinch.cz - (mid[1] - pinch.mid[1]) / this.scale;
        this.draw();
        return;
      }
      if (pan) {
        if (Math.abs(e.clientX - pan.x) + Math.abs(e.clientY - pan.y) > 3) pan.moved = true;
        this.cx = pan.cx - (e.clientX - pan.x) / this.scale;
        this.cz = pan.cz - (e.clientY - pan.y) / this.scale;
        this.draw();
        return;
      }
      if (painting) {
        const [x, z] = this.toWorld(e.clientX, e.clientY);
        this.paint(x, z, this.tool === 'erase' ? '' : this.zone);
        return;
      }
      if (this.tool === 'line' || this.tool === 'special' || this.tool === 'erase') this.draw();
    });
    const up = (e) => {
      const wasPinch = !!pinch;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (wasPinch) return;
      if (pan) {
        const p = pan; pan = null;
        if (!p.moved && e.button === 2 && this.cur) this.finishLine();
        return;
      }
      if (painting) { painting = false; return; }
      if (e.type === 'pointercancel') return;
      const [x, z] = this.toWorld(e.clientX, e.clientY);
      this.tap(x, z, e);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('dblclick', () => { if (this.cur) this.finishLine(); });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [wx, wz] = this.toWorld(e.clientX, e.clientY);
      const k = Math.exp(-e.deltaY * 0.0015);
      this.scale = Math.min(12, Math.max(0.4, this.scale * k));
      const [sx, sy] = this.toScreen(wx, wz);
      this.cx += (sx - e.clientX) / this.scale;
      this.cz += (sy - e.clientY) / this.scale;
      this.draw();
    }, { passive: false });
  }

  tap(x, z) {
    if (this.tool === 'line') {
      const p = this.snapPoint(x, z);
      if (!this.cur) {
        this.cur = { type: this.lineType, smooth: this.smooth, pts: [p] };
      } else {
        const first = this.cur.pts[0], last = this.cur.pts[this.cur.pts.length - 1];
        if (this.cur.pts.length >= 3 && Math.hypot(p[0] - first[0], p[1] - first[1]) < 0.5) { this.cur.closed = true; this.finishLine(); return; }
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.5) { this.finishLine(); return; }
        this.cur.pts.push(p);
      }
      this.draw();
      this.renderPanel();
    } else if (this.tool === 'special') {
      const def = SPECIALS[this.specialKind];
      const [sx, sz] = [Math.round(x / SNAP) * SNAP, Math.round(z / SNAP) * SNAP];
      if (Math.abs(sx) < CORE_HALF + def.w / 2 && Math.abs(sz) < CORE_HALF + def.d / 2) { this.flash('Le centre est réservé à tes commerces.'); return; }
      this.pushUndo();
      this.spec.specials.push({ kind: this.specialKind, x: sx, z: sz, ry: this.rot });
      this.draw();
    } else if (this.tool === 'erase') {
      const hit = this.hitObject(x, z);
      if (!hit) return;
      this.pushUndo();
      if (hit.road) this.spec.roads.splice(this.spec.roads.indexOf(hit.road), 1);
      else this.spec.specials.splice(this.spec.specials.indexOf(hit.special), 1);
      this.draw();
    }
  }

  finishLine() {
    const c = this.cur;
    this.cur = null;
    if (c && c.pts.length >= 2) {
      this.pushUndo();
      this.spec.roads.push(c);
    }
    this.draw();
    this.renderPanel();
  }

  hitObject(x, z) {
    const tol = Math.max(5, 9 / this.scale);
    for (let i = this.spec.specials.length - 1; i >= 0; i--) {
      const s = this.spec.specials[i], def = SPECIALS[s.kind];
      const c = Math.cos(s.ry), n = Math.sin(s.ry);
      const u = (x - s.x) * c - (z - s.z) * n, v = (x - s.x) * n + (z - s.z) * c;
      if (Math.abs(u) < def.w / 2 && Math.abs(v) < def.d / 2) return { special: s };
    }
    let best = null, bd = tol;
    for (const road of this.spec.roads) {
      const pts = expandLine(road, 4);
      for (const p of pts) { const d = Math.hypot(p[0] - x, p[1] - z) - LINE_TYPES[road.type].width / 2; if (d < bd) { bd = d; best = road; } }
    }
    return best ? { road: best } : null;
  }

  paint(x, z, id) {
    const v = Math.max(0, ZONES.findIndex((q) => q.id === id));
    const ci = Math.floor((x + WORLD_HALF) / ZCELL), cj = Math.floor((z + WORLD_HALF) / ZCELL);
    const r = this.brush - 1;
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
      if (i < 0 || j < 0 || i >= ZN || j >= ZN || inCoreCell(i, j)) continue;
      this.zones[j * ZN + i] = v;
    }
    this.draw();
  }

  // ---------------------------------------------------------------------------
  draw() {
    if (!this.open) return;
    const g = this.ctx, dpr = this.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#5d7f4a';
    g.fillRect(0, 0, this.W, this.H);
    const s = this.scale;
    // zones
    for (let j = 0; j < ZN; j++) for (let i = 0; i < ZN; i++) {
      const [x, y] = this.toScreen(i * ZCELL - WORLD_HALF, j * ZCELL - WORLD_HALF);
      if (x > this.W || y > this.H || x + ZCELL * s < 0 || y + ZCELL * s < 0) continue;
      g.fillStyle = ZONES[this.zones[j * ZN + i]].color;
      g.fillRect(x, y, ZCELL * s + 0.6, ZCELL * s + 0.6);
    }
    // grid (when zoomed in)
    if (s > 1.6) {
      g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 1;
      g.beginPath();
      for (let k = 0; k <= ZN; k++) {
        const [x0, y0] = this.toScreen(-WORLD_HALF + k * ZCELL, -WORLD_HALF), [x1, y1] = this.toScreen(-WORLD_HALF + k * ZCELL, WORLD_HALF);
        g.moveTo(x0, y0); g.lineTo(x1, y1);
        const [a0, b0] = this.toScreen(-WORLD_HALF, -WORLD_HALF + k * ZCELL), [a1, b1] = this.toScreen(WORLD_HALF, -WORLD_HALF + k * ZCELL);
        g.moveTo(a0, b0); g.lineTo(a1, b1);
      }
      g.stroke();
    }
    // world border
    const [bx, by] = this.toScreen(-WORLD_HALF, -WORLD_HALF);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.setLineDash([8, 6]);
    g.strokeRect(bx, by, 2 * WORLD_HALF * s, 2 * WORLD_HALF * s);
    g.setLineDash([]);
    // playable district
    const [cx0, cy0] = this.toScreen(-CORE_HALF, -CORE_HALF);
    g.fillStyle = '#d6d0c6'; g.fillRect(cx0, cy0, 2 * CORE_HALF * s, 2 * CORE_HALF * s);
    g.strokeStyle = '#8a8478'; g.lineWidth = Math.max(1.5, 4 * s);
    g.beginPath();
    for (const v of [-70, -50, -30, -10, 10, 30, 50, 70]) {
      const [a, b] = this.toScreen(v, -70), [c2, d] = this.toScreen(v, 70); g.moveTo(a, b); g.lineTo(c2, d);
      const [e, f] = this.toScreen(-70, v), [h, k] = this.toScreen(70, v); g.moveTo(e, f); g.lineTo(h, k);
    }
    g.stroke();
    const [lx, ly] = this.toScreen(0, 0);
    g.fillStyle = '#3d3a33'; g.font = `600 ${Math.max(11, Math.min(18, 7 * s))}px Fredoka, sans-serif`; g.textAlign = 'center';
    g.fillText('Ton centre (fixe)', lx, ly + 5);
    // lines
    const all = this.cur ? [...this.spec.roads, this.cur] : this.spec.roads;
    for (const road of ['path', 'rail', 'sec', 'main', 'hwy'].flatMap((t) => all.filter((r) => r.type === t))) this.drawLine(road, road === this.cur);
    // landmarks
    for (const sp of this.spec.specials) this.drawSpecial(sp);
    // cursor preview
    if (this.mouse && this.open) {
      const [mx, mz] = this.toWorld(...this.mouse);
      if (this.tool === 'line') {
        const p = this.snapPoint(mx, mz);
        const [px, py] = this.toScreen(p[0], p[1]);
        if (this.cur) {
          const last = this.cur.pts[this.cur.pts.length - 1];
          const [qx, qy] = this.toScreen(last[0], last[1]);
          g.strokeStyle = 'rgba(255,255,255,0.8)'; g.setLineDash([6, 5]); g.lineWidth = 2;
          g.beginPath(); g.moveTo(qx, qy); g.lineTo(px, py); g.stroke(); g.setLineDash([]);
          g.fillStyle = '#fff'; g.font = '600 12px Outfit, sans-serif'; g.textAlign = 'left';
          g.fillText(`${Math.round(Math.hypot(p[0] - last[0], p[1] - last[1]))} m`, px + 10, py - 8);
        }
        g.fillStyle = '#ffd166'; g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill();
      } else if (this.tool === 'special') {
        this.drawSpecial({ kind: this.specialKind, x: Math.round(mx / SNAP) * SNAP, z: Math.round(mz / SNAP) * SNAP, ry: this.rot }, true);
      } else if (this.tool === 'zone' || this.tool === 'erase') {
        const ci = Math.floor((mx + WORLD_HALF) / ZCELL) - (this.brush - 1), cj = Math.floor((mz + WORLD_HALF) / ZCELL) - (this.brush - 1);
        const [x, y] = this.toScreen(ci * ZCELL - WORLD_HALF, cj * ZCELL - WORLD_HALF);
        g.strokeStyle = '#fff'; g.lineWidth = 2;
        g.strokeRect(x, y, (2 * this.brush - 1) * ZCELL * s, (2 * this.brush - 1) * ZCELL * s);
      }
    }
    this.updateHint();
  }

  drawLine(road, editing) {
    const g = this.ctx, s = this.scale;
    const pts = expandLine(road, 3).map(([x, z]) => this.toScreen(x, z));
    if (road.closed && pts.length) pts.push(pts[0]);
    if (pts.length < 2) { if (editing) this.drawHandles(road); return; }
    const st = LINE_STYLE[road.type];
    const w = Math.max(road.type === 'path' ? 1.5 : 2.5, LINE_TYPES[road.type].width * s);
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); };
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (st.edge) { path(); g.strokeStyle = st.edge; g.lineWidth = w + Math.max(1, 2 * s); g.stroke(); }
    path(); g.strokeStyle = st.color; g.lineWidth = w; g.setLineDash(st.dash || []); g.stroke(); g.setLineDash([]);
    if (st.center && s > 0.8) { path(); g.strokeStyle = st.center; g.lineWidth = Math.max(1, 0.4 * s); g.stroke(); }
    if (st.ties) { path(); g.strokeStyle = '#cfd4da'; g.lineWidth = Math.max(1, w * 0.35); g.setLineDash([2, Math.max(2, 2.4 * s)]); g.stroke(); g.setLineDash([]); }
    if (editing || this.tool === 'line') this.drawHandles(road, editing);
  }

  drawHandles(road, editing) {
    const g = this.ctx;
    for (const p of road.pts) {
      const [x, y] = this.toScreen(p[0], p[1]);
      g.fillStyle = editing ? '#ffd166' : 'rgba(255,255,255,0.75)';
      g.fillRect(x - 3, y - 3, 6, 6);
    }
  }

  drawSpecial(sp, ghost = false) {
    const g = this.ctx, def = SPECIALS[sp.kind], s = this.scale;
    const [x, y] = this.toScreen(sp.x, sp.z);
    g.save();
    g.translate(x, y);
    g.rotate(-sp.ry);
    g.globalAlpha = ghost ? 0.6 : 1;
    g.fillStyle = '#f8f4ec'; g.strokeStyle = '#3d3a33'; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect(-def.w / 2 * s, -def.d / 2 * s, def.w * s, def.d * s, 3); g.fill(); g.stroke();
    g.fillStyle = '#e0573f'; g.fillRect(-def.w / 2 * s, def.d / 2 * s - Math.max(2, 1.5 * s), def.w * s, Math.max(2, 1.5 * s)); // front
    g.restore();
    if (s > 0.9) {
      g.fillStyle = '#3d3a33'; g.font = `600 ${Math.max(10, Math.min(14, 3 * s))}px Outfit, sans-serif`; g.textAlign = 'center';
      g.fillText(def.name, x, y + 4);
    }
  }

  // ---------------------------------------------------------------------------
  renderPanel() {
    const tools = TOOLS.map((t) => `<button class="ed-tool ${this.tool === t.id ? 'on' : ''}" data-ed="tool" data-id="${t.id}">${icon(t.icon)}<span>${t.name}</span></button>`).join('');
    let opts = '';
    if (this.tool === 'zone') {
      opts = `<div class="ed-label">Zone à peindre</div><div class="ed-swatches">${ZONES.map((z) => `<button class="ed-sw ${this.zone === z.id ? 'on' : ''}" data-ed="zone" data-id="${z.id}"><i style="background:${z.color}"></i>${z.name}</button>`).join('')}</div>
        <div class="ed-label">Pinceau</div><div class="ed-row">${[1, 2, 3, 5].map((b) => `<button class="ed-chip ${this.brush === b ? 'on' : ''}" data-ed="brush" data-id="${b}">${(2 * b - 1) * ZCELL} m</button>`).join('')}</div>`;
    } else if (this.tool === 'line') {
      opts = `<div class="ed-label">Type de tracé</div><div class="ed-swatches">${Object.entries(LINE_TYPES).map(([id, t]) => `<button class="ed-sw ${this.lineType === id ? 'on' : ''}" data-ed="ltype" data-id="${id}"><i style="background:${LINE_STYLE[id].color}"></i>${t.name}</button>`).join('')}</div>
        <div class="ed-row"><button class="ed-chip ${!this.smooth ? 'on' : ''}" data-ed="smooth" data-id="0">Droit</button><button class="ed-chip ${this.smooth ? 'on' : ''}" data-ed="smooth" data-id="1">Courbe</button></div>
        ${this.cur ? `<div class="ed-row"><button class="ed-btn gold" data-ed="finish">Terminer le tracé</button><button class="ed-btn" data-ed="cancel">Annuler</button></div>` : ''}`;
    } else if (this.tool === 'special') {
      opts = `<div class="ed-label">Monument</div><div class="ed-swatches">${Object.entries(SPECIALS).map(([id, d]) => `<button class="ed-sw ${this.specialKind === id ? 'on' : ''}" data-ed="skind" data-id="${id}"><i style="background:#f8f4ec"></i>${d.name}</button>`).join('')}</div>
        <div class="ed-row"><button class="ed-chip" data-ed="rot" data-id="1">Pivoter ↻</button><button class="ed-chip" data-ed="rot" data-id="-1">Pivoter ↺</button></div>`;
    } else if (this.tool === 'erase') {
      opts = '<p class="ed-note">Clique sur une route ou un monument pour le supprimer, ou glisse sur les zones pour les effacer.</p>';
    } else {
      opts = '<p class="ed-note">Glisse pour déplacer la vue. Molette ou pincement : zoom.</p>';
    }
    this.body.innerHTML = `<div class="ed-tools">${tools}</div>${opts}
      <div class="ed-sep"></div>
      <div class="ed-row"><button class="ed-chip" data-ed="undo">${icon('shift', 'inline')} Annuler</button><button class="ed-chip" data-ed="fit">Vue d'ensemble</button></div>
      <div class="ed-row"><button class="ed-chip" data-ed="export">Exporter</button><button class="ed-chip" data-ed="import">Importer</button><button class="ed-chip" data-ed="default">Carte par défaut</button><button class="ed-chip red" data-ed="clear">Tout effacer</button></div>
      <button class="ed-btn green big" data-ed="apply">${icon('check', 'inline')} Appliquer et reconstruire la ville</button>
      <p class="ed-note">${this.spec.roads.length} tracés · ${this.spec.specials.length} monuments. Ta partie est conservée : seule la ville autour de ton centre change.</p>
      <input type="file" id="ed-file" accept=".json,application/json" hidden>`;
  }

  updateHint() {
    const t = this.tool;
    const h = t === 'line'
      ? (this.cur ? 'Clique pour ajouter un point · double-clic, clic droit ou Entrée pour terminer · clique sur le 1er point pour fermer une boucle · Retour arrière : enlever un point'
        : `Clique pour commencer : ${LINE_TYPES[this.lineType].name.toLowerCase()} (${this.smooth ? 'courbe' : 'droit'}). Les points s'aimantent aux routes existantes.`)
      : t === 'zone' ? 'Glisse pour peindre la zone. Les bâtiments apparaissent le long des routes selon la zone.'
        : t === 'special' ? 'Clique pour poser le monument (bande rouge = façade). R pour pivoter.'
          : t === 'erase' ? 'Clique sur un élément pour le supprimer.' : 'Glisse pour te déplacer.';
    if (this.hint.textContent !== h) this.hint.textContent = h;
  }

  flash(text) {
    this.hint.textContent = text;
    this.hint.classList.add('warn');
    setTimeout(() => this.hint.classList.remove('warn'), 1600);
  }

  onClick(e) {
    const b = e.target.closest('[data-ed]');
    if (!b) return;
    const a = b.dataset.ed, id = b.dataset.id;
    if (a === 'close') return this.hide();
    if (a === 'tool') { if (this.cur) this.finishLine(); this.tool = id; }
    else if (a === 'zone') this.zone = id;
    else if (a === 'brush') this.brush = +id;
    else if (a === 'ltype') { this.lineType = id; if (this.cur) this.cur.type = id; }
    else if (a === 'smooth') { this.smooth = id === '1'; if (this.cur) this.cur.smooth = this.smooth; }
    else if (a === 'skind') this.specialKind = id;
    else if (a === 'rot') this.rot = (this.rot + (+id) * Math.PI / 2) % (Math.PI * 2);
    else if (a === 'finish') this.finishLine();
    else if (a === 'cancel') { this.cur = null; }
    else if (a === 'undo') this.undo();
    else if (a === 'fit') this.fit();
    else if (a === 'clear') {
      if (!confirm('Effacer toute la carte (zones, routes et monuments) ?')) return;
      this.pushUndo();
      this.spec.roads = []; this.spec.specials = []; this.zones = emptyZones();
    } else if (a === 'default') {
      if (!confirm('Remplacer par la carte par défaut ?')) return;
      this.pushUndo();
      const d = defaultSpec();
      this.spec.roads = d.roads; this.spec.specials = d.specials; this.zones = decodeZones(d.zones);
    } else if (a === 'export') this.exportJSON();
    else if (a === 'import') {
      const f = this.el.querySelector('#ed-file');
      f.onchange = () => this.importJSON(f.files[0]);
      f.click();
      return;
    } else if (a === 'apply') return this.apply();
    this.renderPanel();
    this.draw();
  }

  onChange() { /* inputs handled on click */ }

  onKey(e) {
    if (!this.open) return;
    if (e.key === 'Escape') { if (this.cur) { this.cur = null; this.renderPanel(); this.draw(); } else this.hide(); }
    else if (e.key === 'Enter' && this.cur) this.finishLine();
    else if (e.key === 'Backspace' && this.cur) { e.preventDefault(); this.undo(); }
    else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.undo(); }
    else if ((e.key === 'r' || e.key === 'R') && this.tool === 'special') { this.rot = (this.rot + Math.PI / 2) % (Math.PI * 2); this.draw(); }
  }

  currentSpec() {
    return { v: 1, zones: encodeZones(this.zones), roads: this.spec.roads, specials: this.spec.specials };
  }

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.currentSpec())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'empire-carte.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  importJSON(file) {
    if (!file) return;
    file.text().then((txt) => {
      try {
        const d = JSON.parse(txt);
        if (!d || !Array.isArray(d.roads)) throw new Error('format');
        this.pushUndo();
        this.spec.roads = d.roads.filter((r) => LINE_TYPES[r.type] && Array.isArray(r.pts));
        this.spec.specials = (d.specials || []).filter((s) => SPECIALS[s.kind]);
        this.zones = decodeZones(d.zones);
        this.renderPanel();
        this.draw();
      } catch (err) {
        this.flash('Fichier de carte invalide.');
      }
    });
  }

  apply() {
    if (this.cur) this.finishLine();
    if (!saveSpec(this.currentSpec())) { this.flash('Impossible d\'enregistrer la carte (stockage plein ?)'); return; }
    this.dirty = false;
    this.onApply?.();
  }
}

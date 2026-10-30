import * as THREE from 'three';
import {
  WORLD_HALF, ZCELL, ZN, CORE_HALF, ZONES, LINE_TYPES, CATALOG, CATALOG_ITEM, isTreeKind,
  loadSpec, saveSpec, defaultSpec, emptySpec, decodeZones, encodeZones, inCoreCell, expandLine,
} from '../world/mapspec.js';
import { buildObjectModel } from '../models/districts.js';
import { LOTS, TREES, SPEC as LOADED_SPEC } from '../world/citymap.js';
import { disposeObject } from '../models/builder.js';
import { icon } from '../ui/icons.js';

// 3D map editor: edit the city directly in the 3D view. Place any building, landmark,
// tree or street furniture, select it to move (drag), rotate, scale, vary, duplicate or
// delete it; draw roads / paths / railways by clicking on the ground; paint the ground
// (paving, water, fields, district zones). Start from the current city or from an empty
// world. "Appliquer" saves the map and rebuilds the full city.

const SNAP = 1;
const ROAD_COL = { main: '#4a4f57', sec: '#61666e', hwy: '#3a3f47', path: '#d9c9a8', rail: '#7a6a58' };
const GROUND_TOOLS = ['', 'ped', 'water', 'farm', 'park', 'forest', 'res', 'shop', 'cbd', 'ind'];
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

export class MapEditor3D {
  constructor(game, env, engine) {
    Object.assign(this, { game, env, engine });
    this.active = false;
    this.tool = 'select';
    this.item = 'chalet';
    this.lineType = 'sec';
    this.smooth = true;
    this.ground = 'ped';
    this.brush = 1;
    this.rot = 0;
    this.randomRot = true;
    this.selected = null;
    this.cur = null; // road being drawn
  }

  // ---------------------------------------------------------------------------
  open() {
    if (!this.el) this.buildUI();
    const s = loadSpec();
    this.spec = JSON.parse(JSON.stringify({ roads: s.roads, objects: s.objects || [], auto: s.auto !== false }));
    // landmarks of the 2D editor become ordinary objects here
    for (const sp of s.specials || []) this.spec.objects.push({ k: sp.kind, x: sp.x, z: sp.z, ry: sp.ry || 0, s: 1, seed: 7 });
    this.zones = decodeZones(s.zones);
    this.undoStack = [];
    this.dirty = false;
    this.active = true;
    this.game.editor = this;
    this.game.select(null);
    this.env.setCityVisible(false);
    this.root = new THREE.Group();
    this.root.name = 'editor3d';
    this.engine.scene.add(this.root);
    this.objLayer = new THREE.Group();
    this.root.add(this.objLayer);
    this.rebuildAll();
    this.el.classList.remove('hidden');
    document.body.classList.add('editing');
    this.cam = this.engine.controls.cam;
    this.cam.dragTool = (ndc, phase) => this.onDrag(ndc, phase);
    this.renderPanel();
  }

  close(force = false) {
    if (!force && this.dirty && !confirm('Quitter l\'éditeur 3D sans appliquer tes modifications ?')) return;
    this.active = false;
    this.cam.dragTool = null;
    this.engine.scene.remove(this.root);
    disposeObject(this.root);
    this.root = null;
    this.env.setCityVisible(true);
    this.el.classList.add('hidden');
    document.body.classList.remove('editing');
  }

  // ---------------------------------------------------------------------------
  snapshot() {
    this.undoStack.push(JSON.stringify({ roads: this.spec.roads, objects: this.spec.objects, auto: this.spec.auto, zones: encodeZones(this.zones) }));
    if (this.undoStack.length > 40) this.undoStack.shift();
    this.dirty = true;
  }
  undo() {
    if (this.cur) { this.cur.pts.pop(); if (!this.cur.pts.length) this.cur = null; this.rebuildPreview(); this.renderPanel(); return; }
    const s = this.undoStack.pop();
    if (!s) return;
    const d = JSON.parse(s);
    this.spec.roads = d.roads; this.spec.objects = d.objects; this.spec.auto = d.auto; this.zones = decodeZones(d.zones);
    this.select(null);
    this.rebuildAll();
    this.renderPanel();
  }

  currentSpec() {
    return { v: 1, zones: encodeZones(this.zones), roads: this.spec.roads, specials: [], objects: this.spec.objects, auto: this.spec.auto };
  }

  // ---------------------------------------------------------------------------
  // 3D preview of the edited map
  // ---------------------------------------------------------------------------
  rebuildAll() {
    this.rebuildGround();
    this.rebuildRoads();
    this.rebuildObjects();
    this.rebuildTrees();
    this.rebuildPreview();
  }

  rebuildGround() {
    if (this.groundMesh) { this.root.remove(this.groundMesh); this.groundMesh.geometry.dispose(); }
    const pos = [], col = [];
    const c = new THREE.Color();
    for (let j = 0; j < ZN; j++) for (let i = 0; i < ZN; i++) {
      const z = ZONES[this.zones[j * ZN + i]];
      if (!z.id) continue;
      const x0 = i * ZCELL - WORLD_HALF, z0 = j * ZCELL - WORLD_HALF, x1 = x0 + ZCELL, z1 = z0 + ZCELL;
      const y = z.id === 'water' ? 0.06 : 0.035;
      pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
      c.set(z.id === 'ped' ? '#cdbb9a' : z.id === 'water' ? '#2f9fc7' : z.color);
      if (z.id !== 'ped' && z.id !== 'water' && z.id !== 'farm') c.lerp(new THREE.Color('#8cc152'), 0.55); // district zones: a light tint
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    this.groundMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    this.groundMesh.receiveShadow = true;
    this.root.add(this.groundMesh);
  }

  ribbon(pts, w, y, color, closed) {
    const P = closed ? [...pts, pts[0]] : pts;
    const pos = [];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * w / 2, nz = (dx / l) * w / 2;
      pos.push(a[0] - nx, y, a[1] - nz, b[0] - nx, y, b[1] - nz, b[0] + nx, y, b[1] + nz, a[0] - nx, y, a[1] - nz, b[0] + nx, y, b[1] + nz, a[0] + nx, y, a[1] + nz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    return m;
  }

  rebuildRoads() {
    if (this.roadLayer) { this.root.remove(this.roadLayer); disposeObject(this.roadLayer); }
    this.roadLayer = new THREE.Group();
    for (const road of this.spec.roads) {
      const pts = expandLine(road, 2);
      if (pts.length < 2) continue;
      const w = LINE_TYPES[road.type].width;
      const y = { path: 0.05, rail: 0.12, sec: 0.08, main: 0.09, hwy: 0.1 }[road.type];
      if (road.type !== 'path' && road.type !== 'rail') this.roadLayer.add(this.ribbon(pts, w, y - 0.01, '#c9c3b8', road.closed));
      const m = this.ribbon(pts, road.type === 'path' || road.type === 'rail' ? w : w - 3, y, ROAD_COL[road.type], road.closed);
      m.userData.road = road;
      this.roadLayer.add(m);
      if (road.type === 'rail') this.roadLayer.add(this.ribbon(pts, 1.6, y + 0.05, '#9aa1a8', road.closed));
    }
    this.root.add(this.roadLayer);
  }

  objectGroup(o) {
    const g = buildObjectModel({ kind: o.k, w: o.w || CATALOG_ITEM[o.k].w, d: o.d || CATALOG_ITEM[o.k].d, s: o.s || 1, seed: o.seed || 1 });
    g.position.set(o.x, 0, o.z);
    g.rotation.y = o.ry || 0;
    g.userData.obj = o;
    g.traverse((m) => { if (m.isMesh) m.userData.obj = o; });
    return g;
  }

  rebuildObjects() {
    for (const c of [...this.objLayer.children]) { this.objLayer.remove(c); disposeObject(c); }
    this.groups = new Map();
    for (const o of this.spec.objects) {
      if (isTreeKind(o.k) || !CATALOG_ITEM[o.k]) continue;
      const g = this.objectGroup(o);
      this.groups.set(o, g);
      this.objLayer.add(g);
    }
  }
  refreshObject(o) {
    const old = this.groups.get(o);
    if (old) { this.objLayer.remove(old); disposeObject(old); }
    if (!this.spec.objects.includes(o)) { this.groups.delete(o); return; }
    if (isTreeKind(o.k)) { this.rebuildTrees(); return; }
    const g = this.objectGroup(o);
    this.groups.set(o, g);
    this.objLayer.add(g);
  }

  rebuildTrees() {
    if (this.treeLayer) { this.root.remove(this.treeLayer); this.treeLayer.traverse((m) => { if (m.isInstancedMesh) m.dispose(); }); }
    this.treeLayer = new THREE.Group();
    this.treeList = { tree: [], pine: [] };
    for (const o of this.spec.objects) if (isTreeKind(o.k)) this.treeList[o.k].push(o);
    if (!this.treeGeo) {
      const crown = new THREE.IcosahedronGeometry(2.0, 1).translate(0, 3.9, 0);
      this.treeGeo = {
        trunk: new THREE.CylinderGeometry(0.28, 0.42, 2.6, 7).translate(0, 1.3, 0),
        tree: crown,
        pine: new THREE.ConeGeometry(1.9, 6.5, 8).translate(0, 4.6, 0),
      };
      this.treeMats = {
        trunk: new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 1 }),
        tree: new THREE.MeshStandardMaterial({ color: '#4ca346', roughness: 0.85 }),
        pine: new THREE.MeshStandardMaterial({ color: '#2d6a4f', roughness: 0.85 }),
      };
    }
    for (const k of ['tree', 'pine']) {
      const list = this.treeList[k];
      if (!list.length) continue;
      const trunk = new THREE.InstancedMesh(this.treeGeo.trunk, this.treeMats.trunk, list.length);
      const crown = new THREE.InstancedMesh(this.treeGeo[k], this.treeMats[k], list.length);
      list.forEach((o, i) => {
        _q.setFromAxisAngle(_v.set(0, 1, 0), o.ry || 0);
        _m.compose(_v.set(o.x, 0, o.z), _q, _s.setScalar(o.s || 1));
        trunk.setMatrixAt(i, _m); crown.setMatrixAt(i, _m);
      });
      for (const m of [trunk, crown]) { m.castShadow = true; m.computeBoundingSphere(); m.userData.trees = list; this.treeLayer.add(m); }
    }
    this.root.add(this.treeLayer);
  }

  /** Ghost of the item / road being placed and the selection box. */
  rebuildPreview() {
    if (this.preview) { this.root.remove(this.preview); disposeObject(this.preview); }
    this.preview = new THREE.Group();
    if (this.cur && this.cur.pts.length) {
      const pts = this.hoverPoint ? [...this.cur.pts, this.hoverPoint] : this.cur.pts;
      if (pts.length >= 2) {
        const m = this.ribbon(expandLine({ ...this.cur, pts, closed: false }, 2), LINE_TYPES[this.cur.type].width, 0.15, '#ffd166');
        m.material.transparent = true; m.material.opacity = 0.75;
        this.preview.add(m);
      }
      for (const p of this.cur.pts) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), new THREE.MeshBasicMaterial({ color: '#ffd166' }));
        d.position.set(p[0], 0.3, p[1]);
        this.preview.add(d);
      }
    }
    if (this.selected) {
      const box = new THREE.Box3();
      const g = this.groups.get(this.selected);
      if (g) box.setFromObject(g);
      else box.setFromCenterAndSize(new THREE.Vector3(this.selected.x, 3, this.selected.z), new THREE.Vector3(4, 7, 4).multiplyScalar(this.selected.s || 1));
      box.expandByScalar(0.4);
      this.preview.add(new THREE.Box3Helper(box, new THREE.Color('#ffd166')));
    }
    this.root.add(this.preview);
  }

  updateGhost() {
    if (this.ghost) { this.root.remove(this.ghost); disposeObject(this.ghost); this.ghost = null; }
    if (this.tool !== 'place' || !this.hoverPoint) return;
    const o = this.newObject(this.hoverPoint[0], this.hoverPoint[1], true);
    if (!o) return;
    if (isTreeKind(o.k) || this.item === 'grove') {
      this.ghost = new THREE.Mesh(new THREE.CylinderGeometry(this.item === 'grove' ? 7 : 1.8, this.item === 'grove' ? 7 : 1.8, 0.2, 16), new THREE.MeshBasicMaterial({ color: '#5effa8', transparent: true, opacity: 0.45 }));
      this.ghost.position.set(o.x, 0.2, o.z);
    } else {
      this.ghost = this.objectGroup(o);
      this.ghost.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.55; m.castShadow = false; } });
    }
    this.root.add(this.ghost);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  groundAt(ndc) {
    _ray.setFromCamera(ndc, this.engine.camera);
    const p = _ray.ray.intersectPlane(_plane, _v);
    return p ? [p.x, p.z] : null;
  }
  pickAt(ndc) {
    _ray.setFromCamera(ndc, this.engine.camera);
    const hits = _ray.intersectObjects([this.objLayer, this.treeLayer, this.roadLayer], true);
    for (const h of hits) {
      if (h.object.userData.obj) return { obj: h.object.userData.obj };
      if (h.object.userData.trees && h.instanceId !== undefined) return { obj: h.object.userData.trees[h.instanceId] };
      if (h.object.userData.road) return { road: h.object.userData.road };
    }
    return null;
  }
  inCore(x, z, r = 0) { return Math.abs(x) < CORE_HALF + r && Math.abs(z) < CORE_HALF + r; }

  newObject(x, z, ghost = false) {
    const def = CATALOG_ITEM[this.item];
    if (!def) return null;
    const snap = (v) => Math.round(v / SNAP) * SNAP;
    const k = this.item === 'grove' ? 'tree' : this.item;
    const nature = def.cat === 'Nature';
    const ry = nature && this.randomRot && !ghost ? Math.random() * Math.PI * 2 : this.rot;
    return { k, x: snap(x), z: snap(z), ry, s: nature && !ghost ? 0.8 + Math.random() * 0.5 : 1, seed: ghost ? 7 : (Math.random() * 1e9) | 0 };
  }

  onTap(ndc) {
    const p = this.groundAt(ndc);
    if (this.tool === 'select' || this.tool === 'erase') {
      const hit = this.pickAt(ndc);
      if (this.tool === 'erase') {
        if (!hit) return;
        this.snapshot();
        if (hit.obj) { this.spec.objects.splice(this.spec.objects.indexOf(hit.obj), 1); this.refreshObject(hit.obj); }
        else { this.spec.roads.splice(this.spec.roads.indexOf(hit.road), 1); this.rebuildRoads(); }
        this.rebuildPreview();
        return;
      }
      this.select(hit && hit.obj ? hit.obj : null);
      return;
    }
    if (!p) return;
    if (this.tool === 'place') {
      const def = CATALOG_ITEM[this.item];
      if (this.inCore(p[0], p[1], Math.max(def.w, def.d) / 2)) return this.flash('Le centre est réservé à tes commerces.');
      this.snapshot();
      if (this.item === 'grove') {
        for (let k = 0; k < 8; k++) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 7;
          const o = this.newObject(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r);
          o.k = Math.random() < 0.4 ? 'pine' : 'tree';
          this.spec.objects.push(o);
        }
        this.rebuildTrees();
      } else {
        const o = this.newObject(p[0], p[1]);
        this.spec.objects.push(o);
        this.refreshObject(o);
      }
      this.renderPanel();
    } else if (this.tool === 'road') {
      const q = this.snapRoadPoint(p);
      if (!this.cur) this.cur = { type: this.lineType, smooth: this.smooth, pts: [q] };
      else {
        const first = this.cur.pts[0], last = this.cur.pts[this.cur.pts.length - 1];
        if (this.cur.pts.length >= 3 && Math.hypot(q[0] - first[0], q[1] - first[1]) < 0.5) { this.cur.closed = true; this.finishRoad(); return; }
        if (Math.hypot(q[0] - last[0], q[1] - last[1]) < 0.5) { this.finishRoad(); return; }
        this.cur.pts.push(q);
      }
      this.rebuildPreview();
      this.renderPanel();
    } else if (this.tool === 'ground') {
      this.snapshot();
      this.paint(p);
    }
  }

  /** Drag on the map: move the selected object, or paint the ground. Return true to capture. */
  onDrag(ndc, phase) {
    if (!this.active) return false;
    if (phase === 'start') {
      if (this.tool === 'ground') { this.snapshot(); const p = this.groundAt(ndc); if (p) this.paint(p); this.dragging = 'paint'; return true; }
      if (this.tool === 'select' && this.selected) {
        const hit = this.pickAt(ndc);
        if (hit && hit.obj === this.selected) { this.snapshot(); this.dragging = 'move'; return true; }
      }
      return false;
    }
    if (phase === 'tap') { this.dragging = null; this.onTap(ndc); return true; }
    if (phase === 'cancel' || !ndc) { this.dragging = null; return true; }
    const p = this.groundAt(ndc);
    if (p && this.dragging === 'paint') this.paint(p);
    if (p && this.dragging === 'move') {
      const o = this.selected;
      if (!this.inCore(p[0], p[1], 2)) { o.x = Math.round(p[0]); o.z = Math.round(p[1]); }
      const g = this.groups.get(o);
      if (g) g.position.set(o.x, 0, o.z); else if (phase === 'end') this.rebuildTrees();
      this.rebuildPreview();
    }
    if (phase === 'end') {
      if (this.dragging === 'move' && isTreeKind(this.selected.k)) this.rebuildTrees();
      this.dragging = null;
    }
    return true;
  }

  snapRoadPoint(p) {
    let best = null, bd = 4;
    for (const r of this.spec.roads) for (const q of r.pts) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = q; } }
    if (this.cur) for (const q of this.cur.pts) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = q; } }
    return best ? [best[0], best[1]] : [Math.round(p[0]), Math.round(p[1])];
  }

  finishRoad() {
    const c = this.cur;
    this.cur = null;
    if (c && c.pts.length >= 2) { this.snapshot(); this.spec.roads.push(c); this.rebuildRoads(); }
    this.rebuildPreview();
    this.renderPanel();
  }

  paint(p) {
    const v = Math.max(0, ZONES.findIndex((z) => z.id === this.ground));
    const ci = Math.floor((p[0] + WORLD_HALF) / ZCELL), cj = Math.floor((p[1] + WORLD_HALF) / ZCELL);
    const r = this.brush - 1;
    let changed = false;
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
      if (i < 0 || j < 0 || i >= ZN || j >= ZN || inCoreCell(i, j)) continue;
      if (this.zones[j * ZN + i] !== v) { this.zones[j * ZN + i] = v; changed = true; }
    }
    if (changed) this.rebuildGround();
  }

  select(o) {
    this.selected = o;
    this.rebuildPreview();
    this.renderPanel();
  }

  transformSelected(fn) {
    const o = this.selected;
    if (!o) return;
    this.snapshot();
    fn(o);
    this.refreshObject(o);
    this.rebuildPreview();
    this.renderPanel();
  }

  update() {
    if (!this.active) return;
    const cam = this.cam;
    if (cam.pointerType === 'mouse' && (this.tool === 'place' || (this.tool === 'road' && this.cur))) {
      const p = this.groundAt(cam.hover);
      const q = p ? (this.tool === 'road' ? this.snapRoadPoint(p) : p) : null;
      const key = q ? q[0].toFixed(0) + ',' + q[1].toFixed(0) : '';
      if (key !== this.hoverKey) {
        this.hoverKey = key;
        this.hoverPoint = q;
        if (this.tool === 'place') this.updateGhost(); else this.rebuildPreview();
      }
    } else if (this.ghost) { this.root.remove(this.ghost); disposeObject(this.ghost); this.ghost = null; this.hoverKey = ''; }
  }

  // ---------------------------------------------------------------------------
  // Panel
  // ---------------------------------------------------------------------------
  buildUI() {
    const el = document.createElement('div');
    el.id = 'editor3d';
    el.className = 'hidden';
    el.innerHTML = `<aside class="ed-panel ed3"><div class="ed-head">${icon('crane')}<div><b>Éditeur 3D</b><small>Construis ta ville comme tu veux</small></div>
      <button class="ed-x" data-e3="close" title="Fermer">${icon('close')}</button></div><div class="ed-body"></div></aside>
      <div class="ed-hint ed3-hint"></div>`;
    document.body.appendChild(el);
    this.el = el;
    this.body = el.querySelector('.ed-body');
    this.hint = el.querySelector('.ed-hint');
    el.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  renderPanel() {
    if (!this.body) return;
    const tools = [['select', 'Sélection', 'pointer'], ['place', 'Placer', 'plus'], ['road', 'Routes', 'crane'], ['ground', 'Sol', 'apps'], ['erase', 'Gomme', 'close']]
      .map(([id, name, ic]) => `<button class="ed-tool ${this.tool === id ? 'on' : ''}" data-e3="tool" data-id="${id}">${icon(ic)}<span>${name}</span></button>`).join('');
    let opts = '';
    if (this.tool === 'place') {
      opts = CATALOG.map((c) => `<div class="ed-label">${c.cat}</div><div class="ed-swatches">${c.items.map(([k, name]) => `<button class="ed-sw ${this.item === k ? 'on' : ''}" data-e3="item" data-id="${k}">${name}</button>`).join('')}</div>`).join('') +
        `<div class="ed-row"><button class="ed-chip" data-e3="rot" data-id="-1">↺ 45°</button><button class="ed-chip" data-e3="rot" data-id="1">↻ 45°</button>
        <button class="ed-chip ${this.randomRot ? 'on' : ''}" data-e3="rrot">Nature : orientation aléatoire</button></div>`;
    } else if (this.tool === 'road') {
      opts = `<div class="ed-label">Type</div><div class="ed-swatches">${Object.entries(LINE_TYPES).map(([id, t]) => `<button class="ed-sw ${this.lineType === id ? 'on' : ''}" data-e3="ltype" data-id="${id}"><i style="background:${ROAD_COL[id]}"></i>${t.name}</button>`).join('')}</div>
        <div class="ed-row"><button class="ed-chip ${!this.smooth ? 'on' : ''}" data-e3="smooth" data-id="0">Droit</button><button class="ed-chip ${this.smooth ? 'on' : ''}" data-e3="smooth" data-id="1">Courbe</button></div>
        ${this.cur ? `<div class="ed-row"><button class="ed-btn gold" data-e3="finish">Terminer (${this.cur.pts.length} pts)</button><button class="ed-btn" data-e3="cancel">Annuler</button></div>` : ''}`;
    } else if (this.tool === 'ground') {
      opts = `<div class="ed-label">Revêtement / zone</div><div class="ed-swatches">${GROUND_TOOLS.map((id) => { const z = ZONES.find((q) => q.id === id); return `<button class="ed-sw ${this.ground === id ? 'on' : ''}" data-e3="ground" data-id="${id}"><i style="background:${id === 'ped' ? '#cdbb9a' : z.color}"></i>${id === '' ? 'Herbe' : id === 'ped' ? 'Pavés (piéton)' : z.name}</button>`; }).join('')}</div>
        <div class="ed-label">Pinceau</div><div class="ed-row">${[1, 2, 3].map((b) => `<button class="ed-chip ${this.brush === b ? 'on' : ''}" data-e3="brush" data-id="${b}">${(2 * b - 1) * ZCELL} m</button>`).join('')}</div>
        <p class="ed-note">Les zones d'affaires, commerces, industrie et habitations servent au remplissage automatique.</p>`;
    } else if (this.tool === 'select') {
      const o = this.selected;
      opts = o ? `<div class="ed-label">${CATALOG_ITEM[o.k]?.name || o.k}</div>
        <div class="ed-row"><button class="ed-chip" data-e3="srot" data-id="-15">↺ 15°</button><button class="ed-chip" data-e3="srot" data-id="15">↻ 15°</button><button class="ed-chip" data-e3="srot" data-id="90">↻ 90°</button></div>
        <div class="ed-row"><button class="ed-chip" data-e3="scale" data-id="0.9">Plus petit</button><button class="ed-chip" data-e3="scale" data-id="1.1">Plus grand</button><span class="ed-note">× ${(o.s || 1).toFixed(2)}</span></div>
        <div class="ed-row"><button class="ed-chip" data-e3="vary">Varier le modèle</button><button class="ed-chip" data-e3="dup">Dupliquer</button><button class="ed-chip red" data-e3="del">Supprimer</button></div>
        <p class="ed-note">Glisse l'objet pour le déplacer. Clavier : flèches, Q / E, Suppr.</p>`
        : '<p class="ed-note">Clique sur un bâtiment, un arbre ou un objet pour le modifier.</p>';
    } else opts = '<p class="ed-note">Clique sur un objet ou une route pour le supprimer.</p>';
    const nObj = this.spec.objects.filter((o) => !isTreeKind(o.k)).length, nTree = this.spec.objects.length - nObj;
    this.body.innerHTML = `<div class="ed-tools">${tools}</div>${opts}
      <div class="ed-sep"></div>
      <div class="ed-row"><button class="ed-chip" data-e3="undo">Annuler</button><button class="ed-chip" data-e3="plan">Vue plan 2D</button></div>
      <div class="ed-row"><button class="ed-chip ${this.spec.auto ? 'on' : ''}" data-e3="auto">Remplissage auto : ${this.spec.auto ? 'oui' : 'non'}</button></div>
      <div class="ed-row"><button class="ed-chip" data-e3="freeze">Rendre la ville actuelle modifiable</button></div>
      <div class="ed-row"><button class="ed-chip" data-e3="default">Ville par défaut</button><button class="ed-chip red" data-e3="empty">Monde vide</button></div>
      <button class="ed-btn green big" data-e3="apply">${icon('check', 'inline')} Appliquer et reconstruire</button>
      <p class="ed-note">${nObj} objets · ${nTree} arbres · ${this.spec.roads.length} tracés. Ta partie est conservée.</p>`;
    this.updateHint();
  }

  updateHint() {
    const t = this.tool;
    this.hint.textContent = t === 'place' ? 'Clique sur le sol pour poser. Glisser : déplacer la vue · clic droit : pivoter · molette : zoom'
      : t === 'road' ? (this.cur ? 'Clique pour ajouter des points · re-clique le dernier point (ou Entrée) pour terminer · le 1er point ferme une boucle' : 'Clique sur le sol pour commencer un tracé (les points s\'aimantent aux routes)')
        : t === 'ground' ? 'Glisse pour peindre le sol · clic droit : pivoter la vue · deux doigts : déplacer'
          : t === 'select' ? 'Clique pour sélectionner · glisse l\'objet sélectionné pour le déplacer'
            : 'Clique sur ce que tu veux supprimer';
  }

  flash(text) {
    this.hint.textContent = text;
    this.hint.classList.add('warn');
    setTimeout(() => { this.hint.classList.remove('warn'); this.updateHint(); }, 1600);
  }

  onClick(e) {
    const b = e.target.closest('[data-e3]');
    if (!b) return;
    const a = b.dataset.e3, id = b.dataset.id;
    if (a === 'close') return this.close();
    if (a === 'tool') { if (this.cur) this.finishRoad(); this.tool = id; if (id !== 'select') this.select(null); this.updateGhost(); }
    else if (a === 'item') { this.item = id; this.hoverKey = ''; }
    else if (a === 'rot') this.rot = (this.rot + (+id) * Math.PI / 4 + Math.PI * 2) % (Math.PI * 2);
    else if (a === 'rrot') this.randomRot = !this.randomRot;
    else if (a === 'ltype') { this.lineType = id; if (this.cur) this.cur.type = id; this.rebuildPreview(); }
    else if (a === 'smooth') { this.smooth = id === '1'; if (this.cur) this.cur.smooth = this.smooth; this.rebuildPreview(); }
    else if (a === 'finish') this.finishRoad();
    else if (a === 'cancel') { this.cur = null; this.rebuildPreview(); }
    else if (a === 'ground') this.ground = id;
    else if (a === 'brush') this.brush = +id;
    else if (a === 'srot') this.transformSelected((o) => { o.ry = ((o.ry || 0) + ((+id) * Math.PI) / 180) % (Math.PI * 2); });
    else if (a === 'scale') this.transformSelected((o) => { o.s = Math.min(4, Math.max(0.3, (o.s || 1) * +id)); });
    else if (a === 'vary') this.transformSelected((o) => { o.seed = (Math.random() * 1e9) | 0; });
    else if (a === 'dup') {
      const o = this.selected; if (!o) return;
      this.snapshot();
      const c = { ...o, x: o.x + Math.max(4, (CATALOG_ITEM[o.k]?.w || 4) * (o.s || 1) + 2), seed: (Math.random() * 1e9) | 0 };
      this.spec.objects.push(c); this.refreshObject(c); this.select(c);
      return;
    } else if (a === 'del') {
      const o = this.selected; if (!o) return;
      this.snapshot();
      this.spec.objects.splice(this.spec.objects.indexOf(o), 1); this.refreshObject(o); this.select(null);
      return;
    } else if (a === 'undo') this.undo();
    else if (a === 'auto') { this.snapshot(); this.spec.auto = !this.spec.auto; }
    else if (a === 'freeze') {
      if (!confirm('Transformer les bâtiments et arbres générés en objets modifiables ?\nLe remplissage automatique sera désactivé.')) return;
      this.freeze();
    } else if (a === 'default') {
      if (!confirm('Revenir à la ville par défaut ?')) return;
      this.snapshot();
      const d = defaultSpec();
      this.spec = { roads: d.roads, objects: d.specials.map((sp) => ({ k: sp.kind, x: sp.x, z: sp.z, ry: sp.ry, s: 1, seed: 7 })), auto: true };
      this.zones = decodeZones(d.zones);
      this.select(null); this.rebuildAll();
    } else if (a === 'empty') {
      if (!confirm('Tout effacer et partir d\'un monde vide ?')) return;
      this.snapshot();
      const d = emptySpec();
      this.spec = { roads: [], objects: [], auto: false };
      this.zones = decodeZones(d.zones);
      this.select(null); this.rebuildAll();
    } else if (a === 'plan') {
      saveSpec(this.currentSpec());
      this.close(true);
      this.onPlan?.();
      return;
    } else if (a === 'apply') {
      if (this.cur) this.finishRoad();
      if (!saveSpec(this.currentSpec())) return this.flash('Impossible d\'enregistrer (stockage plein ?)');
      this.dirty = false;
      this.onApply?.();
      return;
    }
    this.renderPanel();
  }

  /** Turn the automatically generated buildings and trees of the loaded city into objects. */
  freeze() {
    this.snapshot();
    const objs = [];
    for (const l of LOTS) {
      if (!CATALOG_ITEM[l.kind]) continue;
      objs.push({ k: l.kind, x: +l.x.toFixed(1), z: +l.z.toFixed(1), ry: +l.ry.toFixed(3), s: l.s || 1, w: +l.w.toFixed(1), d: +l.d.toFixed(1), seed: l.seed });
    }
    for (const [x, z, kind, s] of TREES) {
      if (Math.abs(x) > WORLD_HALF || Math.abs(z) > WORLD_HALF) continue;
      objs.push({ k: kind === 'pine' ? 'pine' : 'tree', x: +x.toFixed(1), z: +z.toFixed(1), s: +(s || 1).toFixed(2), ry: 0 });
    }
    this.spec.objects = objs;
    this.spec.roads = JSON.parse(JSON.stringify(LOADED_SPEC.roads));
    this.zones = decodeZones(LOADED_SPEC.zones);
    this.spec.auto = false;
    this.select(null);
    this.rebuildAll();
    this.flash(`${objs.length} éléments sont maintenant modifiables.`);
  }

  onKey(e) {
    if (!this.active || e.target instanceof HTMLInputElement) return;
    const o = this.selected;
    if (e.key === 'Escape') { if (this.cur) { this.cur = null; this.rebuildPreview(); this.renderPanel(); } else if (o) this.select(null); }
    else if (e.key === 'Enter' && this.cur) this.finishRoad();
    else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.undo(); }
    else if (o && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); this.onClick({ target: { closest: () => ({ dataset: { e3: 'del' } }) } }); }
    else if (o && (e.key === 'q' || e.key === 'e')) this.transformSelected((x) => { x.ry = (x.ry || 0) + (e.key === 'q' ? -1 : 1) * Math.PI / 12; });
    else if (o && e.key.startsWith('Arrow')) {
      e.preventDefault();
      e.stopPropagation();
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      this.transformSelected((x) => { x.x += d[0]; x.z += d[1]; });
      this.cam.keys.delete(e.key.toLowerCase());
    } else if (!o && this.tool === 'place' && (e.key === 'q' || e.key === 'e')) { this.rot += (e.key === 'q' ? -1 : 1) * Math.PI / 4; this.hoverKey = ''; }
  }
}

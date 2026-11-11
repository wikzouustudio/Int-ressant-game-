// Arène "Marché de Minuit" : carte, collisions, ligne de vue, A*, et décor 3D.
import * as THREE from 'three';
import { rbox, outlineGeometry, outlineMaterial, GEO } from './toon.js';

// Moitié haute de la carte (équipe rouge). La moitié basse est la rotation à 180°.
// '#' mur  'B' buisson  '~' eau  'r' apparition rouge  '.' sol
const TOP = [
  'BBBB.............BBBB',
  'BB.....r..r..r.....BB',
  '.....................',
  '..###...........###..',
  '..#...............#..',
  '..#....BBBBBBB....#..',
  '.......BBBBBBB.......',
  'BB.................BB',
  'BBB....~~~.~~~....BBB',
  'BB.....~~~.~~~.....BB',
  '.....................',
  '....###.......###....',
  '....#BB.......BB#....',
  '.....BB...#...BB.....',
  '##........#........##',
  '##.......BBB.......##',
  '.........BBB.........',
];

export function mapRows() {
  const rows = [...TOP];
  for (let i = TOP.length - 2; i >= 0; i--) {
    rows.push(TOP[i].split('').reverse().join('').replace(/r/g, 'b'));
  }
  return rows;
}

export class Arena {
  constructor() {
    this.rows = mapRows();
    this.H = this.rows.length;
    this.W = this.rows[0].length;
    this.grid = this.rows.map((r) => r.split(''));
    this.spawns = { 0: [], 1: [] };
    this.bushes = [];
    for (let r = 0; r < this.H; r++) {
      for (let c = 0; c < this.W; c++) {
        const ch = this.grid[r][c];
        if (ch === 'b') this.spawns[0].push(this.world(c, r));
        if (ch === 'r') this.spawns[1].push(this.world(c, r));
        if (ch === 'B') this.bushes.push([c, r]);
      }
    }
    this.spawns[0].sort((a, b) => a.x - b.x);
    this.spawns[1].sort((a, b) => b.x - a.x);
    this.zone = { x: 0, z: 0, r: 3 };
    this.time = 0;
  }

  world(c, r) { return { x: c - this.W / 2 + 0.5, z: r - this.H / 2 + 0.5 }; }
  tc(x) { return Math.floor(x + this.W / 2); }
  tr(z) { return Math.floor(z + this.H / 2); }
  cell(c, r) { return c < 0 || r < 0 || c >= this.W || r >= this.H ? '#' : this.grid[r][c]; }
  solidMove(c, r) { const ch = this.cell(c, r); return ch === '#' || ch === '~'; }
  solidShot(c, r) { return this.cell(c, r) === '#'; }
  solidShotAt(x, z) { return this.solidShot(this.tc(x), this.tr(z)); }
  solidMoveAt(x, z) { return this.solidMove(this.tc(x), this.tr(z)); }
  inBush(x, z) { return this.cell(this.tc(x), this.tr(z)) === 'B'; }

  // Repousse un cercle hors des tuiles solides.
  resolveCircle(p, rad) {
    for (let it = 0; it < 2; it++) {
      const c0 = this.tc(p.x - rad), c1 = this.tc(p.x + rad);
      const r0 = this.tr(p.z - rad), r1 = this.tr(p.z + rad);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (!this.solidMove(c, r)) continue;
          const minx = c - this.W / 2, minz = r - this.H / 2;
          const nx = Math.max(minx, Math.min(p.x, minx + 1));
          const nz = Math.max(minz, Math.min(p.z, minz + 1));
          let dx = p.x - nx, dz = p.z - nz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rad * rad) continue;
          if (d2 > 1e-9) {
            const d = Math.sqrt(d2);
            p.x += (dx / d) * (rad - d);
            p.z += (dz / d) * (rad - d);
          } else {
            const cx = minx + 0.5, cz = minz + 0.5;
            dx = p.x - cx; dz = p.z - cz;
            if (Math.abs(dx) > Math.abs(dz)) p.x = cx + Math.sign(dx || 1) * (0.5 + rad);
            else p.z = cz + Math.sign(dz || 1) * (0.5 + rad);
          }
        }
      }
    }
  }

  los(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const n = Math.ceil(Math.hypot(dx, dz) / 0.2);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.solidShotAt(ax + dx * t, az + dz * t)) return false;
    }
    return true;
  }

  walkClear(ax, az, bx, bz, rad = 0.4) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return true;
    const px = -dz / len * rad, pz = dx / len * rad;
    const n = Math.ceil(len / 0.25);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + dx * t, z = az + dz * t;
      if (this.solidMoveAt(x + px, z + pz) || this.solidMoveAt(x - px, z - pz)) return false;
    }
    return true;
  }

  nearestWalkable(x, z) {
    let c = Math.max(0, Math.min(this.W - 1, this.tc(x)));
    let r = Math.max(0, Math.min(this.H - 1, this.tr(z)));
    if (!this.solidMove(c, r)) return { x: Math.max(-this.W / 2 + 0.5, Math.min(this.W / 2 - 0.5, x)), z: Math.max(-this.H / 2 + 0.5, Math.min(this.H / 2 - 0.5, z)) };
    for (let rad = 1; rad < 6; rad++) {
      let best = null, bd = 1e9;
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        if (this.solidMove(c + dc, r + dr)) continue;
        const w = this.world(c + dc, r + dr);
        const d = (w.x - x) ** 2 + (w.z - z) ** 2;
        if (d < bd) { bd = d; best = w; }
      }
      if (best) return best;
    }
    return this.world(c, r);
  }

  // A* 8 directions sur la grille, puis lissage du chemin.
  path(ax, az, bx, bz) {
    const W = this.W, H = this.H;
    const s = this.nearestWalkable(ax, az), g = this.nearestWalkable(bx, bz);
    const sc = this.tc(s.x), sr = this.tr(s.z), gc = this.tc(g.x), gr = this.tr(g.z);
    const start = sr * W + sc, goal = gr * W + gc;
    if (start === goal) return [{ x: bx, z: bz }];
    const gScore = new Float32Array(W * H).fill(Infinity);
    const came = new Int32Array(W * H).fill(-1);
    const closed = new Uint8Array(W * H);
    const open = [start];
    gScore[start] = 0;
    const hf = (i) => {
      const dx = Math.abs((i % W) - gc), dz = Math.abs(((i / W) | 0) - gr);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    const fScore = new Float32Array(W * H).fill(Infinity);
    fScore[start] = hf(start);
    let found = false, guard = 0;
    while (open.length && guard++ < 4000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === goal) { found = true; break; }
      closed[cur] = 1;
      const cc = cur % W, cr = (cur / W) | 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = cc + dc, nr = cr + dr;
        if (this.solidMove(nc, nr)) continue;
        if (dr && dc && (this.solidMove(cc + dc, cr) || this.solidMove(cc, cr + dr))) continue;
        const ni = nr * W + nc;
        if (closed[ni]) continue;
        const ng = gScore[cur] + (dr && dc ? 1.414 : 1);
        if (ng < gScore[ni]) {
          if (gScore[ni] === Infinity) open.push(ni);
          gScore[ni] = ng;
          fScore[ni] = ng + hf(ni);
          came[ni] = cur;
        }
      }
    }
    if (!found) return [];
    const pts = [];
    for (let i = goal; i !== -1 && i !== start; i = came[i]) pts.push(this.world(i % W, (i / W) | 0));
    pts.reverse();
    pts[pts.length - 1] = g;
    // Lissage : saute les points visibles
    const out = [];
    let ox = ax, oz = az, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.walkClear(ox, oz, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]);
      ox = pts[j].x; oz = pts[j].z;
      i = j + 1;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Décor 3D
  // ---------------------------------------------------------------------------
  build(scene) {
    const W = this.W, H = this.H;
    this.group = new THREE.Group();
    scene.add(this.group);

    // Sol : texture peinte en canvas (dalles du marché)
    const T = 48;
    const cv = document.createElement('canvas');
    cv.width = W * T; cv.height = H * T;
    const g = cv.getContext('2d');
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const ch = this.grid[r][c];
      const alt = (r + c) % 2 === 0;
      let col = alt ? '#f6d498' : '#eec687';
      if (ch === 'B') col = alt ? '#9fd27a' : '#93c96e';
      if (ch === '~') col = '#2a7fb8';
      g.fillStyle = col;
      g.fillRect(c * T, r * T, T, T);
      if (ch !== '~') {
        g.fillStyle = 'rgba(120,70,30,0.10)';
        for (let k = 0; k < 4; k++) g.fillRect(c * T + rnd() * T, r * T + rnd() * T, 3, 3);
        g.strokeStyle = 'rgba(140,80,40,0.16)';
        g.lineWidth = 2;
        g.strokeRect(c * T + 1, r * T + 1, T - 2, T - 2);
      }
    }
    // Zones d'apparition
    for (const [team, col] of [[0, 'rgba(61,182,255,0.30)'], [1, 'rgba(255,64,87,0.30)']]) {
      const rr = team === 0 ? H - 3 : 0;
      g.fillStyle = col;
      g.beginPath();
      g.roundRect(5 * T, rr * T + 6, 11 * T, 3 * T - 12, 24);
      g.fill();
    }
    // Rosace centrale
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 6;
    g.beginPath(); g.arc(W * T / 2, H * T / 2, 3 * T, 0, Math.PI * 2); g.stroke();
    g.setLineDash([14, 12]);
    g.beginPath(); g.moveTo(0, H * T / 2); g.lineTo(W * T, H * T / 2); g.stroke();
    g.setLineDash([]);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Herbe extérieure
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(90, 110), new THREE.MeshStandardMaterial({ color: 0x3f8f5a, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    this.group.add(outer);
    const curb = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.2, H + 1.2), new THREE.MeshStandardMaterial({ color: 0xb87a4b, roughness: 0.9 }));
    curb.rotation.x = -Math.PI / 2;
    curb.position.y = -0.01;
    this.group.add(curb);

    // Murs : caisses en bois avec couvercle clair
    const walls = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (this.grid[r][c] === '#') walls.push(this.world(c, r));
    const boxG = rbox(0.98, 1.0, 0.98, 0.1, 2);
    const capG = rbox(0.84, 0.14, 0.84, 0.05, 1);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const iw = new THREE.InstancedMesh(boxG, wallMat, walls.length);
    const ic = new THREE.InstancedMesh(capG, capMat, walls.length);
    const iwo = new THREE.InstancedMesh(outlineGeometry(boxG), outlineMaterial, walls.length);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    walls.forEach((w, i) => {
      m4.makeTranslation(w.x, 0.5, w.z);
      iw.setMatrixAt(i, m4);
      iwo.setMatrixAt(i, m4);
      col.set(i % 3 === 0 ? 0xd77a44 : i % 3 === 1 ? 0xcb6d3a : 0xe0884f);
      iw.setColorAt(i, col);
      m4.makeTranslation(w.x, 1.03, w.z);
      ic.setMatrixAt(i, m4);
      col.set(0xffb070);
      ic.setColorAt(i, col);
    });
    iw.castShadow = iw.receiveShadow = true;
    ic.castShadow = true;
    this.group.add(iw, ic, iwo);

    // Buissons : boules de feuillage qui ondulent
    const bushG = new THREE.IcosahedronGeometry(1, 1);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, flatShading: true });
    this.bushUniform = { value: 0 };
    const sway = (shader) => {
      shader.uniforms.uTime = this.bushUniform;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sw = sin(uTime * 1.8 + ip.x * 0.9 + ip.z * 0.7) * 0.07 * max(0.0, position.y + 0.4);
        transformed.x += sw; transformed.z += sw * 0.5;`);
    };
    bushMat.onBeforeCompile = sway;
    const blobs = [];
    for (const [c, r] of this.bushes) {
      const w = this.world(c, r);
      for (let k = 0; k < 3; k++) {
        blobs.push({
          x: w.x + (rnd() - 0.5) * 0.5, z: w.z + (rnd() - 0.5) * 0.5,
          s: 0.42 + rnd() * 0.16, h: 0.55 + rnd() * 0.25, k,
        });
      }
    }
    const ib = new THREE.InstancedMesh(bushG, bushMat, blobs.length);
    const ibo = new THREE.InstancedMesh(outlineGeometry(bushG), outlineMaterial, blobs.length);
    const q = new THREE.Quaternion();
    blobs.forEach((b, i) => {
      q.setFromEuler(new THREE.Euler(0, rnd() * 6, 0));
      m4.compose(new THREE.Vector3(b.x, b.h * 0.8, b.z), q, new THREE.Vector3(b.s, b.h, b.s));
      ib.setMatrixAt(i, m4);
      ibo.setMatrixAt(i, m4);
      col.set([0x46c25a, 0x58d36a, 0x37ad4e][b.k]);
      ib.setColorAt(i, col);
    });
    ib.receiveShadow = true;
    this.group.add(ib, ibo);

    // Eau
    const wcv = document.createElement('canvas');
    wcv.width = wcv.height = 128;
    const wg = wcv.getContext('2d');
    wg.fillStyle = '#3cc0ff';
    wg.fillRect(0, 0, 128, 128);
    wg.strokeStyle = 'rgba(255,255,255,0.55)';
    wg.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      wg.beginPath();
      for (let x = 0; x <= 128; x += 8) wg.lineTo(x, 16 + i * 32 + Math.sin(x / 128 * Math.PI * 2) * 6);
      wg.stroke();
    }
    this.waterTex = new THREE.CanvasTexture(wcv);
    this.waterTex.colorSpace = THREE.SRGBColorSpace;
    this.waterTex.wrapS = this.waterTex.wrapT = THREE.RepeatWrapping;
    const waterMat = new THREE.MeshStandardMaterial({ map: this.waterTex, roughness: 0.15, emissive: 0x0a3d66, emissiveIntensity: 0.35 });
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (this.grid[r][c] === '~') {
      const w = this.world(c, r);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), waterMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(w.x, 0.03, w.z);
      this.group.add(m);
    }

    // Clôture + lanternes + arbres autour de l'arène
    const postG = rbox(0.3, 0.7, 0.3, 0.06, 1);
    const posts = [];
    for (let x = -W / 2; x <= W / 2 + 0.01; x += 1.5) { posts.push([x, -H / 2 - 0.45], [x, H / 2 + 0.45]); }
    for (let z = -H / 2 + 1.5; z < H / 2; z += 1.5) { posts.push([-W / 2 - 0.45, z], [W / 2 + 0.45, z]); }
    const ip = new THREE.InstancedMesh(postG, new THREE.MeshStandardMaterial({ color: 0x8a4fff, roughness: 0.6 }), posts.length);
    const ipo = new THREE.InstancedMesh(outlineGeometry(postG), outlineMaterial, posts.length);
    posts.forEach(([x, z], i) => { m4.makeTranslation(x, 0.35, z); ip.setMatrixAt(i, m4); ipo.setMatrixAt(i, m4); });
    ip.castShadow = true;
    this.group.add(ip, ipo);

    const lanternMat = new THREE.MeshStandardMaterial({ color: 0xff5a4a, emissive: 0xff3a1a, emissiveIntensity: 0.8, roughness: 0.5 });
    const lanternMat2 = new THREE.MeshStandardMaterial({ color: 0xffc53a, emissive: 0xff9a00, emissiveIntensity: 0.8, roughness: 0.5 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3b2a55 });
    this.lanterns = [];
    let li = 0;
    for (const z of [-14, -8, -2, 4, 10, 16]) for (const sx of [-1, 1]) {
      const x = sx * (W / 2 + 1.6);
      const pole = new THREE.Mesh(GEO.cyl, poleMat);
      pole.scale.set(0.07, 2.6, 0.07);
      pole.position.set(x, 1.3, z);
      this.group.add(pole);
      const lan = new THREE.Mesh(GEO.sph, li++ % 2 ? lanternMat : lanternMat2);
      lan.scale.set(0.35, 0.45, 0.35);
      lan.position.set(x, 2.5, z);
      lan.add(new THREE.Mesh(outlineGeometry(GEO.sph), outlineMaterial));
      this.group.add(lan);
      this.lanterns.push(lan);
    }
    const treeTop = new THREE.MeshStandardMaterial({ color: 0x2f9e5a, roughness: 0.8, flatShading: true });
    const trunk = new THREE.MeshStandardMaterial({ color: 0x7a4a2a });
    const treeG = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (W / 2 + 3.2 + rnd() * 6);
      const z = -H / 2 - 2 + rnd() * (H + 6);
      const t = new THREE.Mesh(GEO.cyl, trunk);
      t.scale.set(0.15, 1, 0.15);
      t.position.set(x, 0.5, z);
      const s = 0.9 + rnd() * 0.7;
      const top = new THREE.Mesh(treeG, treeTop);
      top.scale.set(s, s * 1.2, s);
      top.position.set(x, 1.2 + s, z);
      top.castShadow = true;
      top.add(new THREE.Mesh(outlineGeometry(treeG), outlineMaterial));
      this.group.add(t, top);
    }
    for (let i = 0; i < 10; i++) {
      const top = new THREE.Mesh(treeG, treeTop);
      const s = 1 + rnd();
      top.scale.set(s * 1.4, s, s * 1.4);
      top.position.set((rnd() - 0.5) * 22, s * 0.6, (i % 2 ? -1 : 1) * (H / 2 + 2.5 + rnd() * 3));
      top.add(new THREE.Mesh(outlineGeometry(treeG), outlineMaterial));
      this.group.add(top);
    }
  }

  buildZone(scene) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(this.zone.r, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.04;
    const ring = new THREE.Mesh(new THREE.RingGeometry(this.zone.r - 0.16, this.zone.r, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    g.add(disc, ring);
    scene.add(g);
    this.zoneMesh = { g, disc, ring };
    return this.zoneMesh;
  }

  update(dt) {
    this.time += dt;
    if (this.bushUniform) this.bushUniform.value = this.time;
    if (this.waterTex) this.waterTex.offset.set(this.time * 0.05, this.time * 0.08);
    if (this.lanterns) this.lanterns.forEach((l, i) => { l.rotation.z = Math.sin(this.time * 1.5 + i) * 0.08; });
  }
}

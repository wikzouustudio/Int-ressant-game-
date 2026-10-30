import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { MeshBuilder, rng } from '../models/builder.js';
import { setNightLevel } from '../models/materials.js';
import { CELL, GRID, ROAD_Y, PLAY_HALF, ROAD_W, CARRIAGE, isMainRoad } from '../game/config.js';
import { buildDistricts } from '../models/districts.js';
import { buildRoadNetwork, buildTrain } from './roadmesh.js';
import { TREES, WATER, R_WORLD, R_RAIL } from './citymap.js';

const LAMP_RY = -Math.PI / 4;
// Street grid of the playable district (x = const and z = const lines, boundary roads
// included). The districts around it have their own curved network (citymap.js).
export const ROADS = [];
for (let k = -GRID - 1; k <= GRID; k++) ROADS.push((k + 0.5) * CELL);
export const ROADS_X = ROADS;
export const ROADS_Z = ROADS;
/** Road lines that lie inside the playable district (golden briefcases, events). */
export const PLAY_ROADS = ROADS.filter((v) => Math.abs(v) <= PLAY_HALF + 0.1);
/** Avenues that continue out of the district: [line, side] → true (side = ±1 towards the outside). */
const EXITS = new Set(['x|10|1', 'x|-10|1', 'z|10|1', 'z|-10|1', 'z|10|-1', 'z|-10|-1']);
const continues = (axis, v, side) => EXITS.has(`${axis}|${v}|${side}`);

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const groundNoise = (x, z) => Math.sin(x * 0.05) * Math.cos(z * 0.06) + Math.sin(x * 0.13 + z * 0.09) * 0.5;

export function heightAt(x, z) {
  const n = groundNoise(x, z);
  const dCity = Math.max(Math.hypot(x, z) - R_WORLD, 0);
  let h = 0;
  if (dCity > 0) h = smooth(0, 60, dCity) * (2.5 + n * 2.5) + smooth(60, 300, dCity) * 25 * (0.6 + 0.4 * Math.sin(x * 0.01 + z * 0.012));
  for (const w of WATER) {
    const d = Math.hypot((x - w.x) / (w.rx + 4), (z - w.z) / (w.rz + 4));
    if (d < 1) h = Math.min(h, -0.7 * (1 - d * d));
  }
  return h;
}

export function createEnvironment(engine) {
  const { scene, renderer } = engine;
  const root = new THREE.Group();
  scene.add(root);

  // ---------------- Sky & lights ----------------
  const sky = new Sky();
  sky.scale.setScalar(2500);
  const su = sky.material.uniforms;
  su.turbidity.value = 4.5;
  su.rayleigh.value = 1.6;
  su.mieCoefficient.value = 0.004;
  su.mieDirectionalG.value = 0.82;
  scene.add(sky);

  scene.fog = new THREE.FogExp2('#cfe3f2', 0.0019);

  const hemi = new THREE.HemisphereLight('#cfe8ff', '#5c7a3a', 0.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff3dc', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(engine.mobile ? 2048 : 4096, engine.mobile ? 2048 : 4096);
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70;
  sc.near = 10; sc.far = 320;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  sun.target.position.set(0, 0, 5);

  // Stars
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  const r0 = rng(7);
  for (let i = 0; i < 1500; i++) {
    const th = r0() * Math.PI * 2;
    const ph = Math.acos(r0() * 0.95);
    const R = 1100;
    sp.push(R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph), R * Math.sin(ph) * Math.sin(th));
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Moon
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(28, 24, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.0), fog: false, transparent: true })
  );
  scene.add(moon);

  // ---------------- Ground ----------------
  const groundGeo = new THREE.PlaneGeometry(1400, 1400, 160, 160);
  groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position;
  const gcol = new Float32Array(gp.count * 3);
  const c = new THREE.Color();
  const grassA = new THREE.Color('#6dae46');
  const grassB = new THREE.Color('#8cc152');
  const grassC = new THREE.Color('#4f8f3a');
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    const n = groundNoise(x, z);
    gp.setY(i, heightAt(x, z) - 0.02);
    c.copy(grassA).lerp(grassB, 0.5 + n * 0.35);
    if (n < -0.6) c.lerp(grassC, 0.5);
    gcol[i * 3] = c.r; gcol[i * 3 + 1] = c.g; gcol[i * 3 + 2] = c.b;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(gcol, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  root.add(ground);

  // ---------------- Streets: asphalt carriageways, raised sidewalks, markings ----------------
  const paveTex = makePavingTexture(renderer);
  const span = 2 * PLAY_HALF + CARRIAGE;
  const H_ASPH = 0.06;
  const asphMain = [], asphSec = [], walks = [], curbs = [], marks = [];
  const box = (list, x, y, z, w, h, d) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y + h / 2, z);
    list.push(g);
  };
  const half = ROAD_W / 2, ch = CARRIAGE / 2, sw = (ROAD_W - CARRIAGE) / 2;
  for (const v of ROADS) {
    const main = isMainRoad(v);
    box(main ? asphMain : asphSec, 0, 0, v, span, H_ASPH, CARRIAGE);
    box(main ? asphMain : asphSec, v, 0, 0, CARRIAGE, H_ASPH, span);
  }
  // sidewalks run between intersections; corner squares join them
  const last = ROADS.length - 1;
  for (const v of ROADS) {
    // outer side of the boundary roads: one continuous sidewalk, open only where an avenue leaves
    const edge = v === ROADS[0] ? -1 : v === ROADS[last] ? 1 : 0;
    if (edge) {
      const off = v + edge * (ch + sw / 2), coff = v + edge * (ch + 0.06);
      for (const horiz of [true, false]) {
        // horiz: road z = v (its sidewalk runs along x), open where an avenue x = w leaves the district
        const cuts = [-PLAY_HALF - ch - sw, ...ROADS.filter((w) => continues(horiz ? 'x' : 'z', w, edge)).flatMap((w) => [w - ch, w + ch]), PLAY_HALF + ch + sw];
        for (let q = 0; q < cuts.length; q += 2) {
          const len = cuts[q + 1] - cuts[q], mid = (cuts[q] + cuts[q + 1]) / 2;
          if (horiz) { box(walks, mid, 0, off, len, ROAD_Y, sw); box(curbs, mid, 0, coff, len, ROAD_Y + 0.02, 0.12); }
          else { box(walks, off, 0, mid, sw, ROAD_Y, len); box(curbs, coff, 0, mid, 0.12, ROAD_Y + 0.02, len); }
        }
      }
    }
    for (let k = 0; k < ROADS.length - 1; k++) {
      const a0 = ROADS[k] + ch, a1 = ROADS[k + 1] - ch, len = a1 - a0, mid = (a0 + a1) / 2;
      for (const side of [-1, 1]) {
        if (side === edge) continue;
        const off = v + side * (ch + sw / 2);
        box(walks, mid, 0, off, len, ROAD_Y, sw);
        box(walks, off, 0, mid, sw, ROAD_Y, len);
        box(curbs, mid, 0, v + side * (ch + 0.06), len, ROAD_Y + 0.02, 0.12);
        box(curbs, v + side * (ch + 0.06), 0, mid, 0.12, ROAD_Y + 0.02, len);
      }
    }
  }
  for (const x of ROADS) for (const z of ROADS) {
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const cx = x + sx * (ch + sw / 2), cz = z + sz * (ch + sw / 2);
      if (Math.abs(cx) > PLAY_HALF + ch || Math.abs(cz) > PLAY_HALF + ch) continue; // drawn by the outer sidewalk
      box(walks, cx, 0, cz, sw, ROAD_Y, sw);
    }
  }
  // markings: dashed centre line on main roads, zebra crossings at every intersection
  for (const v of ROADS) {
    const main = isMainRoad(v);
    for (let k = 0; k < ROADS.length - 1; k++) {
      const a0 = ROADS[k] + half + 0.6, a1 = ROADS[k + 1] - half - 0.6;
      if (main) for (let t = a0 + 1; t < a1 - 1; t += 3) { box(marks, t, H_ASPH, v, 1.6, 0.012, 0.16); box(marks, v, H_ASPH, t, 0.16, 0.012, 1.6); }
    }
    for (const w of ROADS) {
      // crossings on the arms of intersection (v, w) that lead somewhere
      for (const side of [-1, 1]) {
        const out = Math.abs(v) === PLAY_HALF && Math.sign(v) === side;
        for (let q = -1.5; q <= 1.5; q += 0.75) {
          if (!out || continues('z', w, side)) box(marks, v + side * (half + 0.5), H_ASPH, w + q, 0.9, 0.012, 0.38);
          if (!out || continues('x', w, side)) box(marks, w + q, H_ASPH, v + side * (half + 0.5), 0.38, 0.012, 0.9);
        }
      }
    }
  }
  const mk = (list, mat) => { const m = new THREE.Mesh(mergeBoxes(list), mat); m.receiveShadow = true; root.add(m); return m; };
  mk(asphMain, new THREE.MeshStandardMaterial({ color: '#4a4f57', roughness: 0.95 }));
  mk(asphSec, new THREE.MeshStandardMaterial({ color: '#61666e', roughness: 0.95 }));
  const walkMesh = mk(walks, new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.9 }));
  const wp = walkMesh.geometry.attributes.position, wuv = walkMesh.geometry.attributes.uv;
  for (let i = 0; i < wp.count; i++) wuv.setXY(i, wp.getX(i) / 2.2, wp.getZ(i) / 2.2);
  mk(curbs, new THREE.MeshStandardMaterial({ color: '#c9c3b8', roughness: 0.8 }));
  mk(marks, new THREE.MeshStandardMaterial({ color: '#f1f3f5', roughness: 0.7 }));

  // ---------------- Districts around the playable city ----------------
  const network = buildRoadNetwork(renderer, paveTex);
  root.add(network.group);
  const districts = buildDistricts();
  root.add(districts.group);
  const street = buildStreetscape();
  root.add(street);
  const train = buildTrain();
  root.add(train);

  // ---------------- Street lamps (instanced) ----------------
  const lampPos = [];
  const rl = rng(77);
  const lampOff = ROAD_W / 2 - 0.35;
  for (const v of ROADS) {
    const main = isMainRoad(v);
    for (let k = 0; k < ROADS.length - 1; k++) {
      const a0 = ROADS[k] + 4, a1 = ROADS[k + 1] - 4;
      const step = main ? 7 : 12;
      for (let t = a0 + (main ? 0 : rl() * 4); t <= a1; t += step) {
        for (const side of main ? [-1, 1] : [rl() < 0.5 ? -1 : 1]) {
          // horizontal street (z = v) and vertical street (x = v); arm points at the carriageway
          if (!(Math.abs(v) === PLAY_HALF && Math.sign(v) === side)) lampPos.push([t, v + side * lampOff, side > 0 ? -Math.PI / 2 : Math.PI / 2]);
          if ((main || rl() < 0.6) && !(Math.abs(v) === PLAY_HALF && Math.sign(v) === side)) lampPos.push([v + side * lampOff, t, side > 0 ? 0 : Math.PI]);
        }
      }
    }
  }
  lampPos.push(...network.lamps);
  const lb = new MeshBuilder();
  lb.cyl(0.22, 0.3, 0.4, '#2b2f36', { mat: 'metal' }, 7);
  lb.cyl(0.08, 0.11, 4.6, '#2b2f36', { mat: 'metal' }, 6);
  lb.box(1.1, 0.08, 0.08, '#2b2f36', { x: -0.5, y: 4.55, mat: 'metal', sharp: true });
  lb.cyl(0.25, 0.35, 0.3, '#2b2f36', { x: -1.0, y: 4.35, mat: 'metal' }, 8);
  const lampProto = lb.build();
  const lb2 = new MeshBuilder();
  lb2.sphere(0.24, '#fff0c8', { x: -1.0, y: 4.3, mat: 'lit' }, 8, 6);
  const bulbProto = lb2.build({ castShadow: false });
  // Light pools on the ground at night
  const poolTex = makeRadialTexture('#ffd59a');
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const poolGeo = new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2);
  // ~1000 lamps: instanced per 180 m cell so off-screen / distant cells are skipped
  const dummy = new THREE.Object3D();
  const LCH = 180;
  const lampCells = new Map();
  for (const l of lampPos) {
    const key = `${Math.floor(l[0] / LCH)},${Math.floor(l[1] / LCH)}`;
    if (!lampCells.has(key)) lampCells.set(key, []);
    lampCells.get(key).push(l);
  }
  const lampChunks = [];
  const _off = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  for (const list of lampCells.values()) {
    const lamp = toInstanced(lampProto.children[0], list.length);
    const bulb = toInstanced(bulbProto.children[0], list.length);
    const pool = new THREE.InstancedMesh(poolGeo, poolMat, list.length);
    const center = new THREE.Vector3();
    list.forEach(([x, z, ry], i) => {
      dummy.position.set(x, ROAD_Y, z);
      dummy.rotation.set(0, ry, 0);
      dummy.updateMatrix();
      lamp.setMatrixAt(i, dummy.matrix);
      bulb.setMatrixAt(i, dummy.matrix);
      _off.set(-1.0, 0, 0).applyAxisAngle(_up, ry);
      dummy.position.set(x + _off.x, ROAD_Y + 0.03, z + _off.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      pool.setMatrixAt(i, dummy.matrix);
      center.x += x; center.z += z;
    });
    center.divideScalar(list.length);
    let radius = 0;
    for (const [x, z] of list) radius = Math.max(radius, Math.hypot(x - center.x, z - center.z));
    for (const m of [lamp, bulb, pool]) { m.computeBoundingSphere(); root.add(m); }
    pool.renderOrder = 2;
    lampChunks.push({ lamp, bulb, pool, center, radius, visible: true });
  }

  // ---------------- Trees (forests, parks, gardens, countryside) ----------------
  const r = rng(1234);
  const treeSpots = TREES;

  // Vegetation is split into spatial cells (one set of InstancedMeshes per cell) so each
  // cell can be frustum-culled, switched to a low-poly LOD and hidden beyond the draw distance.
  const geos = {
    trunk: [new THREE.CylinderGeometry(0.28, 0.42, 2.6, 10).translate(0, 1.3, 0), new THREE.CylinderGeometry(0.28, 0.42, 2.6, 5).translate(0, 1.3, 0)],
    crown: [mergeBlobs([[0, 3.9, 0, 2.0], [0.9, 3.3, 0.6, 1.3], [-0.8, 3.4, -0.5, 1.2], [0.1, 5.0, -0.2, 1.3]], 1),
      mergeBlobs([[0, 3.9, 0, 2.0], [0.9, 3.3, 0.6, 1.3], [-0.8, 3.4, -0.5, 1.2], [0.1, 5.0, -0.2, 1.3]], 0)],
    pine: [new THREE.ConeGeometry(1.9, 5.5, 10).translate(0, 4.4, 0), new THREE.ConeGeometry(1.9, 5.5, 6).translate(0, 4.4, 0)],
    pine2: [new THREE.ConeGeometry(1.4, 3.6, 10).translate(0, 6.6, 0), new THREE.ConeGeometry(1.4, 3.6, 6).translate(0, 6.6, 0)],
  };
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
  const leafColors = ['#3f8f3a', '#4ca346', '#5cb84a', '#2f7a35', '#7cbf3f', '#3a7d44'];
  const pineColors = ['#2d6a4f', '#1b4332', '#40916c', '#2f5d3a'];
  const CHUNK = 110;
  const chunkMap = new Map();
  treeSpots.forEach(([x, z, kind, scale]) => {
    const s = scale * (0.9 + r() * 0.5);
    dummy.position.set(x, heightAt(x, z) - 0.1, z);
    dummy.rotation.set(0, r() * Math.PI * 2, 0);
    dummy.scale.set(s, s * (0.9 + r() * 0.3), s);
    dummy.updateMatrix();
    const round = kind === 'round';
    const color = new THREE.Color(round ? leafColors[Math.floor(r() * leafColors.length)] : pineColors[Math.floor(r() * pineColors.length)]);
    const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    if (!chunkMap.has(key)) chunkMap.set(key, []);
    chunkMap.get(key).push({ m: dummy.matrix.clone(), round, color });
  });
  const vegetation = [];
  for (const trees of chunkMap.values()) {
    const rounds = trees.filter((t) => t.round);
    const pinesL = trees.filter((t) => !t.round);
    const meshes = [];
    const make = (kind, list, mat, colorMul = 1) => {
      if (!list.length) return;
      const m = new THREE.InstancedMesh(geos[kind][0], mat, list.length);
      list.forEach((t, k) => {
        m.setMatrixAt(k, t.m);
        if (mat === leafMat) m.setColorAt(k, colorMul === 1 ? t.color : t.color.clone().multiplyScalar(colorMul));
      });
      m.computeBoundingSphere();
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.kind = kind;
      root.add(m);
      meshes.push(m);
    };
    make('trunk', trees, trunkMat);
    make('crown', rounds, leafMat);
    make('pine', pinesL, leafMat);
    make('pine2', pinesL, leafMat, 1.12);
    const center = new THREE.Vector3();
    trees.forEach((t) => center.add(new THREE.Vector3().setFromMatrixPosition(t.m)));
    center.divideScalar(trees.length);
    let radius = 0;
    trees.forEach((t) => { radius = Math.max(radius, center.distanceTo(new THREE.Vector3().setFromMatrixPosition(t.m))); });
    // trees far from the city never fall inside the (view-fitted) shadow frustum
    const nearCity = center.length() - radius < 200;
    meshes.forEach((m) => { m.castShadow = nearCity; });
    vegetation.push({ meshes, center, radius, low: false, visible: true });
  }
  const vegStats = { chunks: vegetation.length, visible: 0, low: 0 };
  let vegDist = 600;
  let cityNear = 170;
  let treeNear = 160;
  function updateVegetation(camPos) {
    let vis = 0, low = 0;
    for (const c of vegetation) {
      const d = Math.hypot(c.center.x - camPos.x, c.center.z - camPos.z) - c.radius;
      const visible = d < vegDist;
      // hysteresis band so cells do not flip back and forth
      const wantLow = c.low ? d > treeNear - 10 : d > treeNear + 10;
      if (visible !== c.visible) { c.visible = visible; c.meshes.forEach((m) => { m.visible = visible; }); }
      if (wantLow !== c.low) {
        c.low = wantLow;
        c.meshes.forEach((m) => { m.geometry = geos[m.userData.kind][wantLow ? 1 : 0]; });
      }
      if (visible) { vis++; if (c.low) low++; }
    }
    vegStats.visible = vis;
    vegStats.low = low;
    for (const c of lampChunks) {
      const d = Math.hypot(c.center.x - camPos.x, c.center.z - camPos.z) - c.radius;
      const visible = d < Math.max(160, vegDist * 0.7);
      if (visible !== c.visible) { c.visible = visible; c.lamp.visible = c.bulb.visible = visible; }
      c.lamp.castShadow = d < 40;
      c.pool.visible = visible && night > 0.02;
    }
  }

  // rocks scattered in the countryside
  const deco = new MeshBuilder();
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = R_WORLD + 10 + r() * 140;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    deco.blob(0.6 + r() * 1.4, ['#8d939b', '#a3a9b0', '#7b8189'][i % 3], { x, y: heightAt(x, z) + 0.2, z, sy: 0.6, ry: r() * 3 }, 1);
  }
  root.add(deco.build());

  // Distant mountains
  const mb = new MeshBuilder();
  const rm = rng(99);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rm() * 0.2;
    const d = 520 + rm() * 160;
    const h = 90 + rm() * 140;
    const rad = 90 + rm() * 80;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    mb.cone(rad, h, ['#6b8f71', '#7d9a84', '#8aa39a', '#5f7f6a'][i % 4], { x, y: -5, z, ry: rm() * 3 }, 7);
    mb.cone(rad * 0.32, h * 0.32, '#f4f6f8', { x, y: -5 + h * 0.68, z }, 7);
  }
  const mountains = mb.build({ castShadow: false, receiveShadow: false });
  mountains.children.forEach((m) => { m.material = m.material.clone(); m.material.flatShading = true; });
  root.add(mountains);

  // Clouds
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.95 });
  const rc = rng(5);
  for (let i = 0; i < 14; i++) {
    const cb = new MeshBuilder();
    const n = 4 + Math.floor(rc() * 4);
    for (let k = 0; k < n; k++) {
      cb.blob(4 + rc() * 4, '#ffffff', { x: (k - n / 2) * 4.5, y: rc() * 2, z: (rc() - 0.5) * 5, sy: 0.65 }, 2);
    }
    const cg = cb.build({ castShadow: false, receiveShadow: false });
    cg.children.forEach((m) => { m.material = cloudMat; });
    cg.position.set((rc() - 0.5) * 600, 80 + rc() * 40, (rc() - 0.5) * 500);
    cg.userData.speed = 1.5 + rc() * 2.5;
    root.add(cg);
    clouds.push(cg);
  }

  // ---------------- Day / night update ----------------
  const sunDir = new THREE.Vector3();
  const fogDay = new THREE.Color('#cfe3f2');
  const fogDusk = new THREE.Color('#f2b38a');
  const fogNight = new THREE.Color('#0c1630');
  const sunColDay = new THREE.Color('#fff3dc');
  const sunColDusk = new THREE.Color('#ffb070');
  const moonCol = new THREE.Color('#9fb8ff');
  const tmp = new THREE.Color();
  let night = 0;
  let poolsOn = true;

  // ---------------- Shadows fitted to the view ----------------
  // The shadow frustum follows the camera focus and shrinks when zooming in, so the
  // same map resolution gives sharper shadows and far, off-screen casters are culled.
  let shadowRange = 1;
  let frame = 0;
  const focusSnap = new THREE.Vector3();
  function fitShadows(focus, camDist) {
    const half = Math.min(95, Math.max(26, Math.round((camDist * 0.62 * shadowRange) / 4) * 4));
    const texel = (2 * half) / sun.shadow.mapSize.x;
    focusSnap.set(Math.round(focus.x / texel) * texel, 0, Math.round(focus.z / texel) * texel);
    sun.target.position.copy(focusSnap);
    if (sc.right !== half) {
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
      sc.updateProjectionMatrix();
    }
  }

  function setShadowQuality(size, soft, range) {
    shadowRange = range;
    const typeChanged = renderer.shadowMap.type !== (soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap);
    renderer.shadowMap.type = soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    if (typeChanged) scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }

  function update(dt, tod, time, view) {
    frame++;
    if (view) {
      fitShadows(view.focus, view.distance);
      if (frame % 15 === 0) updateVegetation(view.camera);
    }
    // tod: 0..1, 0.25 sunrise, 0.5 noon, 0.75 sunset (biased toward day)
    const a = (tod - 0.25) * Math.PI * 2;
    const elev = Math.sin(a) * 62 + 14; // degrees
    const az = 200 + Math.cos(a) * 70;
    const phi = THREE.MathUtils.degToRad(90 - elev);
    const theta = THREE.MathUtils.degToRad(az);
    sunDir.setFromSphericalCoords(1, phi, theta);
    su.sunPosition.value.copy(sunDir);

    const day = smooth(-6, 12, elev);
    const dusk = (1 - smooth(4, 26, elev)) * smooth(-8, 4, elev);
    night = 1 - smooth(-10, 4, elev);

    if (elev > -4) {
      sun.position.copy(sunDir).multiplyScalar(160).add(sun.target.position);
      tmp.copy(sunColDay).lerp(sunColDusk, dusk);
      sun.color.copy(tmp);
      sun.intensity = 3.1 * day + 0.25;
    } else {
      // moonlight
      sun.position.copy(sunDir).multiplyScalar(-160).add(sun.target.position);
      sun.position.y = Math.abs(sun.position.y) + 60;
      sun.color.copy(moonCol);
      sun.intensity = 0.55;
    }
    hemi.intensity = 0.3 + day * 0.4;
    hemi.color.set('#cfe8ff').lerp(new THREE.Color('#5b6fa8'), night);
    hemi.groundColor.set('#5c7a3a').lerp(new THREE.Color('#1a2238'), night);
    scene.environmentIntensity = 0.1 + day * 0.25;

    tmp.copy(fogDay).lerp(fogDusk, dusk * 0.7).lerp(fogNight, night);
    scene.fog.color.copy(tmp);
    renderer.toneMappingExposure = 0.7 + day * 0.2 + night * 0.25;

    starMat.opacity = night * 0.95;
    stars.rotation.y += dt * 0.004;
    moon.position.copy(sunDir).multiplyScalar(-1000);
    moon.position.y = Math.abs(moon.position.y) * 0.7 + 180;
    moon.material.opacity = night;
    moon.visible = night > 0.02;

    poolMat.opacity = night * 0.55;
    if ((night > 0.02) !== poolsOn) { poolsOn = night > 0.02; for (const c of lampChunks) c.pool.visible = poolsOn && c.visible; }
    setNightLevel(night);

    for (const cl of clouds) {
      cl.position.x += cl.userData.speed * dt;
      if (cl.position.x > 340) cl.position.x = -340;
    }
    train.rotation.y = -time * (13 / R_RAIL);
    if (view && frame % 10 === 0) districts.update(view.camera, cityNear);
  }

  return {
    update, sun, setShadowQuality, vegStats,
    setVegetationDistance(d) { vegDist = d; cityNear = Math.min(260, Math.max(80, d * 0.32)); treeNear = Math.min(170, Math.max(70, d * 0.3)); frame = 9; },
    setClouds(on) { clouds.forEach((c) => { c.visible = on; }); },
    get night() { return night; },
  };
}

// ---------------------------------------------------------------------------
function mergeBoxes(list) {
  let total = 0, idxTotal = 0;
  for (const g of list) { total += g.attributes.position.count; idxTotal += g.index.count; }
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const idx = new Uint32Array(idxTotal);
  let vo = 0, io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count;
    io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// ---------------------------------------------------------------------------
// Street life: irregular street trees, benches, bins, bus stops, parked cars and flower
// beds along the road edges (kept to the outer 0.6 m so pedestrians walk freely).
// ---------------------------------------------------------------------------
function buildStreetscape() {
  const r = rng(4242);
  const group = new THREE.Group();
  const EDGE = ROAD_W / 2 - 0.4;
  const trees = [];
  const props = new MeshBuilder({ lod: 1 });
  const carColors = ['#e0573f', '#4b8fd8', '#f2c14e', '#f8f9fa', '#2e3440', '#3bb3a8', '#8b5cf6'];
  // Tree-lined avenues: every third road line in each direction. Trees always stand in a
  // continuous grass strip with curbs; ordinary streets only get street furniture.
  const isAvenue = (idx) => isMainRoad(ROADS[idx]);
  ROADS.forEach((v, idx) => {
    for (let k = 0; k < ROADS.length - 1; k++) {
      const a = ROADS[k] + 3.2, b = ROADS[k + 1] - 3.2; // segment between two intersections
      for (const horizontal of [true, false]) {
        const ry = horizontal ? 0 : Math.PI / 2;
        if (isAvenue(idx)) {
          const len = b - a, mid = (a + b) / 2;
          for (const side of [-1, 1]) {
            const off = v + side * EDGE;
            props.group({ x: horizontal ? mid : off, z: horizontal ? off : mid, ry }, () => {
              props.box(len, 0.08, 0.8, '#6fae3d', { y: ROAD_Y - 0.02, sharp: true });
              props.box(len, 0.12, 0.08, '#c9c3b8', { y: ROAD_Y - 0.02, z: 0.44, sharp: true });
              props.box(len, 0.12, 0.08, '#c9c3b8', { y: ROAD_Y - 0.02, z: -0.44, sharp: true });
              for (let q = 0; q < len / 2.2; q++) if (r() < 0.35) props.sphere(0.07, ['#ffffff', '#ffd43b', '#ff8fab'][q % 3], { x: -len / 2 + q * 2.2 + r(), y: ROAD_Y + 0.08, z: (r() - 0.5) * 0.5 }, 5, 3);
            });
            const n = Math.max(1, Math.round(len / 6));
            for (let q = 0; q < n; q++) {
              const t = a + (q + 0.5) * (len / n) + (r() - 0.5) * 0.6;
              trees.push([horizontal ? t : off, horizontal ? off : t, 0.75 + r() * 0.3, r()]);
            }
          }
          continue;
        }
        const side = r() < 0.5 ? 1 : -1;
        let t = a + r() * 3;
        while (t < b) {
          const roll = r();
          const x = horizontal ? t : v + side * EDGE;
          const z = horizontal ? v + side * EDGE : t;
          const fy = horizontal ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
          if (roll < 0.22) props.group({ x, z, ry: fy }, () => {
            for (const bx of [-0.7, 0.7]) props.box(0.1, 0.45, 0.4, '#2e3440', { x: bx, y: ROAD_Y, sharp: true });
            for (let q = 0; q < 3; q++) props.box(1.8, 0.07, 0.14, '#c98a4b', { y: ROAD_Y + 0.45, z: -0.14 + q * 0.14, r: 0.03 });
            props.box(1.8, 0.35, 0.06, '#c98a4b', { y: ROAD_Y + 0.6, z: 0.2, r: 0.03 });
          });
          else if (roll < 0.36) props.group({ x, z, ry: fy }, () => {
            props.cyl(0.22, 0.2, 0.75, '#3f8f45', { y: ROAD_Y }, 10);
            props.cyl(0.24, 0.24, 0.08, '#2e3440', { y: ROAD_Y + 0.75 }, 10);
          });
          else if (roll < 0.48) props.group({ x, z, ry: fy }, () => {
            props.box(2.2, 0.4, 0.7, '#b9ad98', { y: ROAD_Y, r: 0.12 });
            props.box(2.0, 0.06, 0.55, '#5b3a1e', { y: ROAD_Y + 0.36, sharp: true });
            for (let q = 0; q < 5; q++) props.blob(0.24, ['#ff6b9a', '#ffd43b', '#ffffff', '#b197fc', '#ff922b'][q], { x: -0.8 + q * 0.4, y: ROAD_Y + 0.5, z: (q % 2) * 0.15 - 0.07 }, 1);
          });
          else if (roll < 0.54) props.group({ x, z, ry: fy }, () => {
            props.box(2.6, 0.1, 0.9, '#5f6875', { y: ROAD_Y + 2.3, r: 0.04 });
            props.box(0.08, 2.3, 0.08, '#5f6875', { x: -1.2, y: ROAD_Y, z: 0.35, sharp: true });
            props.box(0.08, 2.3, 0.08, '#5f6875', { x: 1.2, y: ROAD_Y, z: 0.35, sharp: true });
            props.box(2.4, 1.6, 0.04, '#cfe6ef', { y: ROAD_Y + 0.5, z: 0.4, mat: 'glass', sharp: true });
            props.box(1.6, 0.1, 0.3, '#c98a4b', { y: ROAD_Y + 0.45, z: 0.15, r: 0.03 });
            props.box(0.6, 0.6, 0.06, '#f2c14e', { x: 1.0, y: ROAD_Y + 2.45, z: 0.4, mat: 'lit', sharp: true });
          });
          else if (roll < 0.7) props.group({ x: horizontal ? t : v + side * 1.25, z: horizontal ? v + side * 1.25 : t, y: 0.06 - ROAD_Y, ry }, () => {
            const col = carColors[(r() * carColors.length) | 0];
            props.rbox(3.4, 0.8, 1.6, 0.35, col, { y: ROAD_Y + 0.3, mat: 'soft' });
            props.rbox(1.9, 0.72, 1.45, 0.32, '#bfe3ff', { x: -0.2, y: ROAD_Y + 0.95, mat: 'glass' });
            for (const [cx, cz] of [[1.1, 0.75], [-1.1, 0.75], [1.1, -0.75], [-1.1, -0.75]]) props.cyl(0.36, 0.36, 0.26, '#22262d', { x: cx, y: ROAD_Y + 0.36, z: cz - Math.sign(cz) * 0.13, rx: Math.PI / 2 }, 10);
          });
          t += 4 + r() * 7;
        }
      }
    }
  });
  group.add(props.build());
  // street trees (instanced), each slightly different
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 2.2, 7).translate(0, 1.1, 0);
  const crownGeo = mergeBlobs([[0, 3.0, 0, 1.25], [0.5, 2.6, 0.3, 0.8], [-0.45, 2.7, -0.3, 0.75]], 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 1 }), trees.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), trees.length);
  const d = new THREE.Object3D();
  const greens = ['#4ca346', '#5cb84a', '#3f8f3a', '#7cbf3f', '#6aa84f'];
  trees.forEach(([x, z, s, q], i) => {
    d.position.set(x, ROAD_Y, z);
    d.rotation.set(0, q * 6, 0);
    d.scale.set(s, s * (0.9 + q * 0.3), s);
    d.updateMatrix();
    trunks.setMatrixAt(i, d.matrix);
    crowns.setMatrixAt(i, d.matrix);
    crowns.setColorAt(i, new THREE.Color(greens[Math.floor(q * greens.length)]));
  });
  for (const m of [trunks, crowns]) { m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); group.add(m); }
  return group;
}

function mergeBlobs(list, detail = 2) {
  const geos = list.map(([x, y, z, r]) => {
    const g = new THREE.IcosahedronGeometry(r, detail);
    g.translate(x, y, z);
    return g;
  });
  const merged = mergeBoxes(geos.map((g) => {
    const idx = [];
    for (let i = 0; i < g.attributes.position.count; i++) idx.push(i);
    g.setIndex(idx);
    return g;
  }));
  return merged;
}

function toInstanced(mesh, count) {
  const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, count);
  inst.castShadow = mesh.castShadow;
  inst.receiveShadow = true;
  return inst;
}

function makePavingTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8f8473';
  g.fillRect(0, 0, 256, 256);
  const r = rng(3);
  const rows = 4, cols = 4;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const off = y % 2 ? 32 : 0;
      const l = 58 + r() * 12;
      g.fillStyle = `hsl(${32 + r() * 10}, ${16 + r() * 10}%, ${l}%)`;
      const px = x * 64 + off, py = y * 64;
      g.fillRect(px + 3, py + 3, 58, 58);
      if (px + 64 > 256) g.fillRect(px - 256 + 3, py + 3, 58, 58);
      for (let k = 0; k < 30; k++) {
        g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
        g.fillRect(px + 3 + r() * 56, py + 3 + r() * 56, 2, 2);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

export function makeRadialTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, color);
  grd.addColorStop(0.4, color + '88');
  grd.addColorStop(1, color + '00');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

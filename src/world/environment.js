import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { MeshBuilder, rng } from '../models/builder.js';
import { setNightLevel } from '../models/materials.js';
import { CELL, GRID, ROAD_Y } from '../game/config.js';

const ROAD_W = CELL - 13;
const LAMP_RY = -Math.PI / 4;
export const ROADS_X = [];
export const ROADS_Z = [];
for (let i = -GRID; i < GRID; i++) ROADS_X.push((i + 0.5) * CELL);
for (let j = -GRID; j <= GRID; j++) ROADS_Z.push((j + 0.5) * CELL);
export const CITY_MIN_X = -(GRID + 0.5) * CELL;
export const CITY_MAX_X = (GRID + 0.5) * CELL;
export const CITY_MIN_Z = -(GRID + 0.5) * CELL;
export const CITY_MAX_Z = (GRID + 0.5) * CELL + ROAD_W / 2;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const groundNoise = (x, z) => Math.sin(x * 0.05) * Math.cos(z * 0.06) + Math.sin(x * 0.13 + z * 0.09) * 0.5;

export function heightAt(x, z) {
  const n = groundNoise(x, z);
  const dCity = Math.max(Math.abs(x) - 55, z < 0 ? -z - 52 : z - 62, 0);
  let h = 0;
  if (dCity > 0) h = smooth(0, 60, dCity) * (2.5 + n * 2.5) + smooth(120, 400, dCity) * 25 * (0.6 + 0.4 * Math.sin(x * 0.01 + z * 0.012));
  const pd = Math.hypot(x + 82, z - 8);
  if (pd < 30) h = Math.min(h, -0.6 * (1 - pd / 30) + h * (pd / 30));
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

  // ---------------- Walkways (paved) ----------------
  const paveTex = makePavingTexture(renderer);
  const wb = [];
  const addStrip = (x, z, w, d) => {
    const g = new THREE.BoxGeometry(w, ROAD_Y, d);
    g.translate(x, ROAD_Y / 2, z);
    wb.push(g);
  };
  for (const z of ROADS_Z) addStrip(0, z, CITY_MAX_X - CITY_MIN_X + ROAD_W, ROAD_W);
  const lastZ = ROADS_Z[ROADS_Z.length - 1];
  for (const x of ROADS_X) addStrip(x, (CITY_MIN_Z + lastZ) / 2, ROAD_W, lastZ - CITY_MIN_Z + ROAD_W);
  // outer rings
  addStrip(CITY_MIN_X, (CITY_MIN_Z + CITY_MAX_Z) / 2, ROAD_W, CITY_MAX_Z - CITY_MIN_Z + 2);
  addStrip(CITY_MAX_X, (CITY_MIN_Z + CITY_MAX_Z) / 2, ROAD_W, CITY_MAX_Z - CITY_MIN_Z + 2);
  addStrip(0, CITY_MIN_Z, CITY_MAX_X - CITY_MIN_X + ROAD_W, ROAD_W);
  const roadsGeo = mergeBoxes(wb);
  const pos = roadsGeo.attributes.position;
  const uv = roadsGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 3, pos.getZ(i) / 3);
  const roads = new THREE.Mesh(roadsGeo, new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.9, color: '#ffffff' }));
  roads.receiveShadow = true;
  root.add(roads);

  // ---------------- Street lamps (instanced) ----------------
  const lampPos = [];
  for (const x of [CITY_MIN_X, ...ROADS_X, CITY_MAX_X]) {
    for (const z of [CITY_MIN_Z, ...ROADS_Z]) {
      lampPos.push([x + 2.0, z + 2.0]);
    }
  }
  const lb = new MeshBuilder();
  lb.cyl(0.22, 0.3, 0.4, '#2b2f36', { mat: 'metal' }, 10);
  lb.cyl(0.08, 0.11, 4.6, '#2b2f36', { mat: 'metal' }, 8);
  lb.box(1.1, 0.08, 0.08, '#2b2f36', { x: -0.5, y: 4.55, mat: 'metal' });
  lb.cyl(0.25, 0.35, 0.3, '#2b2f36', { x: -1.0, y: 4.35, mat: 'metal' }, 10);
  const lampProto = lb.build();
  const lb2 = new MeshBuilder();
  lb2.sphere(0.24, '#fff0c8', { x: -1.0, y: 4.3, mat: 'lit' }, 10, 8);
  const bulbProto = lb2.build({ castShadow: false });
  const lampMesh = toInstanced(lampProto.children[0], lampPos.length);
  const bulbMesh = toInstanced(bulbProto.children[0], lampPos.length);
  const dummy = new THREE.Object3D();
  lampPos.forEach(([x, z], i) => {
    dummy.position.set(x, ROAD_Y, z);
    dummy.rotation.y = LAMP_RY;
    dummy.updateMatrix();
    lampMesh.setMatrixAt(i, dummy.matrix);
    bulbMesh.setMatrixAt(i, dummy.matrix);
  });
  root.add(lampMesh, bulbMesh);

  // Light pools on the ground at night
  const poolTex = makeRadialTexture('#ffd59a');
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const poolMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), poolMat, lampPos.length);
  lampPos.forEach(([x, z], i) => {
    const off = new THREE.Vector3(-1.0, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), LAMP_RY);
    dummy.position.set(x + off.x, ROAD_Y + 0.03, z + off.z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poolMesh.setMatrixAt(i, dummy.matrix);
  });
  poolMesh.renderOrder = 2;
  root.add(poolMesh);

  // ---------------- Trees, rocks, flowers ----------------
  const r = rng(1234);
  const treeSpots = [];
  const tryPlace = (x, z) => {
    if (x > CITY_MIN_X - 6 && x < CITY_MAX_X + 6 && z > CITY_MIN_Z - 6 && z < CITY_MAX_Z + 6) return false;
    if (Math.hypot(x + 82, z - 8) < 26) return false;
    treeSpots.push([x, z]);
    return true;
  };
  // dense belt around the city
  for (let i = 0; i < 900 && treeSpots.length < 520; i++) {
    const a = r() * Math.PI * 2;
    const d = 62 + Math.pow(r(), 1.6) * 190;
    tryPlace(Math.cos(a) * d * 1.05, 6 + Math.sin(a) * d);
  }

  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.4, 6).translate(0, 1.2, 0);
  const crownGeo = new THREE.IcosahedronGeometry(2, 0).translate(0, 3.8, 0);
  crownGeo.computeVertexNormals();
  const pineGeo = new THREE.ConeGeometry(1.9, 5.5, 7).translate(0, 4.4, 0);
  const pine2Geo = new THREE.ConeGeometry(1.4, 3.6, 7).translate(0, 6.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true });
  const nRound = Math.floor(treeSpots.length * 0.55);
  const nPine = treeSpots.length - nRound;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, leafMat, nRound);
  const pines = new THREE.InstancedMesh(pineGeo, leafMat, nPine);
  const pines2 = new THREE.InstancedMesh(pine2Geo, leafMat, nPine);
  const leafColors = ['#3f8f3a', '#4ca346', '#5cb84a', '#2f7a35', '#7cbf3f', '#3a7d44'];
  const pineColors = ['#2d6a4f', '#1b4332', '#40916c', '#2f5d3a'];
  treeSpots.forEach(([x, z], i) => {
    const s = 0.8 + r() * 0.9;
    dummy.position.set(x, heightAt(x, z) - 0.1, z);
    dummy.rotation.set(0, r() * Math.PI * 2, 0);
    dummy.scale.set(s, s * (0.9 + r() * 0.3), s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    if (i < nRound) {
      crowns.setMatrixAt(i, dummy.matrix);
      crowns.setColorAt(i, new THREE.Color(leafColors[Math.floor(r() * leafColors.length)]));
    } else {
      const k = i - nRound;
      pines.setMatrixAt(k, dummy.matrix);
      pines2.setMatrixAt(k, dummy.matrix);
      const pc = new THREE.Color(pineColors[Math.floor(r() * pineColors.length)]);
      pines.setColorAt(k, pc);
      pines2.setColorAt(k, pc.clone().multiplyScalar(1.12));
    }
  });
  for (const m of [trunks, crowns, pines, pines2]) {
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }

  // Bushes & flowers lining the city edge
  const deco = new MeshBuilder();
  for (let x = CITY_MIN_X - 4; x <= CITY_MAX_X + 4; x += 3.2) {
    for (const z of [CITY_MIN_Z - 4.5, CITY_MAX_Z + 4]) {
      deco.ico(0.9 + r() * 0.5, leafColors[Math.floor(r() * 6)], { x: x + r(), y: 0.5, z: z + r() - 0.5, sy: 0.8 });
      if (r() < 0.5) deco.sphere(0.18, ['#ff6b9a', '#ffd43b', '#ffffff', '#b197fc'][Math.floor(r() * 4)], { x: x + 1.2, y: 0.3, z: z + 1.3 }, 6, 4);
    }
  }
  for (let z = CITY_MIN_Z - 4; z <= CITY_MAX_Z + 4; z += 3.2) {
    for (const x of [CITY_MIN_X - 4.5, CITY_MAX_X + 4.5]) {
      deco.ico(0.9 + r() * 0.5, leafColors[Math.floor(r() * 6)], { x: x + r() - 0.5, y: 0.5, z: z + r(), sy: 0.8 });
    }
  }
  // rocks
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2, d = 70 + r() * 150;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x + 82, z - 8) < 24) continue;
    deco.ico(0.6 + r() * 1.4, ['#8d939b', '#a3a9b0', '#7b8189'][i % 3], { x, y: heightAt(x, z) + 0.2, z, sy: 0.6, ry: r() * 3 });
  }
  // pond rim stones + reeds
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    deco.ico(0.5 + r() * 0.5, '#b0aaa0', { x: -82 + Math.cos(a) * 21, y: 0, z: 8 + Math.sin(a) * 15.5, sy: 0.5 });
    if (i % 3 === 0) deco.cyl(0.05, 0.05, 1.6, '#5a8f3a', { x: -82 + Math.cos(a) * 19, y: -0.3, z: 8 + Math.sin(a) * 14 }, 4);
  }
  // wooden dock
  deco.box(3, 0.2, 8, '#9c6b3f', { x: -64, y: 0.3, z: 8, ry: Math.PI / 2 });
  for (let i = 0; i < 4; i++) deco.cyl(0.15, 0.15, 1.2, '#6f4627', { x: -61 - i * 2.4, y: -0.6, z: 6.6 }, 6);
  root.add(deco.build());

  // Pond water
  const waterMat = new THREE.MeshStandardMaterial({ color: '#2f9fc7', roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.9 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), waterMat);
  water.scale.set(21, 1, 15.5);
  water.position.set(-82, 0.05, 8);
  water.receiveShadow = true;
  root.add(water);

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
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, transparent: true, opacity: 0.95 });
  const rc = rng(5);
  for (let i = 0; i < 14; i++) {
    const cb = new MeshBuilder();
    const n = 4 + Math.floor(rc() * 4);
    for (let k = 0; k < n; k++) {
      cb.ico(4 + rc() * 4, '#ffffff', { x: (k - n / 2) * 4.5, y: rc() * 2, z: (rc() - 0.5) * 5, sy: 0.65 }, 1);
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

  function update(dt, tod, time) {
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
    setNightLevel(night);

    for (const cl of clouds) {
      cl.position.x += cl.userData.speed * dt;
      if (cl.position.x > 340) cl.position.x = -340;
    }
    waterMat.color.setHSL(0.55, 0.6, 0.38 + Math.sin(time * 0.8) * 0.01);
  }

  return { update, sun, get night() { return night; } };
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

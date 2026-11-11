// Outils de rendu "cartoon 3D" : matériaux, contours encrés, géométries partagées.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

export const INK_HEX = 0x1b1236;

// Contour encré à épaisseur constante en pixels (technique de la coque inversée,
// extrudée dans l'espace écran). Compatible InstancedMesh.
export const outlineMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uPx: { value: 2.4 },
    uRes: { value: new THREE.Vector2(1280, 720) },
    uColor: { value: new THREE.Color(INK_HEX) },
  },
  vertexShader: /* glsl */ `
    uniform float uPx;
    uniform vec2 uRes;
    void main() {
      vec4 lp = vec4(position, 1.0);
      vec3 ln = normal;
      #ifdef USE_INSTANCING
        lp = instanceMatrix * lp;
        ln = mat3(instanceMatrix) * ln;
      #endif
      vec4 clip = projectionMatrix * modelViewMatrix * lp;
      vec3 vn = normalize(normalMatrix * ln);
      vec2 d = (projectionMatrix * vec4(vn, 0.0)).xy;
      float l = length(d);
      d = l > 1e-5 ? d / l : vec2(0.0);
      clip.xy += d * uPx * 2.0 / uRes * clip.w;
      gl_Position = clip;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    void main() { gl_FragColor = vec4(uColor, 1.0); }`,
  side: THREE.BackSide,
});

export function setOutline(px, renderer) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  outlineMaterial.uniforms.uRes.value.copy(size);
  outlineMaterial.uniforms.uPx.value = px * renderer.getPixelRatio();
}

// Copie de la géométrie avec normales lissées (évite les trous du contour sur les arêtes vives).
const outlineCache = new WeakMap();
export function outlineGeometry(geo) {
  let g = outlineCache.get(geo);
  if (g) return g;
  const pos = geo.attributes.position;
  const map = new Map();
  const verts = [];
  const remap = new Uint32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = verts.length / 3;
      verts.push(x, y, z);
      map.set(key, id);
    }
    remap[i] = id;
  }
  const idx = [];
  if (geo.index) for (let i = 0; i < geo.index.count; i++) idx.push(remap[geo.index.getX(i)]);
  else for (let i = 0; i < pos.count; i++) idx.push(remap[i]);
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  outlineCache.set(geo, g);
  return g;
}

export const GEO = {
  sph: new THREE.SphereGeometry(1, 24, 16),
  sphLo: new THREE.SphereGeometry(1, 12, 9),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cone: new THREE.ConeGeometry(1, 1, 20),
  ico: new THREE.IcosahedronGeometry(1, 0),
};

const cache = new Map();
function cached(key, fn) {
  let g = cache.get(key);
  if (!g) { g = fn(); cache.set(key, g); }
  return g;
}
export const capsule = (r, l) => cached(`cap${r}_${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 16));
export const torus = (R, r, arc = Math.PI * 2) =>
  cached(`tor${R}_${r}_${arc}`, () => new THREE.TorusGeometry(R, r, 10, 32, arc));
export const rbox = (w, h, d, rad = 0.05, seg = 2) =>
  cached(`rb${w}_${h}_${d}_${rad}_${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, rad));
export const lathe = (key, pts, seg = 36) =>
  cached(`la${key}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg));

// Roche facettée (icosaèdre déformé de façon déterministe).
export function rockGeo(seed = 1, amp = 0.12) {
  return cached(`rock${seed}_${amp}`, () => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const h = Math.sin(x * 12.9898 * seed + y * 78.233 + z * 37.719) * 43758.5453;
      const n = 1 + (h - Math.floor(h) - 0.5) * amp * 2;
      p.setXYZ(i, x * n, y * n, z * n);
    }
    g.computeVertexNormals();
    return g;
  });
}

// Bouche en "D" (grand sourire) extrudée.
export const smileGeo = (w = 0.1, h = 0.075, curve = 0.25) =>
  cached(`smile${w}_${h}_${curve}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w, 0);
    s.quadraticCurveTo(0, -h * curve, w, 0);
    s.absellipse(0, 0, w, h, 0, Math.PI, true);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 18,
    });
    g.center();
    return g;
  });

export function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: o.r ?? 0.45,
    metalness: o.m ?? 0,
    emissive: o.e ?? 0x000000,
    emissiveIntensity: o.ei ?? 1,
    flatShading: !!o.flat,
    side: o.side ?? THREE.FrontSide,
    transparent: !!o.t,
    opacity: o.o ?? 1,
  });
}

export const SHINE = new THREE.MeshBasicMaterial({ color: 0xffffff });

// Crée une pièce de personnage (+ contour) : p=position, r=rotation, s=échelle.
export function mesh(geo, mat, o = {}) {
  // Les petites sphères (boutons, pupilles, reflets…) n'ont pas besoin de beaucoup de polygones.
  if (geo === GEO.sph && o.s !== undefined) {
    const mx = typeof o.s === 'number' ? o.s : Math.max(o.s[0], o.s[1], o.s[2]);
    if (mx < 0.09) geo = GEO.sphLo;
  }
  const m = new THREE.Mesh(geo, mat);
  if (o.p) m.position.set(o.p[0], o.p[1], o.p[2]);
  if (o.r) m.rotation.set(o.r[0], o.r[1], o.r[2], o.order || 'XYZ');
  if (o.s !== undefined) {
    if (typeof o.s === 'number') m.scale.setScalar(o.s);
    else m.scale.set(o.s[0], o.s[1], o.s[2]);
  }
  if (o.outline !== false) {
    const ol = new THREE.Mesh(outlineGeometry(geo), outlineMaterial);
    ol.userData.outline = true;
    ol.castShadow = false;
    m.add(ol);
  }
  m.castShadow = o.cast ?? true;
  if (o.parent) o.parent.add(m);
  return m;
}

// Œil expressif posé à la surface d'une tête (centre de la tête = origine du parent).
export function makeEye(parent, x, y, z, size, mats, o = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const len = Math.hypot(x, y, z) || 1;
  g.rotation.order = 'YXZ';
  g.rotation.y = Math.atan2(x, z);
  g.rotation.x = -Math.asin(y / len);
  const white = mesh(GEO.sph, mats.white, { s: [size * 0.78, size, size * 0.55], parent: g });
  const pupil = new THREE.Group();
  pupil.position.set(o.lookX ?? 0, o.lookY ?? -size * 0.05, size * 0.4);
  g.add(pupil);
  mesh(GEO.sph, mats.pupil, { s: [size * 0.46, size * 0.56, size * 0.3], parent: pupil, outline: false });
  mesh(GEO.sph, SHINE, { p: [size * 0.16, size * 0.24, size * 0.2], s: size * 0.17, parent: pupil, outline: false, cast: false });
  mesh(GEO.sph, SHINE, { p: [-size * 0.12, -size * 0.2, size * 0.2], s: size * 0.07, parent: pupil, outline: false, cast: false });
  parent.add(g);
  return { group: g, white, pupil };
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MATS } from './materials.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

/** Material codes baked into geometry when a builder runs in `extra` mode (instanced crowds). */
export const MAT_CODE = { std: 0, soft: 1, metal: 2, gold: 3, glass: 4, lit: 5, neon: 6 };

/**
 * Level-of-detail settings. LOD 0 = full detail, 1 = medium, 2 = low (also used as shadow proxy).
 *  - skip:  parts whose largest dimension is below this are dropped
 *  - seg:   multiplier on curved segment counts
 *  - round: whether boxes keep their rounded edges
 */
export const LOD_SETTINGS = [
  { skip: 0, seg: 1, round: true },
  { skip: 0.12, seg: 0.6, round: true },
  { skip: 0.32, seg: 0.4, round: true },
  { skip: 0.5, seg: 0.3, round: false }, // distant scenery: plain boxes, tiny parts dropped
];

/**
 * Assemble many primitive shapes into a handful of merged meshes
 * (one per material). Every primitive keeps its own color through
 * vertex colors, so a whole building costs only 2–4 draw calls.
 *
 * Conventions: box / rbox / cyl / cone / prism use `y` as their BOTTOM,
 * sphere / ico / torus / geo use `y` as their CENTER.
 *
 * new MeshBuilder({ lod, extra })
 *  - lod:   0..2, see LOD_SETTINGS
 *  - extra: also bake `slot` (colour slot + shade) and `matc` (material code) attributes,
 *           so the whole model can be drawn with one instanced material.
 */
export class MeshBuilder {
  constructor({ lod = 0, extra = false, uv = true } = {}) {
    this.parts = new Map();
    this.stack = [new THREE.Matrix4()];
    this.lod = LOD_SETTINGS[lod];
    this.extra = extra;
    this.uv = uv && !extra; // untextured scenery can skip the uv attribute (saves memory)
  }

  skip(size) { return size < this.lod.skip; }
  seg(n, min = 4) { return Math.max(min, Math.round(n * this.lod.seg)); }

  /** Run `fn` with an extra local transform (for reusable props). */
  group(o, fn) {
    const m = composeMatrix(o);
    this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m));
    fn(this);
    this.stack.pop();
    return this;
  }

  geo(geometry, color, o = {}) {
    let g = geometry;
    if (!g.index) {
      const count = g.attributes.position.count;
      const idx = new Array(count);
      for (let i = 0; i < count; i++) idx[i] = i;
      g.setIndex(idx);
    }
    if (this.uv && !g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    g.applyMatrix4(composeMatrix(o));
    g.applyMatrix4(this.stack[this.stack.length - 1]);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    // colour slots (extra mode): the colour is multiplied per instance in the shader
    const slot = o.slot || 0;
    if (slot) _c.setRGB(1, 1, 1); else _c.set(color);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const keep = this.uv ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'color'];
    for (const key of Object.keys(g.attributes)) {
      if (!keep.includes(key)) g.deleteAttribute(key);
    }
    const mat = o.mat || 'std';
    if (this.extra) {
      const sl = new Float32Array(n * 2);
      const mc = new Float32Array(n);
      const k = o.k ?? 1;
      const code = MAT_CODE[mat] ?? 0;
      for (let i = 0; i < n; i++) { sl[i * 2] = slot; sl[i * 2 + 1] = k; mc[i] = code; }
      g.setAttribute('slot', new THREE.BufferAttribute(sl, 2));
      g.setAttribute('matc', new THREE.BufferAttribute(mc, 1));
    }
    g.clearGroups();
    const bucket = this.extra ? 'all' : mat;
    if (!this.parts.has(bucket)) this.parts.set(bucket, []);
    this.parts.get(bucket).push(g);
    return this;
  }

  /** Boxes are softly rounded by default (cartoon look); pass `sharp: true` to opt out. */
  box(w, h, d, color, o = {}) {
    if (this.skip(Math.max(w, h, d))) return this;
    const m = Math.min(w, h, d);
    let g;
    if (o.sharp || m < 0.05 || !this.lod.round) {
      g = new THREE.BoxGeometry(w, h, d);
    } else {
      const r = Math.min(o.r ?? 0.1, m * 0.32);
      g = new RoundedBoxGeometry(w, h, d, Math.max(w, h, d) > 2.5 && this.lod.seg === 1 ? 2 : 1, r);
    }
    g.translate(0, h / 2, 0);
    return this.geo(g, color, o);
  }

  /** Smooth low-poly blob (bushes, cartoon rocks, foliage). */
  blob(r, color, o = {}, detail = 2) {
    if (this.skip(r * 2)) return this;
    const d = this.lod.seg === 1 ? detail : Math.max(0, detail - (this.lod.seg < 0.5 ? 2 : 1));
    return this.geo(new THREE.IcosahedronGeometry(r, d), color, o);
  }

  rbox(w, h, d, r, color, o = {}) {
    if (this.skip(Math.max(w, h, d))) return this;
    const g = this.lod.round
      ? new RoundedBoxGeometry(w, h, d, this.lod.seg === 1 ? 2 : 1, Math.min(r, w / 2, h / 2, d / 2) * 0.999)
      : new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    return this.geo(g, color, o);
  }

  cyl(rt, rb, h, color, o = {}, seg = 16) {
    if (this.skip(Math.max(rt * 2, rb * 2, h))) return this;
    const g = new THREE.CylinderGeometry(rt, rb, h, this.seg(seg, 5), 1, o.open || false);
    g.translate(0, h / 2, 0);
    return this.geo(g, color, o);
  }

  cone(r, h, color, o = {}, seg = 16) {
    if (this.skip(Math.max(r * 2, h))) return this;
    const g = new THREE.ConeGeometry(r, h, this.seg(seg, 5));
    g.translate(0, h / 2, 0);
    return this.geo(g, color, o);
  }

  sphere(r, color, o = {}, ws = 16, hs = 12, thetaLength = Math.PI) {
    if (this.skip(r * 2)) return this;
    const g = new THREE.SphereGeometry(r, this.seg(ws, 6), this.seg(hs, 4), 0, Math.PI * 2, 0, thetaLength);
    return this.geo(g, color, o);
  }

  ico(r, color, o = {}, detail = 0) {
    if (this.skip(r * 2)) return this;
    const g = new THREE.IcosahedronGeometry(r, this.lod.seg === 1 ? detail : 0);
    g.computeVertexNormals();
    return this.geo(g, color, o);
  }

  octa(r, color, o = {}) {
    if (this.skip(r * 2 * Math.max(o.sy ?? 1, 1))) return this;
    const g = new THREE.OctahedronGeometry(r, 0);
    g.computeVertexNormals();
    return this.geo(g, color, o);
  }

  torus(r, tube, color, o = {}, arc = Math.PI * 2, rs = 8, ts = 20) {
    if (this.skip(Math.max(r * 2, tube * 2) * (arc < Math.PI ? 0.6 : 1))) return this;
    return this.geo(new THREE.TorusGeometry(r, tube, this.seg(rs, 3), this.seg(ts, 6), arc), color, o);
  }

  /** Triangular prism: length along X, triangle in the YZ plane. */
  prism(w, h, d, color, o = {}) {
    if (this.skip(Math.max(w, h, d))) return this;
    if (!o.sharp && this.lod.round) {
      // rounded gable: triangle extruded with a soft bevel
      const bv = Math.min(0.14, h * 0.12, d * 0.08);
      const shape = new THREE.Shape();
      shape.moveTo(-d / 2 + bv, bv * 0.6);
      shape.lineTo(d / 2 - bv, bv * 0.6);
      shape.lineTo(0, h - bv * 1.6);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: w - bv * 2, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: this.lod.seg === 1 ? 3 : this.lod.seg >= 0.6 ? 2 : 1, curveSegments: 1,
      });
      g.translate(0, 0, -(w - bv * 2) / 2);
      g.rotateY(Math.PI / 2);
      g.deleteAttribute('uv');
      return this.geo(g, color, o);
    }
    const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
    g.rotateZ(Math.PI / 2);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.5, 0);
    g.scale(w, h / 1.5, d / Math.sqrt(3));
    g.computeVertexNormals();
    return this.geo(g.toNonIndexed(), color, o);
  }

  /** One mesh per material. */
  build({ castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    for (const [key, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, MATS[key] || MATS.std);
      const glows = key === 'neon' || key === 'glass';
      mesh.castShadow = castShadow && !glows;
      mesh.receiveShadow = receiveShadow;
      mesh.name = key;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }

  /** Everything merged into a single geometry (all materials), or null if empty. */
  buildGeometry() {
    const list = [];
    for (const l of this.parts.values()) list.push(...l);
    this.parts.clear();
    if (!list.length) return null;
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    merged.computeBoundingSphere();
    return merged;
  }
}

function composeMatrix(o) {
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
  _q.setFromEuler(_e);
  const s = o.s ?? 1;
  _s.set((o.sx ?? 1) * s, (o.sy ?? 1) * s, (o.sz ?? 1) * s);
  _p.set(o.x || 0, o.y || 0, o.z || 0);
  return _m.compose(_p, _q, _s);
}

/** Deterministic random generator (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
    if (o.material && o.material.userData?.owned) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}

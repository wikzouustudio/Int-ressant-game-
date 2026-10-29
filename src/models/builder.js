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

/**
 * Assemble many primitive shapes into a handful of merged meshes
 * (one per material). Every primitive keeps its own color through
 * vertex colors, so a whole building costs only 2–4 draw calls.
 *
 * Conventions: box / rbox / cyl / cone / prism use `y` as their BOTTOM,
 * sphere / ico / torus / geo use `y` as their CENTER.
 */
export class MeshBuilder {
  constructor() {
    this.parts = new Map();
    this.stack = [new THREE.Matrix4()];
  }

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
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    g.applyMatrix4(composeMatrix(o));
    g.applyMatrix4(this.stack[this.stack.length - 1]);
    _c.set(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const key of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(key)) g.deleteAttribute(key);
    }
    g.clearGroups();
    const mat = o.mat || 'std';
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return this;
  }

  /** Boxes are softly rounded by default (cartoon look); pass `sharp: true` to opt out. */
  box(w, h, d, color, o = {}) {
    const m = Math.min(w, h, d);
    let g;
    if (o.sharp || m < 0.05) {
      g = new THREE.BoxGeometry(w, h, d);
    } else {
      const r = Math.min(o.r ?? 0.1, m * 0.32);
      g = new RoundedBoxGeometry(w, h, d, Math.max(w, h, d) > 2.5 ? 2 : 1, r);
    }
    g.translate(0, h / 2, 0);
    return this.geo(g, color, o);
  }

  /** Smooth low-poly blob (bushes, cartoon rocks, foliage). */
  blob(r, color, o = {}, detail = 2) {
    return this.geo(new THREE.IcosahedronGeometry(r, detail), color, o);
  }

  rbox(w, h, d, r, color, o = {}) {
    const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
    g.translate(0, h / 2, 0);
    return this.geo(g, color, o);
  }

  cyl(rt, rb, h, color, o = {}, seg = 16) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, o.open || false);
    g.translate(0, h / 2, 0);
    return this.geo(g, color, o);
  }

  cone(r, h, color, o = {}, seg = 16) {
    const g = new THREE.ConeGeometry(r, h, seg);
    g.translate(0, h / 2, 0);
    return this.geo(g, color, o);
  }

  sphere(r, color, o = {}, ws = 16, hs = 12, thetaLength = Math.PI) {
    const g = new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, thetaLength);
    return this.geo(g, color, o);
  }

  ico(r, color, o = {}, detail = 0) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    g.computeVertexNormals();
    return this.geo(g, color, o);
  }

  octa(r, color, o = {}) {
    const g = new THREE.OctahedronGeometry(r, 0);
    g.computeVertexNormals();
    return this.geo(g, color, o);
  }

  torus(r, tube, color, o = {}, arc = Math.PI * 2, rs = 8, ts = 20) {
    return this.geo(new THREE.TorusGeometry(r, tube, rs, ts, arc), color, o);
  }

  /** Triangular prism: length along X, triangle in the YZ plane. */
  prism(w, h, d, color, o = {}) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
    g.rotateZ(Math.PI / 2);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.5, 0);
    g.scale(w, h / 1.5, d / Math.sqrt(3));
    g.computeVertexNormals();
    return this.geo(g.toNonIndexed(), color, o);
  }

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
}

function composeMatrix(o) {
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
  _q.setFromEuler(_e);
  const s = o.s ?? 1;
  _s.set((o.sx ?? 1) * s, (o.sy ?? 1) * s, (o.sz ?? 1) * s);
  _p.set(o.x || 0, o.y || 0, o.z || 0);
  return new THREE.Matrix4().compose(_p, _q, _s);
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
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material.userData?.owned) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}

// Shared cartoon rendering helpers: toon materials with rim light, outline hulls, cached geometries.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

let gradient = null;
export function gradientMap() {
  if (!gradient) {
    const data = new Uint8Array([110, 190, 255]);
    gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

// Toon material + soft rim light so shapes read as sculpted 3D.
export function toon(color, opts = {}) {
  const { rim = 0.32, ...rest } = opts;
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...rest });
  m.userData.rim = rim;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rim };
    sh.fragmentShader = 'uniform float uRim;\n' + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `{
        vec3 vdir = normalize(vViewPosition);
        float rimF = 1.0 - max(dot(normal, vdir), 0.0);
        outgoingLight += vec3(1.0, 0.96, 0.9) * smoothstep(0.6, 0.92, rimF) * uRim;
      }
      #include <opaque_fragment>`
    );
  };
  m.customProgramCacheKey = () => 'toonrim';
  return m;
}

// Unlit glowing material (eyes, crystals, screens).
export function glow(color) {
  return new THREE.MeshBasicMaterial({ color });
}

export function outlineMaterial(color = 0x1b0f33, width = 0.026) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOW = { value: width };
    sh.vertexShader = 'uniform float uOW;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed += normalize(normal) * uOW;'
    );
  };
  m.customProgramCacheKey = () => 'outline' + width;
  return m;
}

const cache = new Map();
function cached(key, make) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

export const geo = {
  sphere: (r, w = 24, h = 18) => cached(`s${r}_${w}_${h}`, () => new THREE.SphereGeometry(r, w, h)),
  capsule: (r, l, cs = 6, rs = 16) => cached(`c${r}_${l}_${cs}_${rs}`, () => new THREE.CapsuleGeometry(r, l, cs, rs)),
  cyl: (rt, rb, h, s = 20) => cached(`y${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)),
  cone: (r, h, s = 18) => cached(`k${r}_${h}_${s}`, () => new THREE.ConeGeometry(r, h, s)),
  box: (w, h, d, rad = 0.04, seg = 3) => cached(`b${w}_${h}_${d}_${rad}_${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, rad)),
  torus: (R, t, arc = Math.PI * 2, rs = 10, ts = 28) => cached(`t${R}_${t}_${arc}_${rs}_${ts}`, () => new THREE.TorusGeometry(R, t, rs, ts, arc)),
  ico: (r, d = 1) => cached(`i${r}_${d}`, () => new THREE.IcosahedronGeometry(r, d)),
  octa: (r) => cached(`o${r}`, () => new THREE.OctahedronGeometry(r, 0)),
};

// Builder context: each character keeps its own material list so it can flash / fade independently.
export class Kit {
  constructor() {
    this.mats = [];
    this.outline = outlineMaterial();
    this.outlines = [];
  }
  t(color, opts) {
    const m = toon(color, opts);
    this.mats.push(m);
    return m;
  }
  g(color) {
    const m = glow(color);
    m.userData.glow = true;
    this.mats.push(m);
    return m;
  }
  mk(geometry, mat, parent, pos = [0, 0, 0], o = {}) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
    if (o.scale !== undefined) {
      if (typeof o.scale === 'number') m.scale.setScalar(o.scale);
      else m.scale.set(o.scale[0], o.scale[1], o.scale[2]);
    }
    m.castShadow = o.shadow !== false;
    m.receiveShadow = false;
    if (o.outline !== false) {
      const ol = new THREE.Mesh(geometry, this.outline);
      ol.castShadow = false;
      ol.userData.outline = true;
      m.add(ol);
      this.outlines.push(ol);
    }
    parent.add(m);
    return m;
  }
}

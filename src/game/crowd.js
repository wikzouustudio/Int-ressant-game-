import * as THREE from 'three';
import { partGeometry } from '../models/character.js';
import { crowdUniforms } from '../models/materials.js';

// GPU-instanced renderer for every NPC. Each character part (body per tier/hairstyle,
// arms, legs, props) is one InstancedMesh per LOD; colours come from per-instance
// attributes and metal/gold/neon from a baked material code, so the whole crowd
// costs a constant ~30 draw calls instead of ~7 per NPC.

const COLOR_ATTRS = ['iSkin', 'iHair', 'iShirt', 'iPants', 'iAccent'];
const LOD_FAR = 2;

function makeCrowdMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.03 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNeon = crowdUniforms.uNeon;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec2 slot;
        attribute float matc;
        attribute vec3 iSkin;
        attribute vec3 iHair;
        attribute vec3 iShirt;
        attribute vec3 iPants;
        attribute vec3 iAccent;
        varying float vMat;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        {
          int s = int(slot.x + 0.5);
          vec3 sc = vec3(1.0);
          if (s == 1) sc = iSkin;
          else if (s == 2) sc = iHair;
          else if (s == 3) sc = iShirt;
          else if (s == 4) sc = iPants;
          else if (s == 5) sc = iAccent;
          vColor.rgb *= sc * slot.y;
        }
        vMat = matc;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uNeon;
        varying float vMat;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        if (vMat > 0.5 && vMat < 1.5) roughnessFactor = 0.55;
        else if (vMat > 1.5 && vMat < 2.5) roughnessFactor = 0.32;
        else if (vMat > 2.5 && vMat < 3.5) roughnessFactor = 0.22;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        if (vMat > 1.5 && vMat < 2.5) metalnessFactor = 0.75;
        else if (vMat > 2.5 && vMat < 3.5) metalnessFactor = 1.0;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (vMat > 5.5) totalEmissiveRadiance += diffuseColor.rgb * uNeon;`);
  };
  m.customProgramCacheKey = () => 'crowd-v1';
  return m;
}

const _sphere = new THREE.Sphere(new THREE.Vector3(), 2.2);
const _pm = new THREE.Matrix4();

export class CrowdRenderer {
  constructor(scene) {
    this.scene = scene;
    this.material = makeCrowdMaterial();
    this.buckets = new Map();
    this.frustum = new THREE.Frustum();
    this.lodDistance = 60;       // switch to the far LOD beyond this (tuned by quality tier)
    this.farShadows = true;      // do far-LOD NPCs cast shadows
    this.stats = { drawn: 0, culled: 0, far: 0 };
  }

  bucket(key, lod) {
    const id = key + '|' + lod;
    let b = this.buckets.get(id);
    if (b) return b;
    const geo = partGeometry(key, lod);
    b = { id, geo, mesh: null, n: 0, cap: 0, chars: [], colorDirty: false, lod };
    if (geo) this.allocate(b, 32);
    this.buckets.set(id, b);
    return b;
  }

  allocate(b, cap) {
    const old = b.mesh;
    // Instanced colour attributes must live on the geometry: each bucket gets a lightweight
    // geometry that references the shared template buffers plus its own per-instance buffers.
    const g = new THREE.BufferGeometry();
    for (const [k, v] of Object.entries(b.geo.attributes)) g.setAttribute(k, v);
    g.setIndex(b.geo.index);
    g.boundingSphere = b.geo.boundingSphere;
    g.userData.shared = true;
    b.attrs = {};
    for (const name of COLOR_ATTRS) {
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      if (old) attr.array.set(old.geometry.getAttribute(name).array);
      g.setAttribute(name, attr);
      b.attrs[name] = attr;
    }
    const mesh = new THREE.InstancedMesh(g, this.material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (old) {
      mesh.instanceMatrix.array.set(old.instanceMatrix.array);
      this.scene.remove(old);
      old.dispose();
    }
    mesh.frustumCulled = false; // culled per NPC on the CPU
    mesh.castShadow = b.lod !== LOD_FAR || this.farShadows;
    mesh.receiveShadow = true;
    mesh.count = 0;
    mesh.visible = false;
    mesh.layers.enable(1); // shadow layer
    this.scene.add(mesh);
    b.mesh = mesh;
    b.cap = cap;
  }

  setFarShadows(on) {
    this.farShadows = on;
    for (const b of this.buckets.values()) if (b.mesh && b.lod === LOD_FAR) b.mesh.castShadow = on;
  }

  update(camera, ...lists) {
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(_pm);
    for (const b of this.buckets.values()) b.n = 0;
    let drawn = 0, culled = 0, far = 0;
    const cam = camera.position;
    const D = this.lodDistance;
    for (const list of lists) for (const w of list) {
      const c = w.char;
      if (!c.root.visible) continue;
      const p = c.root.position;
      _sphere.center.set(p.x, p.y + 1.4, p.z);
      if (!this.frustum.intersectsSphere(_sphere)) { culled++; c.offscreen = true; continue; }
      c.offscreen = false;
      const d = Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z);
      if (c.lod === 0 && d > D + 4) c.lod = LOD_FAR;
      else if (c.lod === LOD_FAR && d < D - 4) c.lod = 0;
      if (c.lod) far++;
      drawn++;
      c.root.updateMatrixWorld(true);
      for (const [node, key] of c.parts) {
        if (!node.visible) continue;
        const b = this.bucket(key, c.lod);
        if (!b.mesh) continue;
        if (b.n >= b.cap) this.allocate(b, b.cap * 2);
        const i = b.n++;
        b.mesh.instanceMatrix.array.set(node.matrixWorld.elements, i * 16);
        if (b.chars[i] !== c) {
          b.chars[i] = c;
          const col = c.colors;
          for (let k = 0; k < 5; k++) {
            const a = b.attrs[COLOR_ATTRS[k]].array;
            a[i * 3] = col[k * 3]; a[i * 3 + 1] = col[k * 3 + 1]; a[i * 3 + 2] = col[k * 3 + 2];
          }
          b.colorDirty = true;
        }
      }
    }
    for (const b of this.buckets.values()) {
      if (!b.mesh) continue;
      b.mesh.count = b.n;
      b.mesh.visible = b.n > 0;
      b.chars.length = b.n;
      if (b.n > 0) b.mesh.instanceMatrix.needsUpdate = true;
      if (b.colorDirty) {
        for (const name of COLOR_ATTRS) b.attrs[name].needsUpdate = true;
        b.colorDirty = false;
      }
    }
    this.stats.drawn = drawn;
    this.stats.culled = culled;
    this.stats.far = far;
  }
}

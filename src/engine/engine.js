import * as THREE from 'three';
import { CityCamera } from './camera.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { R_WORLD } from '../world/citymap.js';

export function createEngine(container) {
  const mobile = matchMedia('(pointer: coarse)').matches;
  const quality = { high: !mobile };

  // Native MSAA on the default framebuffer: nearly free on mobile tile-based GPUs and used
  // whenever post-processing is off; the composer has its own multisampled target.
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.8, 3000);
  camera.position.set(58, 72, 100);

  const cityCam = new CityCamera(camera, renderer.domElement, R_WORLD - 40);
  // `controls` keeps the small surface the rest of the code relies on
  const controls = { target: cityCam.target, cam: cityCam };

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: mobile ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(size.clone(), 0.4, 0.45, 1.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  function update(dt) { cityCam.update(dt); }

  // --- quality tier (see engine/quality.js) ---
  let useComposer = true;
  function applyTier(t) {
    quality.high = t.bloom;
    const dpr = Math.min(window.devicePixelRatio || 1, t.maxDpr);
    renderer.setPixelRatio(dpr);
    composer.setPixelRatio(dpr);
    bloom.enabled = t.bloom;
    useComposer = t.bloom;
    for (const target of [composer.renderTarget1, composer.renderTarget2]) {
      if (target.samples !== t.aa) { target.samples = t.aa; target.dispose(); }
    }
    resize();
  }

  // --- GPU timing (only where EXT_disjoint_timer_query_webgl2 is exposed) ---
  const gl = renderer.getContext();
  const timerExt = gl.getExtension && gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const queries = [];
  const gpu = { ms: null, supported: !!timerExt };
  function beginGpu() {
    if (!timerExt || queries.length > 3) return null;
    const q = gl.createQuery();
    gl.beginQuery(timerExt.TIME_ELAPSED_EXT, q);
    return q;
  }
  function endGpu(q) {
    if (!q) return;
    gl.endQuery(timerExt.TIME_ELAPSED_EXT);
    queries.push(q);
  }
  function pollGpu() {
    while (queries.length) {
      const q = queries[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const disjoint = gl.getParameter(timerExt.GPU_DISJOINT_EXT);
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      if (!disjoint) gpu.ms = gpu.ms == null ? ns / 1e6 : gpu.ms * 0.9 + (ns / 1e6) * 0.1;
      gl.deleteQuery(q);
      queries.shift();
    }
  }

  function focus(point, maxDistance) { cityCam.focus(point, maxDistance); }

  return {
    renderer, scene, camera, controls, composer, bloom, quality, mobile,
    update,
    render() {
      if (timerExt) pollGpu();
      const q = beginGpu();
      if (useComposer) composer.render(); else renderer.render(scene, camera);
      endGpu(q);
    },
    applyTier, focus, gpu,
  };
}

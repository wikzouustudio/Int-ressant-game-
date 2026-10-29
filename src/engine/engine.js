import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createEngine(container) {
  const mobile = matchMedia('(pointer: coarse)').matches;
  const quality = { high: !mobile };

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.5, 3000);
  camera.position.set(52, 62, 88);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 6);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 18;
  controls.maxDistance = 170;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.28;
  controls.screenSpacePanning = false;
  controls.zoomSpeed = 1.1;
  controls.panSpeed = 1.2;
  controls.update();

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

  // Keyboard panning (WASD / arrows)
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();
  const boundsMin = new THREE.Vector3(-55, 0, -50);
  const boundsMax = new THREE.Vector3(55, 0, 60);

  function update(dt) {
    move.set(0, 0, 0);
    camera.getWorldDirection(fwd);
    fwd.y = 0; fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();
    if (keys.has('w') || keys.has('z') || keys.has('arrowup')) move.add(fwd);
    if (keys.has('s') || keys.has('arrowdown')) move.sub(fwd);
    if (keys.has('d') || keys.has('arrowright')) move.add(right);
    if (keys.has('a') || keys.has('q') || keys.has('arrowleft')) move.sub(right);
    if (move.lengthSq() > 0) {
      const dist = camera.position.distanceTo(controls.target);
      move.normalize().multiplyScalar(dt * (20 + dist * 0.6));
      camera.position.add(move);
      controls.target.add(move);
    }
    // keep the camera over the city
    const before = controls.target.clone();
    controls.target.clamp(boundsMin, boundsMax);
    camera.position.add(before.sub(controls.target).negate());
    controls.update();
  }

  // --- quality tier (see engine/quality.js) ---
  let useComposer = true;
  function applyTier(t) {
    quality.high = t.bloom;
    const dpr = Math.min(window.devicePixelRatio || 1, t.maxDpr);
    renderer.setPixelRatio(dpr);
    composer.setPixelRatio(dpr);
    bloom.enabled = t.bloom;
    useComposer = t.bloom || t.aa > 0;
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

  /** Smoothly fly the camera to focus a point. */
  let flight = null;
  function focus(point, distance = 45) {
    const dir = camera.position.clone().sub(controls.target).normalize();
    flight = {
      t: 0,
      fromT: controls.target.clone(),
      toT: point.clone(),
      fromP: camera.position.clone(),
      toP: point.clone().add(dir.multiplyScalar(distance)),
    };
  }
  function updateFlight(dt) {
    if (!flight) return;
    flight.t = Math.min(1, flight.t + dt * 1.6);
    const k = 1 - Math.pow(1 - flight.t, 3);
    controls.target.lerpVectors(flight.fromT, flight.toT, k);
    camera.position.lerpVectors(flight.fromP, flight.toP, k);
    if (flight.t >= 1) flight = null;
  }
  renderer.domElement.addEventListener('pointerdown', () => { flight = null; });

  return {
    renderer, scene, camera, controls, composer, bloom, quality, mobile,
    update(dt) { updateFlight(dt); update(dt); },
    render() {
      if (timerExt) pollGpu();
      const q = beginGpu();
      if (useComposer) composer.render(); else renderer.render(scene, camera);
      endGpu(q);
    },
    applyTier, focus, gpu,
  };
}

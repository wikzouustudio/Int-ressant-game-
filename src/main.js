import './style.css';
import * as THREE from 'three';
import { createEngine } from './engine/engine.js';
import { QualityManager, TIERS } from './engine/quality.js';
import { createEnvironment } from './world/environment.js';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { icon } from './ui/icons.js';
import * as CFG from './game/config.js';
import { MapEditor } from './editor/editor.js';

document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });

const bar = document.getElementById('loader-bar');
const step = (p) => { bar.style.width = p + '%'; return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); };

async function boot() {
  const tBoot = performance.now();
  await step(10);
  if (document.fonts?.load) {
    try { await Promise.race([document.fonts.load('800 40px Outfit'), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* ignore */ }
  }
  await step(25);
  const engine = createEngine(document.getElementById('app'));
  await step(45);
  const env = createEnvironment(engine);
  await step(70);
  const game = new Game(engine, env, document.getElementById('fx-layer'));

  // ---- quality tiers ----
  let shadowEvery = 1;
  let fpsCap = 60;
  const quality = new QualityManager((t, fps) => {
    engine.applyTier(t);
    env.setShadowQuality(t.shadowSize, t.shadowSoft, t.shadowRange);
    shadowEvery = t.shadowEvery;
    game.setLodScale(t.lodScale);
    game.crowd.lodDistance = t.crowdLod;
    game.crowd.setFarShadows(t.farShadows);
    game.fx.density = t.particles;
    env.setVegetationDistance(t.vegDist);
    env.setClouds(t.clouds);
    game.citizens.setMax(t.citizens);
    game.traffic.setMax(t.cars);
    fpsCap = fps;
  });
  quality.start();

  const ui = new UI(game, engine);
  const editor = new MapEditor();
  editor.onApply = () => { game.save(); game.resetting = true; location.reload(); };
  ui.editor = editor;
  window.__ed = editor;
  document.getElementById('btn-map').onclick = () => { game.sound.click(); game.select(null); editor.show(); };
  ui.quality = quality;
  await step(85);
  const result = game.load();
  ui.refresh();
  if (!game.canton) ui.openCanton();
  else ui.showTutorial(game.tutorial);
  if (game.ipoJustDone) ui.showIPODone(game.ipoJustDone);
  else if (result && result.offline > 0) ui.showOffline(result.offline, result.elapsed);
  await step(100);

  // Warm up shaders before revealing the scene
  const view = { focus: engine.controls.target, distance: 100, camera: engine.camera.position };
  env.update(0, game.tod, 0, view);
  game.renderPrep();
  engine.renderer.compile(engine.scene, engine.camera);
  const loadMs = performance.now() - tBoot;

  // ---- frame loop ----
  const renderer = engine.renderer;
  renderer.shadowMap.autoUpdate = false;
  const info = renderer.info;
  info.autoReset = false;
  const perf = { update: 0, render: 0, frame: 16.7, calls: 0, triangles: 0, samples: 0, loadMs };
  window.__perf = perf;
  const overlay = new PerfOverlay(engine, game, env, quality, perf);
  ui.overlay = overlay;

  const clock = new THREE.Clock();
  let uiTimer = 0;
  let saveTimer = 0;
  let frameNo = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    // 30 FPS mode: render every other vsync (saves battery and heat on weak phones)
    if (fpsCap < 60 && now - last < 1000 / fpsCap - 3) return;
    const t0 = performance.now();
    perf.frame = t0 - last;
    last = t0;
    const dt = Math.min(clock.getDelta(), 0.1);
    game.update(dt);
    view.distance = engine.camera.position.distanceTo(engine.controls.target);
    env.update(dt, game.tod, game.time, view);
    game.fx.update(dt);
    engine.update(dt);
    game.renderPrep();
    const t1 = performance.now();
    info.reset();
    if (++frameNo % shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
    engine.render();
    const t2 = performance.now();
    perf.update = t1 - t0;
    perf.render = t2 - t1;
    perf.calls = info.render.calls;
    perf.triangles = info.render.triangles;
    perf.samples++;
    const msg = quality.sample(perf.frame);
    if (msg) ui.toast(msg, 'gear');
    overlay.tick(dt);
    uiTimer += dt;
    if (uiTimer > 0.12) { uiTimer = 0; ui.tick(); }
    saveTimer += dt;
    if (saveTimer > 8) { saveTimer = 0; game.save(); }
  }
  requestAnimationFrame(frame);

  const saveNow = () => { if (!game.resetting) game.save(); };
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveNow();
    else { clock.getDelta(); quality.reset(); }
  });

  setTimeout(() => document.getElementById('controls-hint')?.classList.add('fade'), 12000);
  setTimeout(() => document.getElementById('loader').classList.add('done'), 250);
  setTimeout(() => document.getElementById('loader').remove(), 1100);

  window.__game = game; // handy for debugging in the console
  window.__quality = quality;
  window.__cfg = CFG;
}

/** Small on-screen profiler (Paramètres → Statistiques de performance). */
class PerfOverlay {
  constructor(engine, game, env, quality, perf) {
    Object.assign(this, { engine, game, env, quality, perf });
    this.el = document.createElement('div');
    this.el.id = 'perf';
    document.body.appendChild(this.el);
    this.acc = 0;
    this.frames = 0;
    this.cpu = 0;
    try { this.enabled = localStorage.getItem('empire-perf') === '1'; } catch (e) { this.enabled = false; }
    this.el.classList.toggle('hidden', !this.enabled);
  }

  toggle(on) {
    this.enabled = on;
    this.el.classList.toggle('hidden', !on);
    try { localStorage.setItem('empire-perf', on ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  tick(dt) {
    if (!this.enabled) return;
    this.acc += dt;
    this.frames++;
    this.cpu += this.perf.update + this.perf.render;
    if (this.acc < 0.5) return;
    const p = this.perf;
    const fps = this.frames / this.acc;
    const cpu = this.cpu / this.frames;
    const mem = this.engine.renderer.info.memory;
    const heap = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' Mo' : 'n/d';
    const gpu = this.engine.gpu.supported ? (this.engine.gpu.ms != null ? this.engine.gpu.ms.toFixed(1) + ' ms' : '…') : 'n/d';
    const cs = this.game.crowd.stats;
    const vs = this.env.vegStats;
    const q = this.quality;
    this.el.innerHTML =
      `<b>${fps.toFixed(0)} FPS</b> · ${(1000 / fps).toFixed(1)} ms<br>` +
      `CPU ${cpu.toFixed(1)} ms · GPU ${gpu}<br>` +
      `Draw calls ${p.calls} · ${(p.triangles / 1000).toFixed(0)}k tri<br>` +
      `Géom. ${mem.geometries} · Tex. ${mem.textures} · JS ${heap}<br>` +
      `PNJ ${cs.drawn} affichés · ${cs.culled} hors champ · ${cs.far} LOD<br>` +
      `Végétation ${vs.visible}/${vs.chunks} cellules · ${vs.low} LOD<br>` +
      `Particules ${this.game.fx.activeParticles}<br>` +
      `Qualité ${TIERS[q.tier].name}${q.mode === 'auto' ? ' (auto)' : ''} · ${q.fpsCap} FPS · chargement ${(p.loadMs / 1000).toFixed(1)} s`;
    this.acc = 0;
    this.frames = 0;
    this.cpu = 0;
  }
}

boot();

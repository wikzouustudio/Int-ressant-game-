import './style.css';
import * as THREE from 'three';
import { createEngine } from './engine/engine.js';
import { createEnvironment } from './world/environment.js';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { icon } from './ui/icons.js';

document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });

const bar = document.getElementById('loader-bar');
const step = (p) => { bar.style.width = p + '%'; return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); };

async function boot() {
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
  const ui = new UI(game, engine);
  await step(85);
  const result = game.load();
  ui.refresh();
  if (!game.canton) ui.openCanton();
  else ui.showTutorial(game.tutorial);
  if (result && result.offline > 0) ui.showOffline(result.offline, result.elapsed);
  await step(100);

  // Warm up shaders before revealing the scene
  env.update(0, game.tod, 0);
  engine.renderer.compile(engine.scene, engine.camera);

  const clock = new THREE.Clock();
  let uiTimer = 0;
  let saveTimer = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    game.update(dt);
    env.update(dt, game.tod, game.time);
    game.fx.update(dt);
    engine.update(dt);
    engine.render();
    uiTimer += dt;
    if (uiTimer > 0.12) { uiTimer = 0; ui.tick(); }
    saveTimer += dt;
    if (saveTimer > 8) { saveTimer = 0; game.save(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const saveNow = () => { if (!game.resetting) game.save(); };
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

  setTimeout(() => document.getElementById('loader').classList.add('done'), 250);
  setTimeout(() => document.getElementById('loader').remove(), 1100);

  window.__game = game; // handy for debugging in the console
}

boot();

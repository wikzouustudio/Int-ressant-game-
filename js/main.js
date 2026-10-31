// App shell: renderer, 3D lobby, menus, match flow, progression and main loop.
import * as THREE from 'three';
import { HEROES, HERO_BY_ID, buildHeroModel, animateHero } from './heroes.js';
import { MAPS, MODES, drawMinimap } from './maps.js';
import { Match } from './game.js';
import { Input } from './input.js';
import { initAudio, sfx, startMusic, setSfx, setMusic } from './audio.js';
import { toon } from './toon.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lerp = (a, b, t) => a + (b - a) * t;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

const EVENTS = [
  { mode: 'ko', map: 'canyon' },
  { mode: 'zone', map: 'clairiere' },
  { mode: 'ko', map: 'glacier' },
  { mode: 'zone', map: 'canyon' },
  { mode: 'ko', map: 'clairiere' },
  { mode: 'zone', map: 'glacier' },
];
const MAX_LV = 7;
const upgradeCost = (lv) => lv * 80;
const RANKS = [[0, 'Recrue'], [60, 'Bagarreur'], [160, 'Cogneur'], [320, 'Vétéran'], [600, 'Champion'], [1000, 'Légende']];

// ------------------------------------------------------------------ save
const SAVE_KEY = 'boomsquad.v1';
function defaultSave() {
  return { name: 'Toi', coins: 150, trophies: 0, hero: 'rex', event: 0, sfx: true, music: true, heroes: Object.fromEntries(HEROES.map((h) => [h.id, { lv: 1, tr: 0 }])) };
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const d = defaultSave();
      const out = { ...d, ...s, heroes: { ...d.heroes, ...(s.heroes || {}) } };
      if (!HERO_BY_ID[out.hero]) out.hero = 'rex';
      if (!(out.event >= 0 && out.event < EVENTS.length)) out.event = 0;
      return out;
    }
  } catch (e) { /* storage unavailable */ }
  return defaultSave();
}
let save = loadSave();
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage unavailable */ }
}
setSfx(save.sfx);
setMusic(save.music);

// ------------------------------------------------------------------ renderer
const canvas = $('gl');
const hud = $('hud');
const hctx = hud.getContext('2d');
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches;
const lowSpec = isMobile || (navigator.hardwareConcurrency || 8) <= 4;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, lowSpec ? 1.75 : 2);
renderer.setPixelRatio(pixelRatio);
const perf = { acc: 0, frames: 0 };
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

let VW = innerWidth, VH = innerHeight, DPR = 1;
let mode = 'loading';
let match = null;
let paused = false;
const portraits = {};

// ------------------------------------------------------------------ lobby scene
const lobby = {
  scene: new THREE.Scene(),
  cam: new THREE.PerspectiveCamera(30, 1, 0.1, 100),
  P: null,
  rotY: 0.4,
  rotV: 0,
  drag: null,
  popT: 1,
  idleT: 3,
  t: 0,
  gems: [],
  heroId: null,
};
{
  const s = lobby.scene;
  s.add(new THREE.HemisphereLight(0xfff4ff, 0x3a1f9a, 1.5));
  const key = new THREE.DirectionalLight(0xfff1dd, 2.6);
  key.position.set(2.5, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  s.add(key);
  const rim = new THREE.DirectionalLight(0x9fd0ff, 2.2);
  rim.position.set(-4, 3, -4);
  s.add(rim);
  const pod = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.72, 0.36, 64), toon('#3a1f9a', { rim: 0.4 }));
  base.position.y = 0.18;
  base.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.38, 0.1, 64), toon('#6c4bf0', { rim: 0.2 }));
  top.position.y = 0.4;
  top.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.44, 0.07, 10, 90), toon('#ffcc1f', { rim: 0.6 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.38;
  const glow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), new THREE.MeshBasicMaterial({ color: '#8a5bff', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.005;
  pod.add(base, top, ring, glow);
  s.add(pod);
  lobby.ring = ring;
  const gemCols = ['#ffcc1f', '#3fe08f', '#ff5d8f', '#2f8bff', '#b46bff', '#7dfcff'];
  const gemGeo = new THREE.OctahedronGeometry(0.16, 0);
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Mesh(gemGeo, toon(gemCols[i % gemCols.length], { rim: 0.7 }));
    g.userData = { a: (i / 7) * Math.PI * 2, r: 2.6 + (i % 3) * 0.4, y: 0.8 + (i % 4) * 0.5, s: 0.55 + (i % 3) * 0.2 };
    g.scale.set(1, 1.5, 1).multiplyScalar(g.userData.s);
    s.add(g);
    lobby.gems.push(g);
  }
}

function disposeModel(P) {
  if (!P) return;
  for (const m of P.kit.mats) m.dispose();
  P.kit.outline.dispose();
}

function setLobbyHero(id, pop = true) {
  if (lobby.heroId === id && lobby.P) return;
  if (lobby.P) {
    lobby.scene.remove(lobby.P.root);
    disposeModel(lobby.P);
  }
  const P = buildHeroModel(id);
  P.root.position.y = 0.45;
  P.root.rotation.y = lobby.rotY;
  lobby.scene.add(P.root);
  lobby.P = P;
  lobby.heroId = id;
  if (pop) {
    lobby.popT = 0;
    P.root.scale.setScalar(0.01);
  }
}

function updateLobby(dt) {
  lobby.t += dt;
  const P = lobby.P;
  if (P) {
    lobby.idleT -= dt;
    if (lobby.idleT <= 0) {
      lobby.idleT = 3.5 + Math.random() * 3;
      P.st.atk = 1;
      P.st.squash = 0.1;
    }
    P.st.move = 0;
    animateHero(P, dt);
    if (!lobby.drag) {
      lobby.rotY += lobby.rotV * dt;
      lobby.rotV *= Math.exp(-dt * 2.5);
      if (Math.abs(lobby.rotV) < 0.4) lobby.rotY = lerp(lobby.rotY, 0.4 + Math.sin(lobby.t * 0.45) * 0.25, 1 - Math.exp(-dt * 1.2));
    }
    P.root.rotation.y = lobby.rotY;
    if (lobby.popT < 1) {
      lobby.popT = Math.min(1, lobby.popT + dt * 2.4);
      const p = lobby.popT;
      const s = 1 - Math.pow(2, -10 * p) * Math.cos(p * 18) * (1 - p);
      P.root.scale.setScalar(Math.max(0.01, s) * 1.1);
    } else P.root.scale.setScalar(1.1);
  }
  for (const g of lobby.gems) {
    const u = g.userData;
    const a = u.a + lobby.t * 0.25;
    g.position.set(Math.cos(a) * u.r, u.y + Math.sin(lobby.t * 1.3 + u.a * 3) * 0.15, Math.sin(a) * u.r * 0.6 - 1.4);
    g.rotation.y += dt * 1.5;
  }
  lobby.ring.material.emissive.setHex(0xffcc1f);
  lobby.ring.material.emissiveIntensity = 0.15 + Math.sin(lobby.t * 3) * 0.1;
}

function updateLobbyView() {
  const cam = lobby.cam;
  const portrait = VH > VW;
  cam.aspect = VW / VH;
  cam.fov = portrait ? 44 : 30;
  cam.position.set(0, portrait ? 1.8 : 1.75, portrait ? 7.6 : 7.9);
  cam.lookAt(0, 1.18, 0);
  let ox = 0, oy = 0;
  if (mode === 'heroes') {
    if (portrait) oy = VH * 0.17;
    else ox = VW * 0.29;
  } else if (portrait) oy = VH * 0.04;
  if (ox || oy) cam.setViewOffset(VW, VH, ox, oy, VW, VH);
  else cam.clearViewOffset();
  cam.updateProjectionMatrix();
}

canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'lobby' && mode !== 'heroes') return;
  lobby.drag = { x: e.clientX, t: performance.now() };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!lobby.drag) return;
  const dx = e.clientX - lobby.drag.x;
  const now = performance.now();
  const dtm = Math.max(1, now - lobby.drag.t) / 1000;
  lobby.rotY += dx * 0.012;
  lobby.rotV = (dx * 0.012) / dtm;
  lobby.drag.x = e.clientX;
  lobby.drag.t = now;
});
const endDrag = () => { lobby.drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ------------------------------------------------------------------ portraits
async function makePortraits(onStep) {
  const size = 256;
  let r2;
  try {
    r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) {
    return;
  }
  r2.setPixelRatio(1);
  r2.setSize(size, size, false);
  r2.outputColorSpace = THREE.SRGBColorSpace;
  r2.setClearColor(0x000000, 0);
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x4a2bb0, 1.6));
  const key = new THREE.DirectionalLight(0xfff1dd, 2.6);
  key.position.set(2, 4, 5);
  sc.add(key);
  const rim = new THREE.DirectionalLight(0x9fd0ff, 2.4);
  rim.position.set(-3, 2, -3);
  sc.add(rim);
  const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  for (let i = 0; i < HEROES.length; i++) {
    const h = HEROES[i];
    const P = buildHeroModel(h.id);
    P.st.blink = 5;
    animateHero(P, 0.016);
    P.root.rotation.y = 0.42;
    sc.add(P.root);
    P.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(P.head);
    const cy = (box.max.y + box.min.y) / 2 - 0.12;
    cam.position.set(0.15, cy + 0.12, 2.65);
    cam.lookAt(0, cy, 0);
    r2.render(sc, cam);
    portraits[h.id] = r2.domElement.toDataURL('image/png');
    sc.remove(P.root);
    disposeModel(P);
    onStep(i + 1, HEROES.length);
    await nextFrame();
  }
  r2.dispose();
  try { r2.forceContextLoss(); } catch (e) { /* ignore */ }
}

// ------------------------------------------------------------------ UI helpers
function show(id, on = true) {
  $(id).hidden = !on;
}
function heroVars(el, h) {
  el.style.setProperty('--hc', h.color);
  el.style.setProperty('--hc2', h.color2);
}
function rankOf(tr) {
  let r = RANKS[0][1];
  for (const [t, n] of RANKS) if (tr >= t) r = n;
  return r;
}
function fmtNum(n) {
  return Math.round(n).toLocaleString('fr-FR');
}
function eventInfo(i) {
  const ev = EVENTS[i];
  return { ev, mode: MODES.find((m) => m.id === ev.mode), map: MAPS.find((m) => m.id === ev.map) };
}

function refreshLobby() {
  const h = HERO_BY_ID[save.hero];
  const hs = save.heroes[save.hero];
  $('lobbyName').textContent = save.name;
  $('lobbyRank').textContent = rankOf(save.trophies);
  $('lobbyTrophies').textContent = fmtNum(save.trophies);
  $('lobbyCoins').textContent = fmtNum(save.coins);
  $('heroesCoins').textContent = fmtNum(save.coins);
  heroVars($('lobbyAvatar'), h);
  if (portraits[h.id]) $('lobbyAvatarImg').src = portraits[h.id];
  $('plateLv').innerHTML = `<span><small>NIV</small>${hs.lv}</span>`;
  $('plateName').textContent = h.name;
  $('plateTitle').textContent = `${h.title} · ${h.role}`;
  $('plateTr').textContent = fmtNum(hs.tr);
  const info = eventInfo(save.event);
  $('evMode').textContent = info.mode.name;
  $('evMap').textContent = info.map.name;
  $('evTag').innerHTML = `<svg width="14" height="14"><use href="${info.mode.id === 'ko' ? '#i-skull' : '#i-zone'}"/></svg> ÉVÉNEMENT · 3 VS 3`;
  drawMinimap($('evThumb'), info.map);
}

// ------------------------------------------------------------------ heroes screen
let viewHero = save.hero;
function buildHeroGrid() {
  const grid = $('hgrid');
  grid.innerHTML = '';
  for (const h of HEROES) {
    const b = document.createElement('button');
    b.className = 'hcard';
    b.dataset.id = h.id;
    b.setAttribute('aria-label', h.name);
    heroVars(b, h);
    b.innerHTML = `<img alt="" src="${portraits[h.id] || ''}"><span class="hc-lv"></span><span class="hc-name">${h.name}</span>`;
    b.addEventListener('click', () => {
      sfx('select');
      selectView(h.id);
    });
    grid.appendChild(b);
  }
}

function statBlock(h, lv) {
  const m = 1 + (lv - 1) * 0.06;
  const a = h.attack;
  const perShot = a.type === 'spread' || a.type === 'burst' ? a.dmg * a.count : a.dmg;
  const rows = [
    ['i-heart', 'PV', Math.round(h.hp * m), h.hp / 6000],
    ['i-fist', 'DÉGÂTS', Math.round(perShot * m), Math.min(1, perShot / 2000)],
    ['i-target', 'PORTÉE', a.range >= 9 ? 'Longue' : a.range >= 6 ? 'Moyenne' : 'Courte', a.range / 10],
    ['i-bolt', 'VITESSE', h.speed >= 3.6 ? 'Très rapide' : h.speed >= 3.2 ? 'Normale' : 'Lente', (h.speed - 2.4) / 1.5],
  ];
  return rows.map(([ic, l, v, f]) => `<div class="stat-row"><svg><use href="#${ic}"/></svg><span class="sl">${l}</span><span class="bar"><i style="width:${Math.round(Math.max(0.08, Math.min(1, f)) * 100)}%"></i></span><span class="sv">${typeof v === 'number' ? fmtNum(v) : v}</span></div>`).join('');
}

function selectView(id) {
  viewHero = id;
  const h = HERO_BY_ID[id];
  const hs = save.heroes[id];
  setLobbyHero(id, true);
  for (const c of $('hgrid').children) {
    c.classList.toggle('sel', c.dataset.id === id);
    c.classList.toggle('cur', c.dataset.id === save.hero);
    c.querySelector('.hc-lv').textContent = save.heroes[c.dataset.id].lv;
  }
  $('scRole').textContent = h.role.toUpperCase();
  $('scRole').style.background = h.color;
  $('scName').textContent = h.name;
  $('scName').style.color = h.color2;
  $('scTitle').textContent = `${h.title} · Niveau ${hs.lv} · ${fmtNum(hs.tr)} trophées`;
  $('scDesc').textContent = h.desc;
  const cost = upgradeCost(hs.lv);
  const maxed = hs.lv >= MAX_LV;
  const isCur = save.hero === id;
  $('hstats').innerHTML = `
    ${statBlock(h, hs.lv)}
    <div class="ability"><span class="ab-ic"><svg><use href="#i-cross"/></svg></span><span><b>${h.attack.name}<em>ATTAQUE</em></b><p>${h.attack.desc}</p></span></div>
    <div class="ability sup"><span class="ab-ic"><svg style="color:#fff"><use href="#i-star"/></svg></span><span><b>${h.super.name}<em>SUPER</em></b><p>${h.super.desc}</p></span></div>
    <div class="hactions">
      <button class="btn ${isCur ? 'dark' : 'gold'}" id="btnChoose" ${isCur ? 'disabled' : ''}>${isCur ? 'SÉLECTIONNÉ' : 'CHOISIR'}</button>
      <button class="btn green" id="btnUpgrade" ${maxed || save.coins < cost ? 'disabled' : ''}>${maxed ? 'NIVEAU MAX' : `<svg><use href="#i-up"/></svg>NIV ${hs.lv + 1} · <svg><use href="#i-coin"/></svg>${cost}`}</button>
    </div>`;
  $('btnChoose').addEventListener('click', () => {
    save.hero = id;
    persist();
    sfx('select');
    refreshLobby();
    selectView(id);
  });
  $('btnUpgrade').addEventListener('click', () => {
    if (maxed || save.coins < cost) return;
    save.coins -= cost;
    hs.lv++;
    persist();
    sfx('coin');
    lobby.popT = 0.35;
    refreshLobby();
    selectView(id);
  });
}

function openHeroes() {
  sfx('click');
  mode = 'heroes';
  show('lobby', false);
  show('heroes', true);
  refreshLobby();
  selectView(save.hero);
  updateLobbyView();
}
function closeHeroes() {
  sfx('click');
  mode = 'lobby';
  show('heroes', false);
  show('lobby', true);
  setLobbyHero(save.hero, viewHero !== save.hero);
  refreshLobby();
  updateLobbyView();
}

// ------------------------------------------------------------------ events modal
function buildEvents() {
  const grid = $('evgrid');
  grid.innerHTML = '';
  EVENTS.forEach((ev, i) => {
    const info = eventInfo(i);
    const b = document.createElement('button');
    b.className = 'btn evcard';
    b.innerHTML = `<canvas width="63" height="93"></canvas><span><b>${info.mode.name}</b><small>${info.map.name}</small></span>`;
    drawMinimap(b.querySelector('canvas'), info.map);
    b.addEventListener('click', () => {
      save.event = i;
      persist();
      sfx('select');
      refreshEvents();
      refreshLobby();
      setTimeout(() => show('events', false), 220);
    });
    grid.appendChild(b);
  });
}
function refreshEvents() {
  [...$('evgrid').children].forEach((c, i) => c.classList.toggle('sel', i === save.event));
  $('modeDesc').textContent = eventInfo(save.event).mode.desc;
}

// ------------------------------------------------------------------ settings
function refreshSettings() {
  $('nameInput').value = save.name;
  $('tgSfx').classList.toggle('on', save.sfx);
  $('tgMusic').classList.toggle('on', save.music);
}
let resetArmed = 0;
$('btnSettings').addEventListener('click', () => { sfx('click'); refreshSettings(); show('settings'); });
$('btnProfile').addEventListener('click', () => { sfx('click'); refreshSettings(); show('settings'); });
$('btnSettingsClose').addEventListener('click', () => { sfx('click'); show('settings', false); refreshLobby(); });
$('nameInput').addEventListener('input', (e) => {
  save.name = e.target.value.trim().slice(0, 12) || 'Toi';
  persist();
});
$('nameInput').addEventListener('keydown', (e) => e.stopPropagation());
$('tgSfx').addEventListener('click', () => { save.sfx = !save.sfx; setSfx(save.sfx); persist(); refreshSettings(); sfx('click'); });
$('tgMusic').addEventListener('click', () => { save.music = !save.music; setMusic(save.music); persist(); refreshSettings(); sfx('click'); });
$('btnReset').addEventListener('click', () => {
  const now = performance.now();
  if (now - resetArmed < 3000) {
    save = defaultSave();
    persist();
    setSfx(save.sfx);
    setMusic(save.music);
    $('btnReset').textContent = 'Réinitialiser';
    resetArmed = 0;
    refreshSettings();
    refreshLobby();
    setLobbyHero(save.hero, true);
    sfx('coin');
  } else {
    resetArmed = now;
    $('btnReset').textContent = 'Confirmer ?';
    setTimeout(() => { $('btnReset').textContent = 'Réinitialiser'; }, 3000);
  }
});

// ------------------------------------------------------------------ input & in-game UI bridge
const input = new Input($('ctl'), {
  moveBase: $('stickBase'),
  moveKnob: $('stickKnob'),
  atk: $('atkBtn'),
  atkKnob: $('atkKnob'),
  sup: $('supBtn'),
  supKnob: $('supKnob'),
});
document.body.classList.toggle('touch', input.touchMode);
input.onModeChange = (on) => document.body.classList.toggle('touch', on);
const ray = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tmpV = new THREE.Vector3();
input.toWorld = (sx, sy) => {
  if (!match) return null;
  ray.setFromCamera(new THREE.Vector2((sx / VW) * 2 - 1, -(sy / VH) * 2 + 1), match.camera);
  if (!ray.ray.intersectPlane(ground, tmpV)) return null;
  return { x: tmpV.x, z: tmpV.z };
};

const uiCache = { time: '', sup: -1, ready: null, resp: -1, alive: true };
function banner(text, cls) {
  const el = $('banner');
  el.className = 'banner';
  void el.offsetWidth;
  el.textContent = text;
  el.className = 'banner show ' + (cls || '');
}
const ui = {
  score(a, b) {
    if (!match || match.mode.id !== 'ko') return;
    $('sbBlue').textContent = a;
    $('sbRed').textContent = b;
  },
  feed(killer, victim) {
    const feed = $('feed');
    const el = document.createElement('div');
    el.className = 'feed-item';
    const side = (b) => (b.team === 0 ? 'b' : 'r');
    const k = killer ? `<img alt="" src="${portraits[killer.hero.id] || ''}"><span class="${side(killer)}">${esc(killer.name)}</span>` : '';
    el.innerHTML = `${k}<svg><use href="#i-skull"/></svg><span class="${side(victim)}">${esc(victim.name)}</span><img alt="" src="${portraits[victim.hero.id] || ''}">`;
    feed.appendChild(el);
    while (feed.children.length > 4) feed.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3200);
  },
  banner,
  end(result) {
    banner(result === 'win' ? 'VICTOIRE !' : result === 'lose' ? 'DÉFAITE' : 'ÉGALITÉ', 'end' + (result === 'lose' ? ' lose' : ''));
    sfx(result === 'win' ? 'win' : 'lose');
    input.enabled = false;
    input.reset();
  },
  frame(d) {
    const s = Math.ceil(d.time);
    const tt = d.overtime ? 'MORT SUBITE' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (tt !== uiCache.time) {
      uiCache.time = tt;
      const el = $('sbTime');
      el.textContent = tt;
      el.classList.toggle('warn', d.overtime || (s <= 10 && s > 0));
    }
    const sp = Math.round(d.superCharge * 100) / 100;
    if (sp !== uiCache.sup) {
      uiCache.sup = sp;
      $('supBtn').style.setProperty('--p', sp);
    }
    const ready = d.superCharge >= 1;
    if (ready !== uiCache.ready) {
      uiCache.ready = ready;
      $('supBtn').classList.toggle('ready', ready);
    }
    if (d.alive !== uiCache.alive) {
      uiCache.alive = d.alive;
      show('respawn', !d.alive && match && match.state === 'play');
    }
    if (!d.alive) {
      const r = Math.max(1, Math.ceil(d.respawn));
      if (r !== uiCache.resp) {
        uiCache.resp = r;
        $('respawnT').textContent = r;
      }
    }
    if (d.zone) {
      const zb = Math.floor(d.zone[0]) + '%', zr = Math.floor(d.zone[1]) + '%';
      if ($('sbBlue').textContent !== zb) $('sbBlue').textContent = zb;
      if ($('sbRed').textContent !== zr) $('sbRed').textContent = zr;
    }
    if (match) {
      for (const b of match.brawlers) {
        const el = b.miniEl;
        if (!el) continue;
        const dead = !b.alive;
        if (el.classList.contains('dead') !== dead) el.classList.toggle('dead', dead);
        if (dead) {
          const t = String(Math.max(1, Math.ceil(b.respawnT)));
          if (el.dataset.t !== t) el.dataset.t = t;
        }
      }
    }
  },
};

// ------------------------------------------------------------------ match flow
let mmTimer = null;
function tryFullscreen() {
  if (!isMobile) return;
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
    if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignore */ } }).catch(() => {});
  } catch (e) { /* ignore */ }
}

function startMatchmaking() {
  if (mode !== 'lobby') return;
  initAudio();
  sfx('click');
  tryFullscreen();
  mode = 'matchmaking';
  show('matchmaking');
  let n = 1;
  const dots = [...$('mmDots').children];
  const step = () => {
    $('mmCount').textContent = `${n}/6`;
    dots.forEach((d, i) => d.classList.toggle('on', i < n));
    if (n >= 6) {
      mmTimer = setTimeout(launchVersus, 380);
      return;
    }
    n++;
    sfx('beep');
    mmTimer = setTimeout(step, 180 + Math.random() * 260);
  };
  step();
}
$('btnCancelMM').addEventListener('click', () => {
  clearTimeout(mmTimer);
  sfx('click');
  show('matchmaking', false);
  mode = 'lobby';
});

function launchVersus() {
  const info = eventInfo(save.event);
  try {
    match = new Match({
      ui, input,
      heroId: save.hero,
      level: save.heroes[save.hero].lv,
      mode: info.mode,
      map: info.map,
      playerName: save.name,
      lowSpec,
      onEnd: onMatchEnd,
    });
  } catch (e) {
    console.error(e);
    show('matchmaking', false);
    mode = 'lobby';
    return;
  }
  match.setSize(VW, VH);
  const card = (b) => {
    const h = b.hero;
    return `<div class="vs-card ${b.isPlayer ? 'me' : ''}" style="--hc:${h.color};--hc2:${h.color2}"><div class="vc-img"><img alt="" src="${portraits[h.id] || ''}"></div><b>${esc(b.name)}</b><small>${h.name}</small></div>`;
  };
  $('vsBlue').innerHTML = match.teams[0].map(card).join('');
  $('vsRed').innerHTML = match.teams[1].map(card).join('');
  $('vsInfo').textContent = `${info.mode.name} · ${info.map.name}`;
  const vb = $('vsBlue'), vr = $('vsRed');
  vb.style.animation = 'none'; vr.style.animation = 'none';
  void vb.offsetWidth;
  vb.style.animation = ''; vr.style.animation = '';
  mode = 'versus';
  show('matchmaking', false);
  show('lobby', false);
  show('versus');
  $('bg').hidden = true;
  sfx('whoosh');
  startMusic('battle');
  setTimeout(() => {
    try { renderer.compile(match.scene, match.camera); } catch (e) { /* ignore */ }
  }, 60);
  setTimeout(beginMatch, 2700);
}

function buildRoster() {
  for (const team of [0, 1]) {
    const box = $(team === 0 ? 'rosterBlue' : 'rosterRed');
    box.innerHTML = '';
    for (const b of match.teams[team]) {
      const el = document.createElement('div');
      el.className = 'mini' + (b.isPlayer ? ' me' : '');
      el.style.setProperty('--hc', b.hero.color);
      el.innerHTML = `<img alt="" src="${portraits[b.hero.id] || ''}">`;
      box.appendChild(el);
      b.miniEl = el;
    }
  }
}

async function beginMatch() {
  if (!match) return;
  show('versus', false);
  show('game-ui');
  document.body.classList.add('ingame');
  mode = 'match';
  paused = false;
  uiCache.time = '';
  uiCache.sup = -1;
  uiCache.ready = null;
  uiCache.alive = true;
  show('respawn', false);
  $('feed').innerHTML = '';
  const isZone = match.mode.id === 'zone';
  $('sbMode').textContent = isZone ? 'ZONE CHAUDE · 100%' : `K.O. RUSH · ${match.mode.goal}`;
  show('zoneBars', false);
  $('sbBlue').textContent = isZone ? '0%' : '0';
  $('sbRed').textContent = isZone ? '0%' : '0';
  buildRoster();
  input.reset();
  input.enabled = false;
  resize();
  const myMatch = match;
  for (const n of ['3', '2', '1']) {
    banner(n, 'count');
    sfx('beep');
    await sleep(780);
    if (match !== myMatch) return;
  }
  banner('COMBAT !', 'go');
  sfx('go');
  match.start();
  input.enabled = true;
}

function onMatchEnd(sum) {
  if (mode !== 'match') return;
  mode = 'results';
  paused = false;
  show('pause', false);
  input.enabled = false;
  input.reset();
  const hs = save.heroes[save.hero];
  const r = sum.result;
  let dt = r === 'win' ? 8 : r === 'lose' ? -4 : 0;
  if (r === 'win' && sum.playerMvp) dt += 2;
  if (dt < 0) dt = -Math.min(-dt, hs.tr, save.trophies);
  let dc = r === 'win' ? 40 : r === 'lose' ? 15 : 25;
  if (sum.playerMvp) dc += 10;
  save.trophies += dt;
  hs.tr += dt;
  save.coins += dc;
  persist();

  const title = $('resTitle');
  title.textContent = r === 'win' ? 'VICTOIRE !' : r === 'lose' ? 'DÉFAITE' : 'ÉGALITÉ';
  title.className = 'res-title ' + r;
  $('resSub').textContent = sum.mode.id === 'ko'
    ? `${sum.score[0]} – ${sum.score[1]} · ${sum.mode.name} · ${sum.map.name}`
    : `${sum.zone[0]} % – ${sum.zone[1]} % · ${sum.mode.name} · ${sum.map.name}`;
  const card = (p, i) => `<div class="res-card ${p.team === 0 ? 'blue' : 'red'} ${p.isPlayer ? 'me' : ''}" style="--hc:${p.hero.color};--hc2:${p.hero.color2};animation-delay:${i * 0.06}s">
      ${p.mvp ? '<span class="mvp">MVP</span>' : ''}
      <div class="rc-img"><img alt="" src="${portraits[p.hero.id] || ''}"></div>
      <b>${esc(p.name)}</b><small>${p.kills} K.O. · ${p.deaths} morts</small><small>${fmtNum(p.damage)} dégâts${p.healed > 0 ? ` · ${fmtNum(p.healed)} soins` : ''}</small></div>`;
  $('resBlue').innerHTML = sum.players.filter((p) => p.team === 0).map(card).join('');
  $('resRed').innerHTML = sum.players.filter((p) => p.team === 1).map((p, i) => card(p, i + 3)).join('');
  countUp($('rwTrophy'), dt, true);
  countUp($('rwCoin'), dc, true);
  show('game-ui', false);
  document.body.classList.remove('ingame');
  show('results');
  setTimeout(() => sfx('coin'), 500);
}

function countUp(el, target, sign) {
  const start = performance.now();
  const dur = 900;
  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
    el.textContent = (sign && v >= 0 ? '+' : '') + v;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function backToLobby() {
  if (match) {
    match.dispose();
    match = null;
  }
  hctx.clearRect(0, 0, hud.width, hud.height);
  show('results', false);
  show('game-ui', false);
  document.body.classList.remove('ingame');
  $('bg').hidden = false;
  mode = 'lobby';
  show('lobby');
  setLobbyHero(save.hero, true);
  refreshLobby();
  updateLobbyView();
  startMusic('lobby');
}

$('btnContinue').addEventListener('click', () => { sfx('click'); backToLobby(); });
$('btnPlay').addEventListener('click', startMatchmaking);
$('btnHeroes').addEventListener('click', openHeroes);
$('btnHeroesBack').addEventListener('click', closeHeroes);
$('btnEvent').addEventListener('click', () => { sfx('click'); refreshEvents(); show('events'); });
$('btnModes').addEventListener('click', () => { sfx('click'); refreshEvents(); show('events'); });
$('btnEventsClose').addEventListener('click', () => { sfx('click'); show('events', false); });
$('btnRotateOk').addEventListener('click', () => document.body.classList.add('no-rotate'));

function pauseGame() {
  if (mode !== 'match' || !match || match.state === 'ended') return;
  paused = true;
  input.enabled = false;
  input.reset();
  show('pause');
}
$('btnPause').addEventListener('click', (e) => { e.stopPropagation(); sfx('click'); pauseGame(); });
$('btnPause').addEventListener('pointerdown', (e) => e.stopPropagation());
$('btnResume').addEventListener('click', () => {
  sfx('click');
  paused = false;
  show('pause', false);
  if (match && match.state === 'play') input.enabled = true;
});
$('btnQuit').addEventListener('click', () => {
  sfx('click');
  show('pause', false);
  paused = false;
  if (!match) return;
  match.finish('lose');
  match.reported = true;
  onMatchEnd(match.summary());
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (mode === 'match' && !paused) pauseGame();
    else if (mode === 'match' && paused) $('btnResume').click();
  }
});
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, () => initAudio(), { capture: true });

// ------------------------------------------------------------------ resize & loop
function resize() {
  VW = window.innerWidth;
  VH = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setSize(VW, VH, false);
  hud.width = Math.round(VW * DPR);
  hud.height = Math.round(VH * DPR);
  updateLobbyView();
  if (match) match.setSize(VW, VH);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  input.update();
  if (mode === 'match' && !paused) {
    perf.acc += dt;
    perf.frames++;
    if (perf.acc > 2.5) {
      const avg = perf.acc / perf.frames;
      if (avg > 0.027 && pixelRatio > 1) {
        pixelRatio = Math.max(1, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        resize();
      }
      perf.acc = 0;
      perf.frames = 0;
    }
  }
  if (match && (mode === 'match' || mode === 'results')) {
    if (!paused) match.update(dt);
    match.render(renderer);
    if (mode === 'match') match.drawHud(hctx, VW, VH, DPR);
    else hctx.clearRect(0, 0, hud.width, hud.height);
  } else if (mode === 'lobby' || mode === 'heroes' || mode === 'matchmaking' || mode === 'loading') {
    updateLobby(dt);
    renderer.render(lobby.scene, lobby.cam);
  }
}

// ------------------------------------------------------------------ boot
function setLoading(p, txt) {
  $('loadFill').style.width = Math.round(p * 100) + '%';
  if (txt) $('loadTxt').textContent = txt;
}

async function boot() {
  resize();
  setLoading(0.08, 'Chargement des polices…');
  try {
    await Promise.race([Promise.all([document.fonts.load('40px "Lilita One"'), document.fonts.load('900 16px "Nunito"')]), sleep(2500)]);
  } catch (e) { /* fallback fonts */ }
  setLoading(0.2, 'Sculpture des héros…');
  await makePortraits((i, n) => setLoading(0.2 + (i / n) * 0.6, `Sculpture des héros… ${i}/${n}`));
  setLoading(0.85, 'Préparation de l\'arène…');
  setLobbyHero(save.hero, false);
  buildHeroGrid();
  buildEvents();
  refreshLobby();
  renderer.compile(lobby.scene, lobby.cam);
  requestAnimationFrame(loop);
  await sleep(250);
  setLoading(1, 'C\'est parti !');
  await sleep(250);
  mode = 'lobby';
  show('loading', false);
  show('lobby');
  lobby.popT = 0;
  updateLobbyView();
  startMusic('lobby');
}

boot().catch((e) => {
  console.error(e);
  $('loadTxt').textContent = 'Erreur de chargement : ' + (e && e.message ? e.message : e);
});

// Debug handle (handy for testing from the console).
window.__boom = { get match() { return match; }, get mode() { return mode; }, get save() { return save; } };

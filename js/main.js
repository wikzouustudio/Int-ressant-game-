// Point d'entrée : rendu, écrans (lobby, héros, fiche, partie, résultats), profil joueur.
import * as THREE from 'three';
import { HEROES, HERO_ORDER, buildHero } from './heroes.js';
import { Input } from './input.js';
import { Lobby } from './lobby.js';
import { Showcase } from './showcase.js';
import { Game } from './game.js';
import { initAudio, sfx, startMusic, setMusic, setSfx } from './audio.js';
import { setOutline } from './toon.js';

const $ = (id) => document.getElementById(id);
const KEY = 'rumblepop.profile.v1';
const DEFAULT = {
  name: 'Joueur', selected: 'miso', mode: 'ko', coins: 150, xp: 0, level: 1,
  trophies: { miso: 0, volta: 0, bouldo: 0, pluma: 0 }, music: true, sfx: true, played: 0, wins: 0,
};
const MODES = {
  ko: { name: 'K.O. EXPRESS', desc: 'Premiers à 10 K.O. · 3c3' },
  zone: { name: 'ZONE CHAUDE', desc: 'Tenez le centre · 3c3' },
};
const TROPHY = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#ffc53a" stroke="#1b1236" stroke-width="1.8" stroke-linejoin="round" d="M6 3h12v3h3c0 4-2 6-4.5 6.4A6 6 0 0 1 13 15.8V18h3.5v3h-9v-3H11v-2.2a6 6 0 0 1-3.5-3.4C5 12 3 10 3 6h3z"/></svg>';

function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { ...DEFAULT, ...p, trophies: { ...DEFAULT.trophies, ...(p.trophies || {}) } };
    }
  } catch (e) { /* stockage indisponible */ }
  return structuredClone(DEFAULT);
}

class App {
  constructor() {
    this.canvas = $('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.ocanvas = $('overlay');
    this.octx = this.ocanvas.getContext('2d');
    this.profile = loadProfile();
    setMusic(this.profile.music);
    setSfx(this.profile.sfx);
    this.input = new Input();
    this.input.bindCanvas(this.canvas);
    this.input.bindMoveZone($('moveZone'), $('joyBase'), $('joyKnob'));
    this.input.bindAimButton($('btnAttack'), $('atkKnob'), 'atk', 'attack');
    this.input.bindAimButton($('btnSuper'), $('supKnob'), 'sup', 'super');
    this.input.onTouchMode = (on) => document.body.classList.toggle('touch', on);
    document.body.classList.toggle('touch', this.input.isTouch);

    this.ui = {
      modeName: $('hudMode'), goal: $('hudGoal'), timer: $('timer'), scores: $('scores'), scoreBlue: $('scoreBlue'), scoreRed: $('scoreRed'),
      zoneBars: $('zoneBars'), zoneBlue: $('zoneBlue'), zoneRed: $('zoneRed'), zoneBlueN: $('zoneBlueN'), zoneRedN: $('zoneRedN'), zoneStatus: $('zoneStatus'),
      killfeed: $('killfeed'), banner: $('banner'), respawn: $('respawn'), respawnN: $('respawnN'),
      superBtn: $('btnSuper'), superChip: $('superChip'), superLabel: $('superLabel'), superLabelD: $('superLabelD'), atkLabel: $('atkLabel'),
    };

    this.lobby = new Lobby(this);
    this.showcase = new Showcase(this);
    this.game = null;
    this.screen = 'lobby';
    this.previewHero = this.profile.selected;
    this.lobby.setHero(this.profile.selected);
    this.showcase.setHero('miso');

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.portraits = {};
    this.makePortraits();
    this.bindUI();
    this.refreshLobby();
    this.show('lobby');
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    $('loading').classList.add('done');
    setTimeout(() => $('loading').remove(), 700);

    const unlock = () => { initAudio(); if (this.screen !== 'game') startMusic('lobby'); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    startMusic('lobby');

    // Petit accès pour générer les planches concept art depuis la console / les tests.
    window.__rumblePop = { makeSheet: (id) => this.showcase.makeSheet(id), app: this };
  }

  sfx(n, v) { sfx(n, v); }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.profile)); } catch (e) { /* ignore */ }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const coarse = this.input?.isTouch;
    this.dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.6 : 2);
    this.w = w; this.h = h;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.ocanvas.width = Math.round(w * this.dpr);
    this.ocanvas.height = Math.round(h * this.dpr);
    this.lobby.resize(w, h);
    this.showcase.resize(w, h);
    if (this.game) this.game.resize(w, h);
  }

  makePortraits() {
    const r = this.renderer;
    const S = 256;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6a4a8a, 1.2));
    const key = new THREE.DirectionalLight(0xfff0e0, 2.8);
    key.position.set(-2, 3, 4);
    const rim = new THREE.DirectionalLight(0xffffff, 2.2);
    rim.position.set(2, 2, -3);
    scene.add(key, rim);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    const frameY = { miso: [1.42, 3.3], volta: [1.35, 3.4], bouldo: [1.12, 3.4], pluma: [0.95, 2.9] };
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    r.setPixelRatio(1);
    r.setSize(S, S, false);
    r.setClearColor(0x000000, 0);
    setOutline(2, r);
    for (const id of HERO_ORDER) {
      const rig = buildHero(id);
      rig.mode = 'idle';
      rig.root.rotation.y = 0.35;
      rig.update(0.016);
      scene.add(rig.root);
      const [y, d] = frameY[id];
      cam.position.set(0.15, y + 0.15, d);
      cam.lookAt(0, y, 0);
      r.render(scene, cam);
      g.clearRect(0, 0, S, S);
      g.drawImage(r.domElement, 0, 0, S, S);
      this.portraits[id] = cv.toDataURL('image/png');
      scene.remove(rig.root);
    }
    this.resize();
  }

  bindUI() {
    const click = (id, fn) => $(id).addEventListener('click', (e) => { initAudio(); sfx('click'); fn(e); });
    click('btnPlay', () => this.startGame());
    click('btnHeroes', () => this.openHeroes());
    click('btnConcept', () => this.openShowcase('miso'));
    click('promo', () => this.openShowcase('miso'));
    click('btnHelp', () => { $('help').hidden = false; });
    click('helpClose', () => { $('help').hidden = true; });
    click('modeCard', () => {
      this.profile.mode = this.profile.mode === 'ko' ? 'zone' : 'ko';
      this.save();
      this.refreshLobby();
    });
    click('profileCard', () => {
      $('renameInput').value = this.profile.name;
      $('rename').hidden = false;
      setTimeout(() => $('renameInput').focus(), 50);
    });
    $('renameForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('renameInput').value.trim().replace(/[<>&"]/g, '').slice(0, 14);
      if (v) this.profile.name = v;
      this.save();
      $('rename').hidden = true;
      this.refreshLobby();
    });
    click('renameCancel', () => { $('rename').hidden = true; });
    click('btnMusic', () => { this.profile.music = !this.profile.music; setMusic(this.profile.music); this.save(); this.refreshLobby(); });
    click('btnSfx', () => { this.profile.sfx = !this.profile.sfx; setSfx(this.profile.sfx); this.save(); this.refreshLobby(); });

    click('heroesBack', () => { this.lobby.setHero(this.profile.selected); this.show('lobby'); });
    click('hdChoose', () => {
      this.profile.selected = this.previewHero;
      this.save();
      sfx('select');
      this.refreshLobby();
      this.show('lobby');
    });
    click('hdSheet', () => this.openShowcase(this.previewHero));

    click('scClose', () => { this.lobby.setHero(this.profile.selected); this.show(this.returnTo || 'lobby'); });
    click('scPrev', () => this.stepShowcase(-1));
    click('scNext', () => this.stepShowcase(1));
    click('scRotate', () => {
      this.showcase.auto = !this.showcase.auto;
      $('scRotate').setAttribute('aria-pressed', String(this.showcase.auto));
    });
    click('scCapture', () => {
      const url = this.showcase.makeSheet(this.showcase.heroId);
      $('sheetImg').src = url;
      $('sheet').hidden = false;
    });
    click('sheetClose', () => { $('sheet').hidden = true; });

    click('btnPause', () => this.togglePause());
    click('pResume', () => this.togglePause());
    click('pQuit', () => { $('pause').hidden = true; this.endGame(); this.show('lobby'); });
    click('resAgain', () => { this.endGame(); this.startGame(); });
    click('resLobby', () => { this.endGame(); this.show('lobby'); });
  }

  show(name) {
    this.screen = name;
    for (const id of ['lobby', 'heroes', 'showcase', 'hud', 'results']) $(id).hidden = true;
    const map = { lobby: 'lobby', heroes: 'heroes', showcase: 'showcase', game: 'hud', results: 'results' };
    $(map[name]).hidden = false;
    document.body.dataset.screen = name;
    this.lobby.active = name === 'lobby' || name === 'heroes';
    this.showcase.active = name === 'showcase';
    this.input.enabled = name === 'game';
    if (name !== 'game') {
      this.octx.setTransform(1, 0, 0, 1, 0, 0);
      this.octx.clearRect(0, 0, this.ocanvas.width, this.ocanvas.height);
    }
    if (name === 'lobby' || name === 'heroes' || name === 'showcase') startMusic('lobby');
    if (name === 'lobby') this.refreshLobby();
  }

  refreshLobby() {
    const p = this.profile;
    const h = HEROES[p.selected];
    $('playerName').textContent = p.name;
    $('lvl').textContent = p.level;
    $('coins').textContent = p.coins;
    const total = Object.values(p.trophies).reduce((a, b) => a + b, 0);
    $('trophyTotal').textContent = total;
    $('xpFill').style.width = Math.min(100, (p.xp / (p.level * 100)) * 100) + '%';
    $('avatarImg').src = this.portraits[p.selected] || '';
    $('avatar').style.background = h.color;
    $('lpName').textContent = h.name;
    $('lpTitle').textContent = h.title;
    $('lpRole').textContent = h.role;
    $('lpTro').textContent = p.trophies[p.selected];
    $('promoImg').src = this.portraits.miso || '';
    $('modeName').textContent = MODES[p.mode].name;
    $('modeDesc').textContent = MODES[p.mode].desc;
    $('modeCard').dataset.mode = p.mode;
    $('btnMusic').setAttribute('aria-pressed', String(p.music));
    $('btnSfx').setAttribute('aria-pressed', String(p.sfx));
    if (this.screen === 'lobby') this.lobby.setHero(p.selected);
  }

  openHeroes() {
    this.previewHero = this.profile.selected;
    const grid = $('heroGrid');
    grid.innerHTML = '';
    for (const id of HERO_ORDER) {
      const h = HEROES[id];
      const b = document.createElement('button');
      b.className = 'hero-card';
      b.dataset.id = id;
      b.style.setProperty('--hc', h.color);
      b.style.setProperty('--hbg', h.bg);
      b.innerHTML = `${h.isNew ? '<span class="new">NOUVEAU</span>' : ''}<img src="${this.portraits[id]}" alt=""><span class="hn">${h.name}</span><span class="hr">${h.role}</span><span class="ht">${TROPHY}${this.profile.trophies[id]}</span>`;
      b.addEventListener('click', () => { sfx('select'); this.previewHeroSet(id); });
      grid.appendChild(b);
    }
    this.previewHeroSet(this.previewHero);
    this.show('heroes');
  }

  previewHeroSet(id) {
    this.previewHero = id;
    const h = HEROES[id];
    for (const c of $('heroGrid').children) c.classList.toggle('sel', c.dataset.id === id);
    this.lobby.setHero(id);
    this.lobby.poke();
    $('hdName').textContent = h.name;
    $('hdTitle').textContent = h.title;
    $('hdRarity').textContent = h.rarity;
    $('hdRole').textContent = h.role;
    $('hdRole').style.background = h.color;
    $('hdAtk').textContent = h.attack.name;
    $('hdAtkD').textContent = h.attack.desc;
    $('hdSup').textContent = h.super.name;
    $('hdSupD').textContent = h.super.desc;
    const labels = { pv: 'Points de vie', degats: 'Dégâts', portee: 'Portée', vitesse: 'Vitesse' };
    $('hdStats').innerHTML = Object.entries(labels).map(([k, lab]) => {
      const v = h.stats[k];
      const val = k === 'pv' ? h.hp : ['', 'Faibles', 'Moyens', 'Élevés', 'Très élevés', 'Extrêmes'][v];
      const pct = k === 'pv' ? Math.round(h.hp / 6200 * 100) : v * 20;
      const txt = k === 'portee' ? ['', 'Courte', 'Courte', 'Moyenne', 'Longue', 'Très longue'][v] : k === 'vitesse' ? ['', 'Lente', 'Normale', 'Normale', 'Rapide', 'Très rapide'][v] : val;
      return `<div class="stat"><span>${lab}</span><b>${txt}</b><i style="--v:${pct}%"></i></div>`;
    }).join('');
    $('hdChoose').textContent = id === this.profile.selected ? 'SÉLECTIONNÉ' : 'CHOISIR';
  }

  openShowcase(id) {
    this.returnTo = this.screen === 'heroes' ? 'heroes' : 'lobby';
    this.showcase.setHero(id);
    this.showcase.resize(this.w, this.h);
    this.fillShowcase(id);
    this.show('showcase');
  }

  stepShowcase(d) {
    const i = HERO_ORDER.indexOf(this.showcase.heroId);
    const id = HERO_ORDER[(i + d + HERO_ORDER.length) % HERO_ORDER.length];
    this.showcase.setHero(id);
    this.showcase.resize(this.w, this.h);
    this.fillShowcase(id);
  }

  fillShowcase(id) {
    const h = HEROES[id];
    const root = $('showcase');
    root.style.setProperty('--hc', h.color);
    root.style.setProperty('--hbg', h.bg);
    $('scEyebrow').textContent = h.isNew ? 'NOUVEAU HÉROS' : 'FICHE HÉROS';
    $('scName').textContent = h.name;
    $('scTitle').textContent = h.title;
    $('scRarity').textContent = h.rarity;
    $('scRole').textContent = h.role;
    $('scBio').textContent = h.bio;
    $('scAtk').textContent = h.attack.name;
    $('scAtkD').textContent = h.attack.desc;
    $('scSup').textContent = h.super.name;
    $('scSupD').textContent = h.super.desc;
    $('scTrait').textContent = h.trait.name;
    $('scTraitD').textContent = h.trait.desc;
    $('scPalette').innerHTML = h.palette.map(([n, c]) => `<span class="sw"><i style="background:${c}"></i>${n}</span>`).join('');
  }

  startGame() {
    initAudio();
    this.endGame();
    this.input.reset();
    this.game = new Game(this, { mode: this.profile.mode, hero: this.profile.selected, playerName: this.profile.name });
    this.game.resize(this.w, this.h);
    $('pause').hidden = true;
    this.show('game');
  }

  togglePause() {
    if (!this.game || this.screen !== 'game' || this.game.state === 'end') return;
    this.game.paused = !this.game.paused;
    $('pause').hidden = !this.game.paused;
    this.input.reset();
  }

  endGame() {
    if (!this.game) return;
    this.game.dispose();
    this.game = null;
    this.octx.setTransform(1, 0, 0, 1, 0, 0);
    this.octx.clearRect(0, 0, this.ocanvas.width, this.ocanvas.height);
  }

  onGameEnd(r) {
    const p = this.profile;
    const won = r.winner === 0, draw = r.winner === -1;
    const tro = won ? 8 : draw ? 0 : -4;
    const before = p.trophies[r.hero];
    p.trophies[r.hero] = Math.max(0, before + tro);
    const coins = (won ? 20 : draw ? 14 : 10) + r.player.kills * 2;
    const xp = (won ? 40 : 20) + r.player.kills * 8;
    p.coins += coins;
    p.xp += xp;
    while (p.xp >= p.level * 100) { p.xp -= p.level * 100; p.level++; }
    p.played++;
    if (won) p.wins++;
    this.save();

    const title = $('resTitle');
    title.textContent = won ? 'VICTOIRE !' : draw ? 'ÉGALITÉ' : 'DÉFAITE';
    title.className = won ? 'win' : draw ? 'draw' : 'lose';
    $('resScore').textContent = r.mode === 'ko' ? `K.O. ${r.score[0]} – ${r.score[1]}` : `Zone ${r.score[0]}% – ${r.score[1]}%`;
    const card = (u) => `<div class="ru ${u.isPlayer ? 'me' : ''} ${u.mvp ? 'mvp' : ''}" style="--hc:${HEROES[u.heroId].color};--hbg:${HEROES[u.heroId].bg}">
      ${u.mvp ? '<span class="mvp-tag">MVP</span>' : ''}<img src="${this.portraits[u.heroId]}" alt="">
      <b>${u.name.replace(/[<>&]/g, '')}</b><small>${u.kills} K.O. · ${u.dmg} dégâts${u.heal ? ` · ${u.heal} soins` : ''}</small></div>`;
    $('resBlue').innerHTML = r.units.filter((u) => u.team === 0).map(card).join('');
    $('resRed').innerHTML = r.units.filter((u) => u.team === 1).map(card).join('');
    $('resTro').textContent = (tro > 0 ? '+' : '') + (p.trophies[r.hero] - before);
    $('resCoins').textContent = '+' + coins;
    $('resXp').textContent = '+' + xp;
    this.show('results');
    setTimeout(() => sfx('coin'), 500);
  }

  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    const r = this.renderer;
    try {
      if (this.screen === 'lobby' || this.screen === 'heroes') {
        this.lobby.update(dt);
        this.lobby.render(r);
      } else if (this.screen === 'showcase') {
        this.showcase.update(dt);
        this.showcase.render(r);
      } else if (this.game) {
        if (this.screen === 'game') this.game.update(dt);
        this.game.render(r);
        if (this.screen === 'game') this.game.drawOverlay(this.game.paused ? 0 : dt);
      }
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((tt) => this.frame(tt));
  }
}

function boot() {
  try {
    new App();
  } catch (e) {
    console.error(e);
    const l = $('loading');
    if (l) l.querySelector('.load-msg').textContent = "Impossible de démarrer le jeu : WebGL n'est pas disponible sur cet appareil.";
  }
}

if (document.fonts && document.fonts.ready) {
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(boot);
} else boot();

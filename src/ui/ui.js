import {
  BUSINESSES, BIZ, WORKERS, UPGRADES, MAX_LEVEL, levelMult, slotsFor, money, fmt,
} from '../game/config.js';

const $ = (id) => document.getElementById(id);

const TUTORIAL = [
  'Clique sur une <b>parcelle libre</b> (le ✚ vert) pour construire ton premier <b>Stand de limonade 🍋</b>.',
  'Bravo ! Maintenant <b>embauche un Stagiaire</b> dans le panneau à droite 👷',
  'Ton employé travaille puis <b>ramène l\'argent au Siège 🏦</b>. Clique aussi sur le Siège pour gagner de l\'argent !',
  'Améliore ton bâtiment pour <b>débloquer plus de places</b> et de <b>meilleurs profils</b> (Employé, Expert, Robot) 📈',
];

export class UI {
  constructor(game, engine) {
    this.game = game;
    this.engine = engine;
    this.panel = $('panel');
    this.modal = $('modal');
    this.modalCard = $('modal-card');
    this.current = null;
    this.lastCash = 0;

    game.on('change', () => this.refresh());
    game.on('select', (t) => this.open(t));
    game.on('toast', (t) => this.toast(t.text, t.kind));
    game.on('hover', (tip) => this.setTooltip(tip));
    game.on('tutorial', (s) => this.showTutorial(s));
    game.on('rush', (on) => {
      $('banner').classList.toggle('hidden', !on);
      $('banner').textContent = '🔥 HEURE DE POINTE — tous les revenus x2 !';
      $('rush-badge').classList.toggle('hidden', !on);
    });

    this.panel.addEventListener('click', (e) => this.onPanelClick(e));
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
      this.onModalClick(e);
    });
    $('btn-research').onclick = () => { game.sound.click(); this.openResearch(); };
    $('btn-stats').onclick = () => { game.sound.click(); this.openStats(); };
    $('btn-settings').onclick = () => { game.sound.click(); this.openSettings(); };
    $('btn-sound').onclick = () => {
      game.sound.enabled = !game.sound.enabled;
      $('btn-sound').firstElementChild.textContent = game.sound.enabled ? '🔊' : '🔇';
      try { localStorage.setItem('empire-sound', game.sound.enabled ? '1' : '0'); } catch (e) { /* ignore */ }
    };
    try {
      if (localStorage.getItem('empire-sound') === '0') {
        game.sound.enabled = false;
        $('btn-sound').firstElementChild.textContent = '🔇';
      }
    } catch (e) { /* ignore */ }

    window.addEventListener('pointermove', (e) => {
      const tt = $('tooltip');
      tt.style.left = e.clientX + 'px';
      tt.style.top = e.clientY + 'px';
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.closeModal(); game.select(null); }
    });
  }

  // =====================================================================
  open(target) {
    const prev = this.current;
    this.current = target;
    if (!target) { this.panel.classList.add('hidden'); return; }
    this.panel.classList.remove('hidden');
    this.render();
    if (target === prev || (prev && prev.hq && target.hq)) return;
    if (target.plot) this.engine.focus(target.plot.center.clone().setY(2), 55);
    else if (target.center) this.engine.focus(target.center.clone().setY(2), 55);
  }

  refresh() {
    if (this.current) this.render();
    this.tick(true);
  }

  render() {
    const t = this.current;
    if (!t) return;
    const scroll = this.panel.querySelector('.panel-body')?.scrollTop || 0;
    if (t.hq) this.panel.innerHTML = this.renderHQ();
    else if (t.workers) this.panel.innerHTML = this.renderBuilding(t);
    else this.panel.innerHTML = this.renderPlot(t);
    const body = this.panel.querySelector('.panel-body');
    if (body) body.scrollTop = scroll;
    this.tick(true);
  }

  head(icon, color, title, sub, extra = '') {
    return `<div class="panel-head">
      <div class="icon" style="background:${color}">${icon}</div>
      <div><h2>${title}</h2><p>${sub}</p>${extra}</div>
      <button class="close" data-action="close">✕</button>
    </div>`;
  }

  renderPlot(plot) {
    const g = this.game;
    const items = BUSINESSES.map((b) => {
      const biz = BIZ[b.id];
      const unlocked = g.isUnlocked(biz);
      const price = g.buildPrice(b.id);
      if (!unlocked) {
        return `<button class="biz locked" disabled>
          <div class="icon" style="background:#334155">🔒</div>
          <div class="info"><b>${b.name}</b><small>Construis d'abord : ${BUSINESSES[biz.index - 1].name}</small></div>
          <div class="price">${money(price)}</div></button>`;
      }
      return `<button class="biz" data-action="build" data-type="${b.id}" data-cost="${price}">
        <div class="icon" style="background:${b.color}">${b.icon}</div>
        <div class="info"><b>${b.name}</b><small>${b.desc}</small>
          <span class="inc">+${money(b.income * g.incomeMult)} / livraison</span></div>
        <div class="price">${money(price)}</div></button>`;
    }).join('');
    return this.head('🏗️', 'linear-gradient(135deg,#3ddc84,#16a34a)', 'Parcelle libre', `Bloc ${plot.i}, ${plot.j} · Choisis un commerce à construire`) +
      `<div class="panel-body"><div class="biz-list">${items}</div></div>`;
  }

  renderHQ() {
    const g = this.game;
    return this.head('🏦', 'linear-gradient(135deg,#ffe58a,#e09b12)', 'Siège social', 'Le cœur de ton empire. Tous tes employés y déposent l\'argent.') +
      `<div class="panel-body">
        <div class="stat-grid">
          <div class="stat"><small>Revenus</small><b class="g" id="hq-rate">${money(g.rate)}/s</b></div>
          <div class="stat"><small>Employés</small><b>${g.workers.length}</b></div>
          <div class="stat"><small>Commerces</small><b>${g.buildings.size}</b></div>
        </div>
        <button class="btn gold" data-action="hqclick"><span class="l"><span>👆</span><span>Encaisser<small>Clique aussi directement sur le Siège</small></span></span><span class="price" id="hq-click">+${money(g.clickValue)}</span></button>
        <div class="section-title">Raccourcis</div>
        <button class="btn purple" data-action="research"><span class="l"><span>🔬</span><span>Centre de recherche<small>Améliorations globales de ton empire</small></span></span><span class="price">→</span></button>
      </div>`;
  }

  renderBuilding(b) {
    const g = this.game;
    const biz = b.biz;
    const stars = Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < b.level ? 'on' : ''}"></i>`).join('');
    const slots = b.slots;
    const perTrip = biz.income * levelMult(b.level) * g.incomeMult;

    const workers = b.workers.map((w, idx) => {
      const next = WORKERS[w.tier.index + 1];
      let promo = '';
      if (next) {
        const locked = b.level < next.unlock;
        const price = g.promotePrice(w);
        promo = locked
          ? `<button class="mini" disabled title="Niveau ${next.unlock} requis">🔒 Niv.${next.unlock}</button>`
          : `<button class="mini" data-action="promote" data-idx="${idx}" data-cost="${price}" title="Promouvoir en ${next.name}">⬆ ${next.icon} ${money(price)}</button>`;
      }
      return `<div class="worker">
        <div class="avatar" style="background:${w.tier.color}33">${w.tier.icon}</div>
        <div class="info"><b>${w.data.name}<span class="tier-tag" style="background:${w.tier.color}">${w.tier.name}</span></b>
          <small id="ws-${idx}">${w.statusLabel()}</small>
          <div class="progress"><i id="wp-${idx}"></i></div></div>
        ${promo}</div>`;
    }).join('');
    const empty = Math.max(0, slots - b.workers.length);
    const emptyHtml = empty ? `<div class="empty-slot">${empty} poste${empty > 1 ? 's' : ''} libre${empty > 1 ? 's' : ''} — embauche quelqu'un !</div>` : '';

    const full = b.workers.length >= slots;
    const hire = WORKERS.map((t) => {
      const locked = b.level < t.unlock;
      const price = g.hirePrice(b, t.id);
      if (locked) {
        return `<button class="hire locked" disabled><div class="t"><span>🔒</span>${t.name}</div><div class="d">Niveau ${t.unlock} requis</div><div class="p">—</div></button>`;
      }
      return `<button class="hire ${full ? 'locked' : ''}" ${full ? 'disabled' : ''} data-action="hire" data-tier="${t.id}" data-cost="${price}">
        <div class="t"><span>${t.icon}</span>${t.name}</div>
        <div class="d">x${t.mult} revenus · vitesse ${t.speed}</div>
        <div class="p">${full ? 'Complet' : money(price)}</div></button>`;
    }).join('');

    let up;
    if (b.level >= MAX_LEVEL) {
      up = `<button class="btn locked" disabled><span class="l"><span>👑</span><span>Niveau maximum atteint</span></span></button>`;
    } else {
      const price = g.upgradePrice(b);
      const nextSlots = slotsFor(b.level + 1);
      const unlockTier = WORKERS.find((t) => t.unlock === b.level + 1);
      const perks = [`revenus x1.6`];
      if (nextSlots > slots) perks.push(`+1 poste`);
      if (unlockTier) perks.push(`débloque ${unlockTier.icon} ${unlockTier.name}`);
      up = `<button class="btn gold" data-action="upgrade" data-cost="${price}"><span class="l"><span>⬆️</span><span>Améliorer → Niv. ${b.level + 1}<small>${perks.join(' · ')}</small></span></span><span class="price">${money(price)}</span></button>`;
    }

    return this.head(biz.icon, biz.color, biz.name, biz.desc, `<div class="stars">${stars}</div>`) +
      `<div class="panel-body">
        <div class="stat-grid">
          <div class="stat"><small>Par livraison</small><b>${money(perTrip)}</b></div>
          <div class="stat"><small>Revenus</small><b class="g" id="b-rate">${money(b.estimatedRate())}/s</b></div>
          <div class="stat"><small>Postes</small><b>${b.workers.length}/${slots}</b></div>
        </div>
        ${up}
        <div class="section-title"><span>Embaucher</span><span>${b.workers.length}/${slots}</span></div>
        <div class="hire-grid">${hire}</div>
        <div class="section-title"><span>Équipe</span></div>
        <div class="workers">${workers}${emptyHtml}</div>
      </div>`;
  }

  onPanelClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const g = this.game;
    const a = btn.dataset.action;
    const t = this.current;
    if (a === 'close') { g.select(null); return; }
    if (a === 'build') {
      const b = g.build(t, btn.dataset.type);
      if (b) this.open(b);
    } else if (a === 'hire') g.hire(t, btn.dataset.tier);
    else if (a === 'upgrade') g.upgrade(t);
    else if (a === 'promote') g.promote(t.workers[+btn.dataset.idx]);
    else if (a === 'hqclick') g.clickHQ();
    else if (a === 'research') this.openResearch();
  }

  // =====================================================================
  openModal(html) {
    this.modalCard.innerHTML = `<button class="close" data-action="close-modal">✕</button>` + html;
    this.modal.classList.remove('hidden');
    this.tick(true);
  }
  closeModal() { this.modal.classList.add('hidden'); this.modalKind = null; }

  openResearch() {
    this.modalKind = 'research';
    const g = this.game;
    const items = UPGRADES.map((u) => {
      const owned = g.upgrades.has(u.id);
      return `<button class="upg ${owned ? 'owned' : ''}" ${owned ? '' : `data-action="upg" data-id="${u.id}" data-cost="${u.cost}"`}>
        <div class="i">${u.icon}</div><b>${u.name}</b><small>${u.desc}</small>
        <div class="p">${owned ? '✓ Acquis' : money(u.cost)}</div></button>`;
    }).join('');
    this.openModal(`<h2>🔬 Centre de recherche</h2><p>Des améliorations qui boostent <b>tous</b> tes employés.</p><div class="upg-grid">${items}</div>`);
  }

  openStats() {
    this.modalKind = 'stats';
    const g = this.game;
    const s = g.stats;
    const byTier = WORKERS.map((t) => `<div class="big-stat"><small>${t.icon} ${t.name}s</small><b>${g.workers.filter((w) => w.data.tier === t.id).length}</b></div>`).join('');
    const h = Math.floor(s.playTime / 3600), m = Math.floor((s.playTime % 3600) / 60);
    this.openModal(`<h2>📊 Statistiques</h2><p>Les chiffres de ton empire.</p>
      <div class="big-stat-grid">
        <div class="big-stat"><small>💰 Gagné au total</small><b>${money(g.totalEarned)}</b></div>
        <div class="big-stat"><small>📈 Revenus</small><b>${money(g.rate)}/s</b></div>
        <div class="big-stat"><small>🏢 Commerces</small><b>${g.buildings.size}/24</b></div>
        <div class="big-stat"><small>🚚 Livraisons</small><b>${fmt(s.deposits)}</b></div>
        <div class="big-stat"><small>👆 Clics</small><b>${fmt(s.clicks)}</b></div>
        <div class="big-stat"><small>💼 Valises dorées</small><b>${s.golden}</b></div>
        <div class="big-stat"><small>⏱️ Temps de jeu</small><b>${h}h ${m}m</b></div>
        <div class="big-stat"><small>🔬 Recherches</small><b>${g.upgrades.size}/${UPGRADES.length}</b></div>
        ${byTier}
      </div>`);
  }

  openSettings() {
    this.modalKind = 'settings';
    const q = this.engine.quality.high;
    this.openModal(`<h2>⚙️ Paramètres</h2><p>La partie est sauvegardée automatiquement dans ton navigateur.</p>
      <div class="section-title">Graphismes</div>
      <div class="settings-row">
        <button class="btn ${q ? 'gold' : 'locked'}" data-action="q-high">✨ Haute qualité</button>
        <button class="btn ${!q ? 'gold' : 'locked'}" data-action="q-low">⚡ Performance</button>
      </div>
      <div class="section-title">Sauvegarde</div>
      <div class="settings-row">
        <button class="btn" data-action="save">💾 Sauvegarder</button>
        <button class="btn danger" data-action="reset">🗑️ Recommencer à zéro</button>
      </div>`);
  }

  showOffline(amount, elapsed) {
    const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60);
    this.modalKind = 'offline';
    this.openModal(`<div class="offline"><h2>Bon retour, patron ! 👋</h2>
      <p>Pendant ton absence (${h ? h + 'h ' : ''}${m}min), tes employés ont continué à bosser.</p>
      <div class="amount">+${money(amount)}</div>
      <button class="btn gold" data-action="close-modal" style="justify-content:center">Encaisser 💰</button></div>`);
  }

  onModalClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const g = this.game;
    const a = btn.dataset.action;
    if (a === 'close-modal') { if (this.modalKind === 'offline') g.sound.golden(); this.closeModal(); }
    else if (a === 'upg') { g.buyUpgrade(btn.dataset.id); if (g.upgrades.has(btn.dataset.id)) this.openResearch(); }
    else if (a === 'q-high') { this.engine.setQuality(true); this.openSettings(); }
    else if (a === 'q-low') { this.engine.setQuality(false); this.openSettings(); }
    else if (a === 'save') { g.save(); this.toast('💾 Partie sauvegardée', 'success'); }
    else if (a === 'reset') {
      if (confirm('Effacer ta progression et recommencer à zéro ?')) g.reset();
    }
  }

  // =====================================================================
  toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = text;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3200);
  }

  setTooltip(tip) {
    const tt = $('tooltip');
    if (!tip) { tt.classList.add('hidden'); return; }
    tt.textContent = tip;
    tt.classList.remove('hidden');
  }

  showTutorial(step) {
    const el = $('tutorial');
    if (step >= TUTORIAL.length) { el.classList.add('hidden'); return; }
    el.innerHTML = `<small>Étape ${step + 1} / ${TUTORIAL.length}</small>${TUTORIAL[step]}`;
    el.classList.remove('hidden');
    if (step === 3) setTimeout(() => { if (this.game.tutorial === 3) this.game.setTutorial(4); }, 14000);
  }

  /** Light-weight per-frame-ish update (called ~8x/s). */
  tick(force = false) {
    const g = this.game;
    const cashEl = $('cash');
    cashEl.textContent = money(g.cash);
    if (g.cash > this.lastCash + 0.5 && !force) {
      cashEl.classList.remove('pulse');
      void cashEl.offsetWidth;
      cashEl.classList.add('pulse');
    }
    this.lastCash = g.cash;
    $('rate').textContent = '+' + money(g.rate) + '/s';
    $('st-workers').textContent = g.workers.length;
    $('st-buildings').textContent = g.buildings.size;
    const hours = (g.tod * 24 + 0) % 24;
    const hh = Math.floor(hours), mm = Math.floor((hours % 1) * 60);
    $('st-clock').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    $('st-clock-icon').textContent = hours >= 6.5 && hours < 19.5 ? '☀️' : '🌙';

    // affordability on any visible priced button
    const scope = [this.panel, this.modalCard];
    for (const root of scope) {
      root.querySelectorAll('[data-cost]').forEach((el) => {
        el.classList.toggle('poor', g.cash < +el.dataset.cost);
      });
    }
    // research badge
    const any = UPGRADES.some((u) => !g.upgrades.has(u.id) && g.cash >= u.cost);
    $('research-dot').classList.toggle('hidden', !any);

    // live worker progress in building panel
    const t = this.current;
    if (t && t.workers && !this.panel.classList.contains('hidden')) {
      t.workers.forEach((w, idx) => {
        const s = document.getElementById('ws-' + idx);
        const p = document.getElementById('wp-' + idx);
        if (s) s.textContent = w.statusLabel() + (w.boost > 0 ? ' ⚡' : '');
        if (p) {
          let k = 0;
          if (w.state === 'working') k = w.timer / w.workTime();
          else if (w.path) k = w.seg / w.path.length;
          p.style.width = Math.min(100, k * 100) + '%';
          p.style.background = w.state === 'working' ? '' : (w.state === 'toHQ' ? 'linear-gradient(90deg,#f6c544,#ffdd75)' : 'linear-gradient(90deg,#64748b,#94a3b8)');
        }
      });
      const br = document.getElementById('b-rate');
      if (br) br.textContent = money(t.estimatedRate() * (g.rush > 0 ? 2 : 1)) + '/s';
    }
    if (t && t.hq) {
      const r = document.getElementById('hq-rate');
      if (r) r.textContent = money(g.rate) + '/s';
      const c = document.getElementById('hq-click');
      if (c) c.textContent = '+' + money(g.clickValue);
    }
  }
}

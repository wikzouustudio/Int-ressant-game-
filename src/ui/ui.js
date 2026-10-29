import {
  BUSINESSES, BIZ, WORKERS, UPGRADES, MAX_LEVEL, LAW, CANTONS, CANTON, ZONES, ROBOT_UPKEEP, DAYS, DAYS_LONG,
  levelMult, slotsFor, money, fmt, pct, buildTime, demolishTime,
} from '../game/config.js';
import { icon } from './icons.js';
import { TIERS } from '../engine/quality.js';

const $ = (id) => document.getElementById(id);
const sumCharges = (c) => c.avs + c.ac + c.lpp + c.laa + c.af;

const TUTORIAL = [
  `Achète le <b>terrain vide</b> à côté du Siège (le ${icon('plus', 'inline')} vert), puis construis ton premier <b>Stand de limonade</b>. Les <b>bâtiments abandonnés</b> se rachètent et se démolissent.`,
  `Ton permis est <b>mis à l'enquête publique</b> (gabarits), puis le chantier démarre. Le stand ouvre dans quelques secondes…`,
  `Ouvert ! <b>Engage un·e apprenti·e CFC</b> dans le panneau à droite. Il/elle travaille <b>lun–ven, 8h–17h</b> (Loi sur le travail).`,
  `Ton apprenti·e enchaîne ses tâches puis <b>rapporte la recette au Siège</b>. Clique aussi sur le Siège pour encaisser !`,
  `Les <b>salaires</b> sont versés chaque soir à 18h, la <b>TVA</b> et l'<b>impôt</b> chaque lundi. Suis tout dans la <b>Fiduciaire</b> ${icon('receipt', 'inline')}.`,
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

    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });

    game.on('change', () => this.refresh());
    game.on('select', (t) => this.open(t));
    game.on('toast', (t) => this.toast(t.text, t.icon, t.kind));
    game.on('hover', (tip) => this.setTooltip(tip));
    game.on('tutorial', (s) => this.showTutorial(s));
    game.on('settlement', () => $('fidu-dot').classList.remove('hidden'));
    game.on('rush', (on) => {
      $('banner').classList.toggle('hidden', !on);
      $('banner').innerHTML = `${icon('fire')} HEURE DE POINTE — tous les revenus x2 !`;
      $('rush-badge').classList.toggle('hidden', !on);
    });

    this.panel.addEventListener('click', (e) => this.onPanelClick(e));
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal && this.modalKind !== 'canton') this.closeModal();
      this.onModalClick(e);
    });
    $('btn-research').onclick = () => { game.sound.click(); this.openResearch(); };
    $('btn-fidu').onclick = () => { game.sound.click(); $('fidu-dot').classList.add('hidden'); this.openFiduciary(); };
    $('btn-law').onclick = () => { game.sound.click(); this.openLaw(); };
    $('btn-stats').onclick = () => { game.sound.click(); this.openStats(); };
    $('btn-settings').onclick = () => { game.sound.click(); this.openSettings(); };
    $('btn-sound').onclick = () => {
      game.sound.enabled = !game.sound.enabled;
      $('btn-sound').innerHTML = icon(game.sound.enabled ? 'sound' : 'mute');
      try { localStorage.setItem('empire-sound', game.sound.enabled ? '1' : '0'); } catch (e) { /* ignore */ }
    };
    try {
      if (localStorage.getItem('empire-sound') === '0') game.sound.enabled = false;
    } catch (e) { /* ignore */ }
    $('btn-sound').innerHTML = icon(game.sound.enabled ? 'sound' : 'mute');

    window.addEventListener('pointermove', (e) => {
      const tt = $('tooltip');
      tt.style.left = e.clientX + 'px';
      tt.style.top = e.clientY + 'px';
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalKind !== 'canton') { this.closeModal(); game.select(null); }
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
    // Only glide the view when the selection is near the screen edges (or under the panel).
    const c = (target.plot ? target.plot.center : target.center || null);
    if (!c) return;
    const v = c.clone().setY(2).project(this.engine.camera);
    const panelSide = window.innerWidth > 860 ? 0.25 : 0;
    if (v.z > 1 || Math.abs(v.x + panelSide) > 0.55 || v.y > 0.55 || v.y < (window.innerWidth > 860 ? -0.7 : -0.1)) {
      this.engine.focus(c, 150);
    }
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
    else if (t.workers) this.panel.innerHTML = t.open ? this.renderBuilding(t) : this.renderConstruction(t);
    else this.panel.innerHTML = this.renderPlot(t);
    const body = this.panel.querySelector('.panel-body');
    if (body) body.scrollTop = scroll;
    this.tick(true);
  }

  head(iconName, color, title, sub, extra = '') {
    return `<div class="panel-head">
      <div class="icon" style="background:${color}">${icon(iconName)}</div>
      <div><h2>${title}</h2><p>${sub}</p>${extra}</div>
      <button class="close" data-action="close">${icon('close')}</button>
    </div>`;
  }

  plotSteps(plot) {
    const st = [
      ['contract', 'Acheter', plot.owned],
      ['crane', 'Démolir', plot.owned && !plot.ruin],
      ['building', 'Construire', !!plot.building],
    ];
    return `<div class="build-steps three">${st.map(([ic, l, done], k) => {
      const cur = !done && (k === 0 || st[k - 1][2]);
      return `<div class="step ${done ? 'on' : ''} ${cur ? 'cur on' : ''}">${icon(done ? 'check' : ic)}<span>${l}</span></div>`;
    }).join('')}</div>`;
  }

  renderPlot(plot) {
    const g = this.game;
    const zone = ZONES[plot.zone];
    if (!plot.owned) {
      const tax = g.transferTax(plot);
      const title = plot.ruin ? 'Bâtiment abandonné' : 'Terrain à vendre';
      return this.head(plot.ruin ? 'warning' : 'pin', plot.ruin ? 'linear-gradient(135deg,#a8a29e,#57534e)' : 'linear-gradient(135deg,#3ddc84,#16a34a)', title, `${zone.name} · Bloc ${plot.i}, ${plot.j}`) +
        `<div class="panel-body">
          ${this.plotSteps(plot)}
          <div class="kv">
            <div><span>${icon('pin', 'inline')} Prix du terrain</span><b>${money(plot.price)}</b></div>
            <div><span>${icon('percent', 'inline')} Droits de mutation (≈3 %)</span><b>${money(tax)}</b></div>
            ${plot.ruin ? `<div><span>${icon('crane', 'inline')} Démolition ensuite</span><b>${money(g.demolitionPrice(plot))}</b></div>` : ''}
          </div>
          <button class="btn gold big" data-action="buy" data-cost="${plot.price + tax}"><span class="l">${icon('contract')}<span>Acheter${plot.ruin ? ' le bâtiment' : ' le terrain'}<small>Inscription au registre foncier</small></span></span><span class="price">${money(plot.price + tax)}</span></button>
          <div class="law-note">${icon('info', 'inline')} ${plot.ruin ? 'Ce bâtiment est à l\'abandon : achète-le, obtiens un <b>permis de démolir</b>, casse-le puis construis ton commerce à la place.' : 'Terrain constructible : achète-le puis dépose un permis de construire.'}</div>
        </div>`;
    }
    if (plot.ruin) {
      const d = plot.demolish;
      if (d) {
        const k = Math.min(1, d.t / d.total);
        return this.head('crane', 'linear-gradient(135deg,#ffc93c,#f08c00)', 'Démolition en cours', `${zone.name} · Bloc ${plot.i}, ${plot.j}`) +
          `<div class="panel-body">${this.plotSteps(plot)}
            <div class="big-progress"><i id="demo-progress" style="width:${k * 100}%"></i></div>
            <p class="muted" id="demo-left">Terrain dégagé dans ${Math.ceil(d.total - d.t)} s</p>
            <div class="tip-card">${icon('pointer')}<div><b>Clique sur le bâtiment</b> pour aider la pelleteuse à le casser plus vite !</div></div>
          </div>`;
      }
      return this.head('warning', 'linear-gradient(135deg,#a8a29e,#57534e)', 'Ton bâtiment abandonné', `${zone.name} · Bloc ${plot.i}, ${plot.j}`) +
        `<div class="panel-body">${this.plotSteps(plot)}
          <button class="btn red big" data-action="demolish" data-cost="${g.demolitionPrice(plot)}"><span class="l">${icon('crane')}<span>Démolir<small>Permis de démolir + évacuation des déchets</small></span></span><span class="price">${money(g.demolitionPrice(plot))}</span></button>
          <div class="law-note">${icon('scale', 'inline')} La démolition nécessite un <b>permis de démolir</b> et le tri des déchets de chantier (OLED). Durée : ${demolishTime(plot.i, plot.j).toFixed(0)} s.</div>
        </div>`;
    }
    const items = BUSINESSES.map((b) => {
      const biz = BIZ[b.id];
      const unlocked = g.isUnlocked(biz);
      const allowed = biz.zones.includes(plot.zone);
      const price = g.buildPrice(b.id) + g.permitFee(b.id);
      if (!unlocked || !allowed) {
        const why = !allowed
          ? `Interdit en ${zone.name.toLowerCase()} (LAT) — ${biz.zones.map((z) => ZONES[z].short).join(' / ')}`
          : `Construis d'abord : ${BUSINESSES[biz.index - 1].name}`;
        return `<button class="biz locked" disabled>
          <div class="icon" style="background:#334155">${icon(allowed ? 'lock' : 'warning')}</div>
          <div class="info"><b>${b.name}</b><small>${why}</small></div>
          <div class="price">${money(price)}</div></button>`;
      }
      return `<button class="biz" data-action="build" data-type="${b.id}" data-cost="${price}">
        <div class="icon" style="background:${b.color}">${icon(b.id)}</div>
        <div class="info"><b>${b.name}</b><small>${b.desc}</small>
          <span class="inc">+${money(b.income * g.incomeMult)} / livraison · TVA ${pct(g.tvaRate(biz))} · chantier ${buildTime(biz)} s</span></div>
        <div class="price">${money(price)}</div></button>`;
    }).join('');
    return this.head('crane', 'linear-gradient(135deg,#3ddc84,#16a34a)', 'Parcelle à vendre', `${zone.name} · Bloc ${plot.i}, ${plot.j}`) +
      `<div class="panel-body">
        <div class="law-note">${icon('scale', 'inline')} Le prix inclut les émoluments du <b>permis de construire</b> (${pct(LAW.permitRate)}). Chaque projet passe par la <b>mise à l'enquête publique</b> avant le chantier.</div>
        <div class="biz-list">${items}</div></div>`;
  }

  renderConstruction(b) {
    const c = b.construction;
    const k = c.t / c.total;
    const phase = k < 0.3 ? 'Mise à l\'enquête publique' : 'Chantier en cours';
    return this.head(b.typeId, b.biz.color, b.biz.name, 'Projet de construction', '') +
      `<div class="panel-body">
        <div class="build-steps">
          <div class="step ${k >= 0 ? 'on' : ''}">${icon('contract')}<span>Permis déposé</span></div>
          <div class="step ${k >= 0.0 ? 'on' : ''} ${k < 0.3 ? 'cur' : ''}">${icon('scale')}<span>Enquête publique</span></div>
          <div class="step ${k >= 0.3 ? 'on' : ''} ${k >= 0.3 ? 'cur' : ''}">${icon('crane')}<span>Chantier</span></div>
          <div class="step">${icon('door')}<span>Ouverture</span></div>
        </div>
        <div class="big-progress"><i id="build-progress" style="width:${k * 100}%"></i></div>
        <p class="muted" id="build-phase">${phase} — ouverture dans ${Math.ceil(c.total - c.t)} s</p>
        <div class="law-note">${icon('info', 'inline')} Les <b>gabarits</b> (piquets rouges et blancs) montrent le volume du futur bâtiment pendant l'enquête publique, comme le veut le droit cantonal des constructions.</div>
      </div>`;
  }

  renderHQ() {
    const g = this.game;
    const c = g.cantonData;
    return this.head('bank', 'linear-gradient(135deg,#ffe58a,#e09b12)', 'Siège social', `Empire SA · canton de ${c.name}`) +
      `<div class="panel-body">
        <div class="stat-grid">
          <div class="stat"><small>Revenus</small><b class="g" id="hq-rate">${money(g.rate)}/s</b></div>
          <div class="stat"><small>Employés</small><b>${g.workers.length}</b></div>
          <div class="stat"><small>Commerces</small><b>${g.buildings.size}</b></div>
        </div>
        <button class="btn gold" data-action="hqclick"><span class="l">${icon('pointer')}<span>Encaisser<small>Clique aussi directement sur le Siège</small></span></span><span class="price" id="hq-click">+${money(g.clickValue)}</span></button>
        <div class="section-title">Canton du siège</div>
        <div class="kv">
          <div><span>${icon('shield', 'inline')} Canton</span><b>${c.name} (${c.id})</b></div>
          <div><span>${icon('percent', 'inline')} Impôt sur le bénéfice (effectif)</span><b>${pct(c.tax, 2)}</b></div>
          <div><span>${icon('coins', 'inline')} Salaire minimum cantonal</span><b>${c.minWage ? money(c.minWage) + '/h' : 'Aucun'}</b></div>
          <div><span>${icon('team', 'inline')} Allocations familiales</span><b>${pct(c.af, 2)}</b></div>
          <div><span>${icon('scale', 'inline')} TVA</span><b>${g.tvaRegistered ? 'Assujetti' : 'Non assujetti (CA < ' + money(LAW.tvaSeuil) + ')'}</b></div>
        </div>
        <div class="section-title">Raccourcis</div>
        <div class="btn-col">
          <button class="btn purple" data-action="fidu"><span class="l">${icon('receipt')}<span>Fiduciaire<small>Compte de résultat, TVA, impôts, salaires</small></span></span><span class="price">→</span></button>
          <button class="btn blue" data-action="research"><span class="l">${icon('bulb')}<span>Recherche<small>Améliorations pour tout l'empire</small></span></span><span class="price">→</span></button>
        </div>
      </div>`;
  }

  renderBuilding(b) {
    const g = this.game;
    const biz = b.biz;
    const stars = Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < b.level ? 'on' : ''}"></i>`).join('');
    const slots = b.slots;
    const perTrip = biz.income * levelMult(b.level) * g.incomeMult;

    const workers = b.workers.map((w, idx) => {
      const pr = g.promotion(w);
      let promo = '';
      if (pr) {
        promo = !pr.ok
          ? `<button class="mini" disabled title="${pr.to.name}">${icon('lock', 'inline')} ${pr.reason}</button>`
          : `<button class="mini" data-action="promote" data-idx="${idx}" ${pr.cost ? `data-cost="${pr.cost}"` : ''} title="${pr.cost ? 'Formation continue' : 'Engager après le CFC'} → ${pr.to.name}">${icon('up', 'inline')} ${pr.cost ? money(pr.cost) : 'CFC'}</button>`;
      }
      const sev = g.severance(w);
      const fireTitle = w.human
        ? `Résilier le contrat — ${w.data.days < LAW.trialDays ? 'période d\'essai : délai de 7 jours (CO 335b)' : 'délai de congé d\'un mois (CO 335c)'} : ${money(sev)}`
        : 'Revendre le robot';
      const wage = w.human ? `${money(g.wage(w))}/h` : `entretien ${pct(ROBOT_UPKEEP, 0)} du CA`;
      return `<div class="worker">
        <div class="avatar" style="background:${w.tier.color}2e">${icon(w.tier.icon)}</div>
        <div class="info"><b>${w.data.name}<span class="tier-tag" style="background:${w.tier.color}">${w.tier.short}</span></b>
          <small id="ws-${idx}">${w.statusLabel()}</small>
          <div class="progress"><i id="wp-${idx}"></i></div>
          <small class="wage">${wage}${w.human ? ` · ${w.data.days} j travaillés${w.data.days < LAW.trialDays ? ' · essai' : ''}` : ''}</small></div>
        <div class="w-actions">${promo}<button class="mini red" data-action="fire" data-idx="${idx}" ${sev ? `data-cost="${sev}"` : ''} title="${fireTitle}">${icon('userMinus', 'inline')}</button></div>
      </div>`;
    }).join('');
    const empty = Math.max(0, slots - b.workers.length);
    const emptyHtml = empty ? `<div class="empty-slot">${empty} poste${empty > 1 ? 's' : ''} vacant${empty > 1 ? 's' : ''} — engage quelqu'un !</div>` : '';

    const full = b.workers.length >= slots;
    const hire = WORKERS.map((t) => {
      const locked = b.level < t.unlock;
      const price = g.hirePrice(b, t.id);
      if (locked) {
        return `<button class="hire locked" disabled><div class="t">${icon('lock')}${t.short}</div><div class="d">Niveau ${t.unlock} requis</div><div class="p">—</div></button>`;
      }
      const fake = { human: t.human, data: { tier: t.id }, tier: t, building: b };
      const wage = t.human ? `${money(g.wage(fake))}/h + ${pct(g.employerCostRate(fake) - 1, 1)} charges` : `24h/24 · entretien ${pct(ROBOT_UPKEEP, 0)}`;
      return `<button class="hire ${full ? 'locked' : ''}" ${full ? 'disabled' : ''} data-action="hire" data-tier="${t.id}" data-cost="${price}">
        <div class="t">${icon(t.icon)}${t.short}</div>
        <div class="d">x${t.mult} productivité · ${wage}</div>
        <div class="p">${full ? 'Complet' : money(price)}</div></button>`;
    }).join('');

    let up;
    if (b.level >= MAX_LEVEL) {
      up = `<button class="btn locked" disabled><span class="l">${icon('trophy')}<span>Niveau maximum atteint</span></span></button>`;
    } else {
      const price = g.upgradePrice(b);
      const nextSlots = slotsFor(b.level + 1);
      const unlockTier = WORKERS.find((t) => t.unlock === b.level + 1);
      const perks = ['revenus x1.6'];
      if (nextSlots > slots) perks.push('+1 poste');
      if (unlockTier) perks.push(`débloque ${unlockTier.short}`);
      up = `<button class="btn gold" data-action="upgrade" data-cost="${price}"><span class="l">${icon('up')}<span>Agrandir → Niv. ${b.level + 1}<small>${perks.join(' · ')}</small></span></span><span class="price">${money(price)}</span></button>`;
    }

    const tasks = biz.tasks.map((t, i) => `<li><span class="n">${i + 1}</span>${t.label}<em>${t.at === 'in' ? 'à l\'intérieur' : 'dehors'}</em></li>`).join('') +
      `<li><span class="n">${biz.tasks.length + 1}</span>Apporte la recette au Siège<em>${icon('bag', 'inline')}</em></li>`;
    const hours = biz.sunday ? 'Lun–Ven 8h–17h · Dim 6h–11h (OLT 2)' : 'Lun–Ven 8h–17h';

    return this.head(b.typeId, biz.color, biz.name, biz.desc, `<div class="stars">${stars}</div>`) +
      `<div class="panel-body">
        <div class="stat-grid">
          <div class="stat"><small>Par livraison</small><b>${money(perTrip)}</b></div>
          <div class="stat"><small>Revenus</small><b class="g" id="b-rate">${money(b.estimatedRate(true))}/s</b></div>
          <div class="stat"><small>Postes</small><b>${b.workers.length}/${slots}</b></div>
        </div>
        ${up}
        <div class="section-title"><span>Engager</span><span>${b.workers.length}/${slots}</span></div>
        <div class="hire-grid">${hire}</div>
        <div class="section-title"><span>Équipe</span></div>
        <div class="workers">${workers}${emptyHtml}</div>
        <div class="section-title"><span>Déroulé du travail</span></div>
        <ol class="tasks">${tasks}</ol>
        <div class="section-title"><span>Cadre légal</span></div>
        <div class="kv">
          <div><span>${icon('clock', 'inline')} Horaires (LTr)</span><b>${hours}</b></div>
          <div><span>${icon('calendar', 'inline')} Durée max. hebdo (LTr art. 9)</span><b>${biz.weekly} h</b></div>
          <div><span>${icon('percent', 'inline')} TVA sur les ventes</span><b>${pct(g.tvaRate(biz))}${biz.tva === 'reduit' ? ' (taux réduit)' : ''}</b></div>
          <div><span>${icon('shield', 'inline')} Prime LAA (accidents prof.)</span><b>${pct(biz.laa, 1)}</b></div>
          <div><span>${icon('pin', 'inline')} Zone (LAT)</span><b>${ZONES[b.plot.zone].name}</b></div>
        </div>
      </div>`;
  }

  onPanelClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const g = this.game;
    const a = btn.dataset.action;
    const t = this.current;
    if (a === 'close') { g.select(null); return; }
    if (a === 'buy') g.buyPlot(t);
    else if (a === 'demolish') g.startDemolition(t);
    else if (a === 'build') {
      const b = g.build(t, btn.dataset.type);
      if (b) this.open(b);
    } else if (a === 'hire') g.hire(t, btn.dataset.tier);
    else if (a === 'upgrade') g.upgrade(t);
    else if (a === 'promote') g.promote(t.workers[+btn.dataset.idx]);
    else if (a === 'fire') {
      const w = t.workers[+btn.dataset.idx];
      if (!w) return;
      const msg = w.human
        ? `Résilier le contrat de ${w.data.name} ?\n\nDélai de congé (${w.data.days < LAW.trialDays ? 'période d\'essai, CO art. 335b' : 'CO art. 335c'}) payé : ${money(g.severance(w))}`
        : `Revendre ${w.data.name} ?`;
      if (confirm(msg)) g.fire(w);
    } else if (a === 'hqclick') g.clickHQ();
    else if (a === 'research') this.openResearch();
    else if (a === 'fidu') this.openFiduciary();
  }

  // =====================================================================
  openModal(html, kind) {
    this.modalKind = kind;
    const closable = kind !== 'canton';
    this.modalCard.innerHTML = (closable ? `<button class="close" data-action="close-modal">${icon('close')}</button>` : '') + html;
    this.modal.classList.remove('hidden');
    this.tick(true);
  }
  closeModal() { this.modal.classList.add('hidden'); this.modalKind = null; }

  openCanton() {
    const items = CANTONS.map((c) => `<button class="canton" data-action="canton" data-id="${c.id}">
      <div class="crest">${icon('shield')}<b>${c.id}</b></div>
      <div class="info"><b>${c.name}</b><small>${c.note}</small>
        <div class="tags"><span>Impôt ${pct(c.tax, 1)}</span><span>${c.minWage ? 'Salaire min. ' + money(c.minWage) + '/h' : 'Pas de salaire min.'}</span><span>Salaires ×${c.wageIdx.toFixed(2)}</span></div></div>
    </button>`).join('');
    this.openModal(`<div class="modal-hero">${icon('swiss', 'hero')}<div><h2>Fonde ta société anonyme</h2>
      <p>Choisis le <b>canton du siège</b> d'Empire SA. Il détermine l'impôt sur le bénéfice, le salaire minimum et le niveau des salaires.</p></div></div>
      <div class="canton-grid">${items}</div>
      <p class="fine">Taux et montants approximatifs (2024–2025), simplifiés pour le jeu. Ce n'est pas un conseil juridique ou fiscal.</p>`, 'canton');
  }

  openResearch() {
    const g = this.game;
    const items = UPGRADES.map((u) => {
      const owned = g.upgrades.has(u.id);
      return `<button class="upg ${owned ? 'owned' : ''}" ${owned ? '' : `data-action="upg" data-id="${u.id}" data-cost="${u.cost}"`}>
        <div class="i">${icon(u.icon)}</div><b>${u.name}</b><small>${u.desc}</small>
        <div class="p">${owned ? icon('check', 'inline') + ' Acquis' : money(u.cost)}</div></button>`;
    }).join('');
    this.openModal(`<h2>${icon('bulb', 'title')} Centre de recherche</h2><p>Des améliorations qui boostent <b>tous</b> tes employés.</p><div class="upg-grid">${items}</div>`, 'research');
  }

  ledgerTable(l, title, final) {
    const ch = sumCharges(l.charges);
    const profit = l.sales - l.wages - ch - l.robots - l.fees;
    const tax = final ? l.tax : Math.max(0, profit) * this.game.cantonData.tax;
    const row = (label, v, cls = '') => `<div class="row ${cls}"><span>${label}</span><b>${v < 0 ? '− ' + money(-v) : money(v)}</b></div>`;
    return `<div class="ledger"><h3>${title}</h3>
      ${row('Chiffre d\'affaires net (hors TVA)', l.sales, 'pos')}
      ${row('Salaires bruts', -l.wages)}
      ${row('AVS / AI / APG (5,3 %)', -l.charges.avs, 'sub')}
      ${row('Assurance-chômage AC (1,1 %)', -l.charges.ac, 'sub')}
      ${row('Prévoyance LPP (2e pilier)', -l.charges.lpp, 'sub')}
      ${row('Assurance-accidents LAA', -l.charges.laa, 'sub')}
      ${row('Allocations familiales', -l.charges.af, 'sub')}
      ${row('Entretien des robots', -l.robots)}
      ${row('Frais (permis, recrutement, résiliations, RC)', -l.fees)}
      ${row('Bénéfice avant impôt', profit, 'total')}
      ${row(`Impôt sur le bénéfice (${pct(this.game.cantonData.tax, 2)})`, -tax)}
      ${row('Bénéfice net', profit - tax, 'total')}
      <div class="row tva"><span>${icon('scale', 'inline')} TVA collectée à reverser à l'AFC</span><b>${money(l.tva)}</b></div>
    </div>`;
  }

  openFiduciary() {
    const g = this.game;
    const nextMonday = (7 - g.weekday) % 7 || 7;
    const html = `<h2>${icon('receipt', 'title')} Fiduciaire</h2>
      <p>Comptabilité d'Empire SA · canton de ${g.cantonData.name} · semaine ${g.weekNo}</p>
      <div class="kv two">
        <div><span>${icon('contract', 'inline')} Salaires à verser ce soir (18h)</span><b>${money(g.pending.wages + g.pending.charges)}</b></div>
        <div><span>${icon('calendar', 'inline')} Prochain décompte TVA / impôt</span><b>${DAYS_LONG[0]} (dans ${nextMonday} j)</b></div>
        <div><span>${icon('scale', 'inline')} Statut TVA</span><b>${g.tvaRegistered ? 'Assujetti · registre du commerce' : `Exonéré jusqu'à ${money(LAW.tvaSeuil)} de CA`}</b></div>
        <div><span>${icon('coins', 'inline')} Total versé</span><b>Salaires ${money(g.stats.wagesPaid)} · Impôts ${money(g.stats.taxesPaid)} · TVA ${money(g.stats.tvaPaid)}</b></div>
      </div>
      <div class="ledgers">
        ${this.ledgerTable(g.week, `Semaine ${g.weekNo} (en cours)`, false)}
        ${g.lastWeek ? this.ledgerTable(g.lastWeek, `Semaine ${g.lastWeek.weekNo} (clôturée)`, true) : `<div class="ledger empty">${icon('hourglass')}<p>Le premier décompte aura lieu lundi à minuit.</p></div>`}
      </div>
      <p class="fine">Simplifications : les investissements (construction, agrandissements, recherche) ne sont pas amortis ; seule la part patronale des cotisations est comptée.</p>`;
    this.openModal(html, 'fidu');
  }

  openLaw() {
    const c = this.game.cantonData;
    const items = [
      ['clock', 'Loi sur le travail (LTr)', `Travail de jour <b>8h–17h</b>, du lundi au vendredi. Durée max. hebdomadaire <b>45 h</b> (industrie, bureaux) ou <b>50 h</b> (artisanat) — art. 9 et 10.`],
      ['coffee', 'Pauses (LTr art. 15)', `Pause obligatoire d'au moins <b>30 minutes</b> au-delà de 7 h de travail : tes employés prennent leur pause café à <b>12h</b>. Les pauses ne sont pas payées.`],
      ['moon', 'Travail de nuit et du dimanche (LTr art. 16 et 18)', `Interdits sans autorisation : les humains rentrent chez eux le soir et le week-end. Exception : les <b>boulangeries</b> peuvent ouvrir le dimanche matin (OLT 2 art. 27). Les <b>robots</b> ne sont pas soumis à la LTr.`],
      ['book', 'Formation professionnelle (LFPr)', `Les <b>apprenti·e·s CFC</b> vont à l'école professionnelle le <b>mercredi</b> (jour payé). Après ${LAW.cfcDays} jours ouvrés, ils obtiennent leur CFC et peuvent être engagés comme employé·e·s.`],
      ['contract', 'Contrat de travail (CO)', `Période d'essai : les <b>${LAW.trialDays} premiers jours</b>, délai de congé de 7 jours (art. 335b). Ensuite, délai de congé d'<b>un mois</b> (art. 335c), payé lors d'une résiliation.`],
      ['shield', 'Assurances sociales', `Part patronale : <b>AVS/AI/APG 5,3 %</b>, <b>AC 1,1 %</b>, <b>LPP ≈ 7 %</b> (pas pour les apprentis, sous le seuil d'entrée), <b>LAA</b> selon le risque du métier, <b>allocations familiales ${pct(c.af, 2)}</b> (${c.name}).`],
      ['coins', 'Salaire minimum', c.minWage ? `Le canton de <b>${c.name}</b> impose un salaire minimum de <b>${money(c.minWage)}/h</b> (les apprentis en sont exclus).` : `Pas de salaire minimum cantonal à <b>${c.name}</b>. (Genève, Neuchâtel, Bâle-Ville, Tessin et le Jura en ont un.)`],
      ['scale', 'TVA (LTVA)', `Assujettissement dès <b>${money(LAW.tvaSeuil)}</b> de chiffre d'affaires. Taux normal <b>8,1 %</b>, taux réduit <b>2,6 %</b> pour les denrées alimentaires (limonade, boulangerie). Décompte chaque semaine.`],
      ['percent', 'Impôt sur le bénéfice', `Taux effectif (fédéral + cantonal + communal) de <b>${pct(c.tax, 2)}</b> à ${c.name}, prélevé chaque lundi sur le bénéfice de la semaine.`],
      ['pin', 'Aménagement du territoire (LAT)', `Les parcelles sont en <b>zone mixte</b> (commerces, bureaux) ou en <b>zone industrielle</b> (usine, mine, spatioport). Chaque construction exige un <b>permis de construire</b> et une <b>mise à l'enquête publique</b> avec gabarits.`],
      ['building', 'Registre du commerce (ORC art. 36)', `Inscription obligatoire dès <b>${money(LAW.rcSeuil)}</b> de chiffre d'affaires (émolument ${money(LAW.rcFee)}).`],
    ];
    this.openModal(`<h2>${icon('scale', 'title')} Cadre légal suisse</h2><p>Les règles appliquées dans le jeu (simplifiées).</p>
      <div class="law-list">${items.map(([ic, t, d]) => `<div class="law">${icon(ic)}<div><b>${t}</b><p>${d}</p></div></div>`).join('')}</div>
      <p class="fine">Valeurs approximatives (2024–2025), adaptées au rythme du jeu. Ce n'est pas un conseil juridique.</p>`, 'law');
  }

  openStats() {
    const g = this.game;
    const s = g.stats;
    const byTier = WORKERS.map((t) => `<div class="big-stat"><small>${icon(t.icon, 'inline')} ${t.short}s</small><b>${g.workers.filter((w) => w.data.tier === t.id).length}</b></div>`).join('');
    const h = Math.floor(s.playTime / 3600), m = Math.floor((s.playTime % 3600) / 60);
    this.openModal(`<h2>${icon('stats', 'title')} Statistiques</h2><p>Les chiffres de ton empire.</p>
      <div class="big-stat-grid">
        <div class="big-stat"><small>${icon('coins', 'inline')} CA cumulé</small><b>${money(g.totalEarned)}</b></div>
        <div class="big-stat"><small>${icon('stats', 'inline')} Revenus</small><b>${money(g.rate)}/s</b></div>
        <div class="big-stat"><small>${icon('building', 'inline')} Commerces</small><b>${g.buildings.size}/24</b></div>
        <div class="big-stat"><small>${icon('bag', 'inline')} Livraisons</small><b>${fmt(s.deposits)}</b></div>
        <div class="big-stat"><small>${icon('contract', 'inline')} Salaires versés</small><b>${money(s.wagesPaid)}</b></div>
        <div class="big-stat"><small>${icon('percent', 'inline')} Impôts payés</small><b>${money(s.taxesPaid)}</b></div>
        <div class="big-stat"><small>${icon('briefcase', 'inline')} Valises dorées</small><b>${s.golden}</b></div>
        <div class="big-stat"><small>${icon('clock', 'inline')} Temps de jeu</small><b>${h}h ${m}m</b></div>
        ${byTier}
      </div>`, 'stats');
  }

  openSettings() {
    const q = this.quality;
    const tierBtn = (mode, label, sub) => {
      const on = q && q.mode === mode;
      return `<button class="btn ${on ? 'gold' : 'locked'}" data-action="q-mode" data-mode="${mode}">${label}<small>${sub}</small></button>`;
    };
    const cur = q ? TIERS[q.tier].name : '';
    this.openModal(`<h2>${icon('gear', 'title')} Paramètres</h2><p>La partie est sauvegardée automatiquement dans ton navigateur.</p>
      <div class="section-title"><span>Qualité graphique</span><span>actuelle : ${cur}</span></div>
      <div class="settings-row q5">
        ${tierBtn('auto', 'Auto', 'adaptée à l\'appareil')}
        ${TIERS.map((t, i) => tierBtn(i, t.name, ['Économie', 'Équilibré', 'Beau', 'Maximum'][i])).join('')}
      </div>
      <div class="section-title">Images par seconde</div>
      <div class="settings-row">
        <button class="btn ${q?.fpsCap === 60 ? 'gold' : 'locked'}" data-action="q-fps" data-fps="60">60 FPS<small>fluide</small></button>
        <button class="btn ${q?.fpsCap === 30 ? 'gold' : 'locked'}" data-action="q-fps" data-fps="30">30 FPS<small>moins de chauffe et de batterie</small></button>
      </div>
      <div class="section-title">Diagnostic</div>
      <div class="settings-row">
        <button class="btn ${this.overlay?.enabled ? 'gold' : 'locked'}" data-action="q-perf">${icon('stats', 'inline')} Statistiques de performance</button>
      </div>
      <div class="section-title">Sauvegarde</div>
      <div class="settings-row">
        <button class="btn" data-action="save">${icon('check', 'inline')} Sauvegarder</button>
        <button class="btn danger" data-action="reset">${icon('warning', 'inline')} Recommencer à zéro</button>
      </div>`, 'settings');
  }

  showOffline(amount, elapsed) {
    const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60);
    this.openModal(`<div class="offline">${icon('coins', 'hero')}<h2>Bon retour, patron·ne !</h2>
      <p>Pendant ton absence (${h ? h + 'h ' : ''}${m}min), ton empire a continué de tourner (horaires légaux, après salaires et impôts).</p>
      <div class="amount">+${money(amount)}</div>
      <button class="btn gold" data-action="close-modal" style="justify-content:center">Encaisser</button></div>`, 'offline');
  }

  onModalClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const g = this.game;
    const a = btn.dataset.action;
    if (a === 'close-modal') { if (this.modalKind === 'offline') g.sound.golden(); this.closeModal(); }
    else if (a === 'canton') {
      g.chooseCanton(btn.dataset.id);
      this.closeModal();
      this.showTutorial(g.tutorial);
    } else if (a === 'upg') { g.buyUpgrade(btn.dataset.id); if (g.upgrades.has(btn.dataset.id)) this.openResearch(); }
    else if (a === 'q-mode') { const m = btn.dataset.mode; this.quality.setMode(m === 'auto' ? 'auto' : +m); this.openSettings(); }
    else if (a === 'q-fps') { this.quality.setFpsCap(+btn.dataset.fps); this.openSettings(); }
    else if (a === 'q-perf') { this.overlay.toggle(!this.overlay.enabled); this.openSettings(); }
    else if (a === 'save') { g.save(); this.toast('Partie sauvegardée', 'check', 'success'); }
    else if (a === 'reset') {
      if (confirm('Effacer ta progression et recommencer à zéro ?')) g.reset();
    }
  }

  // =====================================================================
  toast(text, iconName = 'info', kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = `${icon(iconName)}<span>${text}</span>`;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3800);
  }

  setTooltip(tip) {
    const tt = $('tooltip');
    if (!tip) { tt.classList.add('hidden'); return; }
    if (tt.dataset.tip !== tip) { tt.innerHTML = tip; tt.dataset.tip = tip; }
    tt.classList.remove('hidden');
  }

  showTutorial(step) {
    const el = $('tutorial');
    if (step >= TUTORIAL.length || !this.game.canton) { el.classList.add('hidden'); return; }
    el.innerHTML = `${icon('bulb', 'tuto-icon')}<div><small>Étape ${step + 1} / ${TUTORIAL.length}</small>${TUTORIAL[step]}</div>`;
    el.classList.remove('hidden');
    if (step === 4) setTimeout(() => { if (this.game.tutorial === 4) this.game.setTutorial(5); }, 16000);
  }

  /** Light-weight update (called ~8x/s). */
  tick(force = false) {
    const g = this.game;
    const cashEl = $('cash');
    cashEl.textContent = money(g.cash);
    cashEl.classList.toggle('neg', g.cash < 0);
    if (g.cash > this.lastCash + 0.5 && !force) {
      cashEl.classList.remove('pulse');
      void cashEl.offsetWidth;
      cashEl.classList.add('pulse');
    }
    this.lastCash = g.cash;
    $('rate').textContent = '+' + money(g.rate) + '/s';
    $('st-workers').textContent = g.workers.length;
    $('st-buildings').textContent = g.buildings.size;
    const h = g.hour;
    const hh = Math.floor(h), mm = Math.floor((h % 1) * 60);
    $('st-clock').textContent = `${DAYS[g.weekday]} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    $('st-week').textContent = `Sem. ${g.weekNo}`;
    const day = h >= 6.5 && h < 19.5;
    if (this.dayIcon !== day) { this.dayIcon = day; $('st-clock-icon').innerHTML = icon(day ? 'sun' : 'moon'); }
    const open = g.workers.some((w) => w.active);
    const fast = g.clockSpeed > 10;
    const status = !g.workers.length ? 'Aucun employé' : open ? 'Ouvert' : (g.weekday >= 5 ? 'Week-end' : 'Fermé');
    const st = $('st-open');
    st.textContent = fast ? status + ' · ×10' : status;
    st.className = 'open-tag ' + (open ? 'on' : 'off');
    if (g.canton) $('st-canton').textContent = g.canton;

    const scope = [this.panel, this.modalCard];
    for (const root of scope) {
      root.querySelectorAll('[data-cost]').forEach((el) => {
        el.classList.toggle('poor', g.cash < +el.dataset.cost);
      });
    }
    const any = UPGRADES.some((u) => !g.upgrades.has(u.id) && g.cash >= u.cost);
    $('research-dot').classList.toggle('hidden', !any);

    const t = this.current;
    if (t && t.workers && !this.panel.classList.contains('hidden')) {
      if (!t.open) {
        const c = t.construction;
        const bar = document.getElementById('build-progress');
        const ph = document.getElementById('build-phase');
        if (bar) bar.style.width = (c.t / c.total) * 100 + '%';
        if (ph) ph.textContent = `${c.t / c.total < 0.3 ? 'Mise à l\'enquête publique' : 'Chantier en cours'} — ouverture dans ${Math.max(0, Math.ceil(c.total - c.t))} s`;
        if (c.t / c.total >= 0.3 && !this.panel.querySelector('.step.on:nth-child(3)')) this.render();
      } else {
        t.workers.forEach((w, idx) => {
          const s = document.getElementById('ws-' + idx);
          const p = document.getElementById('wp-' + idx);
          if (s) s.textContent = w.statusLabel() + (w.boost > 0 ? ' · motivé·e' : '');
          if (p) {
            let k = 0;
            if (w.state === 'task') k = (w.taskIndex + Math.min(1, w.timer / w.taskDuration(w.taskIndex))) / (t.biz.tasks.length + 1);
            else if (w.state === 'move') k = w.taskIndex / (t.biz.tasks.length + 1);
            else if (w.state === 'toHQ' && w.path) k = (t.biz.tasks.length + w.seg / w.path.length) / (t.biz.tasks.length + 1);
            else if (w.path && w.state !== 'home') k = w.seg / w.path.length;
            p.style.width = Math.min(100, k * 100) + '%';
            p.style.background = w.state === 'toHQ' ? 'linear-gradient(90deg,#f6c544,#ffdd75)'
              : (w.state === 'home' || w.state.startsWith('commute') || w.state === 'toWork') ? 'linear-gradient(90deg,#64748b,#94a3b8)' : '';
          }
        });
        const br = document.getElementById('b-rate');
        if (br) br.textContent = money(t.estimatedRate(true) * (g.rush > 0 ? 2 : 1)) + '/s';
      }
    }
    if (t && t.demolish) {
      const d = t.demolish;
      const bar = document.getElementById('demo-progress');
      const left = document.getElementById('demo-left');
      if (bar) bar.style.width = Math.min(100, (d.t / d.total) * 100) + '%';
      if (left) left.textContent = `Terrain dégagé dans ${Math.max(0, Math.ceil(d.total - d.t))} s`;
    }
    if (t && t.hq) {
      const r = document.getElementById('hq-rate');
      if (r) r.textContent = money(g.rate) + '/s';
      const c = document.getElementById('hq-click');
      if (c) c.textContent = '+' + money(g.clickValue);
    }
  }
}

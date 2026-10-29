/* ============================================================
   Views : fonctions qui renvoient le HTML de chaque écran
   ============================================================ */
const Views = (() => {
  const { icon, esc } = U;

  const EMOJIS = ['🎯', '📚', '💼', '🧹', '💪', '🍳', '📬', '🎨', '🧠', '🎸', '🌱', '🛒', '✈️', '💻', '🧘', '📊'];
  const COLORS = ['#3a7bd5', '#e5484d', '#2ba640', '#8e4ec6', '#f76b15', '#0090a8', '#d6409f', '#a18072'];
  const DURATIONS = [5, 10, 15, 25, 30, 45, 60, 90, 120, 180];

  const pct = (t) => Math.min(100, (t.focus / (t.duration * 60)) * 100);
  const shortTitle = (s) => s.split(/\s+/).slice(0, 4).join(' ');

  const avatar = (c, tag = 'span', extra = '') =>
    `<${tag} class="ch-avatar" style="background:${c.color}" ${tag === 'a' ? `href="#channel-${c.id}"` : ''} ${extra}>${esc(c.emoji)}</${tag}>`;

  function thumb(t) {
    const c = Store.channel(t.channel);
    const p = pct(t);
    return `<div class="thumb" style="${U.thumbBg(c.color, t.id)}">
      <span class="thumb-emoji">${esc(t.emoji || '🎯')}</span>
      <span class="thumb-title">${esc(shortTitle(t.title))}</span>
      ${t.done ? `<span class="badge-done">${icon('check')}Terminé</span>` : ''}
      <span class="badge-time">${U.clock(t.duration * 60)}</span>
      ${p > 0 || t.done ? `<div class="watch-bar"><span style="width:${t.done ? 100 : p}%"></span></div>` : ''}
      <div class="thumb-actions">
        <button data-action="later" data-id="${t.id}" class="${t.later ? 'on' : ''}" title="${t.later ? 'Retirer de « Plus tard »' : 'À regarder plus tard'}" aria-label="Plus tard">${icon('later')}</button>
        <button data-action="done" data-id="${t.id}" title="${t.done ? 'Remettre à faire' : 'Marquer comme terminée'}" aria-label="Terminer">${icon(t.done ? 'replay' : 'check')}</button>
      </div>
    </div>`;
  }

  const meta = (t) => `${U.plural(t.sessions, 'session', 'sessions')} • ${t.done && t.doneAt ? 'terminée ' + U.timeAgo(t.doneAt) : U.timeAgo(t.createdAt)}`;

  function card(t) {
    const c = Store.channel(t.channel);
    return `<article class="card ${t.done ? 'is-done' : ''}" data-open="${t.id}">
      ${thumb(t)}
      <div class="card-body">
        ${avatar(c, 'a', `aria-label="${esc(c.name)}"`)}
        <div class="card-text">
          <h3 class="card-title" title="${esc(t.title)}">${esc(t.title)}</h3>
          <div class="card-meta"><a href="#channel-${c.id}">${esc(c.name)}</a><br>${meta(t)}</div>
        </div>
      </div>
    </article>`;
  }

  function miniCard(t) {
    const c = Store.channel(t.channel);
    return `<article class="mini-card" data-open="${t.id}">
      ${thumb(t)}
      <div class="card-text">
        <h3 class="card-title">${esc(t.title)}</h3>
        <div class="card-meta">${esc(c.name)}<br>${meta(t)}</div>
      </div>
    </article>`;
  }

  const grid = (tasks, empty) => tasks.length
    ? `<section class="grid">${tasks.map(card).join('')}</section>`
    : emptyState(empty);

  const emptyState = ({ emoji, title, text, cta = true }) => `<div class="empty">
    <div class="big">${emoji}</div><h2>${title}</h2><p>${text}</p>
    ${cta ? `<button class="btn blue" data-action="new-task">${icon('add')}Créer une tâche</button>` : ''}
  </div>`;

  /* ---------- Sidebar ---------- */
  function sidebar(route) {
    const active = Store.tasks.filter(t => !t.done);
    const link = (href, ic, label, count, key) =>
      `<a class="side-link ${route === key ? 'active' : ''}" href="#${href}">${icon(ic)}<span class="label">${label}</span>${count != null ? `<span class="count">${count}</span>` : ''}</a>`;
    return `
      <div class="side-section side-main">
        ${link('home', 'home', 'Accueil', active.length, 'home')}
        ${link('later', 'later', 'Plus tard', active.filter(t => t.later).length, 'later')}
        ${link('history', 'history', 'Historique', Store.tasks.filter(t => t.done).length, 'history')}
        ${link('studio', 'studio', 'Studio', null, 'studio')}
      </div>
      <div class="side-section">
        <div class="side-title">Abonnements</div>
        ${Store.channels.map(c => `<a class="side-link ${route === 'channel-' + c.id ? 'active' : ''}" href="#channel-${c.id}">
          ${avatar(c)}<span class="label">${esc(c.name)}</span><span class="count">${active.filter(t => t.channel === c.id).length}</span></a>`).join('')}
        <button class="side-link" data-action="new-channel">${icon('add')}<span class="label">Nouvelle chaîne</span></button>
      </div>
      <div class="side-foot">
        Raccourcis : <kbd>/</kbd> rechercher · <kbd>N</kbd> créer · <kbd>K</kbd> lecture/pause · <kbd>L</kbd> liker<br>
        © ${new Date().getFullYear()} FocusTube — fait maison
      </div>`;
  }

  /* ---------- Accueil ---------- */
  const FILTERS = [
    { id: 'all', label: 'Tout', test: () => true },
    { id: 'progress', label: 'En cours', test: t => t.focus > 0 },
    { id: 'short', label: 'Courtes (≤ 15 min)', test: t => t.duration <= 15 },
    { id: 'new', label: 'Nouveautés', test: t => Date.now() - t.createdAt < 86400000 * 2 },
  ];

  function home(filter) {
    const chFilters = Store.channels.map(c => ({ id: 'ch:' + c.id, label: `${c.emoji} ${c.name}`, test: t => t.channel === c.id }));
    const all = [...FILTERS, ...chFilters];
    const f = all.find(x => x.id === filter) || all[0];
    const tasks = Store.tasks.filter(t => !t.done && f.test(t));
    return `
      <div class="chips" role="tablist">
        ${all.map(x => `<button class="chip ${x.id === f.id ? 'active' : ''}" data-action="filter" data-filter="${esc(x.id)}" role="tab" aria-selected="${x.id === f.id}">${esc(x.label)}</button>`).join('')}
      </div>
      ${grid(tasks, Store.tasks.some(t => !t.done)
        ? { emoji: '🔎', title: 'Rien dans ce filtre', text: 'Essaie un autre filtre ou crée une nouvelle tâche.' }
        : { emoji: '🏆', title: 'Tout est terminé !', text: 'Plus rien à faire. Profite ou programme la suite.' })}`;
  }

  const pageHead = (title, sub) => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div>`;

  function later() {
    const tasks = Store.tasks.filter(t => t.later && !t.done);
    return pageHead('À regarder plus tard', U.plural(tasks.length, 'tâche', 'tâches') + ' mises de côté')
      + grid(tasks, { emoji: '🕒', title: 'Ta liste est vide', text: 'Survole une tâche et clique sur l’horloge pour la garder pour plus tard.', cta: false });
  }

  function history() {
    const tasks = Store.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    return pageHead('Historique', 'Tout ce que tu as terminé. Bien joué.')
      + grid(tasks, { emoji: '📜', title: 'Aucune tâche terminée', text: 'Mets un pouce bleu sur une tâche pour la terminer : elle arrivera ici.', cta: false });
  }

  function results(q) {
    const needle = q.toLowerCase();
    const tasks = Store.tasks.filter(t => (t.title + ' ' + t.description + ' ' + Store.channel(t.channel).name).toLowerCase().includes(needle));
    return pageHead(`Résultats pour « ${esc(q)} »`, U.plural(tasks.length, 'tâche trouvée', 'tâches trouvées'))
      + grid(tasks, { emoji: '🔍', title: 'Aucun résultat', text: 'Vérifie l’orthographe ou crée cette tâche.' });
  }

  function channelPage(id) {
    const c = Store.channels.find(x => x.id === id);
    if (!c) return emptyState({ emoji: '🤷', title: 'Chaîne introuvable', text: 'Elle a peut-être été supprimée.', cta: false });
    const tasks = Store.tasks.filter(t => t.channel === id);
    const todo = tasks.filter(t => !t.done), done = tasks.filter(t => t.done);
    const focus = tasks.reduce((s, t) => s + t.focus, 0);
    return `<div class="studio">
      <div class="channel-banner" style="${U.thumbBg(c.color, c.id + 'banner')}"><div class="banner-text">${esc(c.emoji)} ${esc(c.name)}</div></div>
      <div class="channel-head">
        ${avatar(c)}
        <div style="flex:1;min-width:0">
          <h1>${esc(c.name)}</h1>
          <div class="sub">${U.plural(todo.length, 'tâche à faire', 'tâches à faire')} • ${U.plural(done.length, 'terminée', 'terminées')} • ${U.human(focus)} de focus</div>
        </div>
        <button class="btn primary" data-action="new-task" data-channel="${c.id}">${icon('add')}Ajouter</button>
        <button class="btn" data-action="delete-channel" data-id="${c.id}">${icon('trash')}Supprimer</button>
      </div>
      ${grid([...todo, ...done], { emoji: esc(c.emoji), title: 'Aucune tâche sur cette chaîne', text: 'Publie ta première « vidéo » ici.' })}
    </div>`;
  }

  /* ---------- Watch (une tâche) ---------- */
  function watch(t) {
    if (!t) return emptyState({ emoji: '📼', title: 'Cette vidéo n’est plus disponible', text: 'La tâche a été supprimée.', cta: false });
    const c = Store.channel(t.channel);
    const doneCh = t.chapters.filter(x => x.done).length;
    const upNext = Store.tasks.filter(x => x.id !== t.id && !x.done)
      .sort((a, b) => (b.channel === t.channel) - (a.channel === t.channel)).slice(0, 12);
    const modes = Object.entries(Timer.MODES);

    return `<div class="watch">
      <div class="watch-main">
        <div class="player" id="player">
          <div class="player-bg" style="${U.thumbBg(c.color, t.id)}"></div>
          <div class="player-screen" data-action="play-toggle">
            <div class="player-emoji">${esc(t.emoji || '🎯')}</div>
            <div class="player-mode" id="p-mode"></div>
            <div class="player-clock" id="p-clock">25:00</div>
            <div class="player-sub" id="p-sub"></div>
          </div>
          <div class="player-burst" id="p-burst"></div>
          <div class="player-controls">
            <div class="progress"><div class="progress-fill" id="p-fill"></div></div>
            <div class="ctrl-row">
              <button class="ctrl" data-action="play-toggle" id="p-play" aria-label="Lecture"></button>
              <button class="ctrl" data-action="skip" aria-label="Passer à la suite" title="Passer (session suivante)">${icon('next')}</button>
              <button class="ctrl" data-action="mute" id="p-mute" aria-label="Son"></button>
              <span class="ctrl-time" id="p-time"></span>
              <span class="spacer"></span>
              ${modes.map(([k, m]) => `<button class="ctrl-mode" data-action="mode" data-mode="${k}">${m.short}</button>`).join('')}
              <button class="ctrl" data-action="restart" aria-label="Recommencer" title="Recommencer">${icon('replay')}</button>
              <button class="ctrl" data-action="fullscreen" aria-label="Plein écran" title="Plein écran">${icon('fullscreen')}</button>
            </div>
          </div>
        </div>

        <h1 class="watch-title">${esc(t.title)}</h1>
        <div class="watch-bar-row">
          <div class="owner">
            ${avatar(c, 'a')}
            <div><a href="#channel-${c.id}" class="owner-name">${esc(c.name)}</a>
              <div class="owner-sub">${U.plural(Store.tasks.filter(x => x.channel === c.id && !x.done).length, 'tâche en attente', 'tâches en attente')}</div></div>
          </div>
          <div class="actions">
            <div class="pill-group">
              <button class="btn like-btn ${t.done ? 'on' : ''}" data-action="done" data-id="${t.id}" title="Terminer (L)">${icon(t.done ? 'like' : 'likeOutline')}${t.done ? 'Terminée' : 'Terminer'}</button>
              <button class="btn ${t.later ? 'on' : ''}" data-action="later" data-id="${t.id}" title="Plus tard">${icon('later')}<span>Plus tard</span></button>
            </div>
            <button class="btn" data-action="edit-task" data-id="${t.id}">${icon('edit')}Modifier</button>
            <button class="btn" data-action="delete-task" data-id="${t.id}" aria-label="Supprimer">${icon('trash')}</button>
          </div>
        </div>

        <div class="desc">
          <div class="desc-meta" id="desc-meta">${focusLine(t)}</div>
          <p>${t.description ? esc(t.description) : '<span class="muted">Aucune description.</span>'}</p>
        </div>

        <div class="chapters">
          <div class="chapters-head"><strong>Chapitres</strong><span>${doneCh}/${t.chapters.length} faits</span></div>
          ${t.chapters.map((x, i) => `<div class="chapter ${x.done ? 'done' : ''}" data-action="chapter" data-id="${t.id}" data-ch="${x.id}" role="checkbox" aria-checked="${x.done}" tabindex="0">
            <span class="chapter-n">${x.done ? icon('check') : i + 1}</span><span class="chapter-text">${esc(x.text)}</span></div>`).join('')}
          <form class="chapter-add" data-form="chapter" data-id="${t.id}">
            <input id="chapter-input" placeholder="Ajouter un chapitre (sous-tâche)…" maxlength="120" aria-label="Nouveau chapitre">
            <button class="btn ghost" type="submit">Ajouter</button>
          </form>
        </div>

        <h2 class="section-title">${U.plural(t.comments.length, 'commentaire', 'commentaires')} <small>tes notes perso</small></h2>
        <form class="comment-form" data-form="comment" data-id="${t.id}">
          <span class="avatar" aria-hidden="true">M</span>
          <div class="field">
            <input id="comment-input" placeholder="Ajouter une note…" maxlength="500" aria-label="Nouvelle note">
            <div class="row"><button class="btn primary" type="submit">Commenter</button></div>
          </div>
        </form>
        ${t.comments.map(cm => `<div class="comment">
          <span class="avatar" aria-hidden="true">M</span>
          <div style="min-width:0;flex:1"><div class="who">@moi<span>${U.timeAgo(cm.at)}</span></div><p>${esc(cm.text)}</p></div>
          <button class="comment-del" data-action="del-comment" data-id="${t.id}" data-c="${cm.id}" aria-label="Supprimer la note">${icon('close')}</button>
        </div>`).join('')}
      </div>

      <aside class="watch-side">
        <h2 class="section-title" style="margin-top:0">À suivre</h2>
        <div class="up-next">${upNext.length ? upNext.map(miniCard).join('') : '<p class="hint">Rien d’autre en attente. 🎉</p>'}</div>
      </aside>
    </div>`;
  }

  const focusLine = (t) =>
    `${U.human(t.focus)} de focus sur ${U.human(t.duration * 60)} prévues • ${U.plural(t.sessions, 'session', 'sessions')} • ${Math.round(pct(t))} %`;

  /* ---------- Studio (stats) ---------- */
  function studio() {
    const days = Store.days;
    const today = U.dayKey();
    const totalFocus = Object.values(days).reduce((a, b) => a + b, 0);
    const done = Store.tasks.filter(t => t.done).length;
    const sessions = Store.tasks.reduce((s, t) => s + t.sessions, 0);

    // Série : jours consécutifs avec du focus (aujourd'hui peut encore être vide)
    let streak = 0;
    for (let i = days[today] ? 0 : 1; i < 365; i++) {
      if (days[U.dayKey(new Date(Date.now() - i * 86400000))]) streak++;
      else break;
    }

    const week = [...Array(7)].map((_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      return { key: U.dayKey(d), label: d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''), min: Math.round((days[U.dayKey(d)] || 0) / 60) };
    });
    const top = Math.max(30, Math.ceil(Math.max(...week.map(w => w.min)) / 20) * 20);
    const weekTotal = week.reduce((s, w) => s + w.min, 0);

    const byChannel = Store.channels.map(c => ({ c, sec: Store.tasks.filter(t => t.channel === c.id).reduce((s, t) => s + t.focus, 0) }))
      .sort((a, b) => b.sec - a.sec);
    const maxCh = Math.max(1, ...byChannel.map(x => x.sec));

    return `<div class="studio">
      <div class="page-head"><div><h1>Studio</h1><p>Les statistiques de ta chaîne de productivité.</p></div></div>
      <div class="kpis">
        <div class="kpi"><div class="k">Temps de focus total</div><div class="v">${U.human(totalFocus)}</div><div class="d">depuis le début</div></div>
        <div class="kpi"><div class="k">Aujourd’hui</div><div class="v ${days[today] ? 'up' : ''}">${U.human(days[today] || 0)}</div><div class="d">${weekTotal} min sur 7 jours</div></div>
        <div class="kpi"><div class="k">Tâches terminées</div><div class="v">${done}</div><div class="d">${U.plural(sessions, 'session complète', 'sessions complètes')}</div></div>
        <div class="kpi"><div class="k">Série en cours</div><div class="v">${streak} 🔥</div><div class="d">${streak > 1 ? 'jours d’affilée' : 'jour'} avec du focus</div></div>
      </div>

      <div class="panel-grid">
        <section class="panel">
          <h2>Minutes de focus — 7 derniers jours</h2>
          <div class="bars" role="img" aria-label="Minutes de focus par jour">
            <div class="bars-axis">${[1, .75, .5, .25, 0].map(f => `<span>${Math.round(top * f)}</span>`).join('')}</div>
            ${week.map(w => `<div class="bar-col">
              <div class="bar-track"><div class="bar ${w.key === today ? 'today' : ''}" style="height:${(w.min / top) * 100}%">${w.min ? `<span class="tip">${w.min}</span>` : ''}</div></div>
              <div class="bar-label">${w.key === today ? 'auj.' : w.label}</div></div>`).join('')}
          </div>
        </section>
        <section class="panel">
          <h2>Top chaînes</h2>
          <div class="rank">${byChannel.map(({ c, sec }) => `<div class="rank-row">
            ${avatar(c)}<span class="name">${esc(c.name)}</span><span class="val">${U.human(sec)}</span>
            <div class="meter"><span style="width:${(sec / maxCh) * 100}%;background:${c.color}"></span></div></div>`).join('') || '<p class="hint">Aucune chaîne.</p>'}</div>
        </section>
      </div>

      <section class="panel">
        <h2>Réglages & données</h2>
        <div class="data-tools">
          <button class="btn" data-action="toggle-theme">${icon('theme')}Changer de thème</button>
          <button class="btn" data-action="export">Copier une sauvegarde</button>
          <button class="btn" data-action="import">Restaurer une sauvegarde</button>
          <button class="btn" data-action="reset">${icon('replay')}Repartir de zéro</button>
        </div>
        <p class="hint">Tout est stocké dans ce navigateur. La sauvegarde est un texte à coller ailleurs (notes, mail…) pour la restaurer plus tard.</p>
      </section>
    </div>`;
  }

  /* ---------- Modales ---------- */
  const modal = (title, body, foot, size = '') => `<div class="modal-wrap" data-action="modal-bg">
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="Fermer">${icon('close')}</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${foot}</div>
    </div></div>`;

  function taskForm(t, preset = {}) {
    const v = t || { title: '', description: '', channel: preset.channel || Store.channels[0]?.id, duration: 25, emoji: '🎯', chapters: [], later: false };
    return modal(t ? 'Modifier la tâche' : 'Publier une tâche', `
      <form id="task-form" data-form="task" data-id="${t ? t.id : ''}" style="display:contents">
        <div class="fl"><label for="f-title">Titre (obligatoire)</label>
          <input id="f-title" name="title" required maxlength="100" value="${esc(v.title)}" placeholder="Ex. Ranger le garage (IMPOSSIBLE ?!)">
          <span class="counter" id="f-count">${v.title.length}/100</span></div>
        <div class="fl"><label for="f-desc">Description</label>
          <textarea id="f-desc" name="description" rows="2" maxlength="1000" placeholder="Pourquoi, comment, détails…">${esc(v.description)}</textarea></div>
        <div class="form-row">
          <div class="fl"><label for="f-channel">Chaîne</label>
            <select id="f-channel" name="channel">${Store.channels.map(c => `<option value="${c.id}" ${c.id === v.channel ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('')}</select></div>
          <div class="fl"><label for="f-duration">Durée estimée</label>
            <select id="f-duration" name="duration">${[...new Set([...DURATIONS, v.duration])].sort((a, b) => a - b).map(d => `<option value="${d}" ${d === v.duration ? 'selected' : ''}>${U.human(d * 60)}</option>`).join('')}</select></div>
        </div>
        <div><div class="hint" style="margin-bottom:6px">Miniature</div>
          <div class="emoji-pick" id="emoji-pick">${[...new Set([v.emoji, ...EMOJIS])].map(e => `<button type="button" class="${e === v.emoji ? 'on' : ''}" data-action="pick-emoji" data-emoji="${esc(e)}">${esc(e)}</button>`).join('')}</div>
          <input type="hidden" name="emoji" id="f-emoji" value="${esc(v.emoji)}"></div>
        <div class="fl"><label for="f-chapters">Chapitres — une sous-tâche par ligne</label>
          <textarea id="f-chapters" name="chapters" rows="3" placeholder="Étape 1&#10;Étape 2">${esc(v.chapters.map(c => c.text).join('\n'))}</textarea></div>
        <label class="check"><input type="checkbox" name="later" id="f-later" ${v.later ? 'checked' : ''}> Ajouter à « Plus tard »</label>
      </form>`,
      `<button class="btn" data-action="close-modal">Annuler</button>
       <button class="btn blue" type="submit" form="task-form">${t ? 'Enregistrer' : 'Publier'}</button>`);
  }

  function channelForm() {
    return modal('Créer une chaîne', `
      <form id="channel-form" data-form="channel" style="display:contents">
        <div class="form-row">
          <div class="fl"><label for="c-name">Nom</label><input id="c-name" name="name" required maxlength="30" placeholder="Ex. Maison"></div>
          <div class="fl"><label for="c-emoji">Emoji</label><input id="c-emoji" name="emoji" maxlength="4" value="✨"></div>
        </div>
        <div><div class="hint" style="margin-bottom:6px">Couleur</div>
          <div class="color-pick">${COLORS.map((c, i) => `<button type="button" data-action="pick-color" data-color="${c}" class="${i === 0 ? 'on' : ''}" style="background:${c}" aria-label="Couleur ${i + 1}"></button>`).join('')}</div>
          <input type="hidden" name="color" id="c-color" value="${COLORS[0]}"></div>
      </form>`,
      `<button class="btn" data-action="close-modal">Annuler</button>
       <button class="btn blue" type="submit" form="channel-form">Créer</button>`, 'small');
  }

  const confirmBox = (title, text, yes) => modal(title, `<p>${text}</p>`,
    `<button class="btn" data-action="close-modal">Annuler</button><button class="btn red" data-action="confirm-yes">${yes}</button>`, 'small');

  const dataBox = (title, text, value, mode) => modal(title, `<p>${text}</p>
      <textarea class="data-box" id="data-box" ${mode === 'export' ? 'readonly' : 'placeholder="Colle ta sauvegarde ici"'}>${esc(value)}</textarea>`,
    mode === 'export'
      ? `<button class="btn" data-action="close-modal">Fermer</button><button class="btn blue" data-action="copy-data">Copier</button>`
      : `<button class="btn" data-action="close-modal">Annuler</button><button class="btn blue" data-action="do-import">Restaurer</button>`, 'small');

  /* ---------- Miniplayer ---------- */
  function miniplayer(t) {
    const c = Store.channel(t.channel);
    return `<div class="mp-screen" data-action="open-player">
        <div class="player-bg" style="${U.thumbBg(c.color, t.id)}"></div>
        <div class="mp-mode" id="mp-mode"></div><div class="mp-clock" id="mp-clock"></div></div>
      <div class="mp-bar"><span id="mp-fill"></span></div>
      <div class="mp-info">
        <div class="txt"><div class="t">${esc(t.title)}</div><div class="c">${esc(c.name)}</div></div>
        <button class="icon-btn" data-action="play-toggle" id="mp-play" aria-label="Lecture"></button>
        <button class="icon-btn" data-action="close-mini" aria-label="Fermer le lecteur">${icon('close')}</button>
      </div>`;
  }

  return { sidebar, home, later, history, results, channelPage, watch, studio, taskForm, channelForm, confirmBox, dataBox, miniplayer, focusLine };
})();

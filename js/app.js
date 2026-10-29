/* ============================================================
   App : routeur, rendu, événements, raccourcis clavier
   ============================================================ */
(() => {
  const { $, $$, icon } = U;
  const view = $('#view');
  const sidebarEl = $('#sidebar');
  const mini = $('#miniplayer');
  const modalRoot = $('#modal-root');

  const ui = {
    route: 'home',
    query: '',
    filter: U.storage.get('focustube:filter', 'all'),
    confirm: null,
  };

  /* ---------- Thème ---------- */
  const savedTheme = U.storage.get('focustube:theme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  function toggleTheme() {
    const isDark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = isDark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    U.storage.set('focustube:theme', next);
  }

  /* ---------- Routeur (hash simple : #home, #watch-<id>, #channel-<id>…) ---------- */
  const parseRoute = () => (location.hash.slice(1) || 'home');

  function render() {
    const r = ui.route;
    document.body.classList.toggle('route-watch', r.startsWith('watch-'));
    sidebarEl.innerHTML = Views.sidebar(r);

    let html, watchTask = null;
    if (r.startsWith('watch-')) {
      watchTask = Store.task(r.slice(6));
      html = Views.watch(watchTask);
    } else if (r.startsWith('channel-')) html = Views.channelPage(r.slice(8));
    else if (r === 'later') html = Views.later();
    else if (r === 'history') html = Views.history();
    else if (r === 'studio') html = Views.studio();
    else if (r === 'results') html = Views.results(ui.query);
    else html = Views.home(ui.filter);

    view.innerHTML = html;
    if (watchTask) Timer.load(watchTask.id);
    syncPlayer();
  }

  function navigate() {
    const prev = ui.route;
    ui.route = parseRoute();
    if (ui.route === 'results' && !ui.query) ui.route = 'home';
    document.body.classList.remove('drawer-open');
    render();
    if (prev !== ui.route) window.scrollTo(0, 0);
  }

  const go = (route) => {
    if (location.hash.slice(1) === route) navigate();
    else location.hash = route;
  };

  /* ---------- Synchronisation lecteur / miniplayer ---------- */
  function syncPlayer(evt) {
    const s = Timer.state;
    const t = s.taskId && Store.task(s.taskId);
    const mode = Timer.MODES[s.mode];
    const onWatch = t && ui.route === 'watch-' + t.id;
    const fill = (Timer.progress() * 100).toFixed(2) + '%';

    const player = onWatch && $('#player');
    if (player) {
      player.classList.toggle('is-running', s.running);
      player.classList.toggle('is-break', !mode.focus);
      $('#p-clock').textContent = U.clock(s.remaining);
      $('#p-mode').textContent = s.running ? mode.label : (s.remaining === Timer.total() ? mode.label + ' • prêt' : 'En pause');
      $('#p-sub').textContent = mode.focus ? t.title : 'Respire, bois un verre d’eau. ☕';
      $('#p-fill').style.width = fill;
      $('#p-time').textContent = `${U.clock(Timer.total() - s.remaining)} / ${U.clock(Timer.total())}`;
      $('#p-play').innerHTML = icon(s.running ? 'pause' : 'play');
      $('#p-mute').innerHTML = icon(s.muted ? 'mute' : 'volume');
      $$('.ctrl-mode').forEach(b => b.classList.toggle('on', b.dataset.mode === s.mode));
      if (evt === 'tick' && mode.focus) $('#desc-meta').textContent = Views.focusLine(t);
      if (evt === 'play' || evt === 'pause') {
        const burst = $('#p-burst');
        burst.innerHTML = icon(s.running ? 'play' : 'pause');
        burst.classList.remove('go'); void burst.offsetWidth; burst.classList.add('go');
      }
    }

    // Miniplayer : visible quand une session tourne (ou a démarré) et qu'on a quitté la page
    const showMini = t && !onWatch && (s.running || s.remaining !== Timer.total());
    if (showMini) {
      if (mini.hidden || mini.dataset.task !== t.id) {
        mini.innerHTML = Views.miniplayer(t);
        mini.dataset.task = t.id;
        mini.hidden = false;
      }
      $('#mp-clock').textContent = U.clock(s.remaining);
      $('#mp-mode').textContent = s.running ? mode.label : 'En pause';
      $('#mp-fill').style.width = fill;
      $('#mp-play').innerHTML = icon(s.running ? 'pause' : 'play');
    } else if (!mini.hidden) {
      mini.hidden = true;
      mini.dataset.task = '';
    }

    document.title = t && s.running ? `${mode.focus ? '▶' : '☕'} ${U.clock(s.remaining)} · ${t.title}` : 'FocusTube';
  }

  Timer.subscribe((s, evt) => {
    syncPlayer(evt);
    if (evt === 'focus-done') {
      toast('Session terminée ! +1 session. Place à 5 min de pause ☕');
      confetti(40);
      render();
    } else if (evt === 'break-done') toast('Pause finie. On y retourne ? 💪');
  });

  /* ---------- Toast & confettis ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function confetti(n = 90) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = $('#confetti');
    const colors = ['#ff0033', '#3ea6ff', '#2ba640', '#ffd60a', '#a970ff', '#ff8a00'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
      p.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
      p.style.setProperty('--dur', (1.2 + Math.random() * 1.4) + 's');
      p.style.animationDelay = Math.random() * 0.3 + 's';
      box.appendChild(p);
      setTimeout(() => p.remove(), 3200);
    }
  }

  /* ---------- Modales ---------- */
  function openModal(html, focusSel) {
    modalRoot.innerHTML = html;
    const target = focusSel ? $(focusSel, modalRoot) : $('input, button', modalRoot);
    target?.focus();
  }
  const closeModal = () => { modalRoot.innerHTML = ''; ui.confirm = null; };

  function askConfirm(title, text, yes, fn) {
    openModal(Views.confirmBox(title, text, yes));
    ui.confirm = fn;
  }

  /* ---------- Actions ---------- */
  function toggleDone(id) {
    const done = Store.toggleDone(id);
    if (done) {
      confetti();
      toast('Tâche terminée ! 👍');
      if (Timer.state.taskId === id) Timer.pause();
    } else toast('Tâche remise à faire');
  }

  const actions = {
    'toggle-sidebar'() {
      const drawer = innerWidth <= 1000 || document.body.classList.contains('route-watch');
      if (drawer) document.body.classList.toggle('drawer-open');
      else {
        document.body.classList.toggle('sidebar-mini');
        U.storage.set('focustube:mini', document.body.classList.contains('sidebar-mini'));
      }
    },
    'close-drawer': () => document.body.classList.remove('drawer-open'),
    'toggle-theme': toggleTheme,
    'new-task': (el) => openModal(Views.taskForm(null, { channel: el.dataset.channel }), '#f-title'),
    'edit-task': (el) => openModal(Views.taskForm(Store.task(el.dataset.id)), '#f-title'),
    'delete-task'(el) {
      const t = Store.task(el.dataset.id);
      askConfirm('Supprimer la tâche ?', `« ${U.esc(t.title)} » sera supprimée définitivement.`, 'Supprimer', () => {
        if (Timer.state.taskId === t.id) Timer.stop();
        Store.remove(t.id);
        toast('Tâche supprimée');
        go('home');
      });
    },
    'new-channel': () => openModal(Views.channelForm(), '#c-name'),
    'delete-channel'(el) {
      const c = Store.channel(el.dataset.id);
      const n = Store.tasks.filter(t => t.channel === c.id).length;
      askConfirm('Supprimer la chaîne ?', `« ${U.esc(c.name)} » et ${U.plural(n, 'tâche', 'tâches')} seront supprimées.`, 'Supprimer', () => {
        if (Store.task(Timer.state.taskId)?.channel === c.id) Timer.stop();
        Store.removeChannel(c.id);
        toast('Chaîne supprimée');
        go('home');
      });
    },
    filter(el) {
      ui.filter = el.dataset.filter;
      U.storage.set('focustube:filter', ui.filter);
      render();
    },
    done: (el) => toggleDone(el.dataset.id),
    later(el) {
      const on = Store.toggleLater(el.dataset.id);
      toast(on ? 'Ajoutée à « Plus tard »' : 'Retirée de « Plus tard »');
    },
    chapter(el) {
      Store.toggleChapter(el.dataset.id, el.dataset.ch);
      const t = Store.task(el.dataset.id);
      if (t.chapters.length && t.chapters.every(c => c.done) && !t.done) toast('Tous les chapitres sont faits. Un petit like ? 👍');
    },
    'del-comment': (el) => Store.removeComment(el.dataset.id, el.dataset.c),
    'play-toggle': () => Timer.toggle(),
    skip: () => Timer.skip(),
    restart: () => Timer.restart(),
    mute: () => Timer.toggleMute(),
    mode: (el) => Timer.setMode(el.dataset.mode),
    fullscreen() {
      const p = $('#player');
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else p?.requestFullscreen?.().catch(() => toast('Plein écran indisponible ici'));
    },
    'open-player': () => go('watch-' + Timer.state.taskId),
    'close-mini': () => Timer.stop(),
    'pick-emoji'(el) {
      $$('#emoji-pick button').forEach(b => b.classList.toggle('on', b === el));
      $('#f-emoji').value = el.dataset.emoji;
    },
    'pick-color'(el) {
      $$('.color-pick button').forEach(b => b.classList.toggle('on', b === el));
      $('#c-color').value = el.dataset.color;
    },
    'close-modal': closeModal,
    'modal-bg': (el, e) => { if (e.target === el) closeModal(); },
    'confirm-yes'() { const fn = ui.confirm; closeModal(); fn?.(); },
    export: () => openModal(Views.dataBox('Sauvegarde', 'Copie ce texte et garde-le précieusement.', Store.exportJSON(), 'export')),
    import: () => openModal(Views.dataBox('Restaurer', 'Colle une sauvegarde FocusTube. Les données actuelles seront remplacées.', '', 'import'), '#data-box'),
    'copy-data'() {
      const box = $('#data-box');
      navigator.clipboard?.writeText(box.value)
        .then(() => toast('Sauvegarde copiée 📋'))
        .catch(() => { box.select(); toast('Sélectionné : fais Ctrl+C'); });
    },
    'do-import'() {
      try {
        Timer.stop();
        Store.importJSON($('#data-box').value);
        closeModal();
        toast('Sauvegarde restaurée ✅');
        go('home');
      } catch { toast('Ce texte n’est pas une sauvegarde valide'); }
    },
    reset: () => askConfirm('Repartir de zéro ?', 'Toutes tes tâches et stats seront remplacées par les exemples de départ.', 'Réinitialiser', () => {
      Timer.stop();
      Store.reset();
      toast('Tout est remis à neuf');
      go('home');
    }),
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) {
      if (el.dataset.action !== 'modal-bg') { e.preventDefault(); e.stopPropagation(); }
      actions[el.dataset.action](el, e);
      return;
    }
    if (e.target.closest('a')) return;
    const card = e.target.closest('[data-open]');
    if (card) go('watch-' + card.dataset.open);
  });

  /* ---------- Formulaires ---------- */
  document.addEventListener('submit', (e) => {
    const form = e.target;
    e.preventDefault();
    const kind = form.dataset.form;

    if (form.id === 'search-form') {
      const q = $('#search-input').value.trim();
      ui.query = q;
      $('#search-input').blur();
      go(q ? 'results' : 'home');
      return;
    }

    const id = form.dataset.id;
    if (kind === 'task') {
      const fd = new FormData(form);
      const title = fd.get('title').trim();
      if (!title) return;
      const prev = id ? Store.task(id) : null;
      const chapters = fd.get('chapters').split('\n').map(s => s.trim()).filter(Boolean).map(text => {
        const old = prev?.chapters.find(c => c.text === text);
        return old || { id: U.uid(), text, done: false };
      });
      const data = {
        title,
        description: fd.get('description').trim(),
        channel: fd.get('channel'),
        duration: Number(fd.get('duration')),
        emoji: fd.get('emoji') || '🎯',
        chapters,
        later: fd.get('later') === 'on',
      };
      closeModal();
      if (prev) { Store.update(id, data); toast('Modifications enregistrées'); }
      else { const t = Store.addTask(data); toast('Tâche publiée 🎬'); go('watch-' + t.id); }
    } else if (kind === 'channel') {
      const fd = new FormData(form);
      const name = fd.get('name').trim();
      if (!name) return;
      const c = Store.addChannel({ name, emoji: fd.get('emoji').trim() || '✨', color: fd.get('color') });
      closeModal();
      toast(`Chaîne « ${name} » créée`);
      go('channel-' + c.id);
    } else if (kind === 'chapter') {
      const text = form.querySelector('input').value.trim();
      if (text) { Store.addChapter(id, text); $('#chapter-input')?.focus(); }
    } else if (kind === 'comment') {
      const text = form.querySelector('input').value.trim();
      if (text) Store.addComment(id, text);
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'f-title') $('#f-count').textContent = `${e.target.value.length}/100`;
  });

  /* ---------- Clavier ---------- */
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === 'Escape') {
      if (modalRoot.innerHTML) closeModal();
      else document.body.classList.remove('drawer-open');
      return;
    }
    if (e.key === 'Enter' && e.target.matches('.chapter')) { e.target.click(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || modalRoot.innerHTML) return;

    const onWatch = ui.route.startsWith('watch-');
    const k = e.key.toLowerCase();
    if (k === '/') { e.preventDefault(); $('#search-input').focus(); }
    else if (k === 'n') { e.preventDefault(); actions['new-task']({ dataset: {} }); }
    else if ((k === 'k' || (k === ' ' && onWatch)) && Timer.state.taskId) { e.preventDefault(); Timer.toggle(); }
    else if (k === 'l' && onWatch) toggleDone(ui.route.slice(6));
    else if (k === 'm' && Timer.state.taskId) Timer.toggleMute();
    else if (k === 'f' && onWatch) actions.fullscreen();
  });

  /* ---------- Démarrage ---------- */
  Store.load();
  if (U.storage.get('focustube:mini', false)) document.body.classList.add('sidebar-mini');
  $$('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon) + el.innerHTML; });
  Store.subscribe(render);
  addEventListener('hashchange', navigate);
  navigate();
})();

/* ============================================================
   Store : données (chaînes, tâches, stats) + persistance locale
   ============================================================ */
const Store = (() => {
  const KEY = 'focustube:v1';
  const listeners = new Set();
  let state;

  const DAY = 86400000;

  function seed() {
    const now = Date.now();
    const channels = [
      { id: 'travail', name: 'Travail', emoji: '💼', color: '#3a7bd5' },
      { id: 'perso', name: 'Perso', emoji: '🏠', color: '#e5484d' },
      { id: 'sport', name: 'Sport', emoji: '🏋️', color: '#2ba640' },
      { id: 'apprendre', name: 'Apprendre', emoji: '📚', color: '#8e4ec6' },
    ];
    const ch = (text, done = false) => ({ id: U.uid(), text, done });
    const tasks = [
      {
        title: 'Comment utiliser FocusTube (TUTO en 2 min)', channel: 'apprendre', emoji: '🎬', duration: 5,
        description: "Chaque « vidéo » est une tâche. Appuie sur lecture pour lancer un minuteur de concentration : le temps passé remplit la barre rouge.\nLe pouce bleu marque la tâche comme terminée.",
        chapters: [ch('Lancer le minuteur avec ▶ (ou la touche K)', false), ch('Cocher les chapitres au fur et à mesure'),
          ch('Laisser une note dans les commentaires'), ch('Liker pour terminer la tâche'), ch('Créer ta propre tâche avec « + Créer »')],
        createdAt: now - 60000,
      },
      {
        title: "J'ai ENFIN rangé mon bureau (pas clickbait)", channel: 'perso', emoji: '🧹', duration: 25,
        description: 'Le défi : tout ranger avant la fin du minuteur.', focus: 600, sessions: 1,
        chapters: [ch('Vider la poubelle', true), ch('Trier les papiers'), ch('Câbles derrière l’écran')],
        createdAt: now - 2 * DAY,
      },
      {
        title: 'Répondre aux mails en retard — ÉPISODE FINAL', channel: 'travail', emoji: '📬', duration: 30,
        description: 'Inbox zéro ou rien.', chapters: [], createdAt: now - 3 * 3600000,
      },
      {
        title: 'Séance abdos niveau légende 🔥', channel: 'sport', emoji: '💪', duration: 15,
        description: '3 tours : gainage 45 s, crunchs x20, mountain climbers 30 s.', later: true,
        chapters: [ch('Échauffement'), ch('Tour 1'), ch('Tour 2'), ch('Tour 3'), ch('Étirements')],
        createdAt: now - 5 * DAY,
      },
      {
        title: 'Préparer la présentation de lundi', channel: 'travail', emoji: '📊', duration: 90,
        description: 'Plan, slides, puis une répétition à voix haute.', focus: 2700, sessions: 2,
        chapters: [ch('Plan en 5 points', true), ch('Slides'), ch('Répétition')], createdAt: now - DAY,
      },
      {
        title: 'Apprendre 20 mots d’espagnol en 10 min ⚡', channel: 'apprendre', emoji: '🇪🇸', duration: 10,
        description: '', later: true, chapters: [], createdAt: now - 6 * DAY,
      },
      {
        title: 'Faire les courses de la semaine', channel: 'perso', emoji: '🛒', duration: 45,
        description: 'Ne pas oublier le café.', done: true, doneAt: now - DAY, focus: 2400, sessions: 2,
        chapters: [ch('Liste', true), ch('Supermarché', true)], createdAt: now - 4 * DAY,
      },
    ].map(t => ({
      id: U.uid(), description: '', focus: 0, sessions: 0, done: false, later: false, doneAt: null,
      comments: [], ...t,
    }));

    // Un peu d'historique pour que le Studio ne soit pas vide au premier lancement
    const days = {};
    [[1, 2700], [2, 600], [3, 1500], [4, 2400], [5, 900]].forEach(([d, s]) => {
      days[U.dayKey(new Date(now - d * DAY))] = s;
    });

    return { channels, tasks, days, version: 1 };
  }

  function load() {
    const saved = U.storage.get(KEY);
    state = saved && Array.isArray(saved.tasks) ? saved : seed();
  }

  const save = () => U.storage.set(KEY, state);
  const emit = () => listeners.forEach(fn => fn());
  const commit = () => { save(); emit(); };

  const task = (id) => state.tasks.find(t => t.id === id);
  const channel = (id) => state.channels.find(c => c.id === id) || { id, name: 'Sans chaîne', emoji: '📁', color: '#717171' };

  function update(id, patch) {
    const t = task(id);
    if (!t) return;
    Object.assign(t, typeof patch === 'function' ? patch(t) : patch);
    commit();
  }

  return {
    load,
    subscribe: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    get channels() { return state.channels; },
    get tasks() { return state.tasks; },
    get days() { return state.days; },
    task,
    channel,

    addTask(data) {
      const t = {
        id: U.uid(), focus: 0, sessions: 0, done: false, doneAt: null, later: false,
        comments: [], chapters: [], description: '', createdAt: Date.now(), ...data,
      };
      state.tasks.unshift(t);
      commit();
      return t;
    },
    update,
    remove(id) { state.tasks = state.tasks.filter(t => t.id !== id); commit(); },

    toggleDone(id) {
      const t = task(id);
      update(id, { done: !t.done, doneAt: t.done ? null : Date.now(), later: false });
      return task(id).done;
    },
    toggleLater(id) { const t = task(id); update(id, { later: !t.later }); return t.later; },

    toggleChapter(id, chId) {
      update(id, t => ({ chapters: t.chapters.map(c => c.id === chId ? { ...c, done: !c.done } : c) }));
    },
    addChapter(id, text) {
      update(id, t => ({ chapters: [...t.chapters, { id: U.uid(), text, done: false }] }));
    },
    addComment(id, text) {
      update(id, t => ({ comments: [{ id: U.uid(), text, at: Date.now() }, ...t.comments] }));
    },
    removeComment(id, cId) {
      update(id, t => ({ comments: t.comments.filter(c => c.id !== cId) }));
    },

    /** Appelé chaque seconde par le minuteur : on sauvegarde sans re-rendre toute la page. */
    addFocus(id, sec) {
      const t = task(id);
      if (!t) return;
      t.focus += sec;
      const k = U.dayKey();
      state.days[k] = (state.days[k] || 0) + sec;
      save();
    },
    logSession(id) { update(id, t => ({ sessions: t.sessions + 1 })); },

    addChannel(data) {
      const c = { id: U.uid(), ...data };
      state.channels.push(c);
      commit();
      return c;
    },
    removeChannel(id) {
      state.channels = state.channels.filter(c => c.id !== id);
      state.tasks = state.tasks.filter(t => t.channel !== id);
      commit();
    },

    exportJSON: () => JSON.stringify(state, null, 2),
    importJSON(text) {
      const data = JSON.parse(text);
      if (!Array.isArray(data.tasks) || !Array.isArray(data.channels)) throw new Error('format');
      state = { days: {}, ...data };
      commit();
    },
    reset() { state = seed(); commit(); },
  };
})();

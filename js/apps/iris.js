/* Prisme OS — Iris : assistante intégrée qui comprend le français et pilote le système */
(function () {
  const { h } = OS;

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').trim();
  const COLORS = { violet: '#8b5cf6', bleu: '#3b82f6', cyan: '#06b6d4', vert: '#10b981', orange: '#f59e0b', jaune: '#f59e0b', rouge: '#f43f5e', rose: '#ec4899', blanc: '#e2e8f0', gris: '#e2e8f0' };
  const JOKES = [
    'Pourquoi les plongeurs plongent-ils toujours en arrière ? Parce que sinon ils tombent dans le bateau. 🤿',
    'Qu\'est-ce qu\'un développeur dit en sortant de l\'ascenseur ? « Je suis arrivé au dernier commit. »',
    'Il y a 10 types de personnes : celles qui comprennent le binaire et les autres.',
    'Un photon arrive à l\'hôtel. « Des bagages ? » — « Non merci, je voyage léger. » ✨',
    'Pourquoi le prisme est-il toujours de bonne humeur ? Parce qu\'il voit la vie en couleurs. 🌈',
  ];

  // Chaque intention : motif(s) → action renvoyant la réponse
  const intents = [
    { re: /^(bonjour|salut|coucou|hello|hey|bonsoir|yo)\b/, run: () => `Bonjour ${OS.settings.user} ! ✦ Que puis-je faire pour vous ?` },
    { re: /(qui es[- ]tu|tu es qui|presente[- ]toi|ton nom)/, run: () => 'Je suis Iris, l\'assistante de Prisme OS. Je peux ouvrir des applications, changer l\'apparence, organiser vos fenêtres, prendre des notes, lancer des minuteurs, calculer… Tapez « aide » pour tout voir.' },
    { re: /^(aide|help|que sais[- ]tu faire|commandes)/, run: () => ({ html: `Voici ce que je sais faire :<ul>
      <li><b>ouvre</b> le terminal, les fichiers, le synthé…</li>
      <li><b>thème</b> sombre / clair, <b>couleur</b> rose, bleu, vert…</li>
      <li><b>fond d'écran</b> nébuleuse, vagues, synthwave…</li>
      <li><b>organise</b> mes fenêtres · <b>ferme</b> tout · <b>vue d'ensemble</b></li>
      <li><b>note</b> : acheter du pain</li>
      <li><b>minuteur</b> 5 minutes</li>
      <li><b>combien</b> font 12 × 7 ?</li>
      <li>quelle <b>heure</b> est-il ? · une <b>blague</b> · <b>verrouille</b></li></ul>` }) },
    { re: /(quelle heure|l heure|heure est)/, run: () => `Il est ${OS.formatTime(new Date(), true)}. ⏰` },
    { re: /(quel jour|quelle date|la date|on est quel)/, run: () => `Nous sommes le ${OS.formatDate()} ${new Date().getFullYear()}. 📅` },
    { re: /(blague|drole|fais[- ]moi rire)/, run: () => JOKES[Math.floor(Math.random() * JOKES.length)] },
    { re: /(meteo|temps fait|il fait)/, run: () => 'Le widget météo du bureau affiche une météo de démonstration pour Paris. Je n\'ai pas accès à Internet pour une vraie prévision… mais ici, il fait toujours beau. ☀️' },
    { re: /(verrouill|lock)/, run: () => (setTimeout(OS.lock, 600), 'Verrouillage de la session… 🔒') },
    { re: /(vue d ensemble|overview|toutes les fenetres)/, run: () => (setTimeout(() => OS.toggleOverview(true), 300), 'Voici toutes vos fenêtres.') },
    { re: /(organise|\brange|mosaique|\btile|aligne)/, run: () => { const n = OS.tileWindows(); return n ? `J'ai organisé ${n} fenêtre${n > 1 ? 's' : ''} en mosaïque. ✨` : 'Il n\'y a aucune fenêtre à organiser sur ce bureau.'; } },
    { re: /(ferme tout|ferme toutes|close all)/, run: (_, win) => { const ws = OS.windows.filter((w) => w !== win); ws.forEach((w) => w.close()); return `${ws.length} fenêtre${ws.length > 1 ? 's fermées' : ' fermée'}. Place nette ! 🧹`; } },
    { re: /^(note|notes?|retiens|ecris)\s*:?\s+/, run: (q, win, raw) => {
      const txt = raw.replace(/^\s*(note|notes?|retiens|écris|ecris)\s*:?\s*/i, '');
      const p = OS.fs.HOME + '/Documents/Notes d\'Iris.md';
      const prev = OS.fs.exists(p) ? OS.fs.read(p) : '# Notes d\'Iris\n\n';
      OS.fs.write(p, prev + `- [ ] ${txt}  _(${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })})_\n`);
      return { html: `Noté dans <a href="#" data-open="${OS.esc(p)}">Notes d'Iris</a> : « ${OS.esc(txt)} » 📝` };
    } },
    { re: /(minuteur|timer|rappelle[- ]moi|dans \d+)/, run: (q) => {
      const m = q.match(/(\d+(?:[.,]\d+)?)\s*(s|sec|secondes?|m|min|minutes?|h|heures?)?/);
      if (!m) return 'Pour combien de temps ? Par exemple : « minuteur 5 minutes ».';
      const n = parseFloat(m[1].replace(',', '.'));
      const unit = (m[2] || 'min')[0];
      const ms = n * (unit === 's' ? 1000 : unit === 'h' ? 3600000 : 60000);
      const label = `${n} ${unit === 's' ? 'seconde' : unit === 'h' ? 'heure' : 'minute'}${n > 1 ? 's' : ''}`;
      const what = q.match(/(?:pour|de)\s+(.+)$/)?.[1];
      setTimeout(() => OS.notify({ title: '⏰ Minuteur terminé', body: what ? `Rappel : ${what}` : `${label} se sont écoulées.`, icon: 'clock' }), ms);
      return `C'est noté, je vous préviens dans ${label}. ⏳`;
    } },
    { re: /(ouvre|lance|demarre|open|affiche|montre)/, run: (q) => {
      const app = Object.values(OS.apps).find((a) => q.includes(norm(a.name)) || q.includes(a.id) || (a.keywords && norm(a.keywords).split(' ').some((k) => k.length > 3 && q.includes(k))));
      if (!app) return 'Je ne trouve pas cette application. Essayez « ouvre le terminal » ou « ouvre les fichiers ».';
      setTimeout(() => OS.launch(app.id), 250);
      return `J'ouvre ${app.name}. 🚀`;
    } },
    { re: /(mode |theme )?(sombre|nuit|dark)/, run: () => (OS.setSetting('theme', 'dark'), 'Mode sombre activé. 🌙') },
    { re: /(mode |theme )?(clair|jour|light)/, run: () => (OS.setSetting('theme', 'light'), 'Mode clair activé. ☀️') },
    { re: /(fond|wallpaper)/, run: (q) => {
      const w = OS.wallpapers.find((x) => q.includes(norm(x.name)) || q.includes(x.id));
      const next = w || OS.wallpapers[(OS.wallpapers.findIndex((x) => x.id === OS.settings.wallpaper) + 1) % OS.wallpapers.length];
      OS.setSetting('wallpaper', next.id);
      return `Fond d'écran « ${next.name} » appliqué. 🎨`;
    } },
    { re: new RegExp('(' + Object.keys(COLORS).join('|') + ')'), run: (q) => {
      const c = Object.keys(COLORS).find((k) => q.includes(k));
      OS.setSetting('accent', COLORS[c]);
      return `Couleur d'accentuation : ${c}. Joli choix ! 🌈`;
    } },
    { re: /(bureau|workspace)\s*(\d)/, run: (q) => { const n = +q.match(/(\d)/)[1]; OS.switchWorkspace(n - 1); return `Direction le bureau ${n}.`; } },
    { re: /(merci|super|genial|parfait|cool|top)/, run: () => 'Avec plaisir ! ✦' },
    { re: /(ca va|comment vas)/, run: () => `Je fonctionne à ${OS.stats.fps} images par seconde, avec ${OS.stats.cpu} % de processeur. Donc très bien, merci ! Et vous ?` },
  ];

  function answer(raw, win) {
    const q = norm(raw);
    // Un calcul pur ou « combien font … »
    const calc = q.replace(/^(combien (font|fait|ca fait)|calcule|calcul)\s*/, '').replace(/\?$/, '').replace(/ x /g, '*').replace(/fois/g, '*').replace(/plus/g, '+').replace(/moins/g, '-').replace(/divise par/g, '/');
    const r = OS.evalMath(calc);
    if (r != null && /\d/.test(calc) && !/minut|second|heure|bureau/.test(q)) return `${raw.replace(/^(combien (font|fait)|calcule)\s*/i, '').replace(/\?$/, '')} = **${r.toLocaleString('fr-FR', { maximumFractionDigits: 10 })}**`;
    for (const it of intents) if (it.re.test(q)) return it.run(q, win, raw);
    return 'Hmm, je n\'ai pas compris. 🤔 Essayez « aide » pour voir ce que je sais faire.';
  }

  OS.registerApp({
    id: 'iris', name: 'Iris', icon: 'sparkle', colors: ['#c084fc', '#ec4899'],
    desc: 'Assistante intelligente', keywords: 'assistant ia aide chat', width: 440, height: 600, minW: 340, minH: 400, single: true,
    launch(win, args) {
      const log = h('div.ir-log');
      const input = h('input.ir-input', { placeholder: 'Demandez quelque chose à Iris…' });
      const chips = h('div.ir-chips', ['Organise mes fenêtres', 'Couleur rose', 'Fond synthwave', 'Une blague', 'Minuteur 1 minute', 'Combien font 12 × 7 ?']
        .map((t) => h('button.ir-chip', { onclick: () => send(t) }, t)));
      const sendBtn = h('button.ir-send', { html: OS.icon('send', 16), onclick: () => send(input.value) });
      win.body.append(h('div.ir',
        h('div.ir-hero', h('div.ir-orb'), h('div', h('b', 'Iris'), h('small', 'Votre assistante Prisme'))),
        log, chips, h('div.ir-bar', input, sendBtn)));

      function bubble(who, content) {
        const b = h('div.ir-msg.' + who);
        if (typeof content === 'object') b.innerHTML = content.html;
        else b.innerHTML = OS.esc(content).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        log.append(b);
        log.scrollTop = log.scrollHeight;
        b.querySelectorAll('[data-open]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); OS.openFile(a.dataset.open); }));
        return b;
      }
      function send(text) {
        text = text.trim();
        if (!text) return;
        input.value = '';
        bubble('me', text);
        const typing = h('div.ir-msg.iris.typing', h('i'), h('i'), h('i'));
        log.append(typing);
        log.scrollTop = log.scrollHeight;
        setTimeout(() => {
          typing.remove();
          let res;
          try { res = answer(text, win); } catch (e) { res = 'Oups, une erreur : ' + e.message; }
          bubble('iris', res);
        }, 450 + Math.random() * 400);
      }
      input.addEventListener('keydown', (e) => e.key === 'Enter' && send(input.value));
      bubble('iris', `Bonjour ${OS.settings.user} ! Je suis Iris ✦ Demandez-moi d'ouvrir une app, de changer les couleurs, d'organiser vos fenêtres… ou tapez « aide ».`);
      win.ask = send;
      if (args.ask) send(args.ask);
      setTimeout(() => input.focus(), 60);
    },
    onReopen(win, args) { if (args.ask) win.ask(args.ask); },
  });
})();

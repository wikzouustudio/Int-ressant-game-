/* Prisme OS — Réglages */
(function () {
  const { h } = OS;

  OS.registerApp({
    id: 'settings', name: 'Réglages', icon: 'sliders', colors: ['#94a3b8', '#475569'],
    desc: 'Personnaliser Prisme OS', keywords: 'parametres preferences configuration theme', width: 780, height: 540, single: true,
    launch(win, args) {
      const sections = [
        ['appearance', 'Apparence', 'eye'],
        ['wallpaper', 'Fond d\'écran', 'image'],
        ['desktop', 'Bureau & Dock', 'desktop'],
        ['sound', 'Sons & notifications', 'bell'],
        ['account', 'Compte', 'home'],
        ['system', 'Système', 'cpu'],
      ];
      let current = args.section || 'appearance';
      const side = h('div.sidebar');
      const main = h('div.se-main');
      win.body.append(h('div.app-flex', side, main));

      const row = (title, sub, control) => h('div.se-row', h('div', h('b', title), sub && h('small', sub)), control);
      const toggle = (key) => {
        const sw = h('button.switch' + (OS.settings[key] ? '.on' : ''));
        sw.onclick = () => { OS.setSetting(key, !OS.settings[key]); sw.classList.toggle('on', OS.settings[key]); };
        return sw;
      };

      const views = {
        appearance() {
          const themes = h('div.se-themes', ['dark', 'light'].map((t) => h('button.se-theme' + (OS.settings.theme === t ? '.on' : ''), { onclick: () => { OS.setSetting('theme', t); render(); } },
            h('div.se-theme-prev.' + t, h('i'), h('i'), h('i')), t === 'dark' ? 'Sombre' : 'Clair')));
          const accents = h('div.se-accents', OS.accents.map((c) => h('button.swatch' + (c === OS.settings.accent ? '.on' : ''), { style: { background: c, width: '34px', height: '34px' }, onclick: () => { OS.setSetting('accent', c); render(); } })));
          const custom = h('input.st-picker', { type: 'color', value: OS.settings.accent });
          custom.addEventListener('change', () => { OS.setSetting('accent', custom.value); render(); });
          accents.append(custom);
          return [
            h('h2', 'Apparence'),
            h('div.se-card', h('h4', 'Thème'), themes),
            h('div.se-card', h('h4', 'Couleur d\'accentuation'), accents),
            h('div.se-card',
              row('Transparence', 'Effet verre dépoli sur les fenêtres et panneaux', toggle('transparency')),
              row('Animations', 'Transitions et effets de mouvement', toggle('animations'))),
          ];
        },
        wallpaper() {
          const grid = h('div.se-walls');
          OS.wallpapers.forEach((w) => {
            const prev = OS.wallpaperPreview(w.id, 220, 136);
            grid.append(h('button.se-wall' + (OS.settings.wallpaper === w.id ? '.on' : ''), { onclick: () => { OS.setSetting('wallpaper', w.id); render(); } }, prev, h('span', w.name)));
          });
          return [h('h2', 'Fond d\'écran'), h('p.se-p', 'Des fonds génératifs, animés en temps réel et teintés par votre couleur d\'accentuation.'), grid];
        },
        desktop() {
          return [
            h('h2', 'Bureau & Dock'),
            h('div.se-card',
              row('Effet loupe du Dock', 'Les icônes grossissent au survol', toggle('magnify')),
              row('Widgets du bureau', 'Horloge, météo et système', toggle('widgets'))),
            h('div.se-card', h('h4', 'Raccourcis clavier'),
              ...[['Ctrl + Espace', 'Recherche universelle'], ['F3 ou Ctrl + ↑', 'Vue d\'ensemble'], ['Ctrl + Alt + ← / →', 'Changer de bureau'], ['Ctrl + Alt + T', 'Nouveau terminal'], ['Ctrl + Alt + W', 'Fermer la fenêtre'], ['Ctrl + Alt + M', 'Réduire la fenêtre'], ['Ctrl + Alt + L', 'Verrouiller']]
                .map(([k, d]) => h('div.se-kb', h('span', d), h('kbd', k)))),
          ];
        },
        sound() {
          const vol = h('input', { type: 'range', min: 0, max: 100, value: OS.volume });
          vol.style.setProperty('--p', OS.volume + '%');
          vol.addEventListener('input', () => { vol.style.setProperty('--p', vol.value + '%'); OS.setVolume(+vol.value); });
          return [
            h('h2', 'Sons & notifications'),
            h('div.se-card',
              row('Sons système', 'Petits sons synthétisés à l\'ouverture, aux notifications…', toggle('sounds')),
              row('Volume général', null, h('div', { style: { width: '200px' } }, vol)),
              row('Ne pas déranger', 'Masque les bulles de notification', toggle('dnd'))),
            h('div.se-card', row('Tester', 'Envoyer une notification d\'essai', h('button.btn', { onclick: () => OS.notify({ title: 'Ceci est un test ✦', body: 'Les notifications fonctionnent parfaitement.', icon: 'bell' }) }, 'Envoyer'))),
          ];
        },
        account() {
          const name = h('input.field', { value: OS.settings.user, style: { width: '220px' } });
          name.addEventListener('change', () => { if (name.value.trim()) OS.setSetting('user', name.value.trim()); render(); });
          return [
            h('h2', 'Compte'),
            h('div.se-account', h('div.avatar', h('span', OS.settings.user[0].toUpperCase())), h('div', h('b', OS.settings.user), h('small', 'Administrateur local'))),
            h('div.se-card', row('Nom d\'utilisateur', 'Affiché sur l\'écran de verrouillage et dans le terminal', name)),
            h('div.se-card', row('Verrouiller la session', null, h('button.btn', { onclick: OS.lock }, 'Verrouiller'))),
          ];
        },
        system() {
          return [
            h('h2', 'Système'),
            h('div.se-card',
              row('Version', null, h('span', 'Prisme OS ' + OS.version)),
              row('Session active depuis', null, h('span', OS.uptime())),
              row('À propos', null, h('button.btn', { onclick: () => OS.launch('about') }, 'Afficher'))),
            h('div.se-card.danger',
              row('Réinitialiser les fichiers', 'Restaure le système de fichiers d\'origine', h('button.btn', { onclick: () => { OS.fs.reset(); OS.notify({ title: 'Fichiers réinitialisés', icon: 'refresh' }); } }, 'Réinitialiser')),
              row('Réinitialisation complète', 'Efface réglages, fichiers et records puis redémarre', h('button.btn.danger', { onclick: () => { OS.store.clear(); location.reload(); } }, 'Tout effacer'))),
          ];
        },
      };

      function render() {
        side.innerHTML = '';
        sections.forEach(([id, label, ic]) => side.append(h('button.side-item' + (id === current ? '.on' : ''), { html: OS.icon(ic, 16) + label, onclick: () => { current = id; render(); } })));
        main.innerHTML = '';
        main.append(...views[current]());
      }
      render();
      const off = OS.on('settings', ({ key }) => { if (key === 'accent' || key === 'theme') main.querySelectorAll('.se-wall canvas').length && current === 'wallpaper' && render(); });
      win.onClose(off);
    },
  });
})();

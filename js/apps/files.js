/* Prisme OS — Fichiers et Visionneuse */
(function () {
  const { h } = OS;
  const H = OS.fs.HOME;

  OS.registerApp({
    id: 'files', name: 'Fichiers', icon: 'folder', colors: ['#fbbf24', '#f97316'],
    desc: 'Explorateur de fichiers', keywords: 'dossier explorer finder', width: 820, height: 520, minW: 460,
    launch(win, args) {
      let cwd = args.path && OS.fs.isDir(args.path) ? OS.fs.norm(args.path) : H;
      const back = [], fwd = [];
      let view = OS.store.get('filesView', 'grid');
      let selected = null;

      const places = [
        ['Personnel', 'home', H], ['Bureau', 'desktop', H + '/Bureau'], ['Documents', 'filetext', H + '/Documents'],
        ['Images', 'image', H + '/Images'], ['Musique', 'music', H + '/Musique'], ['Projets', 'folder', H + '/Projets'],
      ];
      const side = h('div.sidebar');
      const crumbs = h('div.fm-crumbs');
      const main = h('div.fm-main');
      const status = h('div.fm-status');
      const search = h('input.field.fm-search', { placeholder: 'Rechercher…' });
      const btnBack = h('button.tbtn', { html: OS.icon('left', 16), title: 'Précédent', onclick: () => back.length && (fwd.push(cwd), go(back.pop(), true)) });
      const btnFwd = h('button.tbtn', { html: OS.icon('right', 16), title: 'Suivant', onclick: () => fwd.length && (back.push(cwd), go(fwd.pop(), true)) });
      const btnUp = h('button.tbtn', { html: OS.icon('up', 16), title: 'Dossier parent', onclick: () => cwd !== '/' && go(OS.fs.dirname(cwd)) });
      const btnView = h('button.tbtn', { title: 'Changer de vue', onclick: () => { view = view === 'grid' ? 'list' : 'grid'; OS.store.set('filesView', view); render(); } });

      win.body.append(h('div.app-flex', side, h('div.fm-wrap',
        h('div.fm-toolbar', btnBack, btnFwd, btnUp, crumbs, search,
          h('button.tbtn', { html: OS.icon('plus', 16), title: 'Nouveau dossier', onclick: newFolder }),
          h('button.tbtn', { html: OS.icon('filetext', 16), title: 'Nouveau fichier', onclick: newFile }),
          btnView),
        main, status)));

      function renderSide() {
        side.innerHTML = '';
        side.append(h('div.side-title', 'Emplacements'));
        for (const [n, i, p] of places) side.append(h('button.side-item' + (cwd === p ? '.on' : ''), { html: OS.icon(i, 16) + n, onclick: () => go(p) }));
        side.append(h('div.side-title', 'Système'));
        for (const [n, p] of [['Racine', '/'], ['etc', '/etc'], ['tmp', '/tmp']]) side.append(h('button.side-item' + (cwd === p ? '.on' : ''), { html: OS.icon('cpu', 16) + n, onclick: () => go(p) }));
      }

      function go(p, hist) {
        if (!OS.fs.isDir(p)) return;
        if (!hist) { back.push(cwd); fwd.length = 0; }
        cwd = OS.fs.norm(p);
        search.value = '';
        selected = null;
        render();
      }

      function render() {
        win.setTitle(cwd === H ? 'Personnel' : OS.fs.basename(cwd));
        btnView.innerHTML = OS.icon(view === 'grid' ? 'filetext' : 'grid', 16);
        renderSide();
        crumbs.innerHTML = '';
        const parts = cwd.split('/').filter(Boolean);
        crumbs.append(h('button', { onclick: () => go('/') }, '/'));
        parts.forEach((p, i) => {
          if (i) crumbs.append(h('span', '›'));
          crumbs.append(h('button', { onclick: () => go('/' + parts.slice(0, i + 1).join('/')) }, p));
        });
        const q = search.value.trim();
        const items = q ? OS.fs.search(q, cwd) : OS.fs.list(cwd) || [];
        main.innerHTML = '';
        main.className = 'fm-main fm-' + view;
        if (!items.length) main.append(h('div.fm-empty', h('div', { html: OS.icon(q ? 'search' : 'folder', 42, 1.4) }), q ? 'Aucun résultat' : 'Ce dossier est vide'));
        for (const e of items) {
          const isImg = e.type === 'file' && /^data:image/.test(e.content || '');
          const thumb = isImg ? h('img.fm-thumb', { src: e.content, alt: '' }) : h('div.fm-ico' + (e.type === 'dir' ? '.dir' : ''), { html: OS.icon(OS.fs.iconFor(e), view === 'grid' ? 34 : 18, 1.6) });
          const el = h('div.fm-item', { tabindex: 0 }, thumb, h('span.fm-name', e.name),
            view === 'list' ? h('span.fm-meta', e.type === 'dir' ? Object.keys(e.children).length + ' éléments' : OS.fs.fmtSize(OS.fs.size(e))) : null,
            view === 'list' ? h('span.fm-meta', new Date(e.mtime).toLocaleDateString('fr-FR')) : null);
          el.addEventListener('click', () => { main.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); el.classList.add('sel'); selected = e; updateStatus(items); });
          el.addEventListener('dblclick', () => (e.type === 'dir' ? go(e.path) : OS.openFile(e.path)));
          el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') el.dispatchEvent(new MouseEvent('dblclick')); if (ev.key === 'Delete') del(e); });
          el.addEventListener('contextmenu', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            OS.contextMenu(ev.clientX, ev.clientY, [
              { label: 'Ouvrir', icon: 'eye', action: () => (e.type === 'dir' ? go(e.path) : OS.openFile(e.path)) },
              { label: 'Renommer', icon: 'pencil', action: () => rename(e) },
              { label: 'Copier vers le Bureau', icon: 'desktop', action: () => { if (e.type === 'file') { OS.fs.write(H + '/Bureau/' + OS.fs.uniqueName(H + '/Bureau', e.name.replace(/(\.[^.]+)?$/, ''), (e.name.match(/\.[^.]+$/) || [''])[0]), e.content); } } },
              '-',
              { label: 'Supprimer', icon: 'trash', action: () => del(e) },
            ]);
          });
          main.append(el);
        }
        updateStatus(items);
      }
      function updateStatus(items) {
        status.textContent = `${items.length} élément${items.length > 1 ? 's' : ''}` + (selected ? ` · « ${selected.name} » sélectionné` + (selected.type === 'file' ? ` (${OS.fs.fmtSize(OS.fs.size(selected))})` : '') : '');
      }

      async function newFolder() {
        const n = await OS.prompt('Nouveau dossier', OS.fs.uniqueName(cwd, 'Nouveau dossier'), 'Créer');
        if (n) try { OS.fs.mkdir(cwd + '/' + n); } catch (er) { OS.notify({ title: 'Erreur', body: er.message, icon: 'info' }); }
      }
      async function newFile() {
        const n = await OS.prompt('Nouveau fichier', OS.fs.uniqueName(cwd, 'sans titre', '.txt'), 'Créer');
        if (n) try { OS.fs.write(cwd + '/' + n, ''); OS.openFile(cwd + '/' + n); } catch (er) { OS.notify({ title: 'Erreur', body: er.message, icon: 'info' }); }
      }
      async function rename(e) {
        const n = await OS.prompt('Renommer', e.name);
        if (n && n !== e.name) try { OS.fs.rename(e.path, n); } catch (er) { OS.notify({ title: 'Erreur', body: er.message, icon: 'info' }); }
      }
      function del(e) {
        try { OS.fs.remove(e.path); OS.notify({ title: 'Supprimé', body: e.name, icon: 'trash', silent: true }); } catch (er) { OS.notify({ title: 'Erreur', body: er.message, icon: 'info' }); }
      }

      main.addEventListener('contextmenu', (ev) => {
        if (ev.target.closest('.fm-item')) return;
        ev.preventDefault(); ev.stopPropagation();
        OS.contextMenu(ev.clientX, ev.clientY, [
          { label: 'Nouveau dossier', icon: 'folder', action: newFolder },
          { label: 'Nouveau fichier', icon: 'filetext', action: newFile },
          '-',
          { label: 'Ouvrir un terminal ici', icon: 'terminal', action: () => OS.launch('terminal') },
        ]);
      });
      search.addEventListener('input', render);
      const off = OS.on('fs', () => render());
      win.onClose(off);
      render();
    },
  });

  OS.registerApp({
    id: 'viewer', name: 'Visionneuse', icon: 'image', colors: ['#22d3ee', '#3b82f6'], hidden: true, width: 640, height: 480,
    launch(win, { path }) {
      win.setTitle(OS.fs.basename(path));
      let zoom = 1;
      const img = h('img.vw-img', { src: OS.fs.read(path), draggable: 'false' });
      const stage = h('div.vw-stage', img);
      stage.addEventListener('wheel', (e) => { e.preventDefault(); zoom = OS.clamp(zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.1, 8); img.style.transform = `scale(${zoom})`; });
      win.tools.append(
        h('button.tbtn', { html: OS.icon('minus', 15), onclick: () => { zoom = Math.max(0.1, zoom / 1.25); img.style.transform = `scale(${zoom})`; } }),
        h('button.tbtn', { html: OS.icon('plus', 15), onclick: () => { zoom = Math.min(8, zoom * 1.25); img.style.transform = `scale(${zoom})`; } }),
        h('button.tbtn', { html: OS.icon('download', 15), title: 'Télécharger', onclick: () => { const a = h('a', { href: img.src, download: OS.fs.basename(path) }); a.click(); } }));
      win.body.append(stage);
    },
  });
})();

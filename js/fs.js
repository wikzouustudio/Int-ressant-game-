/* Prisme OS — système de fichiers virtuel persistant */
(function () {
  const HOME = '/home/explorateur';

  const now = () => Date.now();
  const dir = (children = {}) => ({ type: 'dir', children, mtime: now() });
  const file = (content = '') => ({ type: 'file', content, mtime: now() });

  function defaultTree() {
    return dir({
      home: dir({
        explorateur: dir({
          Bureau: dir({
            'Bienvenue.txt': file(
`Bienvenue dans Prisme OS ✦

Quelques astuces pour bien démarrer :
  • Ctrl + Espace      → recherche universelle (apps, fichiers, calculs)
  • Ctrl + ↑ ou F3     → vue d'ensemble de toutes les fenêtres
  • Ctrl + Alt + ← / → → changer de bureau virtuel
  • Glissez une fenêtre sur un bord de l'écran pour l'ancrer
  • Clic droit sur le bureau pour plus d'options
  • Demandez n'importe quoi à Iris, l'assistante intégrée

Bonne exploration !`),
            'Idées.md': file('# Idées\n\n- [ ] Composer un morceau dans Synthé\n- [ ] Battre le record de Neon Snake\n- [ ] Dessiner un chef-d\'œuvre dans Studio\n'),
          }),
          Documents: dir({
            'journal.md': file('# Journal de bord\n\nJour 1 : Prisme OS vient de démarrer. Tout est fluide.\n'),
            'recette.txt': file('Crêpes\n- 250 g de farine\n- 4 œufs\n- 50 cl de lait\n- 1 pincée de sel\n- 50 g de beurre fondu\n'),
          }),
          Images: dir({}),
          Musique: dir({}),
          Projets: dir({ 'hello.js': file('console.log("Bonjour depuis Prisme OS !");\n') }),
        }),
      }),
      etc: dir({
        motd: file('Prisme OS — la lumière, décomposée.'),
        hostname: file('prisme'),
      }),
      system: dir({ version: file(OS.version), kernel: file('prisme-kernel 6.9-aurore') }),
      tmp: dir({}),
    });
  }

  let root = OS.store.get('fs', null) || defaultTree();
  let saveTimer;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => OS.store.set('fs', root), 200);
  };

  function norm(path, cwd = HOME) {
    if (!path) return cwd;
    path = path.replace(/^~(?=\/|$)/, HOME);
    if (!path.startsWith('/')) path = cwd.replace(/\/$/, '') + '/' + path;
    const out = [];
    for (const seg of path.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') out.pop();
      else out.push(seg);
    }
    return '/' + out.join('/');
  }

  function get(path) {
    const parts = norm(path).split('/').filter(Boolean);
    let node = root;
    for (const p of parts) {
      if (!node || node.type !== 'dir') return null;
      node = node.children[p];
    }
    return node || null;
  }

  const parentOf = (path) => {
    const p = norm(path);
    const i = p.lastIndexOf('/');
    return [p.slice(0, i) || '/', p.slice(i + 1)];
  };

  const changed = (path) => { persist(); OS.emit('fs', norm(path)); };

  OS.fs = {
    HOME,
    norm,
    get,
    exists: (p) => !!get(p),
    isDir: (p) => get(p)?.type === 'dir',
    basename: (p) => norm(p).split('/').pop() || '/',
    dirname: (p) => parentOf(p)[0],
    list(path) {
      const n = get(path);
      if (!n || n.type !== 'dir') return null;
      return Object.entries(n.children)
        .map(([name, node]) => ({ name, path: norm(path) + (norm(path) === '/' ? '' : '/') + name, ...node }))
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'fr') : a.type === 'dir' ? -1 : 1));
    },
    read(path) {
      const n = get(path);
      if (!n) throw new Error('Fichier introuvable : ' + path);
      if (n.type === 'dir') throw new Error('Est un dossier : ' + path);
      return n.content;
    },
    write(path, content) {
      const [d, name] = parentOf(path);
      const pd = get(d);
      if (!pd || pd.type !== 'dir') throw new Error('Dossier introuvable : ' + d);
      const n = pd.children[name];
      if (n && n.type === 'dir') throw new Error('Est un dossier : ' + path);
      pd.children[name] = { type: 'file', content: String(content), mtime: now() };
      pd.mtime = now();
      changed(path);
    },
    mkdir(path) {
      const [d, name] = parentOf(path);
      const pd = get(d);
      if (!pd || pd.type !== 'dir') throw new Error('Dossier introuvable : ' + d);
      if (pd.children[name]) throw new Error('Existe déjà : ' + name);
      pd.children[name] = dir();
      changed(path);
    },
    remove(path) {
      const [d, name] = parentOf(path);
      const pd = get(d);
      if (!pd || !pd.children[name]) throw new Error('Introuvable : ' + path);
      if (norm(path) === HOME || norm(path) === '/') throw new Error('Opération refusée');
      delete pd.children[name];
      changed(path);
    },
    rename(path, newName) {
      const [d, name] = parentOf(path);
      const pd = get(d);
      if (!pd?.children[name]) throw new Error('Introuvable : ' + path);
      if (pd.children[newName]) throw new Error('Existe déjà : ' + newName);
      pd.children[newName] = pd.children[name];
      delete pd.children[name];
      changed(path);
    },
    uniqueName(dirPath, base, ext = '') {
      let name = base + ext, i = 2;
      while (get(norm(dirPath) + '/' + name)) name = `${base} ${i++}${ext}`;
      return name;
    },
    // Recherche récursive par nom
    search(q, path = '/', acc = []) {
      for (const e of this.list(path) || []) {
        if (e.name.toLowerCase().includes(q.toLowerCase())) acc.push(e);
        if (e.type === 'dir' && acc.length < 50) this.search(q, e.path, acc);
      }
      return acc;
    },
    size(node) {
      if (node.type === 'file') return new Blob([node.content]).size;
      return Object.values(node.children).reduce((s, c) => s + this.size(c), 0);
    },
    reset() { root = defaultTree(); changed('/'); },
  };

  OS.fs.fmtSize = (b) => (b < 1024 ? b + ' o' : b < 1048576 ? (b / 1024).toFixed(1) + ' Ko' : (b / 1048576).toFixed(1) + ' Mo');
  OS.fs.iconFor = (e) => {
    if (e.type === 'dir') return 'folder';
    if (/\.(png|jpe?g|gif|svg|webp)$/i.test(e.name)) return 'image';
    if (/\.(txt|md|js|json|css|html)$/i.test(e.name)) return 'filetext';
    return 'file';
  };
})();

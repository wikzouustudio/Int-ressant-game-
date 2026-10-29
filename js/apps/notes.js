/* Prisme OS — Notes : éditeur de texte avec aperçu Markdown */
(function () {
  const { h } = OS;

  // Mini moteur Markdown (titres, listes, cases à cocher, gras, italique, code, liens, citations)
  function md(src) {
    const inline = (s) => OS.esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const out = [];
    let list = null, code = null;
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const line of src.split('\n')) {
      if (line.startsWith('```')) {
        if (code) { out.push(`<pre><code>${OS.esc(code.join('\n'))}</code></pre>`); code = null; }
        else { closeList(); code = []; }
        continue;
      }
      if (code) { code.push(line); continue; }
      let m;
      if ((m = line.match(/^(#{1,4})\s+(.*)/))) { closeList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
      else if ((m = line.match(/^\s*[-*]\s+\[( |x)\]\s+(.*)/i))) { if (list !== 'ul') { closeList(); out.push('<ul class="todo">'); list = 'ul'; } out.push(`<li class="${m[1] === ' ' ? '' : 'done'}"><span class="cb"></span>${inline(m[2])}</li>`); }
      else if ((m = line.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = line.match(/^\s*\d+\.\s+(.*)/))) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = line.match(/^>\s?(.*)/))) { closeList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); }
      else if (/^---+$/.test(line)) { closeList(); out.push('<hr>'); }
      else if (!line.trim()) closeList();
      else { closeList(); out.push(`<p>${inline(line)}</p>`); }
    }
    if (code) out.push(`<pre><code>${OS.esc(code.join('\n'))}</code></pre>`);
    closeList();
    return out.join('');
  }
  OS.markdown = md;

  OS.registerApp({
    id: 'notes', name: 'Notes', icon: 'notes', colors: ['#fde047', '#f59e0b'],
    desc: 'Éditeur de texte & Markdown', keywords: 'texte editeur markdown ecrire', width: 760, height: 520,
    launch(win, args) {
      let path = args.path || null;
      let dirty = false;
      let mode = path && /\.md$/i.test(path) ? 'split' : 'edit';
      const ta = h('textarea.nt-text', { spellcheck: 'true', placeholder: 'Commencez à écrire… (Markdown pris en charge)' });
      const pv = h('div.nt-preview.md');
      const stat = h('div.nt-status');
      const body = h('div.nt-body', ta, pv);
      const modeBtns = {};
      const setMode = (m) => {
        mode = m;
        body.dataset.mode = m;
        Object.entries(modeBtns).forEach(([k, b]) => b.classList.toggle('on', k === m));
        refresh();
      };
      for (const [m, label] of [['edit', 'Écrire'], ['split', 'Partagé'], ['preview', 'Aperçu']]) {
        modeBtns[m] = h('button.seg-btn', { onclick: () => setMode(m) }, label);
      }
      win.tools.append(h('div.seg', Object.values(modeBtns)),
        h('button.tbtn', { html: OS.icon('save', 15), title: 'Enregistrer (Ctrl+S)', onclick: () => save() }));
      win.body.append(h('div.nt', body, stat));

      if (path) { try { ta.value = OS.fs.read(path); } catch (e) { ta.value = ''; } }

      function title() { win.setTitle((path ? OS.fs.basename(path) : 'Sans titre') + (dirty ? ' •' : '')); }
      function refresh() {
        if (mode !== 'edit') pv.innerHTML = md(ta.value);
        const words = (ta.value.match(/\S+/g) || []).length;
        stat.textContent = `${words} mot${words > 1 ? 's' : ''} · ${ta.value.length} caractères` + (path ? ' · ' + path.replace(OS.fs.HOME, '~') : ' · non enregistré');
        title();
      }
      async function save(as) {
        if (!path || as) {
          const n = await OS.prompt('Enregistrer sous (dans Documents)', path ? OS.fs.basename(path) : 'note.md', 'Enregistrer');
          if (!n) return;
          path = n.includes('/') ? OS.fs.norm(n) : OS.fs.HOME + '/Documents/' + n;
        }
        try {
          OS.fs.write(path, ta.value);
          dirty = false;
          refresh();
          OS.notify({ title: 'Enregistré', body: OS.fs.basename(path), icon: 'save', silent: true });
        } catch (e) { OS.notify({ title: 'Erreur', body: e.message, icon: 'info' }); }
      }
      // Sauvegarde automatique des fichiers existants
      let auto;
      ta.addEventListener('input', () => {
        dirty = true;
        refresh();
        if (path) { clearTimeout(auto); auto = setTimeout(() => { OS.fs.write(path, ta.value); dirty = false; title(); }, 800); }
      });
      ta.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(e.shiftKey); }
        if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
      });
      // Cocher une case dans l'aperçu modifie le texte
      pv.addEventListener('click', (e) => {
        const li = e.target.closest('.todo li');
        if (!li) return;
        const idx = [...pv.querySelectorAll('.todo li')].indexOf(li);
        let n = -1;
        ta.value = ta.value.replace(/^(\s*[-*]\s+\[)( |x)(\])/gim, (all, a, c, b) => (++n === idx ? a + (c === ' ' ? 'x' : ' ') + b : all));
        ta.dispatchEvent(new Event('input'));
      });
      win.onClose(() => { if (path && dirty) OS.fs.write(path, ta.value); });
      setMode(mode);
      setTimeout(() => ta.focus(), 60);
    },
  });
})();

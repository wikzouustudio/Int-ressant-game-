/* Prisme OS — Terminal */
(function () {
  const { h } = OS;

  OS.registerApp({
    id: 'terminal', name: 'Terminal', icon: 'terminal', colors: ['#334155', '#020617'],
    desc: 'Shell interactif', keywords: 'console shell bash commande', width: 760, height: 460,
    launch(win) {
      const out = h('div.term-out');
      const prompt = h('span.term-prompt');
      const input = h('input.term-input', { spellcheck: 'false', autocomplete: 'off' });
      const line = h('div.term-line', prompt, input);
      const root = h('div.term', out, line);
      win.body.append(root);
      root.addEventListener('mouseup', () => { if (!getSelection().toString()) input.focus(); });

      let cwd = OS.fs.HOME;
      const hist = OS.store.get('termHistory', []);
      let hi = hist.length;
      let matrixStop = null;

      const short = (p) => p.replace(OS.fs.HOME, '~');
      const renderPrompt = () => { prompt.innerHTML = `<b class="tp-u">${OS.esc(OS.settings.user.toLowerCase())}@prisme</b><span class="tp-d">${OS.esc(short(cwd))}</span><span class="tp-a">❯</span>`; };
      const print = (html, cls = '') => { out.append(h('div.tl' + (cls ? '.' + cls : ''), { html })); root.scrollTop = root.scrollHeight; };
      const text = (s, cls) => print(OS.esc(s), cls);
      const err = (s) => text(s, 'err');

      const banner = () => print(`<pre class="term-banner">${OS.esc(`
   ╱╲     ____       _
  ╱  ╲   |  _ \\ _ __(_)___ _ __ ___   ___
 ╱ ◆  ╲  | |_) | '__| / __| '_ \` _ \\ / _ \\
╱______╲ |  __/| |  | \\__ \\ | | | | |  __/
         |_|   |_|  |_|___/_| |_| |_|\\___|`)}</pre><span class="dim">Prisme OS ${OS.version} — tapez <b>help</b> pour la liste des commandes.</span>`);

      const cmds = {
        help: () => {
          const list = [
            ['ls [dossier]', 'liste le contenu'], ['cd <dossier>', 'change de dossier'], ['pwd', 'dossier courant'],
            ['cat <fichier>', 'affiche un fichier'], ['mkdir / touch / rm', 'crée ou supprime'], ['echo texte > f', 'écrit dans un fichier'],
            ['tree', 'arborescence'], ['open <app|fichier>', 'ouvre une app ou un fichier'], ['apps', 'liste des applications'],
            ['calc <expr>', 'calculatrice'], ['theme <dark|light|#hex>', 'change l\'apparence'], ['wallpaper <nom>', 'fond d\'écran'],
            ['neofetch', 'infos système'], ['ps / kill <n>', 'processus'], ['matrix', 'pluie numérique'], ['cowsay <texte>', 'une vache qui parle'],
            ['fortune', 'citation'], ['date / uptime / whoami', 'infos'], ['history / clear', 'historique, effacer'],
          ];
          print(list.map(([c, d]) => `<span class="acc">${OS.esc(c.padEnd(26))}</span><span class="dim">${OS.esc(d)}</span>`).join('\n'), 'pre');
        },
        ls: (a) => {
          const p = OS.fs.norm(a[0], cwd);
          const l = OS.fs.list(p);
          if (!l) return OS.fs.exists(p) ? text(OS.fs.basename(p)) : err(`ls: ${a[0]} : introuvable`);
          if (!l.length) return;
          print(l.map((e) => e.type === 'dir' ? `<span class="dir">${OS.esc(e.name)}/</span>` : `<span>${OS.esc(e.name)}</span>`).join('   '));
        },
        cd: (a) => {
          const p = OS.fs.norm(a[0] || '~', cwd);
          if (!OS.fs.isDir(p)) return err(`cd: ${a[0]} : dossier introuvable`);
          cwd = p;
        },
        pwd: () => text(cwd),
        cat: (a) => {
          if (!a.length) return err('cat: fichier manquant');
          for (const f of a) {
            try {
              const c = OS.fs.read(OS.fs.norm(f, cwd));
              text(c.startsWith('data:image') ? '[image binaire]' : c, 'pre');
            } catch (e) { err('cat: ' + e.message); }
          }
        },
        mkdir: (a) => a.forEach((d) => { try { OS.fs.mkdir(OS.fs.norm(d, cwd)); } catch (e) { err('mkdir: ' + e.message); } }),
        touch: (a) => a.forEach((f) => { const p = OS.fs.norm(f, cwd); if (!OS.fs.exists(p)) try { OS.fs.write(p, ''); } catch (e) { err('touch: ' + e.message); } }),
        rm: (a) => a.filter((x) => x !== '-r' && x !== '-rf').forEach((f) => { try { OS.fs.remove(OS.fs.norm(f, cwd)); } catch (e) { err('rm: ' + e.message); } }),
        mv: (a) => { try { OS.fs.rename(OS.fs.norm(a[0], cwd), a[1]); } catch (e) { err('mv: ' + e.message); } },
        echo: (a, raw) => {
          const m = raw.match(/^(.*?)\s*(>>?)\s*(\S+)\s*$/);
          if (m) {
            const p = OS.fs.norm(m[3], cwd);
            const prev = m[2] === '>>' && OS.fs.exists(p) ? OS.fs.read(p) : '';
            try { OS.fs.write(p, prev + m[1].replace(/^["']|["']$/g, '') + '\n'); } catch (e) { err('echo: ' + e.message); }
          } else text(raw.replace(/^["']|["']$/g, ''));
        },
        tree: (a) => {
          const lines = [];
          const walk = (p, pre) => {
            const l = OS.fs.list(p) || [];
            l.forEach((e, i) => {
              const last = i === l.length - 1;
              lines.push(pre + (last ? '└── ' : '├── ') + (e.type === 'dir' ? `<span class="dir">${OS.esc(e.name)}</span>` : OS.esc(e.name)));
              if (e.type === 'dir') walk(e.path, pre + (last ? '    ' : '│   '));
            });
          };
          const p = OS.fs.norm(a[0], cwd);
          lines.push(`<span class="dir">${OS.esc(short(p))}</span>`);
          walk(p, '');
          print(lines.join('\n'), 'pre');
        },
        open: (a) => {
          const t = a.join(' ');
          if (!t) return err('open: que faut-il ouvrir ?');
          const app = Object.values(OS.apps).find((x) => x.id === t.toLowerCase() || x.name.toLowerCase() === t.toLowerCase());
          if (app) return OS.launch(app.id);
          const p = OS.fs.norm(t, cwd);
          if (OS.fs.exists(p)) return OS.openFile(p);
          err('open: introuvable : ' + t);
        },
        apps: () => print(Object.values(OS.apps).filter((a) => !a.hidden).map((a) => `<span class="acc">${a.id.padEnd(12)}</span>${OS.esc(a.name)}`).join('\n'), 'pre'),
        calc: (a) => { const r = OS.evalMath(a.join(' ')); r == null ? err('calc: expression invalide') : text('= ' + r, 'acc'); },
        theme: (a) => {
          const v = a[0];
          if (v === 'dark' || v === 'light') OS.setSetting('theme', v);
          else if (/^#[0-9a-f]{6}$/i.test(v || '')) OS.setSetting('accent', v);
          else return err('usage : theme dark | light | #rrggbb');
          text('✓ Apparence mise à jour', 'ok');
        },
        wallpaper: (a) => {
          const w = OS.wallpapers.find((x) => x.id === a[0] || x.name.toLowerCase() === (a[0] || '').toLowerCase());
          if (!w) return text('Disponibles : ' + OS.wallpapers.map((x) => x.id).join(', '));
          OS.setSetting('wallpaper', w.id);
          text('✓ Fond d\'écran : ' + w.name, 'ok');
        },
        neofetch: () => {
          const logo = ['      ╱╲      ', '     ╱  ╲     ', '    ╱ ◆◆ ╲    ', '   ╱  ◆◆  ╲   ', '  ╱________╲  ', '              '];
          const info = [
            `<b class="acc">${OS.esc(OS.settings.user.toLowerCase())}</b>@<b class="acc">prisme</b>`, '─'.repeat(18),
            `<b class="acc">OS</b>       Prisme OS ${OS.version}`,
            `<b class="acc">Noyau</b>    prisme-kernel 6.9-aurore`,
            `<b class="acc">Uptime</b>   ${OS.uptime()}`,
            `<b class="acc">Shell</b>    psh 2.0`,
            `<b class="acc">Écran</b>    ${innerWidth}×${innerHeight}`,
            `<b class="acc">Thème</b>    ${OS.settings.theme} · ${OS.settings.accent}`,
            `<b class="acc">Fenêtres</b> ${OS.windows.length}`,
            `<b class="acc">CPU</b>      ${navigator.hardwareConcurrency || '?'} cœurs · ${OS.stats.cpu}%`,
            OS.accents.map((c) => `<span style="color:${c}">███</span>`).join(''),
          ];
          print(info.map((l, i) => `<span class="rainbow-${i % 6}">${OS.esc(logo[i] || ' '.repeat(14))}</span>  ${l}`).join('\n'), 'pre');
        },
        ps: () => print('<span class="dim">  PID  APP           BUREAU  ÉTAT</span>\n' + OS.windows.map((w, i) => `${String(i + 1).padStart(5)}  ${w.app.id.padEnd(13)} ${String(w.ws + 1).padEnd(7)} ${w.state}`).join('\n'), 'pre'),
        kill: (a) => { const w = OS.windows[+a[0] - 1]; if (!w) return err('kill: PID inconnu'); if (w === win) return err('kill: refus de se tuer soi-même 🙃'); w.close(); text('✓ processus ' + a[0] + ' terminé', 'ok'); },
        date: () => text(new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium' })),
        uptime: () => text('actif depuis ' + OS.uptime()),
        whoami: () => text(OS.settings.user.toLowerCase()),
        history: () => print(hist.map((c, i) => `<span class="dim">${String(i + 1).padStart(4)}</span>  ${OS.esc(c)}`).join('\n'), 'pre'),
        clear: () => { out.innerHTML = ''; },
        fortune: () => {
          const f = ['« La simplicité est la sophistication suprême. » — Léonard de Vinci', '« Le code est comme l\'humour : s\'il faut l\'expliquer, c\'est mauvais. »', '« Un prisme ne crée pas les couleurs, il les révèle. »', '« Rien ne se perd, rien ne se crée, tout se refactorise. »', '« Il n\'y a pas de bug, seulement des fonctionnalités surprises. »', '« Celui qui déplace une montagne commence par déplacer de petites pierres. » — Confucius'];
          text(f[Math.floor(Math.random() * f.length)], 'acc');
        },
        cowsay: (a) => {
          const msg = a.join(' ') || 'Meuh !';
          print(OS.esc(` ${'_'.repeat(msg.length + 2)}\n< ${msg} >\n ${'-'.repeat(msg.length + 2)}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`), 'pre');
        },
        matrix: () => {
          const c = h('canvas.term-matrix');
          root.append(c);
          const cx = c.getContext('2d');
          const W = (c.width = root.clientWidth), H = (c.height = root.clientHeight);
          const cols = Math.floor(W / 14), drops = Array(cols).fill(0).map(() => Math.random() * -50);
          let raf;
          const draw = () => {
            cx.fillStyle = 'rgba(0,0,0,.08)'; cx.fillRect(0, 0, W, H);
            cx.fillStyle = OS.settings.accent; cx.font = '14px JetBrains Mono, monospace';
            drops.forEach((y, i) => {
              cx.fillText(String.fromCharCode(0x30a0 + Math.random() * 96), i * 14, y * 14);
              drops[i] = y * 14 > H && Math.random() > 0.97 ? 0 : y + 1;
            });
            raf = requestAnimationFrame(draw);
          };
          draw();
          matrixStop = () => { cancelAnimationFrame(raf); c.remove(); matrixStop = null; input.focus(); };
          text('(appuyez sur une touche pour quitter)', 'dim');
        },
        sudo: () => text('Bel essai. Ici, c\'est vous le super-utilisateur ✦', 'acc'),
        exit: () => win.close(),
        reboot: () => location.reload(),
        lock: () => OS.lock(),
        iris: (a) => OS.launch('iris', { ask: a.join(' ') }),
      };
      cmds.ll = cmds.ls; cmds.dir = cmds.ls; cmds.cls = cmds.clear;

      function run(raw) {
        print(prompt.innerHTML + OS.esc(raw), 'echo');
        raw = raw.trim();
        if (!raw) return;
        hist.push(raw);
        if (hist.length > 200) hist.shift();
        OS.store.set('termHistory', hist);
        hi = hist.length;
        for (const part of raw.split(/\s*&&\s*/)) {
          const [name, ...args] = part.match(/"[^"]*"|'[^']*'|\S+/g) || [];
          const rest = part.slice(name.length).trim();
          const fn = cmds[name.toLowerCase()];
          if (fn) { try { fn(args.map((x) => x.replace(/^["']|["']$/g, '')), rest); } catch (e) { err(e.message); } }
          else if (OS.evalMath(part) != null) text('= ' + OS.evalMath(part), 'acc');
          else { err(`psh: commande introuvable : ${name}`); break; }
        }
        renderPrompt();
      }

      input.addEventListener('keydown', (e) => {
        if (matrixStop) { e.preventDefault(); return matrixStop(); }
        if (e.key === 'Enter') { run(input.value); input.value = ''; }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) input.value = hist[--hi]; }
        else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; }
        else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
        else if (e.key === 'Tab') {
          e.preventDefault();
          const parts = input.value.split(' ');
          const last = parts.pop();
          let cands;
          if (!parts.length) cands = Object.keys(cmds).filter((c) => c.startsWith(last));
          else {
            const base = last.includes('/') ? last.slice(0, last.lastIndexOf('/') + 1) : '';
            const l = OS.fs.list(OS.fs.norm(base || '.', cwd)) || [];
            cands = l.filter((x) => x.name.startsWith(last.slice(base.length))).map((x) => base + x.name + (x.type === 'dir' ? '/' : ''));
          }
          if (cands.length === 1) input.value = [...parts, cands[0]].join(' ') + (parts.length ? '' : ' ');
          else if (cands.length > 1) print(cands.map(OS.esc).join('   '), 'dim');
        }
      });

      banner();
      renderPrompt();
      setTimeout(() => input.focus(), 50);
      win.onClose(() => matrixStop && matrixStop());
    },
  });
})();

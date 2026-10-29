/* Prisme OS — Calculatrice (standard + scientifique, avec historique) */
(function () {
  const { h } = OS;

  OS.registerApp({
    id: 'calculator', name: 'Calculatrice', icon: 'calc', colors: ['#fb923c', '#e11d48'],
    desc: 'Calculs standards et scientifiques', keywords: 'calcul math', width: 360, height: 560, minW: 300, minH: 460,
    launch(win) {
      let expr = '';
      let justEvaluated = false;
      const hist = [];
      const exprEl = h('div.calc-expr');
      const resEl = h('div.calc-res', '0');
      const histEl = h('div.calc-hist');
      const pad = h('div.calc-pad');
      let sci = false;

      const display = () => {
        exprEl.textContent = expr || ' ';
        const r = OS.evalMath(expr);
        resEl.textContent = r != null ? fmt(r) : expr ? resEl.textContent : '0';
        resEl.classList.toggle('preview', !justEvaluated);
        const len = resEl.textContent.length;
        resEl.style.fontSize = len > 14 ? '28px' : len > 10 ? '36px' : '';
      };
      const fmt = (n) => (Math.abs(n) > 1e15 || (Math.abs(n) < 1e-6 && n !== 0) ? n.toExponential(6) : n.toLocaleString('fr-FR', { maximumFractionDigits: 10 }));

      function press(k) {
        OS.sound('click');
        if (k === 'C') { expr = ''; justEvaluated = false; }
        else if (k === '⌫') expr = expr.slice(0, -1);
        else if (k === '=') {
          const r = OS.evalMath(expr);
          if (r == null) { resEl.classList.add('shake'); setTimeout(() => resEl.classList.remove('shake'), 400); return; }
          hist.unshift([expr, r]);
          histEl.innerHTML = '';
          hist.slice(0, 6).forEach(([e, v]) => histEl.append(h('button', { onclick: () => { expr = String(v); display(); } }, h('span', e), h('b', fmt(v)))));
          expr = String(r);
          justEvaluated = true;
          display();
          resEl.classList.remove('preview');
          return;
        } else if (k === '±') expr = expr ? `-(${expr})` : '-';
        else {
          if (justEvaluated && /[\d.(]|sqrt|sin|cos|tan|ln|log|π/.test(k[0])) expr = '';
          const map = { '×': '*', '÷': '/', '√': 'sqrt(', 'sin': 'sin(', 'cos': 'cos(', 'tan': 'tan(', 'ln': 'ln(', 'log': 'log(', 'x²': '^2', 'xʸ': '^', '1/x': '1/(' };
          expr += map[k] ?? k;
        }
        justEvaluated = false;
        display();
      }

      const std = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '±', '0', ',', '='];
      const sciKeys = ['sin', 'cos', 'tan', '(', ')', 'ln', 'log', '√', 'x²', 'xʸ', 'π', 'e', '1/x', '!', ''];
      function renderPad() {
        pad.innerHTML = '';
        pad.classList.toggle('sci', sci);
        if (sci) sciKeys.filter((k) => k && k !== '!').forEach((k) => pad.append(h('button.ck.fn', { onclick: () => press(k) }, k)));
        std.forEach((k) => {
          const cls = k === '=' ? '.eq' : /[÷×\-+%]/.test(k) && k.length === 1 ? '.op' : /[C⌫±]/.test(k) ? '.fn' : '';
          pad.append(h('button.ck' + cls, { onclick: () => press(k === ',' ? '.' : k) }, k));
        });
      }
      const sciBtn = h('button.btn', { onclick: () => { sci = !sci; sciBtn.classList.toggle('on', sci); renderPad(); } }, 'Scientifique');
      win.tools.append(sciBtn);
      win.body.append(h('div.calc', h('div.calc-screen', histEl, exprEl, resEl), pad));
      renderPad();
      display();

      const onKey = (e) => {
        if (OS.focused() !== win || e.target.tagName === 'INPUT') return;
        const k = e.key;
        if (/^[\d.()+\-*/%^]$/.test(k)) press(k === '*' ? '×' : k === '/' ? '÷' : k);
        else if (k === ',') press('.');
        else if (k === 'Enter' || k === '=') { e.preventDefault(); press('='); }
        else if (k === 'Backspace') press('⌫');
        else if (k === 'Escape' || k === 'Delete') press('C');
      };
      document.addEventListener('keydown', onKey);
      win.onClose(() => document.removeEventListener('keydown', onKey));
    },
  });
})();

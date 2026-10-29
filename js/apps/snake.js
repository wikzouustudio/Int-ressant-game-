/* Prisme OS — Neon Snake */
(function () {
  const { h } = OS;

  OS.registerApp({
    id: 'snake', name: 'Neon Snake', icon: 'gamepad', colors: ['#4ade80', '#059669'],
    desc: 'Le serpent, version néon', keywords: 'jeu game serpent arcade', width: 560, height: 620, minW: 360, minH: 420, single: true,
    launch(win) {
      const N = 22;
      const cv = h('canvas.sn-canvas', { width: 660, height: 660 });
      const c = cv.getContext('2d');
      const scoreEl = h('b', '0');
      const bestEl = h('b', String(OS.store.get('snakeBest', 0)));
      const msg = h('div.sn-msg');
      win.body.append(h('div.sn', h('div.sn-hud', h('span', 'Score ', scoreEl), h('span', 'Record ', bestEl)), h('div.sn-stage', cv, msg)));

      let snake, dir, nextDir, food, score, state = 'ready', tick, particles = [], speed;
      const cell = cv.width / N;

      function reset() {
        snake = [[10, 11], [9, 11], [8, 11]];
        dir = [1, 0]; nextDir = [1, 0];
        score = 0; speed = 120;
        scoreEl.textContent = '0';
        placeFood();
      }
      function placeFood() {
        do food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)];
        while (snake.some(([x, y]) => x === food[0] && y === food[1]));
      }
      function showMsg(t, s) { msg.innerHTML = `<h2>${t}</h2><p>${s}</p>`; msg.style.display = ''; }
      function start() {
        if (state === 'over' || state === 'ready') reset();
        state = 'play';
        msg.style.display = 'none';
        clearTimeout(tick);
        loop();
      }
      function loop() {
        if (state !== 'play') return;
        step();
        tick = setTimeout(loop, speed);
      }
      function step() {
        dir = nextDir;
        const head = [(snake[0][0] + dir[0] + N) % N, (snake[0][1] + dir[1] + N) % N];
        if (snake.some(([x, y], i) => i < snake.length - 1 && x === head[0] && y === head[1])) return gameOver();
        snake.unshift(head);
        if (head[0] === food[0] && head[1] === food[1]) {
          score += 10;
          scoreEl.textContent = score;
          speed = Math.max(55, speed - 3);
          burst(food);
          OS.sound('click');
          placeFood();
        } else snake.pop();
      }
      function burst([fx, fy]) {
        for (let i = 0; i < 18; i++) {
          const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 4;
          particles.push({ x: (fx + 0.5) * cell, y: (fy + 0.5) * cell, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 });
        }
      }
      function gameOver() {
        state = 'over';
        OS.sound('error');
        const best = OS.store.get('snakeBest', 0);
        if (score > best) {
          OS.store.set('snakeBest', score);
          bestEl.textContent = score;
          showMsg('Nouveau record ! 🏆', `${score} points — Espace pour rejouer`);
          OS.notify({ title: 'Neon Snake', body: `Nouveau record : ${score} points !`, icon: 'gamepad', silent: true });
        } else showMsg('Partie terminée', `${score} points — Espace pour rejouer`);
      }

      // Rendu continu (lissage visuel indépendant de la logique)
      let raf;
      function render() {
        raf = requestAnimationFrame(render);
        const t = performance.now();
        c.fillStyle = '#07060f';
        c.fillRect(0, 0, cv.width, cv.height);
        c.fillStyle = 'rgba(255,255,255,.035)';
        for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if ((x + y) % 2) c.fillRect(x * cell, y * cell, cell, cell);
        if (!snake) return;
        const acc = OS.settings.accent;
        // Nourriture pulsante
        const pr = cell * (0.28 + 0.06 * Math.sin(t / 150));
        c.shadowBlur = 25; c.shadowColor = '#f43f5e'; c.fillStyle = '#fb7185';
        c.beginPath(); c.arc((food[0] + 0.5) * cell, (food[1] + 0.5) * cell, pr, 0, 7); c.fill();
        // Serpent en dégradé
        c.shadowColor = acc;
        snake.forEach(([x, y], i) => {
          const k = 1 - i / snake.length;
          c.shadowBlur = i === 0 ? 30 : 12;
          const [ar, ag, ab] = OS.hexToRgb(acc), m = 0.4 + k * 0.6;
          c.fillStyle = i === 0 ? '#ffffff' : `rgb(${ar * m + 34 * (1 - m)},${ag * m + 211 * (1 - m)},${ab * m + 238 * (1 - m)})`;
          const p = i === 0 ? 2 : 3 + (1 - k) * 4;
          c.beginPath();
          c.roundRect ? c.roundRect(x * cell + p, y * cell + p, cell - p * 2, cell - p * 2, 7) : c.rect(x * cell + p, y * cell + p, cell - p * 2, cell - p * 2);
          c.fill();
        });
        c.shadowBlur = 0;
        particles = particles.filter((p) => (p.life -= 0.03) > 0);
        particles.forEach((p) => {
          p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94;
          c.globalAlpha = p.life; c.fillStyle = '#fb7185';
          c.fillRect(p.x - 2, p.y - 2, 4, 4);
        });
        c.globalAlpha = 1;
      }

      const onKey = (e) => {
        if (OS.focused() !== win) return;
        const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], z: [0, -1], s: [0, 1], q: [-1, 0], d: [1, 0], w: [0, -1], a: [-1, 0] };
        const d = map[e.key];
        if (d) {
          e.preventDefault();
          if (state !== 'play') start();
          if (d[0] !== -dir[0] || d[1] !== -dir[1]) nextDir = d;
        } else if (e.key === ' ') {
          e.preventDefault();
          if (state === 'play') { state = 'pause'; showMsg('Pause', 'Espace pour reprendre'); }
          else start();
        }
      };
      // Contrôle tactile par glissement
      let touch;
      cv.addEventListener('pointerdown', (e) => { touch = [e.clientX, e.clientY]; if (state !== 'play') start(); });
      cv.addEventListener('pointerup', (e) => {
        if (!touch) return;
        const dx = e.clientX - touch[0], dy = e.clientY - touch[1];
        if (Math.hypot(dx, dy) > 20) {
          const d = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
          if (d[0] !== -dir[0] || d[1] !== -dir[1]) nextDir = d;
        }
        touch = null;
      });
      document.addEventListener('keydown', onKey);
      reset();
      render();
      showMsg('Neon Snake', 'Flèches ou ZQSD pour jouer · Espace pour pause');
      win.onClose(() => { document.removeEventListener('keydown', onKey); clearTimeout(tick); cancelAnimationFrame(raf); });
    },
  });
})();

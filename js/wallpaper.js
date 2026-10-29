/* Prisme OS — fonds d'écran génératifs animés */
(function () {
  const canvas = document.getElementById('wallpaper');
  const mainCtx = canvas.getContext('2d');
  let ctx = mainCtx;
  let W = 0, H = 0, scale = 1, t = 0, last = performance.now();
  const mouse = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5 };

  addEventListener('pointermove', (e) => { mouse.x = e.clientX / innerWidth; mouse.y = e.clientY / innerHeight; });

  const palettes = (accent) => {
    const a = accent;
    return {
      dark: ['#0b0820', a, '#06b6d4', '#ec4899', '#1e1b4b', '#10b981'],
      light: ['#eef2ff', a, '#67e8f9', '#f9a8d4', '#c7d2fe', '#6ee7b7'],
    };
  };

  // Étoiles pour la nébuleuse
  const stars = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), tw: Math.random() * 6 }));

  const modes = {
    // Aurore : grands halos colorés qui dérivent, rendus en basse résolution pour un flou naturel
    aurora: {
      res: 0.08,
      draw() {
        const dark = OS.settings.theme === 'dark';
        const pal = palettes(OS.settings.accent)[dark ? 'dark' : 'light'];
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = pal[0];
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = dark ? 'lighter' : 'multiply';
        const blobs = 5;
        for (let i = 0; i < blobs; i++) {
          const k = i + 1;
          const x = W * (0.5 + 0.38 * Math.sin(t * 0.00011 * k + i * 2.1) + (mouse.sx - 0.5) * 0.15 * (i % 2 ? 1 : -1));
          const y = H * (0.5 + 0.34 * Math.cos(t * 0.00013 * k + i * 1.3) + (mouse.sy - 0.5) * 0.15);
          const r = Math.max(W, H) * (0.35 + 0.12 * Math.sin(t * 0.0002 + i));
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          const c = pal[1 + (i % (pal.length - 1))];
          g.addColorStop(0, c + (dark ? 'aa' : 'cc'));
          g.addColorStop(1, c + '00');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
        ctx.globalCompositeOperation = 'source-over';
      },
    },

    // Nébuleuse : champ d'étoiles avec parallaxe à la souris
    nebula: {
      res: 0.5,
      draw() {
        const a = OS.settings.accent;
        const g = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.5, H * 0.5, Math.max(W, H));
        g.addColorStop(0, OS.shade(a, -90));
        g.addColorStop(0.5, '#070512');
        g.addColorStop(1, '#020107');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 3; i++) {
          const x = W * (0.3 + i * 0.25 + 0.05 * Math.sin(t * 0.0001 + i));
          const y = H * (0.4 + 0.15 * Math.cos(t * 0.00012 + i * 2));
          const rg = ctx.createRadialGradient(x, y, 0, x, y, W * 0.3);
          rg.addColorStop(0, [a, '#ec4899', '#06b6d4'][i] + '30');
          rg.addColorStop(1, '#00000000');
          ctx.fillStyle = rg;
          ctx.fillRect(0, 0, W, H);
        }
        for (const s of stars) {
          const px = ((s.x + (mouse.sx - 0.5) * 0.04 * s.z + t * 0.000004 * (s.z + 0.2)) % 1) * W;
          const py = (s.y + (mouse.sy - 0.5) * 0.04 * s.z) * H;
          const alpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.001 + s.tw));
          ctx.fillStyle = `rgba(255,255,255,${alpha * (0.3 + s.z * 0.7)})`;
          ctx.beginPath();
          ctx.arc(px, py, (0.4 + s.z * 1.3) * scale, 0, 6.283);
          ctx.fill();
        }
      },
    },

    // Vagues : couches sinusoïdales superposées
    waves: {
      res: 0.5,
      draw() {
        const dark = OS.settings.theme === 'dark';
        const a = OS.settings.accent;
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, dark ? '#0a0a1a' : '#f5f3ff');
        bg.addColorStop(1, dark ? OS.shade(a, -100) : OS.shade(a, 120));
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        const cols = [a, '#06b6d4', '#ec4899', OS.shade(a, 50), '#3b82f6'];
        for (let L = 0; L < 5; L++) {
          ctx.beginPath();
          const base = H * (0.45 + L * 0.11);
          ctx.moveTo(0, H);
          for (let x = 0; x <= W; x += 8 * scale) {
            const y = base
              + Math.sin(x * 0.004 / scale + t * 0.0006 * (L + 1) * 0.5 + L) * 40 * scale
              + Math.sin(x * 0.011 / scale - t * 0.0009 + L * 3) * 14 * scale
              + (mouse.sy - 0.5) * 30 * scale * (L + 1) * 0.3;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(W, H);
          ctx.closePath();
          const lg = ctx.createLinearGradient(0, base - 60, 0, H);
          lg.addColorStop(0, cols[L] + (dark ? '55' : '66'));
          lg.addColorStop(1, cols[L] + '05');
          ctx.fillStyle = lg;
          ctx.fill();
        }
      },
    },

    // Synthwave : soleil couchant et grille en perspective
    synthwave: {
      res: 0.5,
      draw() {
        const a = OS.settings.accent;
        const hz = H * 0.58;
        const sky = ctx.createLinearGradient(0, 0, 0, hz);
        sky.addColorStop(0, '#0d0221');
        sky.addColorStop(0.7, '#2a0a4a');
        sky.addColorStop(1, OS.shade(a, -20));
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, hz);
        // Soleil rayé
        const r = Math.min(W, H) * 0.22;
        const cx = W / 2 + (mouse.sx - 0.5) * 40 * scale, cy = hz - r * 0.35;
        const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
        sun.addColorStop(0, '#fde047');
        sun.addColorStop(0.5, '#fb7185');
        sun.addColorStop(1, a);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.283);
        ctx.clip();
        ctx.fillStyle = sun;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = '#2a0a4a';
        for (let i = 0; i < 7; i++) {
          const yy = cy + r * 0.1 + i * r * 0.14;
          ctx.fillRect(cx - r, yy, r * 2, 2 + i * 1.6 * scale);
        }
        ctx.restore();
        ctx.shadowBlur = 0;
        // Sol
        const ground = ctx.createLinearGradient(0, hz, 0, H);
        ground.addColorStop(0, '#1a0533');
        ground.addColorStop(1, '#05010d');
        ctx.fillStyle = ground;
        ctx.fillRect(0, hz, W, H - hz);
        ctx.strokeStyle = a;
        ctx.lineWidth = 1.5 * scale;
        ctx.globalAlpha = 0.8;
        const off = (t * 0.00025) % 1;
        for (let i = 0; i < 18; i++) {
          const p = (i + off) / 18;
          const y = hz + (H - hz) * p * p;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        for (let i = -20; i <= 20; i++) {
          ctx.beginPath();
          ctx.moveTo(W / 2 + i * 8 * scale, hz);
          ctx.lineTo(W / 2 + i * W * 0.12, H);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      },
    },

    // Uni : dégradé statique et sobre
    gradient: {
      res: 0.25,
      draw() {
        const dark = OS.settings.theme === 'dark';
        const a = OS.settings.accent;
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, dark ? OS.shade(a, -110) : OS.shade(a, 150));
        g.addColorStop(1, dark ? '#05050a' : '#ffffff');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      },
    },
  };

  OS.wallpapers = [
    { id: 'aurora', name: 'Aurore' },
    { id: 'nebula', name: 'Nébuleuse' },
    { id: 'waves', name: 'Vagues' },
    { id: 'synthwave', name: 'Synthwave' },
    { id: 'gradient', name: 'Dégradé' },
  ];

  function resize() {
    const m = modes[OS.settings.wallpaper] || modes.aurora;
    scale = m.res * Math.min(devicePixelRatio || 1, 2);
    W = canvas.width = Math.max(1, Math.round(innerWidth * scale));
    H = canvas.height = Math.max(1, Math.round(innerHeight * scale));
  }
  addEventListener('resize', resize);
  OS.on('settings', (e) => e.key === 'wallpaper' && resize());
  resize();

  // Rendu à ~30 i/s pour ménager la batterie
  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < 33) return;
    t += OS.settings.animations ? now - last : 0;
    last = now;
    mouse.sx += (mouse.x - mouse.sx) * 0.05;
    mouse.sy += (mouse.y - mouse.sy) * 0.05;
    (modes[OS.settings.wallpaper] || modes.aurora).draw();
  }
  requestAnimationFrame(frame);

  // Miniature pour les réglages : on redirige temporairement le rendu vers un petit canvas
  OS.wallpaperPreview = function (id, w = 160, h = 100) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const saved = [W, H, scale];
    W = w; H = h; scale = 0.4;
    ctx = c.getContext('2d');
    try { modes[id].draw(); } finally { ctx = mainCtx; [W, H, scale] = saved; }
    return c;
  };
})();

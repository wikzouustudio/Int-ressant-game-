// Tiny synthesized sound kit (no asset files needed).
export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastCoin = 0;
    const unlock = () => {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.35;
          this.master.connect(this.ctx.destination);
        }
      }
      if (this.ctx?.state === 'suspended') this.ctx.resume();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  tone(freq, dur, { type = 'sine', vol = 0.5, slide = 0, delay = 0 } = {}) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  coin() {
    const now = performance.now();
    if (now - this.lastCoin < 90) return;
    this.lastCoin = now;
    const base = 1250 + Math.random() * 200;
    this.tone(base, 0.08, { type: 'square', vol: 0.08 });
    this.tone(base * 1.5, 0.22, { type: 'square', vol: 0.07, delay: 0.06 });
  }
  click() { this.tone(520, 0.06, { type: 'triangle', vol: 0.2, slide: 200 }); }
  buy() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.22, delay: i * 0.07 }));
  }
  build() {
    this.tone(110, 0.35, { type: 'sawtooth', vol: 0.15, slide: -40 });
    [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.2, delay: 0.15 + i * 0.08 }));
  }
  error() { this.tone(180, 0.18, { type: 'square', vol: 0.12, slide: -60 }); }
  golden() {
    [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.3, { type: 'sine', vol: 0.25, delay: i * 0.06 }));
  }
  thud() {
    this.tone(70 + Math.random() * 20, 0.35, { type: 'sine', vol: 0.5, slide: -30 });
    this.tone(160, 0.12, { type: 'square', vol: 0.08, slide: -90 });
  }
  whoosh() { this.tone(300, 0.25, { type: 'sine', vol: 0.15, slide: 600 }); }
}

// Quality tiers + adaptive controller.
// Tiers are applied as a whole (never parameter-by-parameter) and the auto mode
// only moves one step at a time with warm-up, cooldowns and hysteresis so the
// image does not "breathe".

export const TIERS = [
  { id: 'low', name: 'Bas', maxDpr: 1, aa: 0, bloom: false, shadowSize: 1024, shadowSoft: false, shadowEvery: 2,
    shadowRange: 0.85, lodScale: 0.55, crowdLod: 32, farShadows: false, particles: 0.4, vegDist: 230, clouds: false },
  { id: 'medium', name: 'Moyen', maxDpr: 1.25, aa: 2, bloom: false, shadowSize: 2048, shadowSoft: false, shadowEvery: 1,
    shadowRange: 1, lodScale: 0.8, crowdLod: 46, farShadows: false, particles: 0.7, vegDist: 360, clouds: true },
  { id: 'high', name: 'Élevé', maxDpr: 1.75, aa: 4, bloom: true, shadowSize: 2048, shadowSoft: true, shadowEvery: 1,
    shadowRange: 1, lodScale: 1, crowdLod: 60, farShadows: true, particles: 1, vegDist: 560, clouds: true },
  { id: 'ultra', name: 'Ultra', maxDpr: 2, aa: 4, bloom: true, shadowSize: 4096, shadowSoft: true, shadowEvery: 1,
    shadowRange: 1.15, lodScale: 1.4, crowdLod: 90, farShadows: true, particles: 1, vegDist: 900, clouds: true },
];

/** Best guess of what the device can sustain, used as the auto mode's ceiling. */
export function defaultTier() {
  const mobile = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (mobile) return cores <= 4 || mem <= 3 ? 0 : 1;
  return cores >= 8 && (window.devicePixelRatio || 1) <= 1.5 ? 3 : 2;
}

const WINDOW_MS = 2000;
const WARMUP_MS = 5000;

export class QualityManager {
  constructor(apply) {
    this.apply = apply;             // (tier, fpsCap) => void
    this.ceiling = defaultTier();
    this.mode = 'auto';             // 'auto' | tier index
    this.fpsCap = 60;
    this.tier = this.ceiling;
    this.bad = 0;
    this.good = 0;
    this.downgrades = new Array(TIERS.length).fill(0);
    this.since = performance.now();
    this.sum = 0;
    this.n = 0;
    this.windowStart = performance.now();
    this.lastChange = '';
    this.load();
  }

  load() {
    try {
      const s = JSON.parse(localStorage.getItem('empire-quality') || 'null');
      if (s) {
        this.mode = s.mode ?? 'auto';
        this.fpsCap = s.fpsCap === 30 ? 30 : 60;
        if (this.mode !== 'auto') this.tier = Math.min(TIERS.length - 1, Math.max(0, s.mode));
      }
    } catch (e) { /* ignore */ }
  }

  save() {
    try { localStorage.setItem('empire-quality', JSON.stringify({ mode: this.mode, fpsCap: this.fpsCap })); } catch (e) { /* ignore */ }
  }

  get current() { return TIERS[this.tier]; }

  start() { this.apply(this.current, this.fpsCap); this.reset(); }

  reset() {
    this.since = performance.now();
    this.windowStart = this.since;
    this.sum = 0;
    this.n = 0;
    this.bad = 0;
    this.good = 0;
  }

  setMode(mode) {
    this.mode = mode;
    this.tier = mode === 'auto' ? this.ceiling : mode;
    this.downgrades.fill(0);
    this.save();
    this.start();
  }

  setFpsCap(cap) {
    this.fpsCap = cap;
    this.save();
    this.start();
  }

  change(delta, reason) {
    const next = Math.max(0, Math.min(TIERS.length - 1, this.tier + delta));
    if (next === this.tier) return false;
    if (delta < 0) this.downgrades[this.tier]++;
    this.tier = next;
    this.lastChange = reason;
    this.apply(this.current, this.fpsCap);
    this.reset();
    return true;
  }

  /** Feed the real frame interval (ms). Returns a message when the tier changed. */
  sample(frameMs) {
    if (frameMs > 250) return null; // tab switch / hitch: not representative
    const now = performance.now();
    if (now - this.since < WARMUP_MS) return null;
    this.sum += frameMs;
    this.n++;
    if (now - this.windowStart < WINDOW_MS) return null;
    const avg = this.sum / this.n;
    this.sum = 0;
    this.n = 0;
    this.windowStart = now;
    this.lastAvg = avg;
    if (this.mode !== 'auto') return null;

    const budget = 1000 / this.fpsCap;
    if (avg > budget * 1.25) { this.bad++; this.good = 0; } else if (avg < budget * 1.08) { this.good++; this.bad = 0; } else { this.bad = 0; this.good = 0; }

    if (this.bad >= 2) {
      if (this.tier > 0) {
        this.change(-1, `${(1000 / avg).toFixed(0)} FPS mesurés`);
        return `Qualité ajustée : ${this.current.name} (${this.lastChange})`;
      }
      if (this.fpsCap === 60 && this.bad >= 3) {
        this.fpsCap = 30;
        this.apply(this.current, this.fpsCap);
        this.reset();
        return 'Mode 30 FPS stable activé pour cet appareil';
      }
    }
    // Climb back up only toward the device ceiling, slowly, and never onto a tier
    // that already had to be abandoned twice.
    if (this.good >= 15 && this.tier < this.ceiling && this.downgrades[this.tier + 1] < 2) {
      this.change(+1, 'marge de performance');
      return `Qualité ajustée : ${this.current.name}`;
    }
    return null;
  }
}

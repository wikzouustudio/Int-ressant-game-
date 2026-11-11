// Clavier + souris + doubles joysticks tactiles.
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, nx: 0, ny: 0, left: false, right: false, active: false };
    this.events = [];
    this.isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.atk = { id: null, cx: 0, cy: 0, dx: 0, dy: 0, mag: 0 };
    this.sup = { id: null, cx: 0, cy: 0, dx: 0, dy: 0, mag: 0 };
    this.enabled = false;
    this.onTouchMode = null;

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
      if (!this.enabled) return;
      if ((e.code === 'Space' || e.code === 'KeyE') && !e.repeat) { this.events.push({ type: 'super', mouse: true }); e.preventDefault(); }
      if (e.code === 'Escape' || e.code === 'KeyP') this.events.push({ type: 'pause' });
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
  }

  bindCanvas(el) {
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.setMouse(e);
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.setTouchMode(false);
      this.setMouse(e);
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2 && this.mouse.right) {
        this.mouse.right = false;
        if (this.enabled) this.events.push({ type: 'super', mouse: true });
      }
    });
    el.addEventListener('pointerleave', () => { this.mouse.active = false; });
  }

  setMouse(e) {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.ny = -(e.clientY / window.innerHeight) * 2 + 1;
    this.mouse.active = true;
  }

  setTouchMode(on) {
    if (this.isTouch === on) return;
    this.isTouch = on;
    if (this.onTouchMode) this.onTouchMode(on);
  }

  // Zone gauche : joystick de déplacement flottant.
  bindMoveZone(zone, knobBase, knob) {
    zone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.setTouchMode(true);
      if (this.stick.id !== null) return;
      zone.setPointerCapture(e.pointerId);
      this.stick.id = e.pointerId;
      this.stick.ox = e.clientX; this.stick.oy = e.clientY;
      this.stick.dx = this.stick.dy = 0;
      knobBase.style.left = e.clientX + 'px';
      knobBase.style.top = e.clientY + 'px';
      knobBase.classList.add('on');
      knob.style.transform = 'translate(-50%,-50%)';
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      const R = 56;
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = dx / l * R; dy = dy / l * R; }
      this.stick.dx = dx / R; this.stick.dy = dy / R;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    const end = (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.id = null;
      this.stick.dx = this.stick.dy = 0;
      knobBase.classList.remove('on');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  // Boutons d'attaque / super : tap = visée auto, glisser = visée manuelle.
  bindAimButton(btn, knob, slot, type) {
    const S = this[slot];
    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.setTouchMode(true);
      if (S.id !== null) return;
      btn.setPointerCapture(e.pointerId);
      const r = btn.getBoundingClientRect();
      S.id = e.pointerId;
      S.cx = r.left + r.width / 2; S.cy = r.top + r.height / 2;
      S.dx = S.dy = S.mag = 0;
      btn.classList.add('held');
      e.preventDefault();
    });
    btn.addEventListener('pointermove', (e) => {
      if (e.pointerId !== S.id) return;
      const R = 70;
      let dx = e.clientX - S.cx, dy = e.clientY - S.cy;
      const l = Math.hypot(dx, dy);
      S.mag = Math.min(1, l / R);
      if (l > 0.001) { S.dx = dx / l; S.dy = dy / l; }
      const k = Math.min(l, R) / (l || 1);
      knob.style.transform = `translate(calc(-50% + ${dx * k * 0.6}px), calc(-50% + ${dy * k * 0.6}px))`;
    });
    const end = (e, cancel) => {
      if (e.pointerId !== S.id) return;
      S.id = null;
      btn.classList.remove('held');
      knob.style.transform = 'translate(-50%,-50%)';
      if (!cancel && this.enabled) {
        if (S.mag < 0.25) this.events.push({ type, auto: true });
        else this.events.push({ type, dx: S.dx, dy: S.dy, mag: S.mag });
      }
      S.mag = 0;
    };
    btn.addEventListener('pointerup', (e) => end(e, false));
    btn.addEventListener('pointercancel', (e) => end(e, true));
  }

  move() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('KeyQ') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('KeyZ') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    const l = Math.hypot(x, y);
    if (l > 0) return { x: x / l, y: y / l };
    if (this.stick.id !== null) {
      const m = Math.hypot(this.stick.dx, this.stick.dy);
      if (m > 0.15) return { x: this.stick.dx / Math.max(1, m), y: this.stick.dy / Math.max(1, m) };
    }
    return { x: 0, y: 0 };
  }

  consume() {
    const e = this.events;
    this.events = [];
    return e;
  }

  reset() {
    this.events = [];
    this.mouse.left = this.mouse.right = false;
    this.stick.id = this.atk.id = this.sup.id = null;
    this.stick.dx = this.stick.dy = 0;
    this.atk.mag = this.sup.mag = 0;
  }
}

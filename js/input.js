// Touch twin-stick controls (floating move stick, drag-to-aim attack & super buttons) + keyboard/mouse.

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export class Input {
  constructor(layer, dom) {
    this.layer = layer;
    this.dom = dom;
    this.move = { x: 0, z: 0 };
    this.stick = { x: 0, z: 0 };
    this.aim = { active: false, kind: 'attack', dx: 0, dz: 0, mag: 0, world: null, faint: false };
    this.events = [];
    this.keys = new Set();
    this.enabled = false;
    this.toWorld = null;
    this.ptrs = new Map();
    this.mouse = null;
    this.rightDown = false;
    this.touchMode = matchMedia('(pointer: coarse)').matches;
    this.onModeChange = null;
    this.bind();
  }

  setTouchMode(on) {
    if (this.touchMode === on) return;
    this.touchMode = on;
    if (this.onModeChange) this.onModeChange(on);
  }

  reset() {
    this.move.x = this.move.z = 0;
    this.stick.x = this.stick.z = 0;
    this.aim.active = false;
    this.events.length = 0;
    this.ptrs.clear();
    this.rightDown = false;
    this.resetStickVisual();
    this.knob(this.dom.atkKnob, 0, 0);
    this.knob(this.dom.supKnob, 0, 0);
    this.dom.atk.classList.remove('aiming');
    this.dom.sup.classList.remove('aiming');
  }

  consume() {
    if (!this.events.length) return this.events;
    const e = this.events;
    this.events = [];
    return e;
  }

  knob(el, x, y) {
    el.style.transform = `translate(${x}px, ${y}px)`;
  }

  resetStickVisual() {
    const b = this.dom.moveBase;
    b.classList.remove('active');
    b.style.left = '';
    b.style.top = '';
    this.knob(this.dom.moveKnob, 0, 0);
  }

  btnHit(el, x, y, scale = 0.8) {
    const r = el.getBoundingClientRect();
    if (!r.width) return false;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return Math.hypot(x - cx, y - cy) < r.width * scale;
  }

  bind() {
    const L = this.layer;
    L.addEventListener('contextmenu', (e) => e.preventDefault());
    L.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.moveEv(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e, true));
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (MOVE_KEYS[e.code]) {
        this.keys.add(e.code);
        e.preventDefault();
        this.setTouchMode(false);
      } else if ((e.code === 'Space' || e.code === 'KeyE') && !e.repeat) {
        e.preventDefault();
        this.events.push(this.mouse && this.toWorld ? { type: 'super', world: this.toWorld(this.mouse.x, this.mouse.y) } : { type: 'super', auto: true });
      } else if ((e.code === 'KeyF' || e.code === 'Enter') && !e.repeat) {
        this.events.push({ type: 'attack', auto: true });
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(e) {
    if (!this.enabled) return;
    const x = e.clientX, y = e.clientY;
    const onSup = this.btnHit(this.dom.sup, x, y, 0.75);
    const onAtk = !onSup && this.btnHit(this.dom.atk, x, y, 0.8);
    if (e.pointerType === 'mouse' && !onSup && !onAtk) {
      this.setTouchMode(false);
      this.mouse = { x, y };
      if (e.button === 0 && this.toWorld) this.events.push({ type: 'attack', world: this.toWorld(x, y) });
      if (e.button === 2) this.rightDown = true;
      return;
    }
    if (e.pointerType === 'touch') this.setTouchMode(true);
    e.preventDefault();
    let role = null;
    if (onSup) role = 'super';
    else if (onAtk) role = 'attack';
    else if (x < window.innerWidth * 0.55) role = 'move';
    if (!role) return;
    for (const p of this.ptrs.values()) if (p.role === role) return;
    try { this.layer.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (role === 'move') {
      const b = this.dom.moveBase;
      b.classList.add('active');
      b.style.left = x + 'px';
      b.style.top = y + 'px';
      this.ptrs.set(e.pointerId, { role, ox: x, oy: y });
    } else {
      const el = role === 'super' ? this.dom.sup : this.dom.atk;
      const r = el.getBoundingClientRect();
      this.ptrs.set(e.pointerId, { role, ox: r.left + r.width / 2, oy: r.top + r.height / 2, aiming: false, R: r.width * 0.75 });
      el.classList.add('pressed');
    }
  }

  moveEv(e) {
    if (e.pointerType === 'mouse') this.mouse = { x: e.clientX, y: e.clientY };
    const p = this.ptrs.get(e.pointerId);
    if (!p || !this.enabled) return;
    e.preventDefault();
    const x = e.clientX, y = e.clientY;
    if (p.role === 'move') {
      const R = this.dom.moveBase.offsetWidth * 0.42 || 50;
      let dx = x - p.ox, dy = y - p.oy;
      let len = Math.hypot(dx, dy);
      if (len > R * 1.35) {
        // let the floating stick follow the finger
        const k = (len - R * 1.35) / len;
        p.ox += dx * k;
        p.oy += dy * k;
        this.dom.moveBase.style.left = p.ox + 'px';
        this.dom.moveBase.style.top = p.oy + 'px';
        dx = x - p.ox;
        dy = y - p.oy;
        len = Math.hypot(dx, dy);
      }
      const cl = Math.min(len, R);
      const nx = len ? dx / len : 0, ny = len ? dy / len : 0;
      this.knob(this.dom.moveKnob, nx * cl, ny * cl);
      const mag = len < 8 ? 0 : Math.min(1, len / R);
      this.stick.x = nx * mag;
      this.stick.z = ny * mag;
    } else {
      const dx = x - p.ox, dy = y - p.oy;
      const len = Math.hypot(dx, dy);
      const el = p.role === 'super' ? this.dom.sup : this.dom.atk;
      const knob = p.role === 'super' ? this.dom.supKnob : this.dom.atkKnob;
      const cl = Math.min(len, p.R * 0.6);
      const nx = len ? dx / len : 0, ny = len ? dy / len : 0;
      this.knob(knob, nx * cl, ny * cl);
      if (len > 16) {
        p.aiming = true;
        el.classList.add('aiming');
      }
      p.len = len;
      if (p.aiming) {
        this.aim.active = len > 16;
        this.aim.kind = p.role;
        this.aim.dx = nx;
        this.aim.dz = ny;
        this.aim.mag = Math.min(1, len / p.R);
        this.aim.world = null;
        this.aim.faint = false;
      }
    }
  }

  up(e, cancel = false) {
    if (e.pointerType === 'mouse' && e.button === 2 && this.rightDown) {
      this.rightDown = false;
      if (this.enabled && this.toWorld && this.mouse) this.events.push({ type: 'super', world: this.toWorld(this.mouse.x, this.mouse.y) });
    }
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    if (p.role === 'move') {
      this.stick.x = this.stick.z = 0;
      this.resetStickVisual();
      return;
    }
    const el = p.role === 'super' ? this.dom.sup : this.dom.atk;
    const knob = p.role === 'super' ? this.dom.supKnob : this.dom.atkKnob;
    el.classList.remove('pressed', 'aiming');
    this.knob(knob, 0, 0);
    if (!cancel && this.enabled) {
      if (!p.aiming) this.events.push({ type: p.role, auto: true });
      else if ((p.len || 0) > 16) this.events.push({ type: p.role, dx: this.aim.dx, dz: this.aim.dz, mag: this.aim.mag });
    }
    if (this.aim.kind === p.role) this.aim.active = false;
  }

  update() {
    let kx = 0, kz = 0;
    for (const k of this.keys) {
      const v = MOVE_KEYS[k];
      if (v) { kx += v[0]; kz += v[1]; }
    }
    if (kx || kz) {
      const l = Math.hypot(kx, kz);
      this.move.x = kx / l;
      this.move.z = kz / l;
    } else {
      this.move.x = this.stick.x;
      this.move.z = this.stick.z;
    }
    // desktop: always-on faint aim preview following the mouse
    let touchAiming = false;
    for (const p of this.ptrs.values()) if (p.role !== 'move' && p.aiming) touchAiming = true;
    if (!touchAiming && !this.touchMode && this.mouse && this.toWorld && this.enabled) {
      this.aim.active = true;
      this.aim.kind = this.rightDown ? 'super' : 'attack';
      this.aim.world = this.toWorld(this.mouse.x, this.mouse.y);
      this.aim.faint = !this.rightDown;
    } else if (!touchAiming) {
      this.aim.active = false;
    }
  }
}

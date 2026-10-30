import * as THREE from 'three';

// City-builder camera: drag grabs the ground (1:1 pan with inertia), two fingers pinch
// to zoom and twist to rotate, right/middle mouse rotates and tilts, the wheel zooms
// toward the cursor. Taps are only reported when the pointer did not move, was not
// part of a multi-touch gesture and was released quickly.

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export class CityCamera {
  constructor(camera, dom, bounds) {
    this.camera = camera;
    this.dom = dom;
    this.bounds = bounds; // half-size of the area the focus point may visit
    this.target = new THREE.Vector3(0, 0, 6);
    this.goal = { target: this.target.clone(), yaw: 0.55, pitch: 0.92, distance: 120 };
    this.yaw = this.goal.yaw;
    this.pitch = this.goal.pitch; // elevation angle (rad)
    this.distance = this.goal.distance;
    this.minDistance = 18;
    this.maxDistance = 330;
    this.velocity = new THREE.Vector3();
    this.pointers = new Map();
    this.gesture = null;
    this.onTap = null;
    this.hover = new THREE.Vector2(9, 9); // NDC of the mouse for hover picking
    this.pointerType = 'mouse';
    this.keys = new Set();
    this.shakeAmp = 0;
    this.bind();
    this.apply();
  }

  // ---------------------------------------------------------------- helpers
  ndc(x, y) {
    const r = this.dom.getBoundingClientRect();
    return _ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  groundAt(x, y, out) {
    _ray.setFromCamera(this.ndc(x, y), this.camera);
    return _ray.ray.intersectPlane(GROUND, out);
  }

  apply() {
    const c = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * c * this.distance,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * c * this.distance,
    );
    this.camera.lookAt(this.target);
    if (this.shakeAmp > 0.002) {
      const k = this.shakeAmp * (0.4 + this.distance / 120);
      this.camera.position.x += (Math.random() - 0.5) * k;
      this.camera.position.y += (Math.random() - 0.5) * k;
      this.camera.position.z += (Math.random() - 0.5) * k;
    }
    this.camera.updateMatrixWorld();
  }

  /** Small camera shake (impacts). */
  shake(amount) { this.shakeAmp = Math.max(this.shakeAmp, amount); }

  clampGoal() {
    const g = this.goal;
    g.target.x = THREE.MathUtils.clamp(g.target.x, -this.bounds, this.bounds);
    g.target.z = THREE.MathUtils.clamp(g.target.z, -this.bounds, this.bounds);
    g.distance = THREE.MathUtils.clamp(g.distance, this.minDistance, this.maxDistance);
    g.pitch = THREE.MathUtils.clamp(g.pitch, 0.42, 1.35);
  }

  /** Pan the goal so the ground point under (x0,y0) ends under (x1,y1). */
  dragPan(x0, y0, x1, y1) {
    if (!this.groundAt(x0, y0, _a) || !this.groundAt(x1, y1, _b)) return;
    _a.sub(_b);
    _a.y = 0;
    this.goal.target.add(_a);
    this.target.add(_a);
    return _a;
  }

  zoomAt(factor, x, y) {
    const g = this.goal;
    const before = g.distance;
    g.distance = THREE.MathUtils.clamp(g.distance * factor, this.minDistance, this.maxDistance);
    const k = 1 - g.distance / before;
    if (x !== undefined && this.groundAt(x, y, _a)) {
      _a.sub(g.target).multiplyScalar(k);
      _a.y = 0;
      g.target.add(_a);
    }
  }

  /** Glide the focus point to `point` (keeps orientation; never zooms out). */
  focus(point, maxDistance) {
    this.goal.target.set(point.x, 0, point.z);
    if (maxDistance && this.goal.distance > maxDistance) this.goal.distance = maxDistance;
    this.velocity.set(0, 0, 0);
  }

  // ---------------------------------------------------------------- input
  bind() {
    const el = this.dom;
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.(e.pointerId);
      this.pointerType = e.pointerType;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
      this.velocity.set(0, 0, 0);
      if (this.pointers.size === 1) {
        this.gesture = {
          mode: e.button === 2 || e.button === 1 || e.ctrlKey || e.shiftKey ? 'rotate' : 'pan',
          sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, multi: false, lastT: performance.now(),
        };
        // an editor tool may capture one-finger / left-button drags (painting, moving objects)
        if (this.gesture.mode === 'pan' && this.dragTool && this.dragTool(this.ndc(e.clientX, e.clientY).clone(), 'start')) this.gesture.mode = 'tool';
      } else {
        if (this.gesture?.mode === 'tool') this.dragTool?.(null, 'cancel');
        this.gesture.multi = true;
        this.gesture.mode = 'pinch';
        this.gesture.pinch = this.pinchState();
      }
    });
    el.addEventListener('pointermove', (e) => {
      this.pointerType = e.pointerType;
      const r = this.dom.getBoundingClientRect();
      this.hover.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const p = this.pointers.get(e.pointerId);
      if (!p || !this.gesture) return;
      const g = this.gesture;
      const px = p.x, py = p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > (e.pointerType === 'mouse' ? 5 : 10)) g.moved = true;
      if (g.mode === 'tool') { if (g.moved) this.dragTool?.(this.ndc(e.clientX, e.clientY).clone(), 'move'); return; }
      if (!g.moved && !g.multi) return;
      const now = performance.now();
      if (g.mode === 'pan' && this.pointers.size === 1) {
        const d = this.dragPan(px, py, e.clientX, e.clientY);
        const dt = Math.max(16, now - g.lastT) / 1000;
        if (d) {
          this.velocity.multiplyScalar(0.5).addScaledVector(d, 0.5 / dt);
          const max = 40 + this.distance * 0.8;
          if (this.velocity.length() > max) this.velocity.setLength(max);
        }
        g.lastT = now;
      } else if (g.mode === 'rotate') {
        this.goal.yaw -= (e.clientX - px) * 0.006;
        this.goal.pitch += (e.clientY - py) * 0.004;
        this.clampGoal();
      } else if (g.mode === 'pinch' && this.pointers.size >= 2) {
        const s = this.pinchState();
        const prev = g.pinch;
        this.zoomAt(prev.dist / Math.max(20, s.dist), s.cx, s.cy);
        this.goal.yaw -= s.angle - prev.angle;
        this.dragPan(prev.cx, prev.cy, s.cx, s.cy);
        g.pinch = s;
      }
    });
    const end = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      const g = this.gesture;
      if (!g) return;
      if (this.pointers.size === 0) {
        if (g.mode === 'tool') {
          this.dragTool?.(this.ndc(e.clientX, e.clientY).clone(), g.moved ? 'end' : 'tap');
          this.gesture = null;
          return;
        }
        const quick = performance.now() - g.t < 450;
        if (!g.moved && !g.multi && quick && (p.button === 0 || e.pointerType !== 'mouse') && e.type === 'pointerup') {
          this.onTap?.(this.ndc(e.clientX, e.clientY).clone(), e.pointerType);
        }
        if (g.mode !== 'pan' || performance.now() - g.lastT > 80) this.velocity.set(0, 0, 0);
        this.gesture = null;
      } else if (g.mode === 'pinch') {
        g.pinch = this.pinchState();
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.hover.set(9, 9); });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomAt(Math.exp(e.deltaY * 0.0012), e.clientX, e.clientY);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); this.gesture = null; });
  }

  pinchState() {
    const [a, b] = [...this.pointers.values()];
    return {
      cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const g = this.goal;
    // keyboard
    const k = this.keys;
    let fx = 0, fz = 0;
    if (k.has('w') || k.has('z') || k.has('arrowup')) fz -= 1;
    if (k.has('s') || k.has('arrowdown')) fz += 1;
    if (k.has('d') || k.has('arrowright')) fx += 1;
    if (k.has('a') || k.has('q') || k.has('arrowleft')) fx -= 1;
    if (fx || fz) {
      const sp = dt * (25 + g.distance * 0.8);
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      g.target.x += (fx * c + fz * s) * sp;
      g.target.z += (-fx * s + fz * c) * sp;
    }
    if (k.has('+') || k.has('=')) this.zoomAt(Math.exp(-dt * 1.5));
    if (k.has('-')) this.zoomAt(Math.exp(dt * 1.5));
    // inertia after a flick
    if (!this.gesture && this.velocity.lengthSq() > 0.01) {
      g.target.addScaledVector(this.velocity, dt);
      this.velocity.multiplyScalar(Math.exp(-dt * 6));
    }
    this.clampGoal();
    // frame-rate independent smoothing toward the goal
    const a = 1 - Math.exp(-dt * 10);
    this.target.lerp(g.target, a);
    this.distance += (g.distance - this.distance) * a;
    this.pitch += (g.pitch - this.pitch) * a;
    let dy = g.yaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * a;
    this.shakeAmp *= Math.exp(-dt * 9);
    this.apply();
  }
}

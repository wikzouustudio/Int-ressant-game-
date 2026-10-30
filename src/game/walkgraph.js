import { buildGraph, ROADS_NET, PATHS } from '../world/citymap.js';

// Walking network for every pedestrian (employees, passers-by): the sidewalks of all
// drawn streets plus the footpaths. Works with any map made in the editor; when two
// points are not connected the walker simply goes straight across.

const lines = [
  ...ROADS_NET.filter((r) => r.type !== 'hwy').map((r) => ({ pts: r.pts, closed: r.closed, off: r.t.c + r.t.sw / 2 })),
  ...PATHS.map((p) => ({ pts: p.pts, closed: p.closed, off: 0 })),
];
export const WALK = buildGraph(lines, 3, 2.5);
for (const e of WALK.edges) {
  const cum = [0];
  for (let i = 1; i < e.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1]));
  e.cum = cum;
  e.off = e.line.off;
}

/** Point on an edge at arc length s from `a`, shifted sideways by `lat` (left of a→b is negative). */
function pointOn(e, s, lat) {
  const cum = e.cum;
  s = Math.max(0, Math.min(e.len, s));
  let k = 1;
  while (k < cum.length - 1 && cum[k] < s) k++;
  const a = e.pts[k - 1], b = e.pts[k];
  const l = cum[k] - cum[k - 1] || 1;
  const t = (s - cum[k - 1]) / l;
  const tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
  return { x: a[0] + (b[0] - a[0]) * t - tz * lat, z: a[1] + (b[1] - a[1]) * t + tx * lat };
}

/** Closest point of the network: edge, arc length and on which side the query point is. */
export function nearest(x, z) {
  let best = null, bd = Infinity;
  for (const e of WALK.edges) {
    for (let i = 0; i < e.pts.length - 1; i++) {
      const a = e.pts[i], b = e.pts[i + 1];
      const vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / l2));
      const px = a[0] + vx * t, pz = a[1] + vz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < bd) {
        bd = d;
        const side = (vx * (z - a[1]) - vz * (x - a[0])) >= 0 ? 1 : -1; // + = right of a→b
        best = { e, s: e.cum[i] + Math.sqrt(l2) * t, side, d };
      }
    }
  }
  return best;
}

/** Points along edge e from arc length s0 to s1 at lateral offset lat. */
function slice(e, s0, s1, lat, out) {
  const dir = s1 >= s0 ? 1 : -1;
  out.push(pointOn(e, s0, lat));
  const inner = [];
  for (let k = 1; k < e.cum.length - 1; k++) if ((e.cum[k] - s0) * dir > 0.3 && (s1 - e.cum[k]) * dir > 0.3) inner.push(e.cum[k]);
  if (dir < 0) inner.reverse();
  for (const s of inner) out.push(pointOn(e, s, lat));
  out.push(pointOn(e, s1, lat));
}

function dijkstra(sources) {
  const n = WALK.nodes.length;
  const dist = new Float64Array(n).fill(Infinity), prev = new Array(n).fill(null), done = new Uint8Array(n);
  for (const [node, d] of sources) if (d < dist[node.id]) dist[node.id] = d;
  for (;;) {
    let u = -1, ud = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < ud) { ud = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = 1;
    for (const e of WALK.nodes[u].edges) {
      const v = e.a.id === u ? e.b : e.a;
      const nd = ud + e.len;
      if (nd < dist[v.id]) { dist[v.id] = nd; prev[v.id] = { e, from: u }; }
    }
  }
  return { dist, prev };
}

/** Walking route between two points (list of {x, z}); `jit` widens the sidewalk lane randomly. */
export function route(from, to, jit = 0.35) {
  const A = nearest(from.x, from.z), B = nearest(to.x, to.z);
  if (!A || !B || A.d > 60 || B.d > 60) return [{ ...to }];
  const j = () => (Math.random() - 0.5) * 2 * jit;
  const out = [];
  const latA = A.e.off ? A.side * (A.e.off + j()) : j(), latB = B.e.off ? B.side * (B.e.off + j()) : j();
  if (A.e === B.e) {
    slice(A.e, A.s, B.s, latA, out);
    out.push({ ...to });
    return out;
  }
  const { dist, prev } = dijkstra([[A.e.a, A.s], [A.e.b, A.e.len - A.s]]);
  const viaA = dist[B.e.a.id] + B.s, viaB = dist[B.e.b.id] + (B.e.len - B.s);
  if (!isFinite(Math.min(viaA, viaB))) return [{ ...to }];
  const endNode = viaA <= viaB ? B.e.a : B.e.b;
  // nodes back to the start edge
  const chain = [];
  let id = endNode.id;
  while (prev[id] && !(prev[id] === null)) { chain.push(prev[id]); id = prev[id].from; }
  chain.reverse();
  const startNode = WALK.nodes[id];
  // leave the start edge towards startNode
  slice(A.e, A.s, startNode === A.e.a ? 0 : A.e.len, latA, out);
  for (const step of chain) {
    const e = step.e, fwd = e.a.id === step.from;
    const lat = e.off ? (fwd ? 1 : -1) * (e.off + j()) : j(); // keep to the right
    slice(e, fwd ? 0 : e.len, fwd ? e.len : 0, lat, out);
  }
  slice(B.e, endNode === B.e.a ? 0 : B.e.len, B.s, latB, out);
  out.push({ ...to });
  return out;
}

export const pathLength = (from, pts) => {
  let l = 0, p = from;
  for (const q of pts) { l += Math.hypot(q.x - p.x, q.z - p.z); p = q; }
  return l;
};

/** Random point on a sidewalk (or a footpath). */
export function randomSidewalkPoint(near, maxDist = Infinity) {
  for (let k = 0; k < 30; k++) {
    const e = WALK.edges[(Math.random() * WALK.edges.length) | 0];
    if (!e) break;
    const p = pointOn(e, Math.random() * e.len, e.off ? (Math.random() < 0.5 ? -1 : 1) * e.off : 0);
    if (!near || Math.hypot(p.x - near.x, p.z - near.z) <= maxDist) return p;
  }
  return null;
}

/** A network node at a walking-commute distance from a point (where an employee "lives"). */
export function homeNode(x, z, seed) {
  const cands = WALK.nodes.filter((n) => { const d = Math.hypot(n.x - x, n.z - z); return d > 45 && d < 140; });
  if (!cands.length) return { x: x + 60 * Math.cos(seed), z: z + 60 * Math.sin(seed) };
  const n = cands[Math.abs(seed | 0) % cands.length];
  return { x: n.x, z: n.z };
}

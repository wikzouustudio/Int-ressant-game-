// Hand-made vector icon set (24×24 grid). Each icon is a list of parts
// { d, f: fill, s: stroke, w: strokeWidth, o: opacity, t: rotation°, rule }.
// The same data renders as inline SVG (HTML UI) and on canvas (3D signs).

const GOLD = '#F6C544', GOLD_D = '#D08A12', RED = '#E5484D', RED_D = '#A8242B';
const WHITE = '#FFFFFF', INK = '#1E2433', SKIN = '#F4C7A1', BLUE = '#4C8DF6', BLUE_D = '#2C5BC0';
const GREEN = '#33C27F', GREEN_D = '#1E8F5A', PURPLE = '#8B5CF6', PURPLE_D = '#5B32C9';
const GRAY = '#B4BDCC', GRAY_D = '#5B6475', ORANGE = '#FF8A3D', ORANGE_D = '#D2601B';
const CYAN = '#3CD3E6', BROWN = '#E3A04A', BROWN_D = '#A9631F', YELLOW = '#FFD84D', SAND = '#C8A165';

const C = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const E = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const R = (x, y, w, h, r = 0) => (r
  ? `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`
  : `M${x} ${y}h${w}v${h}h${-w}Z`);
const P = (...pts) => 'M' + pts.map((p) => p.join(' ')).join('L') + 'Z';
// plus / cross shape centred on (cx,cy): arm half-length a, half-thickness b
const X = (cx, cy, a, b) => `M${cx - b} ${cy - a}h${2 * b}v${a - b}h${a - b}v${2 * b}h${-(a - b)}v${a - b}h${-2 * b}v${-(a - b)}h${-(a - b)}v${-2 * b}h${a - b}Z`;

function star(cx, cy, ro, ri, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? ri : ro;
    pts.push([+(cx + Math.cos(a) * r).toFixed(2), +(cy + Math.sin(a) * r).toFixed(2)]);
  }
  return P(...pts);
}
function gear(cx, cy, ro, ri, hole) {
  const pts = [];
  for (let j = 0; j < 32; j++) {
    const a = (j / 32) * Math.PI * 2 + Math.PI / 32;
    const r = j % 4 < 2 ? ro : ri;
    pts.push([+(cx + Math.cos(a) * r).toFixed(2), +(cy + Math.sin(a) * r).toFixed(2)]);
  }
  return P(...pts) + C(cx, cy, hole);
}

const person = (x = 0, col = BLUE) => [
  { d: C(12 + x, 7.5, 4), f: SKIN },
  { d: `M${4 + x} 21v-1.5a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6V21Z`, f: col },
];

export const ICONS = {
  coin: [
    { d: C(12, 12.6, 9.6), f: GOLD_D },
    { d: C(12, 11.6, 9.6), f: GOLD },
    { d: C(12, 11.6, 6.8), s: GOLD_D, w: 1.3 },
    { d: X(12, 11.6, 4.2, 1.45), f: GOLD_D },
  ],
  coins: [
    { d: E(9, 17.5, 7, 3), f: GOLD_D }, { d: E(9, 16, 7, 3), f: GOLD },
    { d: E(9, 13, 7, 3), f: GOLD_D }, { d: E(9, 11.5, 7, 3), f: GOLD },
    { d: C(16.5, 9.5, 5.5), f: GOLD_D }, { d: C(16.5, 8.8, 5.5), f: GOLD },
    { d: X(16.5, 8.8, 2.6, 0.9), f: GOLD_D },
  ],
  bag: [
    { d: P([8.5, 7], [15.5, 7], [17, 2.5], [7, 2.5]), f: SAND },
    { d: 'M8 8h8c3 3 5.5 6 5.5 9.2A3.8 3.8 0 0 1 17.7 21H6.3a3.8 3.8 0 0 1-3.8-3.8C2.5 14 5 11 8 8Z', f: SAND },
    { d: R(7.5, 6.2, 9, 2.2, 1.1), f: BROWN_D },
    { d: X(12, 15, 3.3, 1.1), f: WHITE, o: 0.9 },
  ],
  swiss: [
    { d: R(2, 2, 20, 20, 4), f: RED },
    { d: X(12, 12, 6.6, 2.2), f: WHITE },
  ],
  shield: [
    { d: 'M12 2l8.5 3v6.2c0 5.4-3.6 9.4-8.5 10.8-4.9-1.4-8.5-5.4-8.5-10.8V5Z', f: RED },
    { d: X(12, 11.5, 5, 1.7), f: WHITE },
  ],
  worker: [
    ...person(0, BLUE),
    { d: 'M7.6 6.6a4.4 4.4 0 0 1 8.8 0Z', f: GOLD },
    { d: R(6.6, 5.8, 10.8, 1.6, 0.8), f: GOLD_D },
  ],
  team: [
    { d: C(7.5, 8, 3.2), f: SKIN }, { d: 'M1.5 19.5v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1Z', f: GREEN },
    { d: C(15.5, 7, 3.6), f: SKIN }, { d: 'M9 21v-1.5a5.5 5.5 0 0 1 5.5-5.5h2a5.5 5.5 0 0 1 5.5 5.5V21Z', f: BLUE },
  ],
  userPlus: [...person(-2, BLUE), { d: X(19.5, 8, 3.5, 1.2), f: GREEN }],
  userMinus: [...person(-2, BLUE), { d: R(16, 6.8, 7, 2.4, 1.2), f: RED }],
  building: [
    { d: R(4.5, 3, 15, 19, 1.8), f: BLUE },
    ...[0, 1, 2].flatMap((c) => [0, 1, 2, 3].map((r) => ({ d: R(7 + c * 3.8, 5.5 + r * 3.2, 2.2, 2, 0.4), f: WHITE, o: 0.9 }))),
    { d: R(10, 17.5, 4, 4.5, 0.8), f: BLUE_D },
  ],
  bank: [
    { d: P([12, 1.8], [22, 7.5], [2, 7.5]), f: GOLD },
    { d: X(12, 5.4, 1.5, 0.55), f: RED },
    { d: R(3, 8, 18, 2, 0.5), f: GOLD_D },
    ...[4.3, 8.4, 13.1, 17.2].map((x) => ({ d: R(x, 10.7, 2.5, 7.6, 0.6), f: WHITE })),
    { d: R(2.5, 18.8, 19, 3, 1), f: GOLD_D },
  ],
  home: [
    { d: P([12, 2.8], [22, 11.5], [19.5, 11.5], [19.5, 21], [4.5, 21], [4.5, 11.5], [2, 11.5]), f: BLUE },
    { d: R(10, 14, 4, 7, 1), f: WHITE },
  ],
  clock: [
    { d: C(12, 12, 10), f: BLUE },
    { d: C(12, 12, 8), f: WHITE },
    { d: 'M12 7v5l3.4 2.2', s: INK, w: 2 },
  ],
  sun: [
    { d: C(12, 12, 5), f: YELLOW },
    { d: 'M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7', s: YELLOW, w: 2 },
  ],
  moon: [{ d: 'M12.5 3a6.5 6.5 0 0 0 8.6 8.6A9 9 0 1 1 12.5 3Z', f: '#C9D4FF' }, { d: C(17.5, 5, 1), f: WHITE }],
  calendar: [
    { d: R(3, 5, 18, 16, 3), f: WHITE },
    { d: R(3, 5, 18, 6, 3), f: RED }, { d: R(3, 8, 18, 3), f: RED },
    { d: R(7, 2.5, 2, 5, 1), f: GRAY_D }, { d: R(15, 2.5, 2, 5, 1), f: GRAY_D },
    ...[6, 10.5, 15].map((x) => ({ d: R(x, 13, 3, 2.6, 0.6), f: GRAY })),
    { d: R(6, 17, 3, 2.4, 0.6), f: GRAY }, { d: R(10.5, 17, 3, 2.4, 0.6), f: BLUE },
  ],
  bulb: [
    { d: C(12, 9.5, 7), f: YELLOW },
    { d: R(8.8, 13, 6.4, 4.5, 1), f: YELLOW },
    { d: 'M10 10.5l2 2.2 2-2.2', s: GOLD_D, w: 1.4 },
    { d: E(9.4, 7.4, 1.5, 2.2), f: WHITE, o: 0.6 },
    { d: R(9, 17.2, 6, 2, 1), f: GRAY_D }, { d: R(9.8, 19.6, 4.4, 2, 1), f: GRAY_D },
  ],
  stats: [
    { d: R(3, 13, 4.4, 8, 1.3), f: BLUE },
    { d: R(9.8, 8, 4.4, 13, 1.3), f: GREEN },
    { d: R(16.6, 3.5, 4.4, 17.5, 1.3), f: GOLD },
  ],
  sound: [
    { d: P([3, 9], [7, 9], [12, 4.5], [12, 19.5], [7, 15], [3, 15]), f: WHITE },
    { d: 'M15.5 8.6a4.8 4.8 0 0 1 0 6.8M18.4 5.6a9 9 0 0 1 0 12.8', s: WHITE, w: 2 },
  ],
  mute: [
    { d: P([3, 9], [7, 9], [12, 4.5], [12, 19.5], [7, 15], [3, 15]), f: WHITE },
    { d: 'M15.5 9.2l5.6 5.6M21.1 9.2l-5.6 5.6', s: RED, w: 2.2 },
  ],
  gear: [{ d: gear(12, 12, 10.2, 7.6, 3.2), f: GRAY, rule: 'evenodd' }],
  close: [{ d: 'M6.5 6.5l11 11M17.5 6.5l-11 11', s: WHITE, w: 2.6 }],
  lock: [
    { d: 'M8 11V8a4 4 0 0 1 8 0v3', s: GRAY, w: 2.4 },
    { d: R(5, 10.5, 14, 11, 2.6), f: GOLD },
    { d: C(12, 15, 1.6), f: GOLD_D }, { d: R(11.3, 15, 1.4, 3.4, 0.7), f: GOLD_D },
  ],
  up: [
    { d: C(12, 12, 10), f: GREEN },
    { d: 'M7.5 12.8L12 8.3l4.5 4.5M12 8.6V17', s: WHITE, w: 2.6 },
  ],
  check: [{ d: C(12, 12, 10), f: GREEN }, { d: 'M7 12.5l3.2 3.2L17 9', s: WHITE, w: 2.4 }],
  info: [{ d: C(12, 12, 10), f: BLUE }, { d: R(11, 10.5, 2, 7, 1), f: WHITE }, { d: C(12, 7.3, 1.3), f: WHITE }],
  star: [{ d: star(12, 12.5, 10, 4.3), f: GOLD }],
  briefcase: [
    { d: 'M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7', s: GOLD_D, w: 2 },
    { d: R(2.5, 7, 19, 13.5, 2.6), f: GOLD },
    { d: R(2.5, 12, 19, 2, 0), f: GOLD_D },
    { d: R(10.4, 10.8, 3.2, 4.4, 0.8), f: WHITE },
  ],
  bolt: [{ d: P([13.5, 1.8], [4, 13.6], [11, 13.6], [9.8, 22.2], [20, 9.8], [13, 9.8]), f: YELLOW }],
  fire: [
    { d: 'M12 2c1 4 6.5 6.2 6.5 12a6.5 6.5 0 0 1-13 0c0-3 2-5.2 3.2-6.4 0 2.2 1 3.4 2.3 3.4 0-3.2-1-6 1-9Z', f: ORANGE },
    { d: 'M12 12.2c1 2 3.2 3 3.2 5.2a3.2 3.2 0 0 1-6.4 0c0-2.2 2.2-3 3.2-5.2Z', f: YELLOW },
  ],
  target: [
    { d: C(12, 12, 10), f: RED },
    { d: C(12, 12, 6.6), f: WHITE },
    { d: C(12, 12, 3.4), f: RED },
    { d: 'M12 12L20.5 3.5', s: INK, w: 1.8 },
    { d: P([18, 2.5], [21.5, 2.5], [21.5, 6]), f: GOLD },
  ],
  bourse: [
    { d: R(2, 3, 20, 18, 3.5), f: INK },
    { d: R(5.2, 12, 2.4, 5.5, 0.6), f: RED },
    { d: R(9.4, 9, 2.4, 7, 0.6), f: GREEN },
    { d: R(13.6, 10.5, 2.4, 4.5, 0.6), f: RED },
    { d: R(17.8, 6, 2.4, 8, 0.6), f: GREEN },
    { d: 'M5.5 9.5L10 6.5L14.5 8.5L19.5 4.8', s: YELLOW, w: 1.6 },
  ],
  trophy: [
    { d: 'M7 5H4.5A2.5 2.5 0 0 0 7 9.5M17 5h2.5A2.5 2.5 0 0 1 17 9.5', s: GOLD_D, w: 1.8 },
    { d: 'M7 3h10v5.5a5 5 0 0 1-10 0Z', f: GOLD },
    { d: R(11, 13, 2, 4), f: GOLD_D },
    { d: R(7.5, 16.8, 9, 4.4, 1.3), f: GOLD_D },
  ],
  warning: [
    { d: 'M10.3 3.4a2 2 0 0 1 3.4 0l8.3 14.4a2 2 0 0 1-1.7 3H3.7a2 2 0 0 1-1.7-3Z', f: ORANGE },
    { d: R(11, 8, 2, 7, 1), f: INK }, { d: C(12, 17.6, 1.2), f: INK },
  ],
  receipt: [
    { d: 'M5 2h14v20l-2.3-1.5-2.4 1.5-2.3-1.5-2.3 1.5-2.4-1.5L5 22Z', f: WHITE },
    { d: R(8, 5.5, 8, 1.6, 0.8), f: GRAY_D }, { d: R(8, 9, 8, 1.6, 0.8), f: GRAY },
    { d: R(8, 12.5, 5, 1.6, 0.8), f: GRAY }, { d: R(8, 16, 8, 2.2, 1.1), f: GREEN },
  ],
  percent: [
    { d: C(7, 7, 3), f: PURPLE }, { d: C(17, 17, 3), f: PURPLE },
    { d: 'M19 5L5 19', s: PURPLE_D, w: 2.4 },
  ],
  scale: [
    { d: 'M12 3v17M6 6h12M8 21h8', s: GOLD_D, w: 2 },
    { d: 'M6 6l-3.5 7h7Z', f: GOLD, o: 0.9 }, { d: 'M18 6l-3.5 7h7Z', f: GOLD, o: 0.9 },
    { d: 'M2.5 13a3.5 2 0 0 0 7 0Z', f: GOLD_D }, { d: 'M14.5 13a3.5 2 0 0 0 7 0Z', f: GOLD_D },
    { d: C(12, 3.5, 1.6), f: GOLD },
  ],
  contract: [
    { d: R(4, 2, 13, 19, 2), f: WHITE },
    { d: R(6.5, 5.5, 8, 1.6, 0.8), f: GRAY_D }, { d: R(6.5, 9, 8, 1.6, 0.8), f: GRAY }, { d: R(6.5, 12.5, 5, 1.6, 0.8), f: GRAY },
    { d: 'M7 17.5c1-1 2-1 2.6 0s1.6 1 2.6 0', s: BLUE, w: 1.3 },
    { d: P([20.5, 6], [22, 7.5], [15, 14.5], [13, 15], [13.5, 13]), f: ORANGE },
  ],
  crane: [
    { d: R(6, 4, 2.6, 16.5), f: ORANGE },
    { d: R(2.5, 3.6, 19, 2.4, 0.6), f: ORANGE },
    { d: R(2.5, 6, 3, 2.6, 0.4), f: GRAY_D },
    { d: 'M18 6v6', s: GRAY_D, w: 1.2 },
    { d: R(15.5, 12, 5, 4, 0.8), f: GOLD },
    { d: R(3, 20, 8.6, 2.2, 1), f: GRAY_D },
    { d: 'M6.2 7.5l2.2 3M8.4 10.5l-2.2 3M6.2 13.5l2.2 3', s: ORANGE_D, w: 0.9 },
  ],
  hourglass: [
    { d: R(5, 2, 14, 2.4, 1.2), f: BROWN_D }, { d: R(5, 19.6, 14, 2.4, 1.2), f: BROWN_D },
    { d: P([6.5, 4.4], [17.5, 4.4], [13, 12], [17.5, 19.6], [6.5, 19.6], [11, 12]), f: '#DDE6F5' },
    { d: P([8.5, 6.5], [15.5, 6.5], [12, 11]), f: GOLD },
    { d: P([12, 14.5], [16, 19.6], [8, 19.6]), f: GOLD },
  ],
  pin: [
    { d: 'M12 22s7.5-6.6 7.5-12.2a7.5 7.5 0 0 0-15 0C4.5 15.4 12 22 12 22Z', f: RED },
    { d: C(12, 9.8, 2.8), f: WHITE },
  ],
  book: [
    { d: 'M2.5 5c3.2-1.6 6.4-1.6 9.5.5 3.1-2.1 6.3-2.1 9.5-.5v15c-3.2-1.6-6.4-1.6-9.5.5-3.1-2.1-6.3-2.1-9.5-.5Z', f: BLUE },
    { d: 'M12 5.6v15', s: WHITE, w: 1.3 },
    { d: 'M5 8.5c1.6-.5 3.2-.4 4.8.3M5 11.5c1.6-.5 3.2-.4 4.8.3M14.2 8.8c1.6-.7 3.2-.8 4.8-.3', s: WHITE, w: 1, o: 0.7 },
  ],
  door: [
    { d: R(5, 2, 14, 20, 1.5), f: BROWN_D },
    { d: R(7, 4, 10, 18, 1), f: BROWN },
    { d: C(14.5, 13, 1.1), f: GOLD },
  ],
  pointer: [
    { d: P([6, 2.5], [19, 12], [13.2, 13], [16.6, 19.6], [14, 21], [10.6, 14.4], [6, 18.5]), f: WHITE },
  ],
  plus: [{ d: C(12, 12, 10), f: GREEN }, { d: X(12, 12, 5.5, 1.4), f: WHITE }],
  // ---------- businesses ----------
  lemonade: [
    { d: E(12, 13.4, 8.4, 6.4), f: YELLOW },
    { d: C(3.9, 13.4, 1.4), f: YELLOW }, { d: C(20.1, 13.4, 1.4), f: YELLOW },
    { d: E(9, 11.4, 2.6, 1.4), f: WHITE, o: 0.55 },
    { d: 'M12 7c.8-3 3.8-4.7 6.6-4.2-.4 2.7-3 4.6-6.6 4.2Z', f: GREEN },
  ],
  bakery: [
    { d: 'M2.5 15c0-5.3 4.3-9.5 9.5-9.5s9.5 4.2 9.5 9.5c-1.6 1-3.2 1-4.4.2-.8-3.2-2.8-4.8-5.1-4.8s-4.3 1.6-5.1 4.8c-1.2.8-2.8.8-4.4-.2Z', f: BROWN },
    { d: 'M7.6 8.2l2.2 3.4M12 6v4.6M16.4 8.2l-2.2 3.4', s: BROWN_D, w: 1.6 },
    { d: 'M5 10.5c1-1.5 2-2.4 3-3', s: WHITE, w: 1, o: 0.6 },
  ],
  garage: [
    { d: R(10.6, 7.5, 2.8, 14, 1.4), f: GRAY, t: 45 },
    { d: C(12, 6, 4.8) + R(10.7, 1.7, 2.6, 4.1), f: GRAY, rule: 'evenodd', t: 45 },
    { d: C(12, 18.7, 0.9), f: GRAY_D, t: 45 },
  ],
  office: [
    { d: R(3.5, 4, 17, 11.5, 1.6), f: GRAY_D },
    { d: R(5, 5.5, 14, 8.5, 0.8), f: CYAN },
    { d: R(7, 7.5, 5, 1.3, 0.6), f: WHITE, o: 0.85 }, { d: R(7, 10.2, 8, 1.3, 0.6), f: WHITE, o: 0.6 },
    { d: P([1.5, 17], [22.5, 17], [21, 20.5], [3, 20.5]), f: GRAY },
  ],
  factory: [
    { d: P([2, 21.5], [2, 10], [7, 13], [7, 10], [12, 13], [12, 10], [16.5, 13], [16.5, 3.5], [21, 3.5], [21, 21.5]), f: '#E26D4B' },
    ...[4.6, 9.6, 14.6].map((x) => ({ d: R(x, 15.5, 3, 3, 0.5), f: YELLOW })),
    { d: R(16.5, 6, 4.5, 1.4), f: WHITE, o: 0.8 },
  ],
  lab: [
    { d: 'M9 2h6v2h-1v5.2l5.6 9.4A2.2 2.2 0 0 1 17.7 22H6.3a2.2 2.2 0 0 1-1.9-3.4L10 9.2V4H9Z', f: '#DCEBFF' },
    { d: 'M7.4 15h9.2l2.3 3.8a1.3 1.3 0 0 1-1.1 2.2H6.2a1.3 1.3 0 0 1-1.1-2.2Z', f: '#3ED598' },
    { d: C(10, 17.6, 1), f: WHITE }, { d: C(13.6, 18.8, 0.7), f: WHITE }, { d: C(12.4, 12.5, 0.6), f: '#3ED598' },
  ],
  mine: [
    { d: P([6, 3], [18, 3], [22, 9], [12, 21.5], [2, 9]), f: CYAN },
    { d: P([6, 3], [18, 3], [22, 9], [2, 9]), f: '#8BE9F7' },
    { d: P([8.4, 9], [15.6, 9], [12, 21.5]), f: '#22AFC7' },
    { d: P([6, 3], [9.2, 3], [8.4, 9], [2, 9]), f: WHITE, o: 0.55 },
  ],
  spaceport: [
    { d: 'M12 2c3 2.6 4.5 6 4.5 10v5h-9v-5c0-4 1.5-7.4 4.5-10Z', f: WHITE, t: 45 },
    { d: 'M12 2c1.6 1.3 2.7 2.8 3.4 4.5H8.6C9.3 4.8 10.4 3.3 12 2Z', f: RED, t: 45 },
    { d: C(12, 10, 2), f: BLUE, t: 45 },
    { d: P([7.5, 13], [4.5, 17.5], [7.5, 17.5]), f: RED, t: 45 },
    { d: P([16.5, 13], [19.5, 17.5], [16.5, 17.5]), f: RED, t: 45 },
    { d: P([9.5, 17], [14.5, 17], [12, 22.8]), f: ORANGE, t: 45 },
  ],
  // ---------- worker tiers ----------
  apprentice: [
    { d: 'M4 14.5a8 8 0 0 1 16 0Z', f: BLUE },
    { d: R(2, 13.5, 20, 2.8, 1.4), f: BLUE_D },
    { d: C(12, 6.4, 1.1), f: BLUE_D },
    { d: R(9.2, 9.2, 5.6, 2.6, 1.3), f: WHITE, o: 0.9 },
  ],
  employee: [
    { d: P([6.5, 2], [12, 6.2], [17.5, 2], [17.5, 5.4], [12, 8.4], [6.5, 5.4]), f: WHITE },
    { d: P([10.2, 6.4], [13.8, 6.4], [13, 9.4], [11, 9.4]), f: RED_D },
    { d: P([11, 9.4], [13, 9.4], [15.4, 18.4], [12, 22.2], [8.6, 18.4]), f: RED },
  ],
  expert: [
    { d: 'M6 11.4v4.6c0 1.7 2.7 3.2 6 3.2s6-1.5 6-3.2v-4.6L12 14Z', f: '#2B3245' },
    { d: P([12, 4], [23, 9], [12, 14], [1, 9]), f: INK },
    { d: 'M20 9.6v6.4', s: GOLD, w: 1.4 }, { d: C(20, 16.8, 1.3), f: GOLD },
  ],
  robot: [
    { d: 'M12 7V3.6', s: GRAY_D, w: 1.6 }, { d: C(12, 3, 1.7), f: RED },
    { d: R(4, 7, 16, 13.5, 3.2), f: GRAY },
    { d: R(2, 11, 2.2, 5, 1), f: GRAY_D }, { d: R(19.8, 11, 2.2, 5, 1), f: GRAY_D },
    { d: R(6.5, 10.5, 11, 5.2, 2.6), f: INK },
    { d: C(9.5, 13.1, 1.3), f: CYAN }, { d: C(14.5, 13.1, 1.3), f: CYAN },
    { d: R(9, 17.2, 6, 1.4, 0.7), f: GRAY_D },
  ],
  // ---------- upgrades ----------
  shoes: [
    { d: 'M2 15.6c0-2 1-6.6 2-8.6h4l1.5 2.6c2.6 0 5 1.5 7 3.5l4 1.3c1 .3 1.5 1 1.5 2v-.8Z', f: RED },
    { d: R(2, 15.6, 20.2, 3.8, 1.7), f: WHITE },
    { d: 'M8.4 9.6l1.5 2M11 9.4l1.4 2.4', s: WHITE, w: 1.1 },
  ],
  coffee: [
    { d: 'M16 11h1.6a2.6 2.6 0 0 1 0 5.2H16', s: WHITE, w: 1.8 },
    { d: 'M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z', f: WHITE },
    { d: E(10, 9.3, 5.6, 1.2), f: BROWN_D },
    { d: 'M8 6.4c-1-1 1-2 0-3.4M12 6.4c-1-1 1-2 0-3.4', s: GRAY, w: 1.4 },
    { d: R(2.5, 20.6, 15, 1.6, 0.8), f: GRAY },
  ],
  detector: [
    { d: C(10, 10, 5.4), f: '#FFF3C4', o: 0.55 },
    { d: C(10, 10, 6.4), s: GOLD, w: 2.6 },
    { d: 'M15 15l6 6', s: GOLD_D, w: 3.2 },
  ],
  megaphone: [
    { d: P([3, 9.5], [8, 9.5], [17, 4], [17, 20], [8, 14.5], [3, 14.5]), f: ORANGE },
    { d: R(7, 14, 3.2, 5.6, 1.2), f: ORANGE_D },
    { d: 'M19.5 9.5a4 4 0 0 1 0 5', s: ORANGE, w: 1.8 },
  ],
  scooter: [
    { d: 'M16.5 18.5L13.4 4H10', s: GRAY_D, w: 1.9 },
    { d: R(4, 16.6, 12.5, 2.2, 1.1), f: GREEN },
    { d: C(5, 19.6, 2.4), f: INK }, { d: C(18.2, 19.6, 2.4), f: INK },
  ],
  chair: [
    { d: R(6, 2, 11, 9, 2.6), f: PURPLE },
    { d: R(4.8, 12, 13.4, 3.2, 1.6), f: PURPLE_D },
    { d: R(10.5, 15, 2, 4), f: GRAY_D },
    { d: 'M6 21.4l5.5-2 5.5 2', s: GRAY_D, w: 1.6 },
  ],
  chip: [
    { d: 'M9 2v3M12 2v3M15 2v3M9 19v3M12 19v3M15 19v3M2 9h3M2 12h3M2 15h3M19 9h3M19 12h3M19 15h3', s: PURPLE, w: 1.6 },
    { d: R(5, 5, 14, 14, 3), f: PURPLE },
    { d: R(8.2, 8.2, 7.6, 7.6, 1.6), f: '#C4B5FD' },
  ],
  tube: [
    { d: 'M2.5 7h10.5a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h13.5', s: CYAN, w: 3 },
    { d: E(13, 7, 2.4, 1.6), f: WHITE },
  ],
  atom: [
    { d: E(12, 12, 10, 3.8), s: BLUE, w: 1.5 },
    { d: E(12, 12, 10, 3.8), s: BLUE, w: 1.5, t: 60 },
    { d: E(12, 12, 10, 3.8), s: BLUE, w: 1.5, t: 120 },
    { d: C(12, 12, 2.3), f: PURPLE },
  ],
  globe: [
    { d: C(12, 12, 10), f: BLUE },
    { d: 'M5 7.5c2 .3 3 1.5 2.6 3s1 2.5 2.4 2.6c1 1.6-.3 3.4-1.4 4.6M15 3.4c-.6 2 .8 3 2.2 3.4s2.2 2 1.4 3.6M14 14.5c1.5-.5 3 .5 3.5 2', s: GREEN, w: 1.8 },
    { d: 'M2 12h20M12 2c2.8 3 4.3 6.5 4.3 10s-1.5 7-4.3 10M12 2C9.2 5 7.7 8.5 7.7 12s1.5 7 4.3 10', s: WHITE, w: 1, o: 0.5 },
  ],
  shift: [
    { d: C(12, 12, 10), f: '#2B3245' },
    { d: 'M12 2a10 10 0 0 1 0 20Z', f: YELLOW },
    { d: 'M12 6v6l4 2', s: WHITE, w: 1.8 },
  ],
  apps: [
    { d: R(3, 3, 8, 8, 2), f: BLUE }, { d: R(13, 3, 8, 8, 2), f: GREEN },
    { d: R(3, 13, 8, 8, 2), f: GOLD }, { d: R(13, 13, 8, 8, 2), f: PURPLE },
  ],
};

function partAttrs(p) {
  const a = [`d="${p.d}"`];
  a.push(`fill="${p.f || 'none'}"`);
  if (p.s) a.push(`stroke="${p.s}" stroke-width="${p.w || 2}" stroke-linecap="round" stroke-linejoin="round"`);
  if (p.o != null) a.push(`opacity="${p.o}"`);
  if (p.rule) a.push(`fill-rule="${p.rule}"`);
  if (p.t) a.push(`transform="rotate(${p.t} 12 12)"`);
  return a.join(' ');
}

const cache = new Map();
/** Inline SVG markup for the HTML UI. */
export function icon(name, cls = '') {
  const key = name + '|' + cls;
  if (cache.has(key)) return cache.get(key);
  const parts = ICONS[name] || ICONS.info;
  const svg = `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${parts.map((p) => `<path ${partAttrs(p)}/>`).join('')}</svg>`;
  cache.set(key, svg);
  return svg;
}

/** Draw an icon on a 2D canvas (used for in-world signs). */
export function drawIcon(ctx, name, x, y, size) {
  const parts = ICONS[name] || ICONS.info;
  const k = size / 24;
  for (const p of parts) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    if (p.t) { ctx.translate(12, 12); ctx.rotate((p.t * Math.PI) / 180); ctx.translate(-12, -12); }
    ctx.globalAlpha = p.o ?? 1;
    const path = new Path2D(p.d);
    if (p.f) { ctx.fillStyle = p.f; ctx.fill(path, p.rule || 'nonzero'); }
    if (p.s) {
      ctx.strokeStyle = p.s;
      ctx.lineWidth = p.w || 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(path);
    }
    ctx.restore();
  }
}

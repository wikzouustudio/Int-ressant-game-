export const CELL = 18;          // size of a city block
export const GRID = 2;           // blocks from -GRID..GRID
export const PAD = 13;           // buildable pad size
export const ROAD_Y = 0.2;
export const PAD_Y = 0.25;
export const MAX_LEVEL = 10;
export const SAVE_KEY = 'empire-inc-tycoon3d-v1';

export const BUSINESSES = [
  { id: 'lemonade', name: 'Stand de limonade', icon: '🍋', cost: 25, income: 10, workTime: 2.5, color: '#f7c948',
    desc: 'Le début de ton empire. Citrons frais, profits acides.' },
  { id: 'bakery', name: 'Boulangerie', icon: '🥐', cost: 350, income: 70, workTime: 3.2, color: '#e07a5f',
    desc: 'Croissants chauds et clients fidèles.' },
  { id: 'garage', name: 'Garage auto', icon: '🔧', cost: 4500, income: 560, workTime: 4, color: '#e63946',
    desc: 'Vidanges, pneus et grosses factures.' },
  { id: 'office', name: 'Startup Tech', icon: '💻', cost: 55000, income: 5200, workTime: 4.8, color: '#4361ee',
    desc: 'Une tour de verre qui grandit à chaque niveau.' },
  { id: 'factory', name: 'Usine', icon: '🏭', cost: 7e5, income: 52000, workTime: 5.5, color: '#bc6c25',
    desc: 'Production de masse, cheminées fumantes.' },
  { id: 'lab', name: 'Laboratoire', icon: '🧪', cost: 9e6, income: 560000, workTime: 6.2, color: '#2ec4b6',
    desc: 'Recherche de pointe et brevets juteux.' },
  { id: 'mine', name: 'Mine de diamants', icon: '💎', cost: 1.3e8, income: 7e6, workTime: 7, color: '#7b2cbf',
    desc: 'Des cristaux brillants extraits jour et nuit.' },
  { id: 'spaceport', name: 'Spatioport', icon: '🚀', cost: 2e9, income: 9.5e7, workTime: 8, color: '#3a86ff',
    desc: 'Tourisme spatial. Le ciel n\'est plus une limite.' },
];

export const BIZ = Object.fromEntries(BUSINESSES.map((b, i) => [b.id, { ...b, index: i }]));

export const WORKERS = [
  { id: 'intern', name: 'Stagiaire', icon: '🧢', mult: 1, speed: 4.2, workMul: 1, costMul: 1, unlock: 1, color: '#94a3b8' },
  { id: 'employee', name: 'Employé', icon: '👔', mult: 3, speed: 5, workMul: 0.9, costMul: 7, unlock: 3, color: '#22c55e' },
  { id: 'expert', name: 'Expert', icon: '🎓', mult: 8, speed: 5.8, workMul: 0.8, costMul: 45, unlock: 5, color: '#a855f7' },
  { id: 'robot', name: 'Robot', icon: '🤖', mult: 22, speed: 7, workMul: 0.6, costMul: 320, unlock: 8, color: '#f59e0b' },
];

export const UPGRADES = [
  { id: 'shoes', name: 'Baskets de sport', icon: '👟', desc: '+25% vitesse de marche', cost: 200, speed: 1.25 },
  { id: 'coffee', name: 'Machine à café', icon: '☕', desc: '-20% temps de travail', cost: 2500, work: 0.8 },
  { id: 'golden', name: 'Détecteur de valises', icon: '💼', desc: 'Valises dorées x3 et plus fréquentes', cost: 6000, goldenMul: 3 },
  { id: 'marketing', name: 'Campagne marketing', icon: '📣', desc: 'Revenus x1.5', cost: 20000, income: 1.5 },
  { id: 'scooter', name: 'Trottinettes électriques', icon: '🛴', desc: '+40% vitesse de marche', cost: 150000, speed: 1.4 },
  { id: 'ergonomic', name: 'Bureaux ergonomiques', icon: '🪑', desc: '-25% temps de travail', cost: 1.2e6, work: 0.75 },
  { id: 'ai', name: 'IA d\'entreprise', icon: '🧠', desc: 'Revenus x2', cost: 1e7, income: 2 },
  { id: 'express', name: 'Tubes pneumatiques', icon: '🌀', desc: '+50% vitesse de marche', cost: 8e7, speed: 1.5 },
  { id: 'quantum', name: 'Finance quantique', icon: '⚛️', desc: 'Revenus x3', cost: 6e8, income: 3 },
  { id: 'franchise', name: 'Franchise mondiale', icon: '🌍', desc: 'Revenus x5', cost: 5e10, income: 5 },
];

export const FIRST_NAMES = [
  'Lucas', 'Emma', 'Hugo', 'Léa', 'Nathan', 'Chloé', 'Louis', 'Manon', 'Jules', 'Camille', 'Adam', 'Inès',
  'Gabriel', 'Jade', 'Arthur', 'Sarah', 'Raphaël', 'Lina', 'Tom', 'Zoé', 'Noah', 'Alice', 'Ethan', 'Louise',
  'Sacha', 'Anna', 'Malo', 'Rose', 'Yanis', 'Mila', 'Kylian', 'Nora', 'Théo', 'Ambre', 'Enzo', 'Lou',
  'Mehdi', 'Aya', 'Samuel', 'Elsa', 'Ibrahim', 'Julia', 'Victor', 'Margaux', 'Liam', 'Lola', 'Axel', 'Yasmine',
];
export const ROBOT_NAMES = ['RX-01', 'B0LT', 'Z3TA', 'N1X', 'K-9000', 'AT0M', 'V0LT', 'GR1D', 'PIX3L', 'T3SLA', 'R2-FR', 'NE0N'];

// --- Economy formulas --------------------------------------------------------
export const levelMult = (level) => Math.pow(1.6, level - 1);
export const slotsFor = (level) => Math.min(8, 1 + level);
export const buildCost = (biz, ownedSameType) => biz.cost * Math.pow(1.35, ownedSameType);
export const upgradeCost = (biz, level) => biz.cost * 1.2 * Math.pow(1.85, level - 1);
export const hireCost = (biz, tier, count) => biz.cost * 0.35 * tier.costMul * Math.pow(1.22, count);
export const promoteCost = (biz, from, to) => biz.cost * 0.35 * (to.costMul - from.costMul) * 1.1;

export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) {
    if (n < 10 && n % 1 !== 0) return n.toFixed(1);
    return Math.floor(n).toString();
  }
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];
  let u = -1;
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + units[u];
}
export const money = (n) => '$' + fmt(n);

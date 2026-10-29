export const CELL = 18;          // size of a city block
export const GRID = 3;           // playable blocks from -GRID..GRID (7×7)
export const DECOR = 2;          // rings of decorative city blocks around the playable district
export const PLAY_HALF = (GRID + 0.5) * CELL;
export const CITY_HALF = (GRID + DECOR + 0.5) * CELL;
export const PAD = 13;           // buildable pad size
export const ROAD_Y = 0.2;
export const PAD_Y = 0.25;
export const MAX_LEVEL = 10;
export const SAVE_KEY = 'empire-inc-tycoon3d-v2';

// ===========================================================================
// Swiss legal framework (simplified for gameplay — values approximate, 2024/25)
// ===========================================================================
export const LAW = {
  // TVA — Loi fédérale régissant la taxe sur la valeur ajoutée (LTVA)
  tvaNormal: 0.081,          // taux normal (art. 25 LTVA)
  tvaReduit: 0.026,          // taux réduit : denrées alimentaires (art. 25 al. 2)
  tvaSeuil: 100000,          // assujettissement dès CHF 100'000 de CA (art. 10 al. 2)
  rcSeuil: 100000,           // inscription au registre du commerce (art. 36 ORC)
  rcFee: 120,                // émolument d'inscription
  // Cotisations patronales
  avs: 0.053,                // AVS/AI/APG part employeur (LAVS)
  ac: 0.011,                 // assurance-chômage (LACI)
  lpp: 0.07,                 // 2e pilier, moyenne part employeur (LPP)
  // Loi sur le travail (LTr)
  shiftStart: 8,             // travail de jour (art. 10)
  shiftEnd: 17,
  pauseStart: 12,            // pause de 30 min dès 7 h de travail (art. 15)
  pauseEnd: 12.5,
  weekly45: 45,              // durée max. hebdo : industrie, bureaux, grands commerces (art. 9)
  weekly50: 50,              // autres travailleurs, artisanat (art. 9)
  // Code des obligations (CO)
  trialDays: 5,              // période d'essai (art. 335b) — simplifiée en jours ouvrés de jeu
  noticeTrialDays: 5,        // délai de congé pendant l'essai : 7 jours civils (art. 335b)
  noticeDays: 21,            // délai de congé ensuite : 1 mois (art. 335c)
  cfcDays: 10,               // durée simplifiée de l'apprentissage CFC (LFPr)
  schoolDay: 2,              // mercredi : cours à l'école professionnelle (art. 21 LFPr)
  permitRate: 0.02,          // émoluments du permis de construire (LAT / lois cantonales)
  demolishRate: 0.35,        // démolition + élimination des déchets (OLED), en % du prix du terrain
  demolishPermit: 0.05,      // émoluments du permis de démolir
};

// --- Foncier -------------------------------------------------------------------
export const STARTER_LOTS = ['1,0', '-1,0'];          // terrains vides, bon marché, à côté du Siège
export const ring = (i, j) => Math.max(Math.abs(i), Math.abs(j));
/** Prix du terrain : plus cher près du centre-ville… mais les anneaux extérieurs sont plus grands. */
export const landPrice = (i, j, ruin) => {
  const base = [0, 15, 900, 45000][ring(i, j)] || 2e6;
  return base * (ruin ? 0.7 : 1) * (1 + 0.04 * ((i * 7 + j * 13) & 3));
};
export const demolishCost = (land) => land * LAW.demolishRate + 8;
export const demolishTime = (i, j) => 7 + ring(i, j) * 2.5; // seconds

export const CANTONS = [
  { id: 'ZG', name: 'Zoug', tax: 0.1185, af: 0.0135, minWage: 0, wageIdx: 1.06, note: 'Fiscalité la plus douce du pays' },
  { id: 'LU', name: 'Lucerne', tax: 0.1232, af: 0.016, minWage: 0, wageIdx: 0.97, note: 'Impôts bas, salaires modérés' },
  { id: 'GE', name: 'Genève', tax: 0.14, af: 0.0245, minWage: 24.48, wageIdx: 1.1, note: 'Salaire minimum cantonal' },
  { id: 'VD', name: 'Vaud', tax: 0.1399, af: 0.0276, minWage: 0, wageIdx: 1.02, note: 'Allocations familiales élevées' },
  { id: 'NE', name: 'Neuchâtel', tax: 0.1357, af: 0.018, minWage: 21.31, wageIdx: 0.96, note: 'Salaire minimum cantonal' },
  { id: 'BS', name: 'Bâle-Ville', tax: 0.1304, af: 0.0165, minWage: 22.0, wageIdx: 1.05, note: 'Salaire minimum cantonal' },
  { id: 'ZH', name: 'Zurich', tax: 0.1961, af: 0.01, minWage: 0, wageIdx: 1.1, note: 'Grande place économique' },
  { id: 'BE', name: 'Berne', tax: 0.2104, af: 0.016, minWage: 0, wageIdx: 1.0, note: 'Capitale fédérale' },
  { id: 'TI', name: 'Tessin', tax: 0.192, af: 0.015, minWage: 20.0, wageIdx: 0.88, note: 'Salaire minimum cantonal' },
];
export const CANTON = Object.fromEntries(CANTONS.map((c) => [c.id, c]));

// Zones d'affectation (LAT) : ZM = zone mixte / centre, ZI = zone industrielle
export const ZONES = {
  ZM: { name: 'Zone mixte', short: 'Mixte' },
  ZI: { name: 'Zone industrielle', short: 'Industrielle' },
};

// tasks: `at` = 'in' (inside the building) or a named outdoor station.
// anim: hammer | type | serve | inspect | push | wipe | phone
export const BUSINESSES = [
  { id: 'lemonade', name: 'Stand de limonade', cost: 25, income: 10, workTime: 3.2, color: '#f7c948',
    tva: 'reduit', laa: 0.005, weekly: 50, zones: ['ZM'],
    desc: 'Le début de ton empire. Boissons à l\'emporter (TVA réduite).',
    tasks: [
      { label: 'Presse les citrons', at: 'press', anim: 'hammer', w: 1 },
      { label: 'Sert les clients', at: 'counter', anim: 'serve', w: 1.3 },
      { label: 'Nettoie les tables', at: 'tables', anim: 'wipe', w: 0.7 },
    ] },
  { id: 'bakery', name: 'Boulangerie', cost: 350, income: 70, workTime: 4, color: '#e07a5f',
    tva: 'reduit', laa: 0.015, weekly: 50, zones: ['ZM'], sunday: true,
    desc: 'Pain et croissants. Peut ouvrir le dimanche matin (OLT 2 art. 27).',
    tasks: [
      { label: 'Pétrit la pâte au fournil', at: 'in', anim: 'hammer', w: 1 },
      { label: 'Cuit le pain au four', at: 'in', anim: 'hammer', w: 1 },
      { label: 'Vend en vitrine', at: 'shop', anim: 'serve', w: 1 },
      { label: 'Sert la terrasse', at: 'terrace', anim: 'serve', w: 0.6 },
    ] },
  { id: 'garage', name: 'Garage auto', cost: 4500, income: 560, workTime: 4.8, color: '#e63946',
    tva: 'normal', laa: 0.025, weekly: 50, zones: ['ZM', 'ZI'],
    desc: 'Expertises, réparations et pneus.',
    tasks: [
      { label: 'Diagnostic du véhicule', at: 'car', anim: 'inspect', w: 0.8 },
      { label: 'Répare le moteur', at: 'car', anim: 'hammer', w: 1.2 },
      { label: 'Change les pneus', at: 'tyres', anim: 'push', w: 1 },
      { label: 'Établit la facture à l\'atelier', at: 'in', anim: 'type', w: 0.6 },
    ] },
  { id: 'office', name: 'Startup Tech', cost: 55000, income: 5200, workTime: 5.5, color: '#4361ee',
    tva: 'normal', laa: 0.001, weekly: 45, zones: ['ZM'],
    desc: 'Une tour de verre qui grandit à chaque niveau.',
    tasks: [
      { label: 'Développe le logiciel', at: 'in', anim: 'type', w: 1.4 },
      { label: 'Réunion d\'équipe', at: 'in', anim: 'type', w: 0.8 },
      { label: 'Appelle un client', at: 'plaza', anim: 'phone', w: 0.8 },
    ] },
  { id: 'factory', name: 'Usine', cost: 7e5, income: 52000, workTime: 6.2, color: '#bc6c25',
    tva: 'normal', laa: 0.03, weekly: 45, zones: ['ZI'],
    desc: 'Production industrielle. Zone industrielle uniquement.',
    tasks: [
      { label: 'Assemble sur la chaîne', at: 'in', anim: 'hammer', w: 1.2 },
      { label: 'Soude les pièces', at: 'in', anim: 'hammer', w: 0.8 },
      { label: 'Contrôle qualité', at: 'pallets', anim: 'inspect', w: 0.8 },
      { label: 'Charge les palettes', at: 'pallets', anim: 'push', w: 0.8 },
    ] },
  { id: 'lab', name: 'Laboratoire', cost: 9e6, income: 560000, workTime: 7, color: '#2ec4b6',
    tva: 'normal', laa: 0.008, weekly: 45, zones: ['ZM', 'ZI'],
    desc: 'Recherche de pointe et brevets juteux.',
    tasks: [
      { label: 'Expérience en salle blanche', at: 'in', anim: 'type', w: 1.2 },
      { label: 'Analyse au microscope', at: 'in', anim: 'type', w: 1 },
      { label: 'Contrôle des cuves', at: 'tanks', anim: 'inspect', w: 0.8 },
    ] },
  { id: 'mine', name: 'Mine de diamants', cost: 1.3e8, income: 7e6, workTime: 7.8, color: '#7b2cbf',
    tva: 'normal', laa: 0.05, weekly: 45, zones: ['ZI'],
    desc: 'Galeries et cristaux. Risque élevé (prime LAA).',
    tasks: [
      { label: 'Fore la galerie', at: 'in', anim: 'hammer', w: 1.2 },
      { label: 'Extrait les diamants', at: 'in', anim: 'hammer', w: 1 },
      { label: 'Charge le wagonnet', at: 'cart', anim: 'push', w: 0.8 },
    ] },
  { id: 'spaceport', name: 'Spatioport', cost: 2e9, income: 9.5e7, workTime: 9, color: '#3a86ff',
    tva: 'normal', laa: 0.02, weekly: 45, zones: ['ZI'],
    desc: 'Tourisme spatial. La fusée décolle régulièrement.',
    tasks: [
      { label: 'Salle de contrôle', at: 'in', anim: 'type', w: 1.2 },
      { label: 'Inspection de la fusée', at: 'pad', anim: 'inspect', w: 1 },
      { label: 'Ravitaillement en carburant', at: 'fuel', anim: 'push', w: 0.8 },
    ] },
];

export const BIZ = Object.fromEntries(BUSINESSES.map((b, i) => [b.id, { ...b, index: i }]));

// wageMul: salaire horaire = revenu de base du commerce × wageMul (× indice cantonal)
export const WORKERS = [
  { id: 'apprentice', name: 'Apprenti·e CFC', short: 'Apprenti', icon: 'apprentice', mult: 1, speed: 4.2, workMul: 1, costMul: 0.5, wageMul: 0.3, unlock: 1, color: '#94a3b8', human: true },
  { id: 'employee', name: 'Employé·e CFC', short: 'Employé', icon: 'employee', mult: 3, speed: 5, workMul: 0.9, costMul: 3, wageMul: 1.3, unlock: 3, color: '#22c55e', human: true },
  { id: 'expert', name: 'Cadre (ES/HES)', short: 'Cadre', icon: 'expert', mult: 8, speed: 5.8, workMul: 0.8, costMul: 20, wageMul: 3.2, unlock: 5, color: '#a855f7', human: true },
  { id: 'robot', name: 'Robot', short: 'Robot', icon: 'robot', mult: 22, speed: 7, workMul: 0.6, costMul: 320, wageMul: 0, unlock: 8, color: '#f59e0b', human: false },
];
export const ROBOT_UPKEEP = 0.12; // entretien + électricité, en % du chiffre d'affaires

export const UPGRADES = [
  { id: 'shoes', name: 'Chaussures de sécurité', icon: 'shoes', desc: '+25% vitesse de marche', cost: 200, speed: 1.25 },
  { id: 'coffee', name: 'Machine à café', icon: 'coffee', desc: '-20% temps de travail', cost: 2500, work: 0.8 },
  { id: 'golden', name: 'Détecteur de valises', icon: 'detector', desc: 'Valises dorées x3 et plus fréquentes', cost: 6000, goldenMul: 3 },
  { id: 'marketing', name: 'Campagne d\'affichage', icon: 'megaphone', desc: 'Revenus x1.5', cost: 20000, income: 1.5 },
  { id: 'scooter', name: 'Trottinettes électriques', icon: 'scooter', desc: '+40% vitesse de marche', cost: 150000, speed: 1.4 },
  { id: 'ergonomic', name: 'Postes ergonomiques', icon: 'chair', desc: '-25% temps de travail', cost: 1.2e6, work: 0.75 },
  { id: 'ai', name: 'IA d\'entreprise', icon: 'chip', desc: 'Revenus x2', cost: 1e7, income: 2 },
  { id: 'express', name: 'Tubes pneumatiques', icon: 'tube', desc: '+50% vitesse de marche', cost: 8e7, speed: 1.5 },
  { id: 'quantum', name: 'Finance quantique', icon: 'atom', desc: 'Revenus x3', cost: 6e8, income: 3 },
  { id: 'franchise', name: 'Franchise mondiale', icon: 'globe', desc: 'Revenus x5', cost: 5e10, income: 5 },
];

export const FIRST_NAMES = [
  'Luca', 'Mia', 'Noah', 'Emma', 'Liam', 'Léa', 'Matteo', 'Chloé', 'Elias', 'Lina', 'Louis', 'Sofia',
  'Gabriel', 'Lara', 'Leon', 'Alice', 'Nino', 'Zoé', 'Samuel', 'Anna', 'Arthur', 'Elena', 'Julien', 'Nora',
  'Yannick', 'Laura', 'Fabio', 'Céline', 'Reto', 'Nadia', 'Urs', 'Sarah', 'Jonas', 'Aline', 'Beat', 'Mélanie',
  'Kevin', 'Jana', 'Florian', 'Selin', 'Arben', 'Valentina', 'David', 'Fatima', 'Marco', 'Giulia', 'Nils', 'Amélie',
];
export const ROBOT_NAMES = ['RX-01', 'B0LT', 'Z3TA', 'N1X', 'K-9000', 'AT0M', 'V0LT', 'GR1D', 'PIX3L', 'SWISS-7', 'HELV-3', 'NE0N'];
export const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const DAYS_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// --- Economy formulas --------------------------------------------------------
export const levelMult = (level) => Math.pow(1.6, level - 1);
export const slotsFor = (level) => Math.min(8, 1 + level);
export const buildCost = (biz, ownedSameType) => biz.cost * Math.pow(1.35, ownedSameType);
export const upgradeCost = (biz, level) => biz.cost * 1.2 * Math.pow(1.85, level - 1);
export const hireCost = (biz, tier, count) => biz.cost * 0.35 * tier.costMul * Math.pow(1.22, count);
export const trainingCost = (biz, from, to) => biz.cost * 0.35 * (to.costMul - from.costMul) * 1.1;
export const buildTime = (biz) => 10 + biz.index * 5; // seconds (mise à l'enquête + chantier)

// --- Formatting (Swiss style: apostrophe thousands, Mio./Mrd./Bio.) --------------
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  const neg = n < 0;
  n = Math.abs(n);
  let s;
  if (n < 1e6) {
    s = n < 100 && n % 1 !== 0 ? n.toFixed(2) : Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  } else {
    const units = [[1e18, 'Trio'], [1e15, 'Brd'], [1e12, 'Bio'], [1e9, 'Mrd'], [1e6, 'Mio']];
    const [v, u] = units.find(([v]) => n >= v);
    const x = n / v;
    s = x.toFixed(x < 10 ? 2 : x < 100 ? 1 : 0) + ' ' + u;
  }
  return (neg ? '-' : '') + s;
}
export const money = (n) => 'CHF ' + fmt(n);
export const pct = (x, d = 1) => (x * 100).toFixed(d).replace(/\.0+$/, '') + '%';

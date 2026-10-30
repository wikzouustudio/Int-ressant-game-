export const CELL = 20;          // size of a city block (13 m lot + 7 m street)
export const GRID = 3;           // playable blocks from -GRID..GRID (7×7)
export const DECOR = 2;          // rings of decorative city blocks around the playable district
export const PLAY_HALF = (GRID + 0.5) * CELL;
export const CITY_HALF = (GRID + DECOR + 0.5) * CELL;
/** Main roads (boulevards with traffic): the axes around the HQ, the district ring and the outer ring. */
export const isMainRoad = (v) => [CELL / 2, PLAY_HALF, CITY_HALF].some((m) => Math.abs(Math.abs(v) - m) < 0.1);
export const PAD = 13;           // buildable pad size
export const ROAD_W = CELL - PAD; // street: 4 m carriageway + 2 × 1.5 m sidewalks
export const CARRIAGE = 4;
export const SIDEWALK = 2.6;      // pedestrian lane offset from the street centreline
export const ROAD_Y = 0.2;
export const PAD_Y = 0.25;
export const MAX_LEVEL = 15;
export const SAVE_KEY = 'empire-inc-tycoon3d-v3';

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
  { id: 'lemonade', name: 'Stand de limonade', cost: 25, income: 9, workTime: 3.2, color: '#f7c948',
    tva: 'reduit', laa: 0.005, weekly: 50, zones: ['ZM'],
    desc: 'Le début de ton empire. Boissons à l\'emporter (TVA réduite).',
    tasks: [
      { label: 'Presse les citrons', at: 'press', anim: 'hammer', w: 1 },
      { label: 'Sert les clients', at: 'counter', anim: 'serve', w: 1.3 },
      { label: 'Nettoie les tables', at: 'tables', anim: 'wipe', w: 0.7 },
    ] },
  { id: 'bakery', name: 'Boulangerie', cost: 300, income: 60, workTime: 4, color: '#e07a5f',
    tva: 'reduit', laa: 0.015, weekly: 50, zones: ['ZM'], sunday: true,
    desc: 'Pain et croissants. Peut ouvrir le dimanche matin (OLT 2 art. 27).',
    tasks: [
      { label: 'Pétrit la pâte au fournil', at: 'in', anim: 'hammer', w: 1 },
      { label: 'Cuit le pain au four', at: 'in', anim: 'hammer', w: 1 },
      { label: 'Vend en vitrine', at: 'shop', anim: 'serve', w: 1 },
      { label: 'Sert la terrasse', at: 'terrace', anim: 'serve', w: 0.6 },
    ] },
  { id: 'garage', name: 'Garage auto', cost: 4500, income: 650, workTime: 4.8, color: '#e63946',
    tva: 'normal', laa: 0.025, weekly: 50, zones: ['ZM', 'ZI'],
    desc: 'Expertises, réparations et pneus.',
    tasks: [
      { label: 'Diagnostic du véhicule', at: 'car', anim: 'inspect', w: 0.8 },
      { label: 'Répare le moteur', at: 'car', anim: 'hammer', w: 1.2 },
      { label: 'Change les pneus', at: 'tyres', anim: 'push', w: 1 },
      { label: 'Établit la facture à l\'atelier', at: 'in', anim: 'type', w: 0.6 },
    ] },
  { id: 'office', name: 'Startup Tech', cost: 75000, income: 7500, workTime: 5.5, color: '#4361ee',
    tva: 'normal', laa: 0.001, weekly: 45, zones: ['ZM'],
    desc: 'Une tour de verre qui grandit à chaque niveau.',
    tasks: [
      { label: 'Développe le logiciel', at: 'in', anim: 'type', w: 1.4 },
      { label: 'Réunion d\'équipe', at: 'in', anim: 'type', w: 0.8 },
      { label: 'Appelle un client', at: 'plaza', anim: 'phone', w: 0.8 },
    ] },
  { id: 'factory', name: 'Usine', cost: 1.6e6, income: 1.2e5, workTime: 6.2, color: '#bc6c25',
    tva: 'normal', laa: 0.03, weekly: 45, zones: ['ZI'],
    desc: 'Production industrielle. Zone industrielle uniquement.',
    tasks: [
      { label: 'Assemble sur la chaîne', at: 'in', anim: 'hammer', w: 1.2 },
      { label: 'Soude les pièces', at: 'in', anim: 'hammer', w: 0.8 },
      { label: 'Contrôle qualité', at: 'pallets', anim: 'inspect', w: 0.8 },
      { label: 'Charge les palettes', at: 'pallets', anim: 'push', w: 0.8 },
    ] },
  { id: 'lab', name: 'Laboratoire', cost: 4e7, income: 2.2e6, workTime: 7, color: '#2ec4b6',
    tva: 'normal', laa: 0.008, weekly: 45, zones: ['ZM', 'ZI'],
    desc: 'Recherche de pointe et brevets juteux.',
    tasks: [
      { label: 'Expérience en salle blanche', at: 'in', anim: 'type', w: 1.2 },
      { label: 'Analyse au microscope', at: 'in', anim: 'type', w: 1 },
      { label: 'Contrôle des cuves', at: 'tanks', anim: 'inspect', w: 0.8 },
    ] },
  { id: 'mine', name: 'Mine de diamants', cost: 1.1e9, income: 4e7, workTime: 7.8, color: '#7b2cbf',
    tva: 'normal', laa: 0.05, weekly: 45, zones: ['ZI'],
    desc: 'Galeries et cristaux. Risque élevé (prime LAA).',
    tasks: [
      { label: 'Fore la galerie', at: 'in', anim: 'hammer', w: 1.2 },
      { label: 'Extrait les diamants', at: 'in', anim: 'hammer', w: 1 },
      { label: 'Charge le wagonnet', at: 'cart', anim: 'push', w: 0.8 },
    ] },
  { id: 'spaceport', name: 'Spatioport', cost: 3.5e10, income: 8e8, workTime: 9, color: '#3a86ff',
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
  { id: 'apprentice', name: 'Apprenti·e CFC', short: 'Apprenti', icon: 'apprentice', mult: 1, speed: 4.2, workMul: 1, costMul: 0.5, wageMul: 0.25, unlock: 1, color: '#94a3b8', human: true },
  { id: 'employee', name: 'Employé·e CFC', short: 'Employé', icon: 'employee', mult: 3, speed: 5, workMul: 0.9, costMul: 3, wageMul: 1.3, unlock: 3, color: '#22c55e', human: true },
  { id: 'expert', name: 'Cadre (ES/HES)', short: 'Cadre', icon: 'expert', mult: 8, speed: 5.8, workMul: 0.8, costMul: 20, wageMul: 3.2, unlock: 5, color: '#a855f7', human: true },
  { id: 'robot', name: 'Robot', short: 'Robot', icon: 'robot', mult: 22, speed: 7, workMul: 0.6, costMul: 320, wageMul: 0, unlock: 8, color: '#f59e0b', human: false },
];
export const ROBOT_UPKEEP = 0.12;
export const GOLDEN_SECONDS = 25; // a golden briefcase pays ~25 s of the income actually earned // entretien + électricité, en % du chiffre d'affaires

// Recherche & développement. Effects: income (×), speed (× walking), work (× task time),
// wage (× salaires), upkeep (× entretien des robots), golden (valises ×2 et plus fréquentes).
export const UPGRADES = [
  { id: 'shoes', name: 'Chaussures de sécurité', icon: 'shoes', desc: '+20% vitesse de marche', cost: 300, speed: 1.2 },
  { id: 'coffee', name: 'Machine à café', icon: 'coffee', desc: '-15% temps de travail', cost: 4000, work: 0.85 },
  { id: 'golden', name: 'Détecteur de valises', icon: 'detector', desc: 'Valises dorées x2 et plus fréquentes', cost: 15000, goldenMul: 2 },
  { id: 'marketing', name: 'Campagne d\'affichage', icon: 'megaphone', desc: 'Revenus x1.5', cost: 60000, income: 1.5 },
  { id: 'formation', name: 'Formation continue', icon: 'apprentice', desc: '-15% de masse salariale (productivité)', cost: 4e5, wage: 0.85 },
  { id: 'scooter', name: 'Trottinettes électriques', icon: 'scooter', desc: '+30% vitesse de marche', cost: 2.5e6, speed: 1.3 },
  { id: 'ergonomic', name: 'Postes ergonomiques', icon: 'chair', desc: '-20% temps de travail', cost: 2e7, work: 0.8 },
  { id: 'ai', name: 'IA d\'entreprise', icon: 'chip', desc: 'Revenus x2', cost: 2.5e8, income: 2 },
  { id: 'cff', name: 'Abonnement général CFF', icon: 'calendar', desc: '+25% vitesse de marche', cost: 2e9, speed: 1.25 },
  { id: 'robotics', name: 'Robotique avancée', icon: 'robot', desc: '-50% d\'entretien des robots', cost: 2e10, upkeep: 0.5 },
  { id: 'express', name: 'Tubes pneumatiques', icon: 'tube', desc: '+40% vitesse de marche', cost: 2e11, speed: 1.4 },
  { id: 'quantum', name: 'Finance quantique', icon: 'atom', desc: 'Revenus x2.5', cost: 1e13, income: 2.5 },
  { id: 'swissmade', name: 'Label Swiss Made', icon: 'swiss', desc: 'Revenus x2', cost: 3e14, income: 2 },
  { id: 'franchise', name: 'Franchise mondiale', icon: 'globe', desc: 'Revenus x3', cost: 2e16, income: 3 },
  { id: 'orbital', name: 'Bureaux en orbite', icon: 'rocket', desc: 'Revenus x4', cost: 1e18, income: 4 },
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

// --- Entrée en bourse (prestige) ----------------------------------------------
// Introduire la société à la SIX Swiss Exchange : on revend tout (commerces, terrains,
// recherche) contre des actions. Chaque action donne +SHARE_BONUS de revenus, pour toujours.
export const SHARE_BONUS = 0.05;
export const IPO_MIN = 1e8;                                     // CA de la partie en cours requis
export const sharesFor = (lifetime) => Math.floor(Math.sqrt(lifetime / 1e7));

// --- Objectifs ------------------------------------------------------------------
// check(g) → [progression, cible]. Prime = `secs` secondes du revenu réellement encaissé (au moins `min` CHF).
export const goalReward = (goal, rate) => Math.max(goal.min, rate * goal.secs);
const nType = (g, id) => g.countType(id);
const maxLevel = (g) => Math.max(0, ...[...g.buildings.values()].map((b) => b.level));
const nTier = (g, t) => g.workers.filter((w) => w.data.tier === t).length;
export const GOALS = [
  { id: 'first', text: 'Ouvre ton stand de limonade', check: (g) => [nType(g, 'lemonade'), 1], secs: 60, min: 40 },
  { id: 'hire2', text: 'Emploie 2 personnes', check: (g) => [g.workers.length, 2], secs: 60, min: 60 },
  { id: 'lvl3', text: 'Monte un commerce au niveau 3', check: (g) => [maxLevel(g), 3], secs: 90, min: 150 },
  { id: 'bakery', text: 'Ouvre une boulangerie', check: (g) => [nType(g, 'bakery'), 1], secs: 90, min: 250 },
  { id: 'earn5k', text: 'Réalise CHF 5’000 de chiffre d’affaires', check: (g) => [g.totalEarned, 5000], secs: 120, min: 500 },
  { id: 'demolish', text: 'Démolis un bâtiment abandonné', check: (g) => [g.stats.demolished || 0, 1], secs: 120, min: 600 },
  { id: 'staff6', text: 'Emploie 6 personnes', check: (g) => [g.workers.length, 6], secs: 120, min: 800 },
  { id: 'garage', text: 'Ouvre un garage', check: (g) => [nType(g, 'garage'), 1], secs: 150, min: 1000 },
  { id: 'cfc', text: 'Forme un·e apprenti·e jusqu’au CFC', check: (g) => [g.stats.cfc || 0, 1], secs: 180, min: 1000 },
  { id: 'plots6', text: 'Possède 6 terrains', check: (g) => [[...g.plots.values()].filter((p) => p.owned).length, 6], secs: 150, min: 1000 },
  { id: 'tva', text: 'Dépasse CHF 100’000 de CA (assujettissement TVA)', check: (g) => [g.totalEarned, 1e5], secs: 180, min: 1000 },
  { id: 'office', text: 'Ouvre une startup tech', check: (g) => [nType(g, 'office'), 1], secs: 200, min: 1000 },
  { id: 'expert', text: 'Engage ou forme un·e cadre', check: (g) => [nTier(g, 'expert'), 1], secs: 200, min: 1000 },
  { id: 'lvl7', text: 'Monte un commerce au niveau 7', check: (g) => [maxLevel(g), 7], secs: 200, min: 1000 },
  { id: 'staff15', text: 'Emploie 15 personnes', check: (g) => [g.workers.length, 15], secs: 240, min: 1000 },
  { id: 'factory', text: 'Ouvre une usine', check: (g) => [nType(g, 'factory'), 1], secs: 240, min: 1000 },
  { id: 'research5', text: 'Termine 5 recherches', check: (g) => [g.upgrades.size, 5], secs: 240, min: 1000 },
  { id: 'robot', text: 'Mets en service un robot', check: (g) => [nTier(g, 'robot'), 1], secs: 300, min: 1000 },
  { id: 'golden10', text: 'Ramasse 10 valises dorées', check: (g) => [g.stats.golden, 10], secs: 240, min: 1000 },
  { id: 'lab', text: 'Ouvre un laboratoire', check: (g) => [nType(g, 'lab'), 1], secs: 300, min: 1000 },
  { id: 'lvl10', text: 'Monte un commerce au niveau 10', check: (g) => [maxLevel(g), 10], secs: 300, min: 1000 },
  { id: 'biz12', text: 'Possède 12 commerces', check: (g) => [g.buildings.size, 12], secs: 300, min: 1000 },
  { id: 'mine', text: 'Ouvre une mine de diamants', check: (g) => [nType(g, 'mine'), 1], secs: 300, min: 1000 },
  { id: 'staff40', text: 'Emploie 40 personnes', check: (g) => [g.workers.length, 40], secs: 300, min: 1000 },
  { id: 'spaceport', text: 'Ouvre un spatioport', check: (g) => [nType(g, 'spaceport'), 1], secs: 300, min: 1000 },
  { id: 'lvl15', text: 'Monte un commerce au niveau 15 (max)', check: (g) => [maxLevel(g), 15], secs: 300, min: 1000 },
  { id: 'ipo', text: 'Entre en bourse (SIX Swiss Exchange)', check: (g) => [g.ipoCount, 1], secs: 120, min: 1000 },
  { id: 'biz30', text: 'Possède 30 commerces', check: (g) => [g.buildings.size, 30], secs: 300, min: 1000 },
  { id: 'research15', text: 'Termine toutes les recherches', check: (g) => [g.upgrades.size, 15], secs: 300, min: 1000 },
  { id: 'shares1000', text: 'Détiens 1’000 actions', check: (g) => [g.shares, 1000], secs: 300, min: 1000 },
  { id: 'biz48', text: 'Construis sur les 48 terrains', check: (g) => [g.buildings.size, 48], secs: 300, min: 1000 },
];

// --- Economy formulas --------------------------------------------------------
export const levelMult = (level) => Math.pow(1.5, level - 1);
export const slotsFor = (level) => Math.min(8, 1 + level);
export const buildCost = (biz, ownedSameType) => biz.cost * Math.pow(1.6, ownedSameType);
export const upgradeCost = (biz, level) => biz.cost * 1.5 * Math.pow(2.15, level - 1);
export const hireCost = (biz, tier, count) => biz.cost * 0.35 * tier.costMul * Math.pow(1.3, count);
export const trainingCost = (biz, from, to) => biz.cost * 0.35 * (to.costMul - from.costMul) * 1.1;
export const buildTime = (biz) => 10 + biz.index * 5; // seconds (mise à l'enquête + chantier)
/** Loi sur les cartels (LCart) : la COMCO bloque une position dominante au-delà de 6 commerces du même type. */
export const MAX_PER_TYPE = 6;
/** Revente d'un commerce (fonds de commerce) : les contrats de travail passent à l'acquéreur (art. 333 CO). */
export const sellValue = (biz, level) => biz.cost * 0.5 * levelMult(level);

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

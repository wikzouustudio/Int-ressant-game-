# Empire SA — Tycoon 3D (droit suisse)

Un jeu de gestion / tycoon en 3D dans le navigateur. Tu fondes une **société anonyme suisse**, tu achètes des
parcelles, tu construis des commerces et tu **engages des PNJ** qui enchaînent leurs tâches — dans et hors des
bâtiments — puis **rapportent la recette au Siège** à pied. Tout le système économique suit (en version
simplifiée) le **droit suisse** : Loi sur le travail, Code des obligations, AVS/LPP, TVA, impôts cantonaux, LAT.

## Lancer le jeu

```bash
npm install
npm run dev        # puis ouvre l'URL affichée (http://localhost:5173)
```

Version optimisée : `npm run build` (site statique dans `dist/`), puis `npm run preview`.

## Comment jouer

1. **Choisis le canton du siège** (Zoug, Genève, Vaud, Zurich, Berne, Tessin…) : impôt sur le bénéfice,
   salaire minimum et niveau des salaires changent.
2. **Clique sur une parcelle libre** et dépose un permis de construire : **mise à l'enquête publique** (gabarits
   rouges et blancs), puis **chantier** (grue, échafaudages), puis ouverture.
3. **Engage du personnel** : Apprenti·e CFC → Employé·e CFC → Cadre (ES/HES), ou des Robots.
4. Chaque employé suit le **déroulé de travail** de son commerce. Exemple à la boulangerie : entrer au fournil,
   pétrir la pâte, cuire le pain, vendre en vitrine, servir la terrasse, puis livrer la recette au Siège.
5. Agrandis tes bâtiments (15 niveaux), achète des **recherches** (15), surveille ta **Fiduciaire**.
6. Suis les **Objectifs** (31 étapes avec primes) et, quand ton chiffre d'affaires est assez élevé,
   **entre en bourse (SIX)** : tu revends tout contre des actions qui donnent +5 % de revenus chacune, pour toujours.

## La ville et l'éditeur de carte

Le centre constructible (7×7 parcelles) est entouré d'une ville carrée : boulevard, autoroute de
contournement, avenues, voie ferrée avec un train, et des quartiers (vieille ville piétonne, affaires,
commerces, industrie, habitations) séparés par des zones sans routes (parcs, lacs, forêt, champs).

Le bouton **carte** en haut à droite ouvre l'**éditeur 3D**, directement dans la ville :
- **Placer** : 30 bâtiments et monuments, arbres, bosquets, buissons, rochers, haies, lampadaires, bancs,
  voitures, bacs à fleurs, arrêts de bus, kiosques (rotation Q / E).
- **Sélection** : glisse un objet pour le déplacer, pivote-le, agrandis-le, varie son modèle, duplique-le ou supprime-le.
- **Routes** (avenues, rues, autoroute, chemins, voie ferrée), **Sol** (pavés, eau, champs, zones), **Gomme**, annuler.
- **Monde vide** pour tout refaire de zéro, ou **Rendre la ville actuelle modifiable** pour retoucher chaque
  bâtiment et chaque arbre de la ville générée. Le **remplissage automatique** peut être activé ou coupé.

L'éditeur offre aussi une **vue plan 2D** :
- **Zones** : peins piéton, affaires, commerces, industrie, habitations, parc, forêt, agricole ou eau (grille de 10 m).
- **Routes** : avenue, rue, autoroute, chemin piéton, voie ferrée — tracés droits ou courbes, aimantés aux routes existantes.
- **Monuments** : église, gare, centre commercial, parking, stade, centrale, ferme, place de jeux, fontaine.
- **Gomme**, annuler, export / import JSON, carte par défaut.
- **Appliquer** reconstruit la ville en 3D : les bâtiments poussent le long des routes selon la zone peinte,
  les voitures et les promeneurs suivent ton réseau. Ta partie (commerces, argent) est conservée.

## Le droit suisse dans le jeu

| Domaine | Règle appliquée |
| --- | --- |
| **Loi sur le travail (LTr)** | Humains : lun–ven 8h–17h, trajet domicile → travail, pause de midi de 30 min (art. 15, non payée), pas de travail de nuit ni le dimanche (art. 16, 18). Durée max. 45 h / 50 h par semaine (art. 9). |
| **OLT 2 art. 27** | Les boulangeries peuvent ouvrir le dimanche matin (6h–11h). |
| **Formation (LFPr)** | Les apprentis vont à l'école professionnelle le mercredi (jour payé) et obtiennent leur **CFC** après 10 jours ouvrés. |
| **Code des obligations** | Période d'essai, puis délai de congé de 7 jours (art. 335b) ou d'un mois (art. 335c), payé si tu résilies un contrat. |
| **Assurances sociales** | Part patronale AVS/AI/APG 5,3 %, AC 1,1 %, LPP ≈ 7 % (pas pour les apprentis), LAA selon le risque du métier, allocations familiales selon le canton. |
| **Salaire minimum** | Genève, Neuchâtel, Bâle-Ville et le Tessin imposent un salaire horaire minimum (hors apprentis). |
| **TVA (LTVA)** | Assujettissement dès CHF 100'000 de CA. Taux normal 8,1 %, réduit 2,6 % (limonade, boulangerie). Décompte hebdomadaire. |
| **Impôt sur le bénéfice** | Taux effectif du canton choisi, prélevé chaque lundi. |
| **LAT / permis de construire** | Zone mixte (commerces, bureaux) ou zone industrielle (usine, mine, spatioport). Émoluments du permis, enquête publique. |
| **Registre du commerce** | Inscription obligatoire dès CHF 100'000 de CA. |
| **Loi sur les cartels (LCart)** | La COMCO bloque une position dominante : 6 commerces du même type au maximum. |
| **Transfert d'entreprise (CO art. 333)** | Si tu revends un commerce, les contrats de travail passent au repreneur (pas d'indemnité). |

Les robots ne sont pas soumis à la LTr : ils travaillent 24h/24 mais coûtent 12 % du CA en entretien.
La nuit et le week-end, quand plus personne ne travaille, le temps s'accélère.

> Taux et montants approximatifs (2024–2025), simplifiés pour le jeu — ce n'est pas un conseil juridique.

## Technique

- **Three.js** (WebGL) + **Vite**, aucun asset externe : bâtiments, PNJ, chantier, arbres et **icônes** (jeu
  d'icônes vectorielles maison, utilisé en SVG dans l'interface et dessiné sur les enseignes 3D) sont générés par code.
- Ombres douces, tone mapping ACES, bloom, ciel physique, cycle jour/nuit, sons WebAudio, sauvegarde `localStorage`.

```
src/
├── engine/engine.js        rendu, caméra, post-processing
├── world/environment.js    ciel, terrain, allées, arbres, lac, jour/nuit
├── models/                 bâtiments, chantier, personnages (procéduraux)
├── game/config.js          données : commerces, tâches, cantons, lois
├── game/game.js            simulation : calendrier, PNJ, paie, TVA, impôts
└── ui/                     interface et icônes
```

# 🏦 Empire Inc. — Tycoon 3D

Un jeu de gestion / tycoon en 3D dans le navigateur. Tu achètes des parcelles, tu construis des commerces,
tu **embauches des PNJ qui travaillent pour toi** et qui **ramènent physiquement l'argent** au siège en marchant
dans les rues de ta ville.

## ▶️ Lancer le jeu

```bash
npm install
npm run dev        # puis ouvre l'URL affichée (http://localhost:5173)
```

Version optimisée :

```bash
npm run build      # génère dist/ (site statique, déployable n'importe où : GitHub Pages, Netlify…)
npm run preview
```

## 🎮 Comment jouer

1. **Clique sur une parcelle libre** (le ✚ vert) et construis un commerce.
2. **Embauche des employés** dans le panneau à droite. Chacun travaille à son poste, puis part
   avec un sac d'argent jusqu'au **Siège 🏦** pour le déposer — et revient bosser.
3. **Améliore tes bâtiments** (10 niveaux) : plus de revenus, plus de postes, et de meilleurs profils.
4. **Promeus tes employés** : 🧢 Stagiaire → 👔 Employé → 🎓 Expert → 🤖 Robot.
5. Achète des **recherches 🔬** qui boostent tout ton empire (vitesse, temps de travail, revenus).

### Astuces
- Clique sur le **Siège** pour encaisser de l'argent à la main.
- Clique sur un **employé** pour le motiver ⚡ (il va 2x plus vite pendant quelques secondes).
- Des **valises dorées 💼** apparaissent dans les rues : clique vite dessus !
- Pendant l'**heure de pointe 🔥**, tous les revenus sont doublés.
- Le jeu se **sauvegarde automatiquement** ; tes employés continuent de gagner (50 %) quand tu es absent (max 4 h).

### Contrôles
| Action | Souris / clavier | Tactile |
| --- | --- | --- |
| Tourner la caméra | Clic gauche + glisser | 1 doigt |
| Déplacer | Clic droit + glisser, ZQSD / WASD / flèches | 2 doigts |
| Zoom | Molette | Pincer |
| Fermer un panneau | Échap | ✕ |

## 🏗️ Contenu

| Commerce | Coût | Particularité |
| --- | --- | --- |
| 🍋 Stand de limonade | $25 | Parasols, citron géant |
| 🥐 Boulangerie | $350 | Cheminée qui fume, terrasse |
| 🔧 Garage auto | $4.5K | Voitures, pneus, enseigne néon |
| 💻 Startup Tech | $55K | Tour de verre qui **grandit à chaque niveau** |
| 🏭 Usine | $700K | Cheminées fumantes, silos |
| 🧪 Laboratoire | $9M | Dôme avec noyau d'énergie animé |
| 💎 Mine de diamants | $130M | Cristaux lumineux qui se multiplient |
| 🚀 Spatioport | $2B | La fusée **décolle** régulièrement |

## 🧱 Technique

- **Three.js** (WebGL) + **Vite**, aucun asset externe : tous les modèles (bâtiments, PNJ, arbres, fusée…)
  sont générés procéduralement et fusionnés en quelques draw calls (vertex colors).
- Rendu : ombres douces, tone mapping ACES, **bloom** (néons, fenêtres la nuit), ciel physique,
  **cycle jour/nuit** avec lampadaires, étoiles et lune.
- PNJ animés (marche, travail, célébration) avec squelette procédural, trajets le long des allées.
- Sons synthétisés en WebAudio, sauvegarde `localStorage`, interface responsive (mobile ok).

```
src/
├── engine/engine.js        rendu, caméra, post-processing
├── world/environment.js    ciel, terrain, allées, arbres, lac, jour/nuit
├── models/                 générateurs de modèles 3D (bâtiments, personnages)
├── game/                   logique : économie, PNJ, effets, sons, config
└── ui/ui.js                HUD et panneaux
```

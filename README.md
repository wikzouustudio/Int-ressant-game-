# Int-ressant-game- · FocusTube

Une to-do list déguisée en YouTube : chaque tâche est une « vidéo », le lecteur est un minuteur de concentration (Pomodoro), les chapitres sont des sous-tâches, les commentaires sont tes notes et le pouce bleu termine la tâche.

## Lancer

Ouvre `index.html` dans ton navigateur. Rien à installer, tout est sauvegardé dans le navigateur.

## Raccourcis

| Touche | Action |
| --- | --- |
| `/` | Rechercher |
| `N` | Créer une tâche |
| `K` / `Espace` | Lecture / pause du minuteur |
| `L` | Terminer (liker) la tâche |
| `M` | Couper le son |
| `F` | Plein écran |

## Organisation du code

```
index.html          structure de la page
css/base.css        thèmes clair/sombre, typo, reset
css/layout.css      barre du haut, sidebar, responsive
css/components.css  cartes, lecteur, modales, studio
js/utils.js         icônes SVG, formatage, stockage
js/store.js         données (tâches, chaînes, stats)
js/timer.js         minuteur Focus / Pause
js/views.js         rendu HTML de chaque écran
js/app.js           routeur, événements, raccourcis
```

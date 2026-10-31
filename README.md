# BOOM SQUAD

Jeu de combat d'arène **3 contre 3** en vue de dessus, en 3D, jouable sur mobile et sur ordinateur, directement dans le navigateur.

Six héros originaux sculptés en 3D (style cartoon, ombrage toon + contours), trois arènes, deux modes de jeu, des bots qui se battent à tes côtés et contre toi, et une progression (trophées, pièces, niveaux de puissance).

## Jouer

Le jeu est un site statique : il faut juste le servir en HTTP (les modules JavaScript ne se chargent pas en `file://`).

```bash
# depuis la racine du dépôt
python3 -m http.server 8080
# puis ouvre http://localhost:8080
```

Tu peux aussi activer **GitHub Pages** sur la branche (Settings → Pages → Deploy from branch, dossier racine) pour y jouer depuis ton téléphone.

Three.js (v0.160.0) et les polices sont chargés depuis des CDN, donc il faut une connexion internet.

## Contrôles

| | Mobile | Clavier / souris |
|---|---|---|
| Bouger | Joystick à gauche (il apparaît là où tu poses le pouce) | `ZQSD` / `WASD` / flèches |
| Attaquer | Bouton rouge : **touche** = visée auto, **glisse** = visée manuelle | Clic gauche (vise la souris) |
| Super | Bouton jaune quand il est chargé (glisse pour viser, ramène au centre pour annuler) | Clic droit ou `Espace` |
| Pause | Bouton en haut à gauche | `Échap` |

Tes 3 munitions se rechargent seules. Tu régénères tes PV si tu ne prends pas de dégâts et ne tires pas pendant 3 secondes. Les buissons te cachent tant qu'aucun ennemi n'est tout près.

## Héros

| Héros | Rôle | Attaque | Super |
|---|---|---|---|
| **Rex** | Tank | Chevrotine (5 plombs en éventail) | Bulldozer : charge qui renverse et casse les murs |
| **Nova** | Tireuse | Tir Stellaire longue portée | Rayon Nova : traverse ennemis et murs |
| **Pip** | Artilleur | Bombe lancée par-dessus les murs | Méga Boum : énorme explosion qui rase les murs |
| **Kumo** | Assassin | Coup de sabre en arc | Saut de l'Ombre : bond + impact de zone |
| **Mira** | Soutien | Graine qui blesse et soigne les alliés touchés | Jardin Sacré : zone de soin |
| **Bolt** | Mitrailleur | Rafale de 6 balles | Pluie de Roquettes |

## Modes et arènes

- **K.O. Rush** : la première équipe à 12 K.O. gagne (mort subite en cas d'égalité au bout de 2 min 30).
- **Zone Chaude** : tenez la zone centrale jusqu'à 100 %.
- Arènes : **Canyon Doré** (désert), **Clairière Sauvage** (forêt et rivières), **Pic Glacé** (neige et glace).

Gagner rapporte des trophées et des pièces. Les pièces servent à monter le niveau de puissance de tes héros (+6 % de PV et de dégâts par niveau, jusqu'au niveau 7). La progression est enregistrée dans le navigateur.

## Structure

```
index.html      interface (lobby, héros, VS, HUD, résultats) + styles
js/main.js      boucle principale, lobby 3D, menus, progression
js/game.js      simulation du match : héros, IA, tirs, Supers, objectifs, caméra, HUD
js/heroes.js    stats des héros + modèles 3D procéduraux et animations
js/maps.js      données des arènes + construction 3D (sol, murs, caisses, buissons, eau, décor)
js/fx.js        particules, débris, ondes de choc
js/input.js     joysticks tactiles, clavier et souris
js/audio.js     effets sonores et musique synthétisés (WebAudio)
js/toon.js      matériaux toon, contours, géométries partagées
```

Aucun fichier image ou son : tout (modèles, textures, sons, musique) est généré par le code.

# 🐾 Minou Chaos

Jeu mobile en 3D. Tu es un chat. Ton humain est sur son téléphone. Fais tomber tout ce qui traîne sur la table… sans te faire griller.

## Comment jouer
- **Maintiens l'écran** : le chat pousse l'objet vers le bord.
- **Lâche** dès que l'humain se retourne (❓ puis ❗). S'il te voit pousser, tu perds une vie.
- Enchaîne les casses pour monter le **combo**.
- Remplis la jauge **CHAOS** : l'humain part aux toilettes 🚽 et tu as quelques secondes de frénésie (vitesse x2, points x2).

## L'humain devient de plus en plus malin
Au fil des casses, il débloque de nouveaux pièges :
- 👁️ **Coup d'œil** : seuls ses yeux bougent, l'alerte est très courte.
- 👂 **Il tend l'oreille** : pousse par petites touches, sinon la jauge de bruit le fait se retourner.
- 📸 **Selfie** : 3, 2, 1… lâche avant le flash.
- 🚶 **Il se lève** : il vient remettre l'objet au milieu de la table (et te tourne le dos en repartant).
- 📞 **Mamie appelle** : quelques secondes de répit.
- 😰 **Parano** : chaque casse le rend plus méfiant (alertes plus courtes), mais multiplie tes points.

## Ce qui fait revenir
- 🎁 Cadeau quotidien avec série de 7 jours
- 📋 3 missions qui changent chaque jour
- 🛍️ Boutique : 5 pouvoirs, 8 chats, 9 chapeaux
- 🏠 5 pièces à débloquer : Salon, Cuisine, Bureau du Boss, Musée, Station spatiale
- 🧾 Le rapport de dégâts en euros à la fin de chaque partie

## Lancer le jeu
Ouvre `index.html` dans un navigateur (sur téléphone, « Ajouter à l'écran d'accueil » pour le plein écran).
Un seul fichier. Les modèles 3D (chat, humain, meubles, 30 objets) sont sculptés au lancement : des volumes fusionnés en douceur dans un champ de distance, convertis en une seule surface lisse, peints et animés par squelette. Three.js est chargé depuis cdnjs, donc il faut une connexion au premier lancement.
La progression est sauvegardée dans le navigateur.

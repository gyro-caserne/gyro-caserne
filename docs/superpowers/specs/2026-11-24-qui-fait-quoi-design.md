# « Qui fait quoi » : nommer au même endroit qu'on lit (design)

Premier lot issu de l’audit des réglages et des nominations (24/11/2026). Direction et design validés par le porteur le même jour (fusion des deux écrans, volet de la personne plutôt qu’un menu « Plus »).

## Pourquoi

Aujourd'hui, quatre écrans disent qui tient quoi : Réglages, Nominations, Comités et référents, et la fiche agent. Quand le chef crée un rôle ou un comité, rien ne le mène ensuite à la nomination. Nominations affiche « Chaque fonction a son titulaire » alors que des équipes n'ont pas de chef de garde. Remplacer un chef de garde demande deux gestes sur deux écrans.

## Ce qui change

**Un seul écran, « Qui fait quoi ».** C'est l'actuel Comités et référents (`/comites`), renommé. Il remplace Nominations.
- **Un agent** voit la page comme aujourd'hui, sans aucun geste.
- **Un chef**, c'est-à-dire qui peut nommer quelque chose (`ceQueJePeuxAttribuer`), y trouve en plus les gestes, seulement sur ce qu'il a le droit de nommer.
- **L'adresse `/nominations`** renvoie vers « Qui fait quoi » (redirection 301), et les entrées Caserne et accueil suivent.

**Agencement :**
- **« À pourvoir »** vient en tête, seulement s'il manque quelqu'un : un rôle qui doit toujours être tenu et n'a pas de titulaire. Pour un rôle d'équipe, c'est l'équipe active sans titulaire ; pour un rôle de comité, le comité en cours sans titulaire. Chaque ligne a son bouton **Nommer**.
- **Les groupes existants** (Commandement, rôles d'équipe, Comités, fonctions, missions…) sont repliés par défaut avec une ligne de résumé (« 4 équipes, 1 à pourvoir », « 6 rôles »). Ils s'ouvrent quand on vise un élément.
- **Un rôle d'équipe** a une ligne par équipe active, et un rôle de comité une ligne par comité, avec le titulaire ou « À pourvoir ».

**Ligne d'un titulaire :**
- Le nom et une flèche. Toute la ligne se touche, sans croix ni menu « Plus ».
- Un appui ouvre le **volet de la personne** : son nom, le rôle, l'équipe ou le comité, et « depuis le … ». Ce volet propose :
  - **Remplacer**, l'action principale : choisir la personne et une date de début. Le mandat en cours se termine la veille, et le nouveau commence à la date choisie, en un seul geste et une seule écriture groupée ;
  - **Finir le mandat**, un geste grave, toujours confirmé, avec une date de fin, aujourd'hui par défaut ;
  - **Voir sa fiche**.
- Sans JavaScript, la ligne mène à une petite page qui propose les mêmes gestes.

**Volet « Nommer »**, le même partout :
- Pour un rôle d'équipe, les agents de cette équipe passent d'abord, puis les autres. La recherche se fait par nom.
- On choisit une date de début, aujourd'hui par défaut.
- Les règles actuelles ne changent pas : qui peut nommer quoi, pas d'extérieur dans un rôle de comité, durée des missions, etc.

**Ailleurs :**
- **La fiche d'un rôle** (Réglages → Rôles → [id]) et **la fiche d'un comité** gagnent un bloc **Titulaires** en tête. Ce bloc reprend les mêmes lignes et le même volet que « Qui fait quoi ».
- **Après « Créer le rôle »** ou **« Créer le comité »**, la fiche s'ouvre avec ce bloc ouvert et la phrase « Qui le tiendra ? » (pour un comité, son rapporteur et ses membres).
- **Réglages** ne fait plus aucune nomination, et son lien vers Nominations disparaît. Le nombre de titulaires de chaque rôle mène à la fiche du rôle.
- **La fiche agent** garde son bloc des rôles. Son bouton « Attribuer une responsabilité » devient **« Nommer à un rôle »**, avec le même volet.

**Vocabulaire :** ce lot utilise « rôle » et « nommer » partout où il touche l'interface. Le reste du vocabulaire (Nature, Portée…) sera repris par le lot de la fiche rôle.

## Ce qui ne change pas

- **Les données** : pas de migration. Les mandats restent des attributions avec une date de début et une date de fin.
- **Les droits** de nomination.
- **Les notifications** de nomination, envoyées par les mêmes fonctions du socle.

## Contraintes

- **Temps de calcul** : aucune requête de plus pour un agent. Pour le chef, au plus ce que lisent aujourd'hui Nominations et Comités et référents réunis, en un seul batch. Les budgets restent verts sans relever de plafond, et un banc mesure la page avant et après.
- **« Remplacer »** est une seule action du socle, testée : fin de l'ancien mandat et début du nouveau dans le même batch, même règle de droit que pour nommer.
- **Charte stricte**, sans aucun marqueur d'interface générée. Les actions vont dans `ACTIONS` (page-au-journal), et le geste « Finir le mandat » est en contour rouge et confirmé.
- **Tests et doc** :
  - un e2e court : nommer sur une ligne « À pourvoir », remplacer, finir un mandat ;
  - mise à jour de la doc fonctionnelle et d'utilisation (« Comment nommer quelqu'un ? », « Comment remplacer un chef de garde ? ») ;
  - une décision 0045.

## Laissé au constructeur

- Les noms des fonctions et des composants.
- La forme exacte du volet, dans la charte.
- L'ordre interne des groupes, en gardant celui d'aujourd'hui.

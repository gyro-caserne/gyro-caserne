# Ancienneté de service : sur la fiche, et fêtée aux paliers (design)

Demande du porteur, le 24/11/2026.

## Pourquoi

Les chefs veulent connaître l'ancienneté d'un agent d'un coup d'œil, et ne plus rater ses étapes de 5, 10 ou 20 ans de service. Ils veulent aussi que le centre les fête, comme il fête déjà les anniversaires.

## Décision du porteur

L'ancienneté se compte en **années de service**, depuis la date d'engagement SPV (`personne.engagement_spv`). Elle suit l'agent d'un centre à l'autre et sert pour les médailles.

## Ce qui change

**1. Sur la fiche d'un agent : un bloc visuel, pas une ligne de texte** (demande du porteur)
- À gauche, l'**insigne du palier atteint**, dessiné à l'encre comme les autres icônes :
  - une médaille avec son ruban, aux couleurs de l'échelon de la médaille d'honneur des sapeurs-pompiers : bronze pour 10 ans, argent pour 20, vermeil pour 25, or pour 30, grand or pour 40 ;
  - pour les autres paliers (5, 15, 35…) et avant le premier, une médaille neutre, à l'encre seule.
- À droite :
  - le **nombre d'années**, en grand, dans le style des titres : « 12 ans » ;
  - « de service, dont 8 au centre » ;
  - l'échelon en toutes lettres, par exemple « Échelon argent ». La couleur n'est jamais la seule information.
- En dessous, une **fine barre de progression** vers le prochain palier : « Prochain palier : 15 ans, le 3 mars 2029 ». Sur le dernier palier réglé, pas de barre.
- C'est sobre : une seule carte, plate, sans bande de couleur. Les couleurs viennent de jetons ajoutés à `app.css` (bronze, argent, vermeil, or), lisibles en clair comme en sombre. Les animations sont coupées si l'agent l'a demandé.
- Le même insigne revient, en petit, sur la carte du jour J et dans l'e-mail.
- Les mots « échelon » et « palier » disent où en est l'ancienneté. Ils n'affirment pas que la médaille a été remise : la remise reste hors du sujet.
- Si une date manque, on n'affiche que ce qu'on sait, ou « Date d'engagement à compléter » pour qui peut modifier la fiche.
- Tout agent voit sa propre ancienneté dans Moi. Sur la fiche d'un collègue, la ligne suit la visibilité actuelle des dates de parcours.

**2. Les paliers**
- **Par défaut** : tous les 5 ans (5, 10, 15, 20, 25…).
- **Réglage du centre** : on peut ajouter ou retirer des paliers dans Réglages, avec ceux qui gèrent les listes du centre. Exemple : ceux de la médaille d'honneur des sapeurs-pompiers, 10, 20, 25, 30 et 40 ans.
- Un palier est atteint le jour anniversaire de l'engagement.

**3. Le jour J : une carte éphémère, comme pour un anniversaire**
- **La carte** : dans « Aujourd'hui au centre », à l'accueil et sur Échanges, « Thomas Agent fête ses 10 ans de service », avec l'insigne du palier et un bouton **Féliciter**, comme « Souhaiter » pour un anniversaire.
- **Ce qu'elle n'est pas** : pas une publication sur un mur. Le lendemain, la carte disparaît.
- **Le bouton Féliciter** prévient l'agent (cloche et téléphone : « Claire vous félicite pour vos 10 ans de service »). On ne félicite qu'une fois par palier.
- **Qui la voit** : les mêmes personnes que pour un anniversaire.

**4. Un e-mail aux chefs, à l'avance**
- **Quand** : 30 jours avant le palier, au réveil quotidien.
- **Qui le reçoit** : le chef de centre et l'adjoint.
- **Le texte** : « Dans 30 jours, le 12 décembre, Thomas Agent atteint 10 ans de service. »
- **Plusieurs agents** dans la même journée : un seul e-mail qui les liste.
- **Aussi dans l'appli** : la cloche des chefs reprend la même ligne.

## Contraintes

- **Temps de calcul (offre gratuite Cloudflare)** :
  - la carte du jour se lit dans la lecture existante des anniversaires, en une seule requête ;
  - la recherche « dans 30 jours » se fait au réveil quotidien, dans une requête bornée par la date ;
  - aucune requête de plus sur l'accueil d'un agent ;
  - les budgets restent verts sans relever les plafonds, avec un banc avant et après pour l'accueil et le réveil.
- **Base** :
  - les félicitations se rangent comme les souhaits d'anniversaire (une table ou une colonne de type, au choix du constructeur) ;
  - les paliers vont dans une liste du centre (colonne JSON ou table de listes existante) ;
  - migration qui ne fait qu'ajouter.
- **E-mails** : par le circuit Brevo déjà en place, avec le même gabarit que les autres e-mails aux chefs. Pas d'envoi si aucun palier n'arrive dans 30 jours.
- **Écrans et finitions** :
  - charte stricte ;
  - **aucun marqueur de texte généré**, règle stricte du porteur : pas de « · », « — », « → » ni « | » comme séparateurs, pas d'emoji décoratif (l'insigne est une icône dessinée), pas de deux-points entre deux idées, pas de majuscules espacées. Les textes restent simples, comme les écrirait un chef (« 12 ans de service », « Prochain palier, 15 ans le 3 mars 2029 »). Fiche, carte, e-mail et notifications sont relus avec cette règle ;
  - gestes dans `ACTIONS` ;
  - téléphone et ordinateur, avec captures téléphone en clair et ordinateur en sombre ;
  - doc (fiche agent, accueil, réglages, e-mails), une page d'aide et une décision ;
  - un e2e court.

## Laissé au constructeur

- Les noms, la forme exacte de la ligne d'ancienneté et de la carte.
- Le format du réglage des paliers.

## Hors du sujet

- Les médailles elles-mêmes : suivi, dossier, remise.
- Les années de service passées dans un autre centre, si la date d'engagement n'est pas renseignée.

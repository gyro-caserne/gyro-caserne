# Ancienneté de service : sur la fiche, et fêtée aux paliers (design)

Demande du porteur, le 24/11/2026.

## Pourquoi

Les chefs veulent connaître l'ancienneté d'un agent d'un coup d'œil, et ne plus rater ses étapes de 5, 10 ou 20 ans de service. Ils veulent aussi que le centre les fête, comme il fête déjà les anniversaires.

## Décision du porteur

L'ancienneté se compte en **années de service**, depuis la date d'engagement SPV (`personne.engagement_spv`). Elle suit l'agent d'un centre à l'autre et sert pour les médailles.

## Ce qui change

**1. Sur la fiche d'un agent**
- Une ligne « Ancienneté : 12 ans de service, 8 ans au centre », calculée à partir des dates de la fiche (engagement SPV et entrée au centre).
- Si une date manque, on n'affiche que ce qu'on sait, ou « Date d'engagement à compléter » pour qui peut modifier la fiche.
- Tout agent voit sa propre ancienneté dans Moi. Sur la fiche d'un collègue, la ligne suit la visibilité actuelle des dates de parcours.

**2. Les paliers**
- **Par défaut** : tous les 5 ans (5, 10, 15, 20, 25…).
- **Réglage du centre** : on peut ajouter ou retirer des paliers dans Réglages, avec ceux qui gèrent les listes du centre. Exemple : ceux de la médaille d'honneur des sapeurs-pompiers, 10, 20, 25, 30 et 40 ans.
- Un palier est atteint le jour anniversaire de l'engagement.

**3. Le jour J : une carte éphémère, comme pour un anniversaire**
- **La carte** : dans « Aujourd'hui au centre », à l'accueil et sur Échanges, « Thomas Agent fête ses 10 ans de service », avec un bouton **Féliciter**, comme « Souhaiter » pour un anniversaire.
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
  - charte stricte, sans aucun marqueur d'interface générée ;
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

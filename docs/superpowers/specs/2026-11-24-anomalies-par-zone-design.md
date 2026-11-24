# Anomalies : prévenir le bon référent selon la zone (design)

Demande du chef de centre de Laillé, transmise par le porteur le 24/11/2026.

## Pourquoi

Aujourd'hui, une anomalie signalée sur un engin prévient ceux qui ont le droit de traiter les anomalies : le référent engins et le chef de garde d'astreinte, ou le chef de centre et l'adjoint s'il n'y a pas de référent. Les référentes pharmacie ne reçoivent rien quand un kit douleur est utilisé ou qu'une attelle à dépression est HS. À l'inverse, le référent engins reçoit des anomalies qui ne le regardent pas.

## Décisions du porteur

- On sépare les anomalies selon ce qu'elles concernent. Ce qui touche la pharmacie va aux référentes pharmacie. Ce qui touche le véhicule (niveau d'huile, voyant moteur…) va au référent engins et au parc matériel.
- Le chef de garde reste prévenu de toute anomalie, pharmacie comprise, puisque c'est lui qui juge du départ.
- Le référent engins n'est pas prévenu des anomalies de pharmacie. Il les retrouve dans la liste des anomalies de l'engin.
- Ce lot doit rester dans l'esprit du lot de simplification en cours (« Qui fait quoi », audit des réglages) : pas de nouvel écran, pas de nouveau mot, les rôles et le verbe « prévenir » tels qu'on les connaît.

## Ce qui change

**Sur chaque zone d'une fiche de prise de garde** (Cabine, Coffres, Sac PS, Tiroir rouge…), on choisit **qui est prévenu** : un ou plusieurs rôles du centre, par exemple « Référent pharmacie », ou « Référent engins » avec « Parc matériel ».
- Le réglage se fait au même endroit que la fiche :
  - à l'écran (Engins, puis Fiches de prise de garde), sur la ligne de la zone : « Prévenir : Référent pharmacie », qui ouvre un volet de choix des rôles ;
  - dans le fichier Excel des fiches : une colonne « Prévenir », avec les noms des rôles séparés par des virgules. Un rôle inconnu est refusé à l'import, avec la ligne en cause.
- Le réglage passe d'une version de la fiche à l'autre, comme la zone, par sa référence.

**À la signalisation d'une anomalie** sur un élément d'une zone réglée :
- sont prévenus tous les titulaires en cours des rôles choisis (les trois référentes pharmacie, par exemple), le chef de garde d'astreinte, et ceux qui suivent déjà l'anomalie ;
- le référent engins n'est prévenu que si son rôle est dans la liste ;
- sans titulaire pour un rôle choisi, ce sont le chef de centre et l'adjoint qui sont prévenus, comme pour une anomalie sans référent aujourd'hui ;
- une zone sans réglage garde le fonctionnement actuel ;
- une anomalie « hors fiche » (Autre) garde aussi le fonctionnement actuel.

**Les suites de l'anomalie** (prise en charge, question, clôture) suivent les règles d'aujourd'hui.
- Mettre l'engin indisponible ou le remettre en service reste réservé à ceux qui ont le droit de traiter les anomalies (référent engins, chef de garde, chef et adjoint).
- Les rôles prévenus, pharmacie comprise, peuvent **prendre en charge** l'anomalie, la commenter et la clore quand le matériel est remplacé.
- Ils voient les anomalies de leurs zones dans la liste des anomalies.

**Pour la lecture**, la fiche d'un rôle (Réglages, puis Rôles) montre en une ligne les zones pour lesquelles il est prévenu, par exemple « Prévenu pour Sac PS (VSAV, CCRM), Tiroir rouge (VSAV) ». C'est le même bloc d'information que celui des Titulaires du lot « Qui fait quoi », sans geste de plus.

## Pour Laillé (une fois en production)

- **VSAV** : Sac PS, tiroirs rouge, bleu, vert et jaune → Référent pharmacie. Vérifications et Cabine → Référent engins et Parc matériel.
- **Sac PS du CCRM** → Référent pharmacie.
- Le porteur fait ces réglages, ou on les met dans le fichier des fiches.

## Contraintes

- **Temps de calcul** : la lecture des rôles prévenus se fait dans le batch existant de la signalisation, sans aller-retour de plus. Les budgets restent verts sans relever de plafond.
- **Base** : une colonne JSON sur `fiche_zone` (les rôles à prévenir), ajoutée par une migration qui ne fait qu'ajouter. Un rôle archivé est ignoré à la lecture.
- **Charte** : la charte s'applique strictement. Le geste de réglage va dans `ACTIONS` et le changement au journal.
- **Livrables** : la doc (fiches de prise de garde, anomalies), l'aide « Comment choisir qui est prévenu d'une anomalie ? », une décision et un e2e court.

## Hors du sujet

- Le réglage élément par élément : la zone suffit, puisque les fiches de Laillé rangent déjà la pharmacie dans des zones à part.
- Les demandes aux référents : c'est un autre circuit.
- Le stock de pharmacie.

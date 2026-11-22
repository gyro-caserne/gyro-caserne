# Fêtes du centre : une équipe d'astreinte imposée — design et plan

Demande du chef de centre de Laillé, cadrée avec le porteur le 21/11/2026 (version A1 et quatre points validés).

## Pourquoi

Pour la Sainte-Barbe, un méchoui de l'Amicale ou toute fête du centre, le chef veut désigner l'équipe qui tient l'astreinte pendant la fête, pour libérer les autres. Comme pour Noël et le Nouvel An, il veut garder l'historique de qui a tenu chaque fête.

## Ce qui change

- **Où** : Planning → Préparer → étape Fêtes, nouvelle partie « Fêtes du centre », à côté de Noël et du Nouvel An ; accessible aussi après la publication de l'année.
- **Une fête** : un nom, un début et une fin (date et heure), l'équipe imposée. Pas de chevauchement entre deux fêtes.
- **Effet (A1)** : pendant ces heures seulement, l'équipe imposée est d'astreinte à la place de celle du roulement ; avant et après, rien ne change. Le planning, la plaque d'astreinte (accueil et planning), l'agenda, les remplacements (disponibles, contrôle d'astreinte) et le chef de garde de la période suivent.
- **Historique**, par nom de fête comme pour Noël : « Sainte-Barbe : équipe 2 en 2025, équipe 4 en 2024 » ; signale un choix hors du tour (l'équipe qui l'a tenue il y a le plus longtemps), sans l'interdire ; saisie une fois des années passées.
- **Qui** : ceux qui préparent le planning (chef de centre et adjoint, droit de gérer le planning).
- **Après la publication** : créer, modifier ou supprimer une fête prévient les agents des deux équipes (celle qui prend l'astreinte, celle qui est libérée), par ex. « Sainte-Barbe, samedi 6 décembre de 18 h à 2 h : l'équipe 3 est d'astreinte ».
- **Remplacements déjà conclus** dans ces heures pour l'équipe libérée : l'appli les montre avant d'enregistrer (« 2 remplacements deviennent inutiles ») ; à l'enregistrement, ils sont annulés et les intéressés prévenus.
- **Hors du lot** : aucune compensation d'heures entre équipes.

## Contraintes

- Temps de calcul (offre gratuite Cloudflare) : l'astreinte est calculée sur de nombreuses pages et au réveil ; la lecture des fêtes doit tenir dans les lectures existantes (même batch, quelques lignes de l'année), budgets verts sans relever les plafonds ; banc avant/après de l'accueil et des remplacements.
- Migration additive seulement ; journal (suivi du centre) pour créer, modifier, supprimer une fête.
- Charte stricte, aucun marqueur d'interface générée ; actions dans `ACTIONS` (page-au-journal.ts).

## Plan

1. Socle : table des fêtes (nom, début, fin, équipe, créée par) + historique (années passées) ; une seule fonction qui applique les fêtes à l'astreinte calculée (équipe d'une période), utilisée partout où l'astreinte est lue ; tests d'abord (fête à cheval sur minuit, sur une relève, pendant l'été, chevauchement refusé).
2. Effets : notifications des deux équipes après publication ; remplacements conclus rendus inutiles listés puis annulés avec avis ; journal.
3. Écrans : partie « Fêtes du centre » de l'étape Fêtes (ajout, modification, suppression confirmée, historique et tour), affichage des heures imposées dans le planning et la plaque d'astreinte.
4. Doc (`docs/fonctionnel/planning-de-l-annee.md`, guide d'utilisation, décision), e2e court, captures téléphone clair.

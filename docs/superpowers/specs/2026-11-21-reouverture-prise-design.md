# Prise de garde validée : participants et réouverture — design et plan

Validé par le porteur le 21/11/2026, après une prise réelle du VSAV : une fois validée, une prise ne se modifiait plus, même pour ajouter un collègue oublié.

## Ce qui change

1. **Participants modifiables après validation**, sans réouverture, jusqu'à la relève suivante : par les participants de la prise, le chef de garde de l'équipe d'astreinte, le chef de centre et l'adjoint. Le contenu de l'inventaire reste figé. La prise le note (« Participants modifiés par … le … »).
2. **Réouverture** d'une prise validée, jusqu'à la relève suivante, par le chef de garde de l'équipe d'astreinte (à défaut, le chef de centre ou l'adjoint), de lui-même ou à la demande d'un agent. Motif court obligatoire. La prise redevient « en cours » : zones vues gardées, écarts modifiables, puis nouvelle validation. La prise garde la trace (« Rouverte par … le … — motif »).
3. **Demande de réouverture** par un agent (participant ou de l'équipe d'astreinte) : bouton « Demander la réouverture » avec un motif court ; notification au chef de garde (à défaut chef de centre et adjoint) avec un lien vers la prise.
4. **Anomalies créées par la première validation** : si, après réouverture, l'écart qui l'a créée est retiré, l'anomalie est annulée d'elle-même si personne ne l'a prise en charge ; sinon elle reste ouverte et l'écran prévient (« Déjà suivie par Rémi : à clore par lui »). À la nouvelle validation, les nouveaux écarts créent leurs anomalies, sans doublon (règle existante).

## Hors du lot

Pas de modification après la relève suivante. Pas d'historique détaillé ligne à ligne (la trace dit qui, quand, pourquoi).

## Contraintes

Charte stricte, aucun marqueur d'interface générée (porteur) ; action grave « Rouvrir » confirmée ; temps de calcul : aucune requête de plus sur la page de prise ; migration additive seulement ; journal (suivi du centre) pour la réouverture et les participants modifiés ; nouvelles actions de formulaire dans `ACTIONS` (page-au-journal.ts).

## Plan

1. Socle (`packages/socle/src/prises.ts` et voisins, tests d'abord) : `modifierParticipantsApresValidation`, `rouvrirPrise(motif)`, `demanderReouverture(motif)` ; droits et borne « relève suivante » ; traces (colonnes ou journal, au choix du constructeur, migration additive) ; annulation automatique des anomalies non prises en charge dont l'écart est retiré ; notifications.
2. Écrans (`routes/engins/[id]/prise`) : sur une prise validée, « Modifier » les participants, « Rouvrir » (chef, sous « Plus », confirmé, motif), « Demander la réouverture » (agent, motif) ; bandeau de trace ; message pour une anomalie déjà suivie.
3. Doc (`docs/fonctionnel/prise-de-garde.md`, guide d'utilisation), tests de rendu, e2e court (rouvrir puis revalider), captures téléphone clair.

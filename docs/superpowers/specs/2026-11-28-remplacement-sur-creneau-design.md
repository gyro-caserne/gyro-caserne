# Remplacement sur un créneau (design)

Cadré avec le porteur le 28/11/2026, à la demande des agents.

## Pourquoi

Un agent qui sait à l'avance qu'il aura un empêchement de quelques heures (mardi prochain de 20 h à 22 h) ne peut aujourd'hui demander que la garde entière, ou attendre le jour même (« Quelques heures aujourd'hui », 2 ou 3 h). Les agents veulent anticiper.

## Ce qui change

Un cinquième choix dans « Me faire remplacer » : **Un créneau**. Les quatre choix actuels ne changent pas (décision du porteur, pour éviter toute régression).

- L'agent fixe le **début et la fin**, date et heure à la minute (« mardi 2 décembre de 20 h 10 à 22 h 40 », « vendredi 21 h à samedi 7 h »).
- Le créneau est **dans ses astreintes**. Il peut couvrir deux astreintes qui se suivent, jamais un trou. Sinon, refus avec un message qui dit pourquoi.
- **Au moins 1 h**, et demandé **au moins 1 h avant son début** (en dessous, « Quelques heures aujourd'hui »).
- Les règles sont **celles de la garde entière** :
  - à qui : « Tout le monde » (les disponibles sur ce créneau) ou un collègue précis, libre sur ce créneau ;
  - aptitude contrôlée qui manque au remplaçant : le chef valide **avant** ;
  - annulation tant que personne n'a accepté ; si le collègue refuse, « Ouvrir à tous ».
- Planning, plaque d'astreinte, agenda et chef de garde montrent « Marc de 20 h 10 à 22 h 40 », comme pour le court.

## Non-objectifs

- Pas de plusieurs créneaux par demande, pas d'échange sur créneau.
- « Quelques heures aujourd'hui » reste tel quel (2 ou 3 h, le jour même, refus après coup).

## Approches

- **Choisie (A)** : une demande de remplacement ordinaire (`genre = 'remplacement'`) avec une seule période libre dans `periodes`. Elle passe par le circuit de la garde entière ; seuls s'ajoutent l'écran du choix et ses contrôles. Sans doute pas de migration.
- **Écartée (B)** : un genre « créneau » à part. Isole mieux, mais double l'acceptation, la validation, les notifications et l'affichage, avec une migration.

## Contraintes

- **Non-régression** : tests des quatre choix actuels avant et après (garde entière, quelques heures, échange, manœuvre) ; vérifier chaque calcul qui pourrait supposer des tranches entières (disponibles, chevauchements entre demandes, relèves, plaque, agenda, aptitudes contrôlées sur la période).
- **Calcul (offre gratuite Cloudflare)** : aucune requête de plus par page ; banc avant et après sur les étapes de la demande et l'accueil ; budgets verts sans relever les plafonds.
- Charte, RGAA, téléphone d'abord ; textes sans « · », tiret cadratin ni deux-points entre deux idées.
- Doc : `docs/utilisation/me-faire-remplacer.md` (et une page « Comment me faire remplacer sur un créneau ? »), page fonctionnelle des remplacements.

## Laissé au constructeur

- Les champs exacts de l'écran (date et heure de début, date et heure de fin, contrôles natifs du téléphone).
- Les phrases de la demande et des notifications, dans l'esprit des actuelles.

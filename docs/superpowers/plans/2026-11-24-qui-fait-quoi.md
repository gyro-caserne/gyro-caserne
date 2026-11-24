# « Qui fait quoi » : plan

Design : [`specs/2026-11-24-qui-fait-quoi-design.md`](../specs/2026-11-24-qui-fait-quoi-design.md). Branche `fonction/qui-fait-quoi`, PR #127. TDD à chaque tâche, commit et push à chaque étape verte.

## Tâches

1. **Socle, `remplacerTitulaire`** (`actions/attributions.ts`). Lit le mandat, applique la règle de `attribuer` (droit, personne, périmètre, doublon) par une préparation partagée, puis un seul batch : fin de l'ancien mandat la veille, nouveau mandat, journal, avis au nommé. Tests : réussite, refus de droit, date pas après le début de l'ancien, ancien déjà fini, extérieur en comité, une seule écriture.
2. **Socle, gestes dans `quiFaitQuoi`** (option `gestes`). Dans le même batch : les mandats en cours et à venir (id, début, fin), la règle de droit lue sur les droits déjà lus (aucune requête de plus). Chaque poste (rôle et équipe, ou rôle et comité) dit s'il est à pourvoir et si l'acteur peut nommer ; chaque titulaire porte son mandat ; la liste des agents à nommer (nom, équipe). Sans l'option, rien ne change.
3. **Page « Qui fait quoi »** (`/comites`) : titre, « À pourvoir » en tête, groupes repliés avec résumé, lignes de titulaire qui ouvrent le volet de la personne (`?mandat=`), volet « Nommer » (`?nommer=`), par `Panneau` (marche sans JavaScript). Actions `nommer`, `remplacer`, `finir`, `terminer` (ajoutées à `ACTIONS`). Banc apparié et budget.
4. **`/nominations`** : redirection 301 vers `/comites`. Caserne, accueil, Agents et planning : liens vers « Qui fait quoi ». Suppression de l'ancienne page, de ses tests et de `lib/nominations.ts` s'il ne sert plus.
5. **Fiches** : bloc « Titulaires » en tête de la fiche d'un rôle et d'un comité (mêmes lignes, même volet, composants partagés) ; après création, le bloc ouvert avec « Qui le tiendra ? ». Réglages : plus de lien vers Nominations, le nombre de titulaires mène à la fiche.
6. **Fiche agent** : « Attribuer une responsabilité » devient « Nommer à un rôle ».
7. **e2e** : mise à jour de ceux qui citent Nominations ou Comités et référents ; un e2e court (nommer, remplacer, finir).
8. **Doc** : fonctionnel, utilisation (« Comment nommer quelqu'un ? », « Comment remplacer un chef de garde ? »), technique, décision 0045.
9. **Relecture** indépendante, une vague de corrections, types, PR prête avec compte rendu.

## Décisions à valider

Notées au fil de l'eau dans la description de la PR.

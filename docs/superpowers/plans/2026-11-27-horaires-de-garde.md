# Horaires de garde par année et durées du remplacement court (plan)

Design : [`2026-11-27-horaires-de-garde-design.md`](../specs/2026-11-27-horaires-de-garde-design.md).

## Tâches

1. **Non-régression d'abord** : `packages/socle/test/horaires-non-regression.test.ts`. Empreintes du calcul actuel (astreinte de l'accueil, relève, tranches, planning, été, fêtes, agenda), sur 2026 et 2027 entières, pour l'agent, le chef de centre, le chef de garde et le référent du jeu grossi. Échoue d'abord sur une valeur, puis passe. Reste vert jusqu'à la fin.
2. **Base** : migration 0041, colonne `horaires` (JSON, nullable) sur `annee_planning`, table `reglage_court` (une ligne, `durees` JSON).
3. **Calcul** (`calendrier.ts`) : `reglageDeLAnnee(reglage, horaires)`, `reglagesDe(reglage, annees)` ; garde-fous `exigerHoraires`. Tests avec relève le lundi à 19 h, semaine de 19 h à 7 h, puis astreinte continue.
4. **Partout où une année sert** : `semainesCalculees` prend la ligne de l'année (ordre et horaires) ; astreinte, planning, préparation, année suivante, été, fêtes, agenda, remplacements et tranches (le réglage de l'année de la semaine). Aucune requête de plus : les horaires viennent avec la ligne déjà lue.
5. **Relève** (prise de garde, réveil) : `releveDe` suit les horaires de l'année de la relève, la dernière semaine de l'année d'avant comprise. Prise de garde : calculée d'abord avec les horaires du centre, vérifiée sur les années lues dans le même lot ; relu une fois seulement si les horaires de l'année la déplacent.
6. **Écrire les horaires** : `reglerHoraires(base, acteur, annee, horaires | null)`, réservé à qui gère le planning, refusé sur une année publiée. Écran : étape Roulement, partie « Horaires de garde » ; lecture seule et phrase sur une année publiée.
7. **Remplacement court** : `lireDureesCourt`, `reglerDureesCourt` (1 à 4 h, au moins une) ; Réglages, ligne « Remplacement court » ; `debutsCourts` rend les durées possibles ; la demande vérifie la durée parmi celles du centre.
8. **Banc apparié** avant et après : accueil, planning, remplacements. Budgets verts.
9. **Doc** : planning de l'année, remplacements, aide « Comment changer les horaires de garde ? », décision. e2e court. Captures.
10. Relecture indépendante, retours en une vague, PR prête.

## Décisions à valider

Tenues dans la description de la PR.

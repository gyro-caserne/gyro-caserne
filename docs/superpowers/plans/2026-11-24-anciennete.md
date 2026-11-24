# Ancienneté de service : plan

Design : [`specs/2026-11-24-anciennete-design.md`](../specs/2026-11-24-anciennete-design.md). Branche `fonction/anciennete`, PR #131. TDD à chaque tâche, commit et push à chaque étape verte.

## Tâches

1. **Base** : migration 0040 qui ne fait qu'ajouter. Table `reglage_anciennete` (une ligne, les paliers en JSON ; absente, tous les 5 ans) et table `avis_anciennete` (les félicitations d'un collègue et les lignes « dans 30 jours » des chefs, qui servent aussi de lignes de cloche). Test de la migration.
2. **Calcul** (`anciennete.ts`, sans base) : années de service au jour anniversaire (29 février fêté le 28), années au centre, échelon de la médaille (bronze 10, argent 20, vermeil 25, or 30, grand or 40), prochain palier, date et part de la barre. Tests des cas limites.
3. **Paliers** : `lirePaliers`, `reglerPaliers` (droit `GERER_LISTES`, de 1 à 60 ans, triés, sans doublon, journal `regler_anciennete`). Tests.
4. **Jour J** : les paliers du jour dans la lecture des anniversaires d'Échanges (même requête, condition en SQL sur le réglage), et dans le batch de l'accueil (`monAnniversaire` devient `fetesPourMoi`, sans aller-retour de plus). `feliciter` : une fois par palier et par collègue, l'agent prévenu (cloche et téléphone). Cloche : la ligne `anciennete`, comptée, lue, effacée au départ. Ménage de nuit. Tests.
5. **Réveil de 8 h** (et 8 h 10 si 8 h a manqué) : `ancienneteDuMatin`, les paliers dans 30 jours en une lecture bornée par la date ; une ligne de cloche par agent au chef et à l'adjoint ; un seul e-mail qui les liste, par Brevo, sauf coupure « courriel ». Rien si aucun palier. Jamais deux fois. Tests.
6. **Écrans** : `InsigneAnciennete` (médaille à l'encre, jetons `--medaille-*` dans `app.css`), bloc d'ancienneté sur la fiche et dans Moi, carte du jour J (accueil et Échanges) avec Féliciter, réglage des paliers dans Réglages (Listes du centre). Gestes dans `ACTIONS`. Tests des pages.
7. **Banc** apparié avant et après (accueil d'un agent, Échanges, réveil) ; budgets verts.
8. **Doc** : fonctionnel, utilisation, technique, décision 0047 ; e2e court.
9. **Captures** (téléphone en clair, ordinateur en sombre), relecture indépendante, une vague de corrections, types, PR prête.

## Décisions à valider

Notées au fil de l'eau dans la description de la PR.

# Anomalies par zone : plan

Design : [`specs/2026-11-24-anomalies-par-zone-design.md`](../specs/2026-11-24-anomalies-par-zone-design.md). Branche `fonction/anomalies-par-zone`, PR #128. TDD à chaque tâche, commit et push à chaque étape verte.

## Tâches

1. **Base** : colonne `prevenir` (JSON des rôles) sur `fiche_zone`, migration 0039 qui ne fait qu'ajouter, et son test.
2. **Fiches** (`fiches.ts`) : `ZoneFiche.prevenir` lu et recopié d'une version à l'autre par la référence de la zone ; `reglerPrevenir` écrit le réglage sur place, dans la dernière version (pas de version de plus), avec sa ligne au journal ; `rolesAPrevenir` (les rôles du centre, non archivés). Tests : réglage, recopie à la version suivante, rôle inconnu refusé, droit exigé, rôle archivé ignoré.
3. **Qui est prévenu** (`anomalies-avis.ts`) : `quiPrevenir` rend, pour chaque liste de rôles, les titulaires en cours, le chef de garde d'astreinte, et le chef et l'adjoint pour un rôle sans titulaire ; liste vide ou que des rôles archivés, la règle d'aujourd'hui (`quiTraite`). Une requête de plus dans le batch existant, aucun aller-retour.
4. **Prise de garde** (`validerPrise`) : chaque nouvelle anomalie prévient selon sa zone ; un avis par destinataire, avec ses seules anomalies. Tests : pharmacie prévenue, référent engins non, chef de garde toujours, sans titulaire le chef et l'adjoint, zone sans réglage inchangée.
5. **Suites** (`anomalies.ts`) : un titulaire d'un rôle prévenu de la zone prend en charge et clôt, sans rendre l'engin indisponible ni le remettre en service. Lu dans les batchs existants de `lireEtat` et `lireAnomalie`.
6. **Écran des fiches** : sur chaque zone, la ligne « Prévenir » qui ouvre un volet (`Panneau`, `?prevenir=<ref>`) de cases à cocher ; action `prevenir` (dans `ACTIONS`). Tests de la page et du serveur.
7. **Classeur** : colonne « Prévenir » (noms de rôles séparés par des virgules) à l'export ; à l'import, rôle inconnu refusé avec sa ligne, colonne absente : réglages gardés, colonne vide : pas de réglage. L'aperçu dit les changements.
8. **Fiche d'un rôle** : la ligne « Prévenu pour Sac PS (VSAV, CCRM) » dans le bloc Titulaires.
9. **Banc** apparié avant/après de la validation d'une prise ; budgets verts.
10. **Doc** : fonctionnel (fiches, anomalies), utilisation (« Comment choisir qui est prévenu d'une anomalie ? »), technique, décision 0046 ; e2e court.
11. **Captures** (téléphone en clair, ordinateur en sombre), relecture indépendante, une vague de corrections, types, PR prête.

## Décisions à valider

Notées au fil de l'eau dans la description de la PR.

# 0046, Anomalies : prévenir le bon référent selon la zone

- **Contexte** : une anomalie de prise de garde prévenait toujours ceux qui traitent les anomalies (référent engins, ou chef de centre et adjoint) et le chef de garde. Les référentes pharmacie ne recevaient rien d'un kit douleur utilisé ; le référent engins recevait la pharmacie. Spec : `docs/superpowers/specs/2026-11-24-anomalies-par-zone-design.md`.
- **Options** : une catégorie par anomalie, choisie par l'agent (écartée : un choix de plus à chaque écart) ; un réglage élément par élément (écarté : les fiches rangent déjà la pharmacie dans des zones à part) ; un réglage par zone de la fiche (retenu).
- **Choix** :
  - une colonne `prevenir` sur `fiche_zone` (JSON des rôles), migration 0039 qui ne fait qu'ajouter ;
  - le réglage s'écrit sur place dans la dernière version de la fiche, sans version de plus (ce n'est pas le contenu de la check-list), et suit la zone d'une version à l'autre ; au journal, `modifier_fiche` avec le geste `prevenir_zone` ;
  - à la validation d'une prise, chaque nouvelle anomalie prévient selon sa zone, lue avec la fiche de la prise : titulaires des rôles choisis, chef de garde d'astreinte, chef et adjoint pour un rôle sans titulaire. Une zone sans réglage, un rôle archivé, un signalement hors fiche : la règle d'avant. La lecture des titulaires est une troisième requête du batch existant de `quiTraite`, sans aller-retour de plus ;
  - un titulaire d'un rôle prévenu prend en charge et clôt les anomalies de la zone (lu dans la requête de l'anomalie, dernière version de la fiche) ; l'indisponibilité reste à ceux qui traitent ;
  - à l'écran, la ligne « Prévenir » de chaque zone ouvre un volet (`Panneau`, `?prevenir=`, action `prevenir`) ; le fichier des fiches gagne une colonne « Prévenir », facultative ; la fiche d'un rôle dit « Prévenu pour… » dans son bloc Titulaires.
- **Pourquoi** : pas de nouvel écran ni de nouveau mot ; le réglage est au même endroit que la fiche ; le calcul reste dans l'offre gratuite (banc dans la PR).
- **Décisions prises en route, à valider** : voir la PR #128.
- **Validé par** : le porteur, le 24/11/2026 (design) ; le reste dans la PR.

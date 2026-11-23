# 0043, demandes aux référents (C1)

- **Contexte** : l'habillement marche bien ; le porteur veut le même suivi pour les autres référents (pharmacie et matériel d'abord), avec des étapes réglées par rôle, puis un seul système. Spec : `docs/superpowers/specs/2026-11-23-demandes-referents-design.md`.
- **Options** : un système commun neuf, puis la reprise de l'habillement (retenue) ; tout en un lot ; transformer les tables de l'habillement (écartées, voir la spec).
- **Choix** : migration additive 0035. Le réglage est une colonne JSON `responsabilite.demandes` (`{ etapes: [{ id, nom }], derniere }`), lue avec les rôles. Trois tables neuves : `demande_referent`, `fil_demande_referent`, `avis_demande_referent`. Les étapes intermédiaires ont un identifiant stable (`e` et 8 caractères), jamais réutilisé, pour que C2 retrouve celles de l'habillement. Une question est un drapeau (`posee`, puis `repondue` jusqu'au geste suivant du référent), pas une étape.
- **Pourquoi** : rien ne touche aux tables de l'habillement ; aucune requête de plus pour un agent sans casquette de demandes (une lecture de plus dans le batch existant de l'accueil, la cloche par une sous-requête de plus dans son compte).
- **Décisions prises en route, à valider** : voir la PR #122.
- **Validé par** : le porteur, le 23/11/2026 (design) ; le reste dans la PR.

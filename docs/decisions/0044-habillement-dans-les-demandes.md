# 0044, l'habillement dans les demandes aux référents (C2)

- **Contexte** : le porteur veut un seul système de demandes. L'habillement, en production depuis novembre, passe dans le système commun de C1 (décision 0043) sans rien perdre. Spec : `docs/superpowers/specs/2026-11-23-habillement-dans-demandes-design.md`.
- **Options** : recopier les demandes dans les tables de C1, puis supprimer les anciennes (retenue) ; transformer les tables de l'habillement (écartée dès C1, plus risquée sur D1).
- **Choix** :
  - migration `0036` : une colonne `demande_referent.habillement_id` (le numéro d'origine, sans clé étrangère, avec un index unique) ;
  - migration `0037`, écrite à la main, qui ne fait qu'ajouter : le réglage du rôle (`estock` « En stock », `ecommande` « Commandée au SDIS », dernière « Livrée »), les demandes, le fil (chaque ligne garde son origine dans `jeton`, `habillement:<numéro>`) et les avis non lus ; puis une ligne au journal (`reprendre_habillement`) qui dit combien de demandes il y avait et combien sont recopiées ;
  - le rôle cible : de portée centre, hors rôles système, non archivé, sans autre réglage de demandes ; celui qui porte `GERER_HABILLEMENT` d'abord (celui qui a un titulaire en cours, puis le natif « Référent habillement »), à défaut un rôle créé à partir du modèle ; sans rôle cible, rien n'est recopié ;
  - rejouée, la reprise ne duplique rien ;
  - `/habillement` mène à `/demandes?role=<id>`, `/habillement/<numéro>` à la demande reprise ;
  - le code de l'habillement est retiré ;
  - migration `0038` : les tables `avis_habillement`, `fil_habillement` et `demande_habillement` sont supprimées tout de suite après la reprise, et le droit `GERER_HABILLEMENT` disparaît (lignes, liste des droits, domaine « Habillement » des réglages, droits verrouillés du chef et de l'adjoint, modèle). Le rôle de l'habillement reçoit les demandes par le réglage de C1.
- **Pourquoi** : la reprise ne modifie aucune ligne existante et se rejoue sans doublon. La suppression, prévue d'abord dans un lot à part une semaine plus tard, est faite tout de suite à la demande du porteur, parce qu'il n'y a pas de vraie demande d'habillement en production. Le comptage avant et après n'a donc plus d'objet ; le Time Travel de D1 (7 jours) reste le filet.
- **Décisions prises en route, à valider** : voir la PR #124.
- **Validé par** : le porteur, le 23/11/2026 (design) ; le reste dans la PR.

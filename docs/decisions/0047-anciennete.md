# 0047, Ancienneté de service : sur la fiche, et fêtée aux paliers

- **Contexte** : les chefs voulaient connaître l'ancienneté d'un agent d'un coup d'œil, ne plus rater ses 5, 10 ou 20 ans, et les fêter comme les anniversaires. Spec : `docs/superpowers/specs/2026-11-24-anciennete-design.md`.
- **Choix** :
  - l'ancienneté se compte en années de service depuis `personne.engagement_spv`, palier atteint au jour anniversaire (29 février fêté le 28) ;
  - les paliers dans `reglage_anciennete` (une ligne, JSON ; absente, tous les 5 ans), réglés avec `GERER_LISTES` (journal `regler_anciennete`) ;
  - l'échelon suit les années (bronze 10, argent 20, vermeil 25, or 30, grand or 40), affiché par un insigne à l'encre dont le disque prend un jeton `--medaille-*`, et toujours écrit ;
  - une table `avis_anciennete` pour la cloche : les félicitations (`auteur_id`, unique par destinataire, agent, palier et auteur, effacées la nuit suivante) et les lignes « dans 30 jours » des chefs (`auteur_id` vide, gardées 30 jours) ; migration 0040 qui ne fait qu'ajouter ;
  - le jour J se lit dans la lecture des anniversaires : la même requête dans Échanges (`fetesDuJourAuCentre`), le même batch sur l'accueil (`fetesPourMoi`), les paliers du centre lus dans la requête par une sous-requête ;
  - l'annonce aux chefs au réveil de 8 h (et 8 h 10), en une lecture bornée par la date, sans relire un palier déjà annoncé ; un e-mail par chef qui liste les agents, par Brevo, comme les autres e-mails aux chefs.
- **Pourquoi** : pas de requête de plus sur l'accueil ni dans Échanges, un réglage simple, presque aucune donnée gardée (banc dans la PR).
- **Décisions prises en route, à valider** : voir la PR #131.
- **Validé par** : le porteur, le 24/11/2026 (design) ; le reste dans la PR.

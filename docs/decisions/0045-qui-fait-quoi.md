# 0045, Qui fait quoi : nommer au même endroit qu'on lit

- **Contexte** : quatre écrans disaient qui tient quoi (Réglages, Nominations, Comités et référents, la fiche agent). Rien ne menait de la création d'un rôle à sa nomination, et remplacer un chef de garde demandait deux gestes sur deux écrans. Spec : `docs/superpowers/specs/2026-11-24-qui-fait-quoi-design.md`.
- **Options** : garder Nominations et y ajouter les lignes vides (écartée : deux écrans pour une même question) ; un menu « Plus » sur chaque titulaire (écartée par le porteur) ; fusionner les deux écrans, la ligne d'un titulaire ouvrant le volet de la personne (retenue).
- **Choix** :
  - Comités et référents devient **Qui fait quoi** (`/comites`) ; `/nominations` répond par une redirection 301 ;
  - « À pourvoir » en tête (fonction sans titulaire en cours ni à venir), groupes repliés avec résumé, volet de la personne avec une rangée de gestes visibles, sans « Plus » (Remplacer, Voir sa fiche, Écrire, Finir le mandat, chacun dépliant son formulaire sur place), à la demande du porteur et volet Nommer, ouverts par l'adresse (`?mandat=`, `?nommer=`), comme les panneaux des anomalies ;
  - le socle gagne `remplacerTitulaire` : fin de l'ancien mandat la veille et nouveau mandat dans un seul batch, avec la préparation de `attribuer` (mêmes règles, même droit, même avis au nommé) ;
  - `quiFaitQuoi` prend l'option `gestes` : les mandats en cours et à venir dans le même batch, la règle de droit appliquée aux droits déjà lus (`regleDAttributionLue`), le chef de centre reconnu d'après ses rôles du jour, déjà lus. Aucune requête de plus, pour l'agent comme pour le chef ;
  - les fiches d'un rôle et d'un comité ont un bloc Titulaires (mêmes lignes, mêmes volets) ; la fiche agent garde « Nommer à un rôle » ;
  - `titulairesDe` et `titulairesDesMiens`, qui ne servaient qu'à l'ancienne page, sont retirés.
- **Pourquoi** : une seule page répond à « qui fait quoi » et permet de le changer ; les volets par l'adresse marchent sans JavaScript ; le calcul reste dans l'offre gratuite (banc dans la PR).
- **Décisions prises en route, à valider** : voir la PR #127.
- **Validé par** : le porteur, le 24/11/2026 (design) ; le reste dans la PR.

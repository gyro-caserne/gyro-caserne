# Corrections des audits du 25/11 (plan)

Design : [2026-11-25-corrections-audits-design.md](../specs/2026-11-25-corrections-audits-design.md). TDD, partie par partie, commit et push à chaque étape verte.

## 0. Banc « avant »

- Banc apparié (hors dépôt) : jeu grossi (60 agents, 6 années, 50 demandes), accueil agent, chef de garde, chef de centre, Échanges, un mur chargé, planning, fiche agent. Racine comprise.
- Deux copies (le commit de départ et la branche), tours alternés, médiane et minimum.

## 1. Accès des extérieurs

1. `/agents` : 403 pour un profil extérieur (layout).
2. Accueil : astreinte lue seulement avec VOIR_PLANNING ; casquette « Mon astreinte » seulement avec VOIR_PLANNING ; sans casquette, un contenu vide.
3. Profil extérieur : seul RESERVER ; écran réduit à « Réservations » (Rien, Réserver) ; refus clair dans le socle.
4. Nomination : un extérieur ne tient aucun rôle (centre, équipe, comité), refus clair.

## 2. Notifications

1. Sujets coupables au téléphone : remplacements, engins, demandes, planning, vie ; la cloche garde tout. Écran Moi, puis Notifications.
2. Chef et adjoint (révisé) : les mêmes notifications ; le second qui agit reçoit « Déjà traité par… », sans double écriture.
3. Anomalies : le signaleur prévenu à la prise en charge et à la clôture ; e-mail seulement sans téléphone abonné.
4. Remplacements : tag avec l'identifiant de la demande ; de 22 h à 7 h, cloche seule (sauf urgences) ; semaines changées regroupées par personne.
5. Nomination : même texte en cloche et au téléphone.
6. Textes : les cinq deux-points ; la garde `textes.test.ts` lit aussi les notifications.

## 3. Charte : emojis

- Règle dans la charte ; garde : emoji refusé partout, sauf un seul en fin de texte des avis conviviaux listés.

## 4. Calcul

1. `astreinteDe` : la fenêtre utile seulement.
2. Plages d'été à revoir : nombre gardé à la proposition et à l'ajustement, relu à l'accueil.
3. `mursEtAppartenances` : cache par requête, vidé aux écritures.
4. Fiche agent : `peutEcrire` en une requête.
5. Banc « après », mêmes tours ; budgets verts ; décision 0021 mise à jour.

## 5. Petit défaut

- « Sur mesure : Des droits » : l'espace à sa place.

## Fin

- e2e touchés, e2e d'accès ; captures ; doc (notifications, accès, charte), décision notifications ; relecture indépendante ; PR prête.

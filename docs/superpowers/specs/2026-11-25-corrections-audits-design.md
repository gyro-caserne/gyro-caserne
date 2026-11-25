# Corrections issues des audits du 25/11 (design court)

Ce lot suit trois audits faits en lecture seule le 25/11/2026 : les accès des extérieurs, les notifications et le temps de calcul. Le porteur l'a validé le jour même.

## 1. Accès des extérieurs

- **`/agents`** : la liste de l'effectif est refusée (403) à un profil extérieur, comme les fiches le sont déjà. C'est le layout `apps/web/src/routes/agents/+layout.server.ts`.
- **Accueil** : l'astreinte n'est lue que pour qui a VOIR_PLANNING. Il n'y a plus de casquette « Mon astreinte » pour un extérieur. Fichiers concernés : `+page.server.ts` et `astreinteDe`.
- **Réglages** :
  - un profil extérieur ne peut recevoir aucun droit d'agent (planning, engins, remplacements…). Seul RESERVER reste possible, pour la réserve citoyenne ;
  - un extérieur ne peut être nommé à aucun rôle de centre ni d'équipe. C'est déjà refusé pour les rôles de comité ;
  - le refus est expliqué dans un message clair.

## 2. Notifications

- **Couper par sujet** : dans Moi, puis Notifications, on peut couper séparément `remplacements`, `engins` (anomalies, prises), `demandes`, `planning` (été, semaines changées, manœuvres) et `vie` (anniversaires, félicitations, nominations). On peut aussi choisir « cloche seule, sans téléphone ». Les urgences restent à part et ne se coupent pas avec ces sujets.
- **Chef et adjoint** : le chef de centre est le destinataire principal. L'adjoint ne reçoit plus les mêmes lignes en double, sauf les urgences ou quand le chef de centre n'a pas de titulaire en cours. Sont concernés : remplacements sans chef de garde, anomalies d'une zone sans titulaire, paliers d'ancienneté, été, réouverture de prise.
  - **Révisé par le porteur (25/11)** : l'adjoint est un chef de centre. Les deux reçoivent les mêmes notifications ; le second qui agit reçoit « Déjà traité par… », sans rien écrire.
- **Anomalies** : le signaleur n'est prévenu qu'à la prise en charge et à la clôture. L'e-mail aux référents ne part qu'à ceux qui n'ont pas activé les notifications sur leur téléphone.
- **Demandes de remplacement** : une notification par demande, avec un tag qui contient l'identifiant de la demande. Entre 22 h et 7 h, pas de notification sur le téléphone : la ligne de cloche suffit, sauf pour les urgences. Les semaines changées d'équipe sont regroupées en un seul avis par personne.
- **Nomination** : le même texte en cloche et sur le téléphone.
- **Textes** : corriger les deux-points entre deux idées relevés par l'audit dans `anomalies.ts:164`, `prises.ts:473`, `prises.ts:603`, `remplacements/moment.ts:58` et `planning/annee.ts:237`. La garde `textes.test.ts` vérifie maintenant aussi les titres et textes des notifications.

## 3. Charte : emojis (décision du porteur)

- **À l'écran** : on garde les icônes dessinées.
- **Dans les notifications et les e-mails** : un seul emoji est permis, en fin de message, et seulement dans les moments conviviaux. Exemples : anniversaire 🎂, félicitations d'ancienneté 🎖️, Bravo 👏, fêtes du centre 🎉, Amicale.
- **Jamais d'emoji** dans l'opérationnel et les urgences (astreinte, remplacements, anomalies, engins), ni dans les titres, boutons ou libellés, ni comme séparateur.
- **Où l'écrire** : la règle va dans la charte (`.claude/skills/charte-gyro/SKILL.md`, section « Les textes »). La garde automatique la contrôle : liste des avis conviviaux autorisés, refus partout ailleurs.

## 4. Allègements du temps de calcul

Chacun se fait sans changer ce que voit l'agent :
- **Astreinte** : `astreinteDe` calcule la fenêtre de la semaine cherchée, pas l'année entière (`semainesCalculees` accepte déjà un argument `entre`).
- **Accueil du chef** : `plagesARevoir` n'est plus recalculé à chaque ouverture. Le nombre est gardé, puis recalculé à la publication ou à l'ajustement de l'été.
- **Murs** : `mursEtAppartenances` est lu une seule fois par requête, avec un cache par requête du même type que `droitsLus`, vidé aux écritures.
- **Fiche agent** : `peutEcrire` utilise `peutEcrireA`, en une requête d'une ligne, au lieu de charger tout l'annuaire.

Un banc apparié mesure l'avant et l'après sur l'accueil (agent, chef de garde, chef de centre), Échanges, un mur chargé, le planning et la fiche agent. Les budgets de requêtes restent verts. On peut baisser un plafond s'il y a du gain.

## 5. Petit défaut

« Sur mesure :Des droits » : l'espace est mal placée dans le sélecteur de niveaux.

## Contraintes

- TDD.
- Aucune migration, sauf si le réglage par sujet l'exige : dans ce cas, une migration qui ne fait qu'ajouter.
- Charte stricte, en dehors de la règle emoji ci-dessus.
- Téléphone et ordinateur : captures de Moi, puis Notifications, et de l'accueil d'un extérieur.
- Doc à jour : notifications, accès, charte.
- Une décision sur les notifications, et une mise à jour de la décision 0021 avec les chiffres de l'audit du temps de calcul.

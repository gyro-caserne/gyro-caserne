# Ouvrir des murs à un profil (et les retraités) : design

Cadré avec le porteur le 22/11/2026, et design validé par lui le même jour. Premier des trois sujets du lot « comités » :
- **A** : accès des profils aux murs (ce document) ;
- **B** : publier au nom d'un comité ;
- **C** : demandes aux référents, sur le modèle de l'habillement.

## Pourquoi

Le centre veut un **comité des retraités** : d'anciens agents qui gardent un lien avec la caserne, par leur propre mur et par le mur de l'Amicale. Plutôt que de coder les retraités à part, le porteur veut un **réglage générique** : le chef ouvre des murs à un profil.

## Ce qui change

- **Réglages → Profils**, sur un profil non agent (« extérieur »), une partie « Murs ouverts ». Pour chaque mur ouvrable, trois choix :
  - **Aucun accès**, la valeur par défaut ;
  - **Lecture** ;
  - **Écriture**.
- **Murs ouvrables** : Le centre, Vie du centre et les comités non dissous. Jamais les équipes.
- **Lecture** : voir les publications du mur et recevoir leurs notifications.
- **Écriture** : en plus de la lecture, publier, commenter, aimer, voter, et répondre aux événements convoqués à « tous » sur ce mur. Ces personnes comptent alors parmi les convoqués et dans le suivi des réponses.
- **Jamais plus qu'un agent** : un profil ouvert n'a jamais plus de droits qu'un agent sur ce mur (choix de Claude). Sur Le centre, où un agent ne publie pas, « Écriture » permet de commenter, aimer, voter et répondre, sans publier.
- **Modération** : jamais pour un profil ouvert. Elle reste aux règles actuelles.
- **Suivis** : les personnes qui ont le mur en lecture ou en écriture comptent parmi ses membres pour les annonces à prendre en compte (« qui a lu »). Seules celles qui l'ont en écriture comptent parmi les convoqués (choix de Claude).
- **Seulement ouvrir** : rien ne change pour les agents. Le profil « Agent » n'a pas ce réglage.
- **Messagerie** : une personne d'un tel profil écrit en privé aux membres des comités dont elle voit le mur, et ceux-ci peuvent lui écrire. Les membres d'un comité sont les agents qui y tiennent un rôle, plus les personnes dont le profil ouvre ce mur en écriture. Les choix suivants sont de Claude :
  - ouvrir un comité en écriture suffit, sans droit à cocher en plus ;
  - le chef et l'adjoint peuvent aussi lui écrire ;
  - messages à deux seulement : pas de groupe pour ces profils dans ce lot ;
  - une ancienne conversation avec quelqu'un qui n'est plus joignable reste lisible, en lecture seule.
- **Navigation** : dès qu'un mur au moins lui est ouvert, cette personne voit Échanges (ses murs et ses messages). Le reste ne change pas : Accueil, Mon profil, et Réservations pour la réserve citoyenne.
- **Accueil** : sa liste « À ne pas manquer » reprend les publications de ses murs ouverts, avec les mêmes règles que pour un agent.
- **Journal** : chaque changement des murs ouverts d'un profil est noté dans le suivi du centre.

## Créer un profil

- **Où** : Réglages → Profils, bouton « Nouveau profil ».
- **Saisie** : un nom (unique) et un type, « Agent » ou « Extérieur ». Les droits et les murs ouverts se règlent ensuite comme pour les autres profils.
- **Renommer et supprimer** : un profil se renomme toujours. Il se supprime seulement si personne ne l'a. Le profil « Agent » de départ ne se supprime jamais.
- **Journal** : la création, le renommage et la suppression sont notés.
- Validé par le porteur le 22/11.

## Les retraités

- **Mise en place** : le chef crée un comité « Retraités » et un profil « Retraité », de type extérieur, avec le mur « Retraités » et le mur « Amicale » en écriture. Il n'y a rien de propre aux retraités dans le code.
- **Pas de rôle de comité** : un extérieur ne tient aucun rôle de comité dans ce lot, c'est refusé à la nomination. Un agent ou le chef anime le comité Retraités. Validé par le porteur le 22/11.
- **Le passage** : un agent qui prend sa retraite **change de profil** (fiche agent, Parcours, Profil) au lieu de passer en « parti ». Il garde sa fiche, et l'effacement au bout de 12 mois ne s'applique pas, puisqu'il ne touche que les partis.
- **Ce qu'il quitte** : passer à un profil extérieur le sort du planning, des remplacements, de l'habillement et du compte d'agents, comme pour la réserve citoyenne aujourd'hui.
- **Équipe et rôles** : avant d'enregistrer, l'appli dit ce qu'il quitte (« Il sort de l'équipe 2 et perd ses rôles : … »). Ce passage suit les mêmes suites qu'un départ (`changerStatut`) sur trois points, avec deux exceptions (choix de Claude) :
  - **Comme un départ** : l'équipe et les rôles prennent fin la veille, et il n'est donc plus membre le jour même. Ses remplacements et échanges en cours sont annulés, ainsi que ses réservations et ses demandes d'habillement en cours. Un chef de centre ou un adjoint ne peut pas passer à un profil extérieur, comme pour un départ.
  - **Contrairement à un départ** : sa fiche et ses notifications restent. Il est retiré des groupes de messagerie d'agents, mais ses conversations à deux restent.

## Approches étudiées

1. **Retenue par le porteur** : une liste des murs ouverts rangée dans le profil, dans une colonne de la table `profil`, par exemple `{"comite:4":"ecriture","vie":"lecture"}`. L'appli lit déjà le profil de la personne à chaque calcul des murs, donc il n'y a aucune lecture en plus.
2. **Une table à part** (profil, mur, niveau) : écartée. Elle ajoute une lecture partout où les murs sont calculés : accueil, échanges, notifications, réveil.
3. **Nommer les retraités « Membre » de chaque comité** : écartée, parce qu'elle n'est pas générique.

## Contraintes

- **Temps de calcul** (offre gratuite Cloudflare, 10 ms) : aucune requête de plus. La colonne est lue dans les requêtes qui joignent déjà le profil (`mursEtAppartenances`, `membresDe`, messagerie). Les budgets restent verts sans relever les plafonds. Les pages lourdes passent au banc avant et après : accueil agent, accueil d'un extérieur, mur.
- **Base** : migration additive (0033), avec une colonne au texte vide par défaut. Une entrée qui vise un comité dissous ou inconnu est ignorée à la lecture.
- **Interface** : la charte stricte s'applique, sans marqueur d'interface générée. Les actions vont dans `ACTIONS`.
- **Icônes** : on ajoute une dizaine d'icônes à la liste du choix (26 aujourd'hui). Elles serviront aux comités, aux rôles et aux référents des sujets B et C : retraités, pharmacie, sport, informatique, formation, cuisine, outils, musique, photo, médaille. Elles se tracent à l'encre, dans le style des icônes actuelles.

## Ce qui reste au constructeur

- Les noms des colonnes et des fonctions.
- La forme exacte de l'écran Profils, dans la charte.
- Le libellé de la confirmation du passage à un profil extérieur.
- Les tracés des nouvelles icônes.

## Hors du sujet

- Fermer des murs aux agents.
- Ouvrir les murs d'équipe.
- Les sujets B et C.

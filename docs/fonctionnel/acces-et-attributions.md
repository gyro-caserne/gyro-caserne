# Accès et attributions

## À quoi ça sert

Décider qui peut entrer dans l'appli, ce que chacun peut y faire, et garder l'historique de qui a occupé quelle responsabilité.

## Entrer dans l'appli

- **Liste fermée** : seules les adresses e-mail ajoutées une par une peuvent se connecter. Il n'y a ni inscription libre, ni lien public.
- **Connexion par courriel** : un lien et un code à 6 chiffres dans le même courriel, valables 5 minutes. Le code se tape sur la page de connexion : c'est ce qui connecte l'appli installée sur iPhone, que le lien n'atteint pas (il ouvre Safari) ([0034](../decisions/0034-code-de-connexion.md)).
  - Exemple : Julie a laissé l'appli 3 mois sans l'ouvrir sur son iPhone. Elle l'ouvre, tape son adresse, lit le code dans Mail et le tape dans l'appli : elle est reconnectée, sans réinstaller.
- **Rester connecté** : la session dure 90 jours, repoussés à chaque jour où l'agent ouvre l'appli ([0032](../decisions/0032-session-90-jours.md)). « Me déconnecter de tous mes appareils » (Moi) ferme toutes ses sessions.
- **Chaque adresse porte un profil** (agent, réserve citoyenne ou un autre). Le profil donne les droits de base et le type de personne : agent ou extérieur.
- **Ajouter ou retirer une adresse** demande le droit `GERER_ACCES` sur le **centre** (le chef de centre et son adjoint, par défaut) : n'importe quelle adresse et n'importe quel profil. La liste des agents et les fiches ne s'ouvrent qu'avec ce droit sur le centre. Depuis le 08/11/2026, ce droit ne se donne plus à un rôle d'équipe ou de comité (voir « Droits du centre » plus bas). Le socle sait encore le lire sur une équipe (statut d'un agent de cette équipe), pour un rôle ancien qui l'aurait déjà ; aucun rôle du jeu de départ ni de la préprod ne l'a.
- **Suspension ou départ** : le statut opérationnel passe à « Suspendu » ou « Parti ». Les accès sont coupés, les sessions fermées et les liens et codes de connexion en attente annulés, mais l'historique est gardé. Au départ, la personne quitte aussi son équipe et **tous ses rôles prennent fin le même jour** (un rôle qui n'avait pas commencé est annulé) : un chef de centre qui part n'est plus chef de centre. On ne nomme pas une personne partie.
- **Lever une suspension ou faire revenir un « parti »** : seuls le chef de centre ou son adjoint le peuvent (`GERER_ACCES` sur le centre), même si un chef de garde a changé le statut de l'agent.
- **Statut du chef de centre** : seul le super administrateur le change. Exemple : l'adjoint ne peut pas suspendre le chef de centre. Un chef de centre nommé à l'avance n'est protégé qu'à partir de sa prise de fonction.
- **Statut d'un adjoint** : seuls le chef de centre ou le super administrateur le changent. Exemple : un adjoint ne peut pas suspendre un autre adjoint. Comme pour le chef de centre, un adjoint nommé à l'avance n'est protégé qu'à partir de sa prise de fonction.
- **Chef de centre adjoint** : il a les mêmes droits que le chef de centre. Seuls le chef de centre en fonction ou le super administrateur le nomment ou mettent fin à sa fonction ; un adjoint ne nomme pas d'autre adjoint.

## Attribuer une responsabilité

1. La personne qui a `ATTRIBUER_RESPONSABILITE` dans le comité qui attribue cette responsabilité (le rapporteur ou le référent du comité) choisit l'agent, la responsabilité, le périmètre et les dates.
2. Elle peut joindre le compte rendu en complément d'explication. Ce n'est jamais une condition.
3. L'attribution prend effet à la date de début et s'arrête d'elle-même à la date de fin, s'il y en a une.

Au démarrage, le chef de centre ou le super administrateur nomme les premiers membres de chaque comité.

**À l'écran**, deux chemins pour les mêmes règles :

- **depuis la fiche de l'agent** (gestionnaires), bloc « Rôles » : « Nommer à un rôle », puis « Changer la date de fin » ou « Terminer » sur un rôle ;
- **depuis Qui fait quoi** (Caserne), pour quiconque peut nommer au moins un rôle (rapporteur d'un comité, chef de centre, par exemple), et depuis le bloc « Titulaires » de la fiche d'un rôle ou d'un comité : « À pourvoir » en tête, la ligne d'un titulaire ouvre son volet (« Remplacer », « Finir le mandat »), « Nommer » ouvre le volet Nommer. Voir [Qui fait quoi](comites-et-referents.md).

Chacun ne voit et ne propose que les rôles et les périmètres qu'il a le droit d'attribuer. Exemple : le rapporteur de l'« Amicale » nomme les membres de l'Amicale, mais ni un « Référent engins » (attribué par le chef de centre), ni un membre d'un autre comité.

- **Terminer** (case « Je confirme » sur la fiche ; « Finir le mandat » ou « Annuler la nomination » sur Qui fait quoi, avec une date de fin) : le rôle s'arrête la veille, ses droits disparaissent dès aujourd'hui. Un rôle qui commence aujourd'hui ou plus tard est annulé.
- **Changer la date de fin** : on avance la fin d'un rôle en cours ou à venir ; on ne la repousse pas (« Une attribution ne peut qu’être raccourcie »). Mêmes droits que « Terminer ».
- **Personne partie** : on ne la nomme pas (« Cette personne est partie »).
- **Remplacer** (Qui fait quoi) : le mandat en cours finit la veille de la date choisie, le nouveau titulaire commence ce jour-là, en une seule écriture ; mêmes règles et mêmes droits que nommer.
- **Doublon refusé** : même personne, même rôle, même périmètre, périodes qui se chevauchent → « Cette personne tient déjà ce rôle sur cette période ».
- **L'agent nommé est prévenu** (au téléphone et dans la cloche) : « Vous êtes nommé Chef de garde », le périmètre et qui l'a nommé. Pas s'il s'est nommé lui-même, pas pour un retrait, pas pour l'import du fichier de l'effectif (pas de rafale). Une affectation d'équipe n'est pas une nomination. Le chef de centre et l'adjoint qui n'ont pas nommé le voient dans leur suivi du centre (voir [Notifications](notifications.md#suivi-du-centre-chef-de-centre-adjoint)).
- **Tout le centre voit** les rôles en cours de chacun dans la liste des agents (« Rôles : Chef de garde (Équipe 1) »), sans dates ni auteur.

## Comités et responsabilités (page « Réglages du centre »)

Avant d'attribuer une responsabilité, elle doit exister. La page « Réglages » crée et fait vivre :

- **les comités** (nom, thème court : « sport », « formation ») : créer, renommer, dissoudre. Le comité du centre ne se renomme pas et ne se dissout pas ;
- **les rôles** (responsabilités, dans le code) : nom, « Doit toujours être tenu » (voir plus bas), pour qui il est tenu (tout le centre, chaque équipe ou chaque comité), qui nomme, icône, droits. Créer à partir d'un modèle, modifier, archiver ;
- **les profils** (Agent, Réserve citoyenne, et ceux que le centre crée, comme Retraité) : leurs droits par domaine, jamais de droit d'administration, et pour un profil extérieur ses murs ouverts. Réservé au chef de centre, à l'adjoint et au super administrateur. « Nouveau profil » demande un nom (unique) et un type, Agent ou Extérieur. Un profil se renomme toujours, et se supprime (sous « Plus », avec « Je confirme ») seulement si personne ne l'a. Le profil Agent de départ ne se supprime jamais. Création, renommage, suppression et murs ouverts vont au journal et au suivi du centre.

La liste range les rôles par thème : « Chef de centre et adjoint », « Chefs de garde » (tenus pour chaque équipe), « Référents » (tenus pour tout le centre), « Comités » (les comités en cours, leurs membres et leur rapporteur, et les rôles tenus pour chaque comité), « Listes du centre » (Aptitudes, Armement des engins), « Profils », et « Archivés », replié. Dans chaque thème, les rôles natifs (installés avec le centre) viennent d'abord, puis ceux créés par le centre, marqués « Créé » ; sur sa page, un rôle créé porte « Créé à partir du modèle », suivi du nom du modèle. Un rôle sans titulaire est signalé « À pourvoir » en orange s'il doit toujours être tenu, « Sans titulaire » en gris sinon. Le chef de centre, l'adjoint et le super administrateur y voient aussi la place prise par les photos. L'icône d'un rôle est celle choisie, sinon celle de son modèle, sinon celle que donne son nom (engins : camion, pharmacie : croix, habillement : veste, technique : clé), sinon celle de son thème. Icônes au choix (rôle, comité, matériel) : étoile, casque, camion, croix, clé, ballon, livre, groupe, cœur, outil, veste, banc, table, tente, barbecue, musique, sifflet, trophée, calendrier, secourisme, appareil photo, ordinateur, drapeau, haltère, mégaphone, euro, retraités, pharmacie, sport, informatique, formation, cuisine, boîte à outils, médaille ; toujours à l'encre, sans couleur. Si l'on renomme ou change pour qui est tenu un rôle sans icône choisie, l'icône affichée jusque-là est enregistrée, pour qu'elle ne change pas. Sur les fiches et les créations d'un rôle ou d'un comité, l'icône choisie s'affiche seule ; « Changer d’icône » déplie la grille sur place, et choisir une icône la referme (sans JavaScript, la grille est dans un repli simple).

**La page d'un rôle**, du plus courant au plus rare :
1. **Titulaires** : qui le tient, avec les gestes pour nommer, et « Prévenu pour » les zones des fiches de prise de garde ;
2. **Identité** : le nom, « Doit toujours être tenu », « Tenu pour », « Qui nomme » et l'icône ;
3. **Ce qu'il peut faire** : les domaines de droits, puis l'administration de l'appli ;
4. **Demandes** : « Reçoit des demandes » et ses étapes, pour un rôle qui peut en recevoir ;
5. en bas de page, « Détail droit par droit », replié, et « Archiver le rôle », un geste grave visible qui déplie sa confirmation (« Je confirme », puis « Confirmer l’archivage »).

Un seul bouton « Enregistrer » garde l'identité, les droits et les demandes. La création d'un rôle reprend l'ordre de l'identité.

**Les droits en paquets.** La page d'un rôle range ses droits par domaine, chacun en niveaux cumulatifs (fixés par l'appli) :

| Domaine | Niveaux |
|---|---|
| Planning et gardes | Rien de plus · Valider les remplacements · Gérer le planning |
| Engins et anomalies | Rien de plus · Gérer (traiter les anomalies, fiches de prise de garde) |
| Stock et pharmacie | Rien de plus · Gérer |
| Réservations | Rien · Réserver · Gérer |
| Messagerie | Rien de plus · Modérer |

Les droits d'administration (gérer les accès, les comités, les rôles, nommer) sont des cases à part. Des droits qui ne tombent sur aucun niveau s'affichent « Sur mesure » : enregistrer sans toucher ce domaine les garde tels quels. Un rôle créé à partir d'un modèle garde ce modèle : s'il s'en écarte, il porte « Personnalisé », et « Revenir au modèle » (un domaine) ou « Tout revenir » (tout le rôle) remet ses domaines au niveau du modèle. Les droits de salon et ceux ajoutés par le détail droit par droit restent : le rôle peut donc garder « Personnalisé ». Ces deux boutons changent l'écran ; rien n'est gardé avant « Enregistrer » (sans JavaScript, ils enregistrent aussitôt). Les cases d'administration ne reviennent au modèle que pour qui les gère. Les rôles natifs n'ont pas de modèle : ils ne portent jamais « Personnalisé ». Le « Détail droit par droit » reste accessible pour les cas particuliers. Pour un profil, le niveau décrit tous ses droits du domaine ; les droits de base (voir le planning ou les engins, par exemple) ne s'y règlent pas.

**Droits sans effet.** « Voir les motifs d'absence » et « Voir l'annuaire » n'ouvrent rien dans l'appli : ni Réglages, ni les paquets, ni « Ce que ce rôle permet » ne les montrent ou ne les proposent. Un rôle ou un profil qui les a déjà les garde, sans effet (le chef de garde du jeu de départ porte encore le premier), et ils ne le rendent pas « Personnalisé ».

**Droits du centre.** « Gérer les accès », « Gérer les comités » et « Gérer les rôles » valent pour tout le centre. Ils ne se donnent qu'à un rôle tenu pour tout le centre. Sur un rôle tenu pour chaque équipe ou chaque comité, ces trois cases sont grisées et décochées, avec la raison, et suivent le choix « Tenu pour » fait à l'écran (sans JavaScript, seulement après l'enregistrement) ; un droit déjà porté part à l'enregistrement, et « Tout revenir » ne les rend pas. Le serveur refuse le reste, avec la raison (créer, modifier les droits ou changer pour qui le rôle est tenu). « Nommer » se donne à tout rôle : le rapporteur nomme dans son comité. Un profil ne donne aucun de ces droits.

**Doit toujours être tenu.** Un rôle qui doit toujours être tenu (chef de centre, chef de garde, référent technique) est une *fonction* dans le code ; les autres, confiés quand le centre en a besoin (référents pharmacie, engins, habillement, rôles de comité), sont des *missions*. L'interrupteur de l'identité écrit l'un ou l'autre. Ce que ça change :
- une fonction sans titulaire est rappelée au chef de centre et à l'adjoint dans « À décider » (« Chef de centre adjoint : aucun titulaire ») et marquée « À pourvoir » en orange dans les réglages et dans Qui fait quoi, et comptée sur Caserne ; une mission sans titulaire n'est ni rappelée ni comptée, et porte « Sans titulaire » en gris ;
- « Qui fait quoi » et la fiche d'un agent rangent les rôles toujours tenus avant les autres (« Autres rôles toujours tenus », puis « Autres rôles »).

Ce réglage ne change aucun droit.

**Les modèles** (« Nouveau rôle ») sont fixés par l'appli : Référent matériel (Engins : Gérer), Référent pharmacie (Stock : Gérer), Référent habillement (aucun droit, reçoit les demandes de tenue), Référent technique (gérer les rôles et les comités ; pas toujours tenu, comme les autres référents), Membre de comité, Rapporteur de comité (nommer, dans son comité), Vierge (aucun droit). Le rôle créé en reprend les droits ; le formulaire est prérempli avec le nom, « Doit toujours être tenu », « Tenu pour » et l'icône du modèle, qui se changent, comme qui nomme. Un modèle qui porte un droit d'administration (Référent technique, Rapporteur de comité) porte « Réservé au chef de centre, à son adjoint et au super administrateur » pour les autres, sans pouvoir être choisi.

Exemple : le chef de centre crée « Référent pharmacie 2 » depuis le modèle « Référent pharmacie ». Il met « Stock et pharmacie » à « Rien de plus » : le rôle devient « Personnalisé ». Il se ravise : « Revenir au modèle » remet « Gérer », la pastille disparaît, il enregistre.

**Le rapporteur** d'un comité est qui y tient un rôle tenu pour chaque comité donnant le droit de nommer.

**Qui nomme** à un rôle : le chef de centre, un comité choisi, ou, pour un rôle tenu pour chaque comité, son comité lui-même (cas du membre et du rapporteur).

**Droits de pouvoir et droits métier** :

| Groupe | Droits |
|---|---|
| Pouvoir | `GERER_ACCES`, `ATTRIBUER_RESPONSABILITE`, `GERER_LISTES`, `GERER_COMITES` |
| Métier | tous les autres (planning, stock, anomalies, salons et les autres) |

**Qui peut quoi** :

- `GERER_COMITES` sur le centre gère les comités ; `GERER_LISTES` sur le centre gère les responsabilités. Chacun ne voit que la liste qu'il gère ; les autres agents n'ont pas la page.
- Le **référent technique** (responsabilité du jeu de départ, attribuée par le chef de centre, avec ces deux droits) met en place ce que le comité ou le chef a décidé. Il ne distribue que des droits métier : il ne coche ni ne décoche un droit de pouvoir, et ne modifie ni n'archive une responsabilité qui en porte un, la sienne comprise. Il peut dissoudre un comité.
- Le **chef de centre**, son **adjoint** et le **super administrateur** font tout, droits de pouvoir compris.

**Règles** :

- Rien n'est supprimé : on dissout un comité, on archive une responsabilité ; ils restent dans « Archivés » et ne sont plus proposés. On ne les réactive pas.
- Noms uniques (comités entre eux, responsabilités entre elles), sans tenir compte des majuscules : « amicale » est refusé si « Amicale » existe, même parmi les anciens. 60 caractères au plus.
- Les responsabilités système (chef de centre, adjoint, chef de garde) ne s'archivent pas et leur page est en lecture seule ; leurs droits verrouillés ne se retirent pas.
- La portée ne change pas tant que quelqu'un tient la responsabilité, aujourd'hui ou plus tard.

**Effets d'une dissolution ou d'un archivage**, le jour même, après une case « Je confirme » :

- les attributions en cours (sur ce comité, ou de cette responsabilité) s'arrêtent la veille : leurs droits disparaissent dès aujourd'hui. Celles qui commencent aujourd'hui ou plus tard sont supprimées ;
- un comité dissous n'attribue plus rien : les responsabilités de centre ou d'équipe qu'il attribuait passent au chef de centre. Tant qu'il attribue une responsabilité de portée « comité » en cours, il ne se dissout pas : on change d'abord qui l'attribue (message « Changez d’abord qui nomme au rôle », suivi de son nom) ;
- le journal note l'action et le nombre d'attributions closes.

Exemple : le comité « Sport » attribue « Référent sport », avec le droit « Gérer le stock ». Le comité est dissous le 3 mars : son rapporteur perd ses droits dès le 3 mars, et « Référent sport » est désormais attribué par le chef de centre. Si « Sport » attribuait une responsabilité de portée « comité », il faudrait d'abord confier cette attribution à un autre comité.

## Super administrateur

- C'est le compte technique du centre : il possède les comptes Cloudflare et Brevo, et son compte GitHub administre le dépôt de l'appli. Pour Laillé : `cislaille35@gmail.com`. Le dépôt appartient à l'organisation GitHub [`gyro-caserne`](https://github.com/gyro-caserne/gyro-caserne) de l'auteur (décision [0040](../decisions/0040-licence-proprietaire.md)).
- Il nomme le chef de centre. À l'installation, il peut aussi reprendre l'organisation réelle du centre : comités, membres, responsabilités.
- **Passation** : on change le mot de passe de la boîte du centre, on remplace les clés (Cloudflare, Brevo, secrets de l'appli) et on ferme ses sessions. La procédure pas à pas sera dans `docs/technique/`.

## Ce qui est tracé

Le journal garde chaque ajout ou retrait d'adresse, chaque changement de profil ou de statut opérationnel, chaque attribution, et chaque création, modification, dissolution ou archivage d'un comité ou d'une responsabilité, avec son auteur et sa date. Le chef de centre et l'adjoint le lisent dans le suivi du centre.

## Ce que la fonction ne fait pas

- Pas de vote ni de validation à plusieurs dans l'appli : le comité décide en réunion.
- Pas de compte partagé entre agents. Seule la réserve citoyenne peut avoir une adresse commune : on demande alors le nom de la personne à chaque réservation.

## Exemple

Une recrue arrive dans l'équipe 2. Le chef de centre l'ajoute (Caserne → Agents → « Ajouter ») avec le profil Agent, dans l'équipe 2. Son adresse étant désormais autorisée, la recrue demande elle-même, sur la page de connexion, son lien ou son code à 6 chiffres, qu'elle reçoit par courriel. Trois mois plus tard, le comité du centre la nomme référente pharmacie : son rapporteur enregistre l'attribution, « du 1er février, sans date de fin ».

## Exemple : les retraités

Le chef de centre crée le comité « Retraités », puis le profil « Retraité » (type Extérieur) avec le mur Retraités et le mur Amicale en écriture. Quand Paul prend sa retraite, il change son profil sur sa fiche (Parcours, Profil) au lieu de déclarer son départ. La fiche dit ce qu'il quitte (« Paul Durand quitte Équipe 2 et perd son rôle de Membre de comité (Amicale). ») et demande « Je confirme ». Son équipe et ses rôles finissent la veille, ses remplacements et échanges et ses réservations sont annulés, comme ses demandes aux référents qui n'ont pas dépassé « Prise en compte », et il sort des groupes de messagerie. Sa fiche, ses notifications et ses conversations à deux restent, et il n'est jamais effacé. Un extérieur ne tient pas de rôle de comité : un agent ou le chef anime le comité Retraités. Le chef de centre et l'adjoint ne passent pas à un profil extérieur. Ce passage se fait sur la fiche, pas par le fichier de l'effectif.

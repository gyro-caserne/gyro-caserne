# Demandes aux référents (C1) : design

Sujet C du lot « comités », en deux temps choisis par le porteur le 23/11/2026 ; design validé par lui le même jour :
- **C1**, ce document : un système commun de demandes, pour les référents qui en reçoivent (pharmacie et matériel d'abord). L'habillement n'y entre pas encore.
- **C2**, lot court ensuite : les demandes d'habillement passent dans le système commun, puis l'ancien code est retiré. La migration est essayée sur une copie de la base de production.

## Pourquoi

L'habillement marche bien en production : un agent demande en texte libre, le référent suit la demande jusqu'au bout, et l'agent est prévenu à chaque étape. Le porteur veut la même chose pour les autres référents, avec des étapes que le référent ou les chefs règlent eux-mêmes. À terme, il ne veut plus qu'un seul système.

## Décisions du porteur

- Les premiers référents visés sont la pharmacie et le matériel.
- Les étapes intermédiaires se règlent par rôle, par le référent ou par les chefs.
- L'habillement rejoindra ce système commun (C2), avec la reprise de ses demandes existantes.

## Le réglage, par rôle

- **Où** : Réglages → Rôles, sur un rôle de portée centre. Une case « Reçoit des demandes ».
- **Étapes** : une fois la case cochée, on règle la liste ordonnée des étapes intermédiaires. On peut en ajouter, en renommer, en déplacer et en retirer. Il y en a 0 à 6, de 30 caractères au plus.
- **Dernière étape** : on peut la renommer (par défaut « Faite », par exemple « Livrée »).
- **Étapes fixes** : « Demandée » et « Prise en compte » au début, « Refusée » et « Annulée » à la fin. Elles ne se renomment pas.
- **Qui règle** :
  - le chef, l'adjoint et qui a le droit de gérer les rôles ;
  - les titulaires en cours du rôle, mais seulement pour ses étapes et sa dernière étape.
- **Retirer une étape** : refusé tant qu'une demande en cours s'y trouve. On peut toujours la renommer, et les demandes suivent le nouveau nom.
- **Décocher « Reçoit des demandes »** : refusé tant que des demandes sont en cours.
- **Journal** : chaque changement de réglage y figure.

## Choix de Claude après relecture (à vérifier par le porteur)

- **Question posée** : c'est un drapeau sur la demande, pas une étape. La demande reste à son étape, par exemple « Commandée », et la réponse de l'agent lève le drapeau. Une question est donc possible à toute étape avant la fin, ce dont C2 aura besoin.
- **Déplacer une étape** : c'est permis. « Jamais en arrière » se juge sur l'ordre du moment : le référent peut aller vers toute étape placée après l'étape actuelle.
- **Archiver un rôle qui a des demandes en cours** : c'est refusé, comme décocher la case.
- **Rôles qui reçoivent des demandes** : jamais les rôles système (chef de centre, adjoint, chef de garde). Pendant C1, pas non plus le rôle qui a le droit de gérer l'habillement, pour éviter deux circuits avant C2.
- **Mise en route** : rien n'est coché sur les rôles déjà en production, et c'est le chef qui coche la pharmacie et le matériel. Aucune donnée réelle n'est écrite. Pour un nouveau centre, les modèles « Référent pharmacie » et « Référent matériel » arrivent cochés, sans étape intermédiaire.
- **Accueil du chef et de l'adjoint, sans titulaire** : les demandes apparaissent dans « Le centre », comme pour l'habillement. Elles sont lues dans le batch existant et prises dans le banc des temps de calcul.

## Le parcours d'une demande

1. **Demandée** :
   - **Où** : l'agent va dans Caserne → « Faire une demande », choisit à qui (les rôles qui reçoivent des demandes, avec leur icône) et écrit sa demande en un seul champ de texte libre.
   - **Combien** : il peut en avoir plusieurs en cours.
2. **Prise en compte** par un titulaire du rôle :
   - **Ce que voit l'agent** : qui suit sa demande.
   - **Chez les autres titulaires** : la demande sort de leur liste « à prendre en compte ».
   - **Question posée** : le référent peut poser une question, à toute étape avant la fin. La demande reste à son étape, et la réponse de l'agent lève la question. C'est possible autant de fois qu'il faut.
3. **Étapes intermédiaires** : le référent fait avancer la demande. Il peut **sauter des étapes**, mais jamais revenir en arrière. C'est ce qui permettra à l'habillement de passer par « En stock » ou par « Commandée au SDIS ».
4. **Fin** : la demande s'arrête sur l'une de ces étapes.
   - **Dernière étape** (« Faite », « Livrée »…), avec un mot facultatif, par exemple « Dans votre casier ».
   - **Refusée**, avec un mot obligatoire.
   - **Annulée** par l'agent, avec confirmation, tant que la demande n'a pas dépassé « Prise en compte ».
- **Le fil** : sous la demande, les questions, les réponses, les précisions et les changements d'étape, dans l'ordre. L'agent ajoute une précision tant que la demande n'est pas finie.
- **Je la reprends** : un autre titulaire, le chef ou l'adjoint reprend d'un geste une demande suivie par un absent. La reprise est notée dans le fil, et le collègue est prévenu.

## Qui voit, qui agit

- **Demander** : tout agent connecté. Pas les extérieurs (retraités, réserve citoyenne), ni le super administrateur.
- **Voir une demande** : son auteur, les titulaires du rôle, le chef et l'adjoint.
- **Agir sur une demande** : les titulaires en cours du rôle, le chef et l'adjoint. Ces deux derniers peuvent toujours agir, pour qu'une demande ne reste jamais bloquée.
- **Sans titulaire** : quand le rôle n'a aucun titulaire en cours, le chef et l'adjoint reçoivent ses demandes.

## Notifications (cloche et téléphone)

Les règles sont celles de l'habillement (`docs/fonctionnel/habillement.md`), rôle par rôle :
- **L'agent** est prévenu à chaque étape et à chaque question.
- **Les titulaires** reçoivent les nouvelles demandes, et la réponse ou la précision de l'agent va à celui qui suit la demande.
- **Le chef et l'adjoint** ne reçoivent rien, sauf si le rôle n'a pas de titulaire.

## Points d'entrée

- **Caserne → Faire une demande** : la nouvelle demande, puis « Mes demandes » (en cours, puis terminées). L'habillement garde son entrée propre jusqu'à C2.
- **Accueil, casquette du rôle** : dans « À décider », les demandes à prendre en compte et celles dont la réponse est arrivée, plus un lien vers toutes les demandes du rôle.
- **Comités et référents** : on peut faire une demande depuis la fiche d'un référent qui en reçoit.

## Conservation

Une demande finie est effacée avec son fil 24 mois après sa fin, par la tâche de nuit, comme pour l'habillement.

## Approches

1. **Retenue par le porteur** : un système commun neuf (C1), puis la reprise de l'habillement (C2). Chaque temps se vérifie à part, et la pharmacie et le matériel sont utilisables dès C1.
2. **Tout en un seul lot** : écartée. Le lot serait plus gros, et une erreur de reprise bloquerait aussi la pharmacie et le matériel.
3. **Transformer les tables de l'habillement** : écartée. Il faudrait renommer et changer des tables en production, ce qui est plus risqué sur D1.

## Contraintes

- **Temps de calcul** (offre gratuite Cloudflare, 10 ms) :
  - **Les réglages** (case, étapes, dernière étape) sont rangés sur le rôle, dans une colonne lue avec les rôles. Ils ne coûtent aucune requête de plus.
  - **L'accueil d'un titulaire** lit ses demandes dans le batch existant, sans aller-retour de plus. Pour un agent sans casquette de demandes, rien ne change.
  - **Les budgets** restent verts sans relever les plafonds. On fait un banc avant et après sur l'accueil d'un agent, l'accueil d'un référent et la liste des demandes.
- **Base** : nouvelles tables (demande, fil, avis de cloche) et nouvelle colonne sur `responsabilite`, par une migration qui ne fait qu'ajouter. Rien ne touche aux tables de l'habillement dans C1.
- **Pensé pour C2** : les étapes d'une demande se repèrent par un identifiant stable, pas par leur nom, pour que la reprise de l'habillement les retrouve.
- **Charte et journal** : la charte s'applique strictement, sans aucun marqueur d'interface générée. Les actions vont dans `ACTIONS` et les gestes au journal.

## Ce qui reste au constructeur

- Les noms des tables, des colonnes et des fonctions.
- La forme exacte des écrans, dans la charte.
- La factorisation avec le code de l'habillement : la réutilisation est bienvenue, à condition que l'habillement ne change pas de comportement dans C1.

## Hors du sujet

- La reprise de l'habillement (C2).
- Un inventaire, des pièces jointes ou des photos.
- La validation d'une demande par le chef avant son traitement.
- Les demandes adressées à un comité.

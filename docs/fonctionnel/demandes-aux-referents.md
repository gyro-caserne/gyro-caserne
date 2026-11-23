# Demandes aux référents

> **Livré** (C1) : les demandes aux référents qui en reçoivent, la pharmacie et le matériel d'abord, avec des étapes réglées par rôle. Cadrage : [la spec](../superpowers/specs/2026-11-23-demandes-referents-design.md), qui l'emporte en cas d'écart. Depuis C2, l'habillement y est repris (décision 0044, [habillement.md](habillement.md)).

## À quoi ça sert

Un agent demande ce qu'il lui faut à un référent, en texte libre, et suit sa demande jusqu'au bout, comme pour l'habillement. Chaque rôle règle les étapes par lesquelles passent ses demandes.

## Le réglage, par rôle

- **Où** : Réglages, Rôles, la page du rôle, bloc **Demandes**. Les titulaires du rôle règlent aussi ses étapes depuis sa liste de demandes (**Régler les étapes**).
- **Reçoit des demandes** : une case, pour un rôle de tout le centre. Jamais un rôle système (chef de centre, adjoint, chef de garde). Le référent habillement reçoit des demandes depuis C2, avec ses étapes En stock et Commandée au SDIS, puis Livrée.
- **Étapes** : de 0 à 6 étapes intermédiaires, de 30 caractères au plus, qu'on ajoute, renomme, monte, descend ou retire. La **dernière étape** se renomme (« Faite » par défaut, par exemple « Livrée »).
- **Étapes fixes** : « Demandée » et « Prise en compte » au début, « Refusée » et « Annulée » à la fin. Elles ne se renomment pas, et une étape réglée ne prend pas leur nom.
- **Qui règle** : le chef, l'adjoint et qui gère les rôles (le référent technique) ; les titulaires en cours, seulement les étapes et la dernière.
- **Garde-fous** : une étape où se trouve une demande en cours ne se retire pas (elle se renomme, et les demandes suivent le nouveau nom). Le rôle ne se décoche pas, et ne s'archive pas, tant que des demandes sont en cours. Décoché, il garde son réglage : recoché, il le retrouve. Deux réglages au même moment : un seul s'écrit, l'autre est refusé.
- **Journal** : chaque réglage y figure, et dans le suivi du centre, comme la prise en compte, la reprise, la question, chaque étape, la fin, le refus et l'annulation.
- **Au départ** : rien n'est coché sur les rôles d'un centre déjà installé, le chef coche la pharmacie et le matériel. Un nouveau centre a le référent pharmacie et le référent engins cochés, sans étape intermédiaire ; de même pour un rôle créé à partir des modèles pharmacie et matériel.

## Le parcours d'une demande

1. **Demandée** : l'agent va dans Caserne, puis **Faire une demande**, choisit à qui et écrit sa demande en un seul champ. Il peut en avoir plusieurs en cours.
2. **Prise en compte** par un titulaire : l'agent voit qui la suit, et elle sort de la liste « à prendre en compte » des autres titulaires.
3. **Étapes intermédiaires** : le référent fait avancer la demande vers une étape placée après l'étape actuelle, dans l'ordre du moment. Il peut en sauter, jamais revenir en arrière.
4. **Fin** : la dernière étape, avec un mot facultatif (« Dans votre casier ») ; **Refusée**, avec un mot obligatoire ; ou **Annulée** par l'agent, avec confirmation, tant qu'elle n'a pas dépassé « Prise en compte ».

- **Question posée** : à toute étape avant la fin, le référent pose une question. La demande reste à son étape ; la réponse de l'agent lève la question. Une seule question attend sa réponse à la fois.
- **Le fil** : sous la demande, les questions, réponses, précisions et changements d'étape, dans l'ordre. L'agent ajoute une précision tant que la demande n'est pas finie.
- **Je la reprends** : un autre titulaire, le chef ou l'adjoint reprend d'un geste une demande suivie par un absent ; c'est noté au fil et le collègue est prévenu.

## Qui voit, qui agit

- **Demander** : tout agent connecté ; pas les extérieurs (retraités, réserve citoyenne), ni le super administrateur.
- **Voir** : l'auteur, les titulaires en cours du rôle, le chef et l'adjoint (le super administrateur en lecture).
- **Agir** : les titulaires en cours, le chef et l'adjoint, pour qu'une demande ne reste jamais bloquée. Un titulaire ne traite pas sa propre demande : les autres titulaires (seul, le chef et l'adjoint) s'en chargent. Un titulaire dont le rôle a pris fin ne voit plus et n'agit plus.
- **Sans titulaire** : le chef et l'adjoint reçoivent les demandes du rôle.

## Notifications (cloche, téléphone, e-mail)

- **L'agent** : à chaque étape et à chaque question. Ouvrir sa demande marque ces notifications lues.
- **Les titulaires** : chaque nouvelle demande (aussi par e-mail, sauf s'ils l'ont coupé). La réponse ou la précision de l'agent va à qui la suit ; tant que personne ne la suit, aux titulaires.
- **Le chef et l'adjoint** : rien, sauf si le rôle n'a pas de titulaire (ou si son seul titulaire demande pour lui-même).

## Points d'entrée

- **Caserne, Faire une demande** : la nouvelle demande, mes demandes (en cours, puis terminées), et les **demandes reçues** de mes rôles (tous les rôles pour le chef et l'adjoint), avec leur nombre en cours.
- **Accueil, casquette du rôle** : dans « À décider », les demandes à prendre en compte et celles qu'on suit dont la réponse est arrivée ; puis **Toutes les demandes**. Sans titulaire, la même chose dans « Le centre » du chef et de l'adjoint.
- **Comités et référents** : **Demander** sur la ligne d'un rôle qui reçoit des demandes.

## Conservation

Une demande finie est effacée avec son fil 24 mois après sa fin, par la tâche de nuit, comme pour l'habillement. Au départ d'un agent, ou à son passage en retraité, ses demandes qui n'ont pas dépassé « Prise en compte » sont annulées au nom de qui fait le geste, et qui les suivait est prévenu. À l'effacement d'un agent parti (12 mois après), ses demandes et leur fil sont effacés ; il ne suit plus celles des autres, et ses lignes au fil des autres restent sous « Ancien agent ».

## Exemple

Le chef coche « Reçoit des demandes » pour le référent pharmacie, avec une étape « Commandée » et une dernière étape « Livrée ». Alice demande « Compresses stériles, la boîte du VSAV est vide ». Paul, référent pharmacie, la voit dans sa casquette, la prend en compte et demande « En 10 x 10 ? ». Alice répond « Oui ». Paul la passe à « Commandée », puis à « Livrée », avec le mot « Dans le placard de la pharmacie ». Alice a été prévenue à chaque étape.

# L'habillement dans les demandes aux référents (C2) : design et plan

Second temps du sujet C, après C1 (#122). Design validé par le porteur le 23/11/2026.

## Pourquoi

Le porteur veut un seul système de demandes. L'habillement, en production depuis novembre, passe dans le système commun de C1 sans rien perdre, puis son code propre est retiré.

## Décisions du porteur

- **Le rôle** : « Référent habillement » reçoit des demandes. Il a deux étapes intermédiaires, **En stock** et **Commandée au SDIS**, et une dernière étape, **Livrée**. Le référent saute l'une des deux selon le cas.
- **La reprise des demandes** : toutes les demandes d'habillement sont recopiées avec leur fil.
  - Question posée devient « Prise en compte » avec la question en attente.
  - Traitée devient « En stock » ou « Commandée au SDIS », selon son issue.
  - Livrée devient « Livrée », et le lieu devient le mot de fin.
  - Refusée et annulée ne changent pas.
- **Les notifications** : les notifications d'habillement non lues sont reprises.
- **L'entrée de l'appli** : « Caserne → Habillement » devient un raccourci vers « Faire une demande », avec le référent habillement déjà choisi. L'ancien code de l'habillement est retiré.
- **Sécurité des données** :
  - la migration **ne supprime rien**, les anciennes tables restent intactes mais ne servent plus ;
  - leur suppression viendra dans un lot à part, au moins une semaine plus tard, avec l'accord du porteur ;
  - on essaie sur la préprod (demandes fictives des comptes de test, tous les états), et des tests couvrent chaque état ;
  - après la mise en production, on compare le nombre de demandes avant et après (des nombres seulement) ;
  - en cas de souci, le Time Travel de D1 sert de filet (7 jours).
- **Pas d'essai sur une copie de la production** : les données réelles ne sortent pas de Cloudflare.

## Plan (un sous-agent, TDD, commit + push à chaque étape verte, journal `/home/maxvm/suivi-c2.log`)

1. **Migration 0036**, qui ne fait qu'ajouter, en SQL :
   - **Le réglage** sur le rôle qui reçoit l'habillement : le rôle système ou le modèle `referent_habillement`, sinon le rôle de centre non archivé qui porte `GERER_HABILLEMENT`, hors rôles système. Les identifiants d'étape sont stables, par exemple `stock` et `commande`.
   - **La recopie** des demandes, du fil et des avis non lus dans les tables de C1, avec la correspondance des états. Les dates, les auteurs, qui suit la demande et les fins sont gardés.
   - **Les cas limites** : sans rôle cible, on ne recopie rien et la migration le dit. Une migration rejouée ne doit rien dupliquer.
   - **Le test** de la migration : une base avec une demande dans chaque état. On compare les nombres avant et après, état par état, avec le fil et les avis.
2. **Le socle** :
   - lever l'interdiction de C1, puisqu'un rôle qui porte `GERER_HABILLEMENT` peut maintenant recevoir des demandes ;
   - le chef et l'adjoint gardent la main, comme dans C1 ;
   - retirer `habillement.ts` et ses usages (accueil, casquettes, notifications, ménage de nuit, départ, passage en extérieur, comptes de test) ;
   - garder les tables dans le schéma, notées « ancienne, ne plus écrire ».
3. **L'appli** :
   - `/habillement` redirige vers `/demandes?role=<id du rôle habillement>`, avec le rôle déjà choisi, et Caserne garde le lien « Habillement » ;
   - les anciennes adresses `/habillement/[id]` mènent à la demande recopiée, ou à « Mes demandes » si on ne la retrouve pas ;
   - retirer les écrans de l'habillement.
4. **Comptes de test** : ils créent des demandes d'habillement dans le nouveau système. On ajoute un compte « retraité » et un « référent pharmacie », avec la pharmacie cochée.
5. **Documentation** : `docs/fonctionnel/habillement.md` renvoie aux demandes aux référents, avec la correspondance des états. On écrit la décision 0044, et on met à jour l'aide et la technique.
6. **Vérifications** :
   - budgets verts sans relever de plafond, et banc avant/après de l'accueil d'un agent et de l'accueil d'un référent ;
   - e2e de l'habillement adapté ;
   - captures au téléphone de la demande d'habillement et du réglage du rôle ;
   - relecture indépendante, avec le modèle le plus capable puisqu'il y a une migration de données, puis retours traités en une vague ;
   - description de la PR au format compte rendu ;
   - dans la PR, la requête de comptage avant/après à lancer en production, qui ne montre que des nombres.

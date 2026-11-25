# Anomalies

> **Livré (lot C des engins)** : le suivi des anomalies des engins, voir « Ce que fait le lot C » plus bas. Les parties « Les notions » et « Le déroulé » décrivent aussi la cible : pas encore d'anomalie hors engin (sac, local, matériel), de catégories (pharmacie, bâtiment…), de priorité, de dates de départ et de retour du garage, de réouverture. Cadrage : [la spec](../superpowers/specs/2026-11-02-engins-design.md), qui l'emporte en cas d'écart.

## À quoi ça sert

Signaler un problème (sur un engin, un contenant comme un sac, un local ou du matériel), le faire réparer et savoir à tout moment ce qui est en cours et ce qui empêche d'utiliser un engin.

## Les notions

- **Objet concerné** : un engin, un contenant (un sac, par exemple), un local ou du matériel.
- **Catégorie** (liste ouverte) : engin, pharmacie, bâtiment, amicale… Elle **décide qui est prévenu**, par exemple le référent pharmacie pour une anomalie de la catégorie pharmacie. Livré pour les anomalies de prise de garde, par la zone de la fiche (voir « Prévenus selon la zone »).
- **Effet sur l'engin**, seulement pour un engin ou un contenant :
  - **bloquant** : l'engin est indisponible jusqu'à sa remise en service ;
  - **avertissement** : l'engin reste utilisable, mais un bandeau prévient tous ceux qui l'ouvrent (« Treuil HS, ne pas utiliser ») ;
  - **aucun**.
- **Priorité de traitement** : faible, normale ou haute. Elle est indépendante de l'effet sur l'engin. L'appli propose « haute » quand c'est bloquant, mais on peut la changer.

## Le déroulé

Les étapes sont fixes. Le centre active ou non les étapes « en attente » et « vérifiée », et peut renommer les libellés.

1. **Signalée** : depuis une prise de garde ou directement, avec une photo et une note.
2. **Prise en charge** : un agent compétent se l'attribue (droit `PRENDRE_EN_CHARGE_ANOMALIE`). Par défaut, tout agent peut le faire ; le centre peut réserver ce droit à une responsabilité, par exemple référent engins.
3. **En attente**, avec un motif visible dans la liste : pièce commandée, au garage, prestataire. La date de départ et la date de retour sont notées.
4. **Réparée** : sur place ou au retour du garage, avec ce qui a été fait. Enregistrer la réparation **clôt l'anomalie** aussitôt : elle passe dans les closes, avec l'étape « Réparée ».
5. **Vérifiée** par une autre personne que celle qui a réparé, seulement si le centre active cette étape. Elle est alors close à « Vérifiée », pas à « Réparée ».
6. **Close** : ce n'est pas un geste de plus, sauf **sans réparation** (signalée deux fois, sans objet), par qui a le droit `TRAITER_ANOMALIE`. Pour un engin indisponible, l'appli rappelle : « Remettre <engin> en service est une décision à part. », avec le bouton **« Remettre en service »** : une autre anomalie peut rester bloquante.

Une anomalie close ne se rouvre pas : si le problème revient, on en signale une nouvelle. L'auteur est prévenu à la prise en charge et à la clôture ; la personne qui l'a prise en charge, de chaque geste d'un autre.

## Les règles

- Un engin n'est indisponible que **par décision** (« Rendre l'engin indisponible » depuis une anomalie, qui devient bloquante). Il le reste jusqu'à « Remettre en service », qui lève toutes ses anomalies bloquantes.
- **Pas d'indisponibilité automatique** parce qu'une vérification est en retard : ça crée de faux arrêts.
- Une prise de garde ne crée pas d'anomalie en double sur un élément qui en a déjà une ouverte.
- Quand la prise de garde suivante retrouve l'élément en ordre, l'appli propose de clore l'anomalie.

## Ce que la fonction ne fait pas

- Pas de gestion du garage ni des devis : l'anomalie note seulement le départ et le retour.
- Pas de commande de pièces.

## Exemple

À la prise de garde du VSAV, l'agent note le kit douleur du Sac PS utilisé. Le Sac PS prévient le référent pharmacie : les trois référentes pharmacie et le chef de garde reçoivent l'anomalie, pas le référent engins. Une référente la prend en charge, remplace le kit et la clôt.

À la prise de garde, l'agent trouve le treuil du VTU en panne. Il le signale en avertissement : le VTU reste disponible, avec le bandeau « Treuil HS ». Le référent engins prend l'anomalie en charge et la met en attente, motif « au garage ». Au retour, il enregistre la réparation : l'anomalie est close. Le bandeau disparaît.

## Ce que fait le lot C

- **Signaler** : à la prise de garde (chaque écart devient une anomalie), ou directement depuis l'engin ou la liste des anomalies : **Signaler un problème**, l'engin, une phrase, « C'est » manquant, abîmé ou à remplacer, puis « Signaler » (note et photo facultatives). L'engin **reste disponible**.
- **Prévenus** : le référent engins, le chef de centre et son adjoint, et le chef de garde de l'équipe d'astreinte (cloche et téléphone). Ensuite, le déclarant apprend la prise en charge et la clôture, et celui qui l'a prise en charge, chaque geste d'un autre. L'e-mail ne part qu'à qui ne la reçoit pas au téléphone.
- **Prévenus selon la zone** : une zone d'une fiche peut nommer les rôles à prévenir (« Prévenir : Référent pharmacie » sur le Sac PS). Une anomalie signalée à la prise de garde sur un élément de cette zone prévient alors tous les titulaires de ces rôles et le chef de garde d'astreinte ; le référent engins seulement si son rôle est choisi. Personne ne tient un rôle choisi : le chef de centre et l'adjoint sont prévenus à sa place. Une zone sans réglage, ou un signalement hors fiche, garde la règle ci-dessus. Chacun reçoit un avis avec ses seules anomalies ; le chef de garde, toutes.
- **Les rôles prévenus** d'une zone prennent en charge ses anomalies, les commentent et les closent (le matériel remplacé). Rendre l'engin indisponible ou le remettre en service reste à ceux qui traitent les anomalies. La fiche d'un rôle (Réglages, puis Rôles) dit pour quelles zones il est prévenu : « Prévenu pour Sac PS (VSAV, CCRM) ».
- **Suivre** : Caserne → Anomalies (ou Engins → Anomalies, ou la page de l'engin) : les ouvertes d'abord, engin par engin, avec leur étape ; puis les closes récentes. La page d'une anomalie montre les étapes du centre, l'historique (qui, quand, quoi) et les gestes permis : **Je la prends en charge** d'un toucher ; **Mettre en attente…** (pièce commandée, au garage, chez un prestataire), **Réparée…** (ce qui a été fait ; l'anomalie est alors close, sauf étape « vérifiée »), **Clore sans réparation…** (qui traite) ouvrent chacun un panneau avec leur formulaire, qui se ferme une fois l'envoi fait.
- **Décider** (référent engins, chefs de garde, chef de centre et adjoint) : **Rendre l'engin indisponible** depuis l'anomalie ; une fois close, **Remettre en service**, décision à part. Jamais d'indisponibilité automatique.
- **Sur l'engin** : un bandeau « Avertissement : 1 anomalie ouverte » (ou « VTU est indisponible ») avec chaque anomalie et son étape ; dans la liste des engins, l'état écrit : Disponible, Avertissement ou Indisponible.
- **À la relève suivante**, la prise montre l'étape de chaque anomalie ouverte ; « Oui, clore le signalement » la clôt (retrouvée), et le déclarant est prévenu.
- **Accueil, « À décider »** pour ceux qui traitent : « 2 anomalies signalées à prendre en charge : VSAV 1, VTU » et « VTU indisponible, anomalie close : remettre en service ? ».
- **Réglage du centre** (dans son fichier de description) : étape « en attente » (oui par défaut), étape « vérifiée » par une autre personne (non par défaut), libellés des étapes.

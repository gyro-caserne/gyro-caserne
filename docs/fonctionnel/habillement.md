# Habillement

> **Repris dans les demandes aux référents** depuis C2 (décision [0044](../decisions/0044-habillement-dans-les-demandes.md)). Tout est décrit dans [Demandes aux référents](demandes-aux-referents.md). Cadrage : [la spec](../superpowers/specs/2026-11-23-habillement-dans-demandes-design.md).

## Ce qui change

- **Caserne → Habillement** ouvre « Faire une demande », le référent habillement déjà choisi.
- Le rôle « Référent habillement » reçoit des demandes, sans droit propre, avec deux étapes intermédiaires, **En stock** et **Commandée au SDIS**, et une dernière étape, **Livrée**. Le référent saute l'une des deux selon le cas. Ces étapes se règlent comme pour tout rôle (Réglages → Rôles).
- Le chef de centre et l'adjoint agissent toujours, et reçoivent les demandes quand le rôle n'a aucun titulaire.
- Les anciennes adresses (`/habillement/12`, dans une notification ou le suivi du centre) mènent à la demande reprise, sinon à « Mes demandes ».

## La reprise des demandes existantes

Toutes les demandes d'habillement sont recopiées avec leur fil, leurs dates, leur auteur et qui les suit. Les notifications non lues sont reprises.

| Avant | Après |
|---|---|
| Demandée | Demandée |
| Prise en compte | Prise en compte (réponse à lire si l'agent a répondu à la dernière question) |
| Question posée | Prise en compte, avec la question en attente |
| Traitée, en stock | En stock |
| Traitée, commandée au SDIS | Commandée au SDIS |
| Livrée | Livrée, le lieu devient le mot de fin |
| Refusée | Refusée, avec le mot du refus |
| Annulée | Annulée |

Il n'y avait pas de vraie demande en production : à la demande du porteur, les anciennes tables et le droit « Gérer l'habillement » sont supprimés dans le même lot, juste après la reprise (décision 0044).

## Exemple

Alice écrit « Veste textile en L, la mienne est déchirée à la manche ». Chloé, référente habillement, la prend en compte et demande « Plutôt en L ou en XL ? ». Alice répond « L ». Chloé la fait passer à **Commandée au SDIS**, puis, à l'arrivée du colis, à **Livrée** avec le mot « Dans votre casier ». Alice a été prévenue à chaque étape.

# Horaires de garde réglables par année, et durées du remplacement court (design)

Demande du porteur, cadre validé le 27/11/2026, sous la condition « si ce n'est pas lourd et que ça ne casse rien ».

## Pourquoi

Aujourd'hui, les horaires de garde sont fixés dans `centres/<id>/centre.ts`. Pour les changer, il faut un développeur et une mise en production :
- relève le vendredi à 18 h, fin à 6 h ;
- de 18 h à 6 h en semaine ;
- 24 h sur 24 le week-end et les jours fériés.

Les durées du remplacement court (2 h ou 3 h) sont fixées dans le code. Le porteur veut que le chef puisse les régler lui-même, sans rien casser.

## Ce qui change

**1. Horaires de garde, par année du planning**
- **Où** : Planning, puis Préparer l'année, à l'étape Roulement. Une partie « Horaires de garde » propose :
  - le jour et l'heure de la relève ;
  - l'heure de fin de l'astreinte ;
  - les horaires de semaine (début et fin) ;
  - « Astreinte continue le week-end et les jours fériés » (oui ou non) ;
  - un bouton « Garder les horaires du centre » pour revenir à ceux de `centre.ts`.
- **Modifiable seulement sur une année pas encore publiée.** Une année publiée garde ses horaires, en lecture seule, avec une phrase qui l'explique.
- **Par défaut**, une année reprend les horaires de `centre.ts`. Une année existante sans réglage se comporte exactement comme aujourd'hui.
- **Stockage** : une colonne JSON nullable `horaires` sur `annee_planning`. Vide veut dire les horaires du centre. Migration qui ne fait qu'ajouter.
- **Calcul** :
  - partout où le `Reglage` d'astreinte sert pour une année donnée, on utilise celui de l'année, c'est-à-dire ses horaires s'il y en a, sinon le centre ;
  - sont concernés l'astreinte, le planning, les remplacements et leurs tranches, l'été, les fêtes, l'agenda, la prise de garde et le réveil ;
  - **sans lecture de plus** : les horaires se lisent avec la ligne de l'année, déjà lue (`ordre`) ;
  - le passage d'une année à l'autre doit rester juste, y compris la relève qui chevauche deux années et la dernière semaine de l'année précédente (`semainesDe(annee - 1, …)`).
- **Garde-fous** :
  - la relève et la fin doivent former une semaine cohérente ;
  - les heures de semaine doivent être valides ;
  - un refus doit être clair.

**2. Durées du remplacement court**
- **Où** : Réglages, une ligne « Remplacement court », réservée au chef de centre et à l'adjoint (droit de gérer les listes). On y coche les durées proposées : 1 h, 2 h, 3 h ou 4 h. Par défaut, 2 h et 3 h, comme aujourd'hui. Il faut au moins une durée.
- **Effet** : seulement sur les nouvelles demandes. Les demandes en cours ne changent pas.
- **Stockage** : réglage du centre, à l'endroit où l'appli range déjà les réglages du centre (listes, paliers d'ancienneté…). Pas de lecture de plus sur les pages courantes.

## Ce qui ne change pas

- Les horaires d'une année publiée ne bougent pas : remplacements conclus, fêtes et été restent intacts.
- Pas de changement en cours d'année.

## Contraintes

- **Non-régression prouvée** : avec les horaires par défaut, les résultats sont strictement identiques à aujourd'hui pour l'astreinte, les tranches, le planning, l'été, les fêtes et l'agenda. Pour le vérifier, un test compare l'ancien et le nouveau calcul sur deux années entières et quatre profils, comme pour l'allègement de l'astreinte en #135.
- **Tests de calcul avec des horaires différents** : relève le lundi à 19 h, semaine de 19 h à 7 h, puis astreinte continue sans horaires de semaine.
- **Temps de calcul** : aucune requête de plus. Les budgets restent verts. Banc apparié avant et après pour l'accueil, le planning et les remplacements.
- **Textes** : aucun marqueur de texte généré (règle stricte du porteur), pas de menu « Plus », charte stricte.
- **Écrans** : téléphone et ordinateur. Captures de l'étape Roulement avec les horaires, et de Réglages, Remplacement court.
- **Livrables** :
  - doc : planning de l'année, remplacements, aide « Comment changer les horaires de garde ? » ;
  - une décision ;
  - un e2e court.

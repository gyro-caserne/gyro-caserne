# 0049, Horaires de garde réglables par année, durées du remplacement court

- **Contexte** : les horaires de garde (relève, fin, heures de semaine) et les durées du remplacement court étaient écrits dans le code. Les changer demandait un développeur et une mise en production. Spec : `docs/superpowers/specs/2026-11-27-horaires-de-garde-design.md`.
- **Choix** :
  - une colonne JSON `horaires`, vide par défaut, sur `annee_planning` ; vide veut dire les horaires de `centre.ts`, et le calcul garde alors l'objet du centre tel quel ;
  - le calcul prend le réglage de chaque année, lu avec les lignes de l'année déjà lues ; la dernière semaine d'une année court jusqu'à la première relève de la suivante quand leurs horaires diffèrent ;
  - réglables seulement sur une année non publiée, avec des garde-fous (été ouvert, dernière semaine de l'année d'avant commencée, semaines changées et autre jour de relève) ;
  - les durées du remplacement court dans `reglage_court` (une ligne, comme l'ancienneté), réglées avec `GERER_LISTES` ; seules les nouvelles demandes les suivent ;
  - migration 0041, qui ne fait qu'ajouter.
- **Lectures** : aucune de plus sur l'accueil, le planning et les remplacements. Deux exceptions voulues, hors de ces pages : la prise de garde relit une fois son batch quand les horaires de l'année déplacent la relève (jamais avec ceux du centre) ; au réveil de 8 h et 8 h 10, un jour qui n'est pas la veille de la relève du centre, une ligne (`annee_planning`) est lue pour savoir si l'année a la sienne demain. « Régler l'été » lit la ligne de l'année dans le même batch que l'été.
- **Écarts à la spec, à valider** : l'interrupteur dit « Astreinte continue toute la semaine » (sans heures de semaine) au lieu de « continue le week-end et les jours fériés » ; avec des heures de semaine, le week-end et les fériés restent continus, comme le calcul d'aujourd'hui. L'alerte de prise de garde en retard (accueil du chef) ne lit rien dans les trois heures qui suivent la relève du centre : avec une relève d'année plus tôt dans la journée, elle peut venir jusqu'à trois heures plus tard. L'ordre proposé suit la référence du centre (`ordrePropose`).
- **Pourquoi** : le chef règle lui-même, sans rien casser. Une garde compare les empreintes du calcul d'avant et d'après sur deux années entières et quatre profils.
- **Décisions prises en route, à valider** : voir la PR #136.
- **Validé par** : le porteur, le 27/11/2026 (design) ; le reste dans la PR.

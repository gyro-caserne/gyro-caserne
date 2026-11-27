# 0049, Horaires de garde réglables par année, durées du remplacement court

- **Contexte** : les horaires de garde (relève, fin, heures de semaine) et les durées du remplacement court étaient écrits dans le code. Les changer demandait un développeur et une mise en production. Spec : `docs/superpowers/specs/2026-11-27-horaires-de-garde-design.md`.
- **Choix** :
  - une colonne JSON `horaires`, vide par défaut, sur `annee_planning` ; vide veut dire les horaires de `centre.ts`, et le calcul garde alors l'objet du centre tel quel ;
  - le calcul prend le réglage de chaque année, lu avec les lignes de l'année déjà lues ; la dernière semaine d'une année court jusqu'à la première relève de la suivante quand leurs horaires diffèrent ;
  - réglables seulement sur une année non publiée, avec des garde-fous (été ouvert, dernière semaine de l'année d'avant commencée, semaines changées et autre jour de relève) ;
  - les durées du remplacement court dans `reglage_court` (une ligne, comme l'ancienneté), réglées avec `GERER_LISTES` ; seules les nouvelles demandes les suivent ;
  - migration 0041, qui ne fait qu'ajouter.
- **Pourquoi** : le chef règle lui-même, sans rien casser. Une garde compare les empreintes du calcul d'avant et d'après sur deux années entières et quatre profils.
- **Décisions prises en route, à valider** : voir la PR #136.
- **Validé par** : le porteur, le 27/11/2026 (design) ; le reste dans la PR.

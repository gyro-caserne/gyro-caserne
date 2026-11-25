# Raccourcis et finitions : plan

Design : [2026-11-25-raccourcis-design.md](../specs/2026-11-25-raccourcis-design.md). TDD à chaque tâche, commit et push à chaque étape verte.

## 1. Nouveau type depuis « Ajouter un engin »

1. Socle : `enregistrerEngin` accepte `nouveauType`. Le type (mêmes règles que `creerTypeEngin`, fiche vide en version 1) et l'engin s'écrivent dans un seul lot. Les contrôles du type passent dans une fonction commune.
2. Socle : l'armement connaît chaque type du centre (`armementDuCentre`, lu par la page d'armement seulement). Un type sans réglage part de CA 1 agrès, CE et agent. `lireArmement` ne change pas (planning).
3. Web : « Nouveau type » dans le choix du type, le champ du nom sur place ; l'action lit `nouveauType`.
4. Web : la page de l'engin, fiche vide et engin géré, montre « Compléter sa fiche de prise de garde » et « Régler son armement » (ce dernier pour qui gère les listes). Le droit n'est lu que dans ce cas.

## 2. « Part à la retraite » dans le départ

1. Web : action nommée `retraite` (profil extérieur, « Je confirme », mêmes suites que le bloc Parcours, refus du chef et de l'adjoint par le socle).
2. Web : dans « Départ du centre », deux choix (`ChoixRadio`) ; le profil des retraités préchoisi ; sans profil extérieur, une phrase et un lien vers Réglages, Profils.

## 3. Espace en bas de page

1. Jeton `--hauteur-navigation` ; `main` garde sous le contenu la barre, la zone de sécurité et `--espace-24`. Test du style et e2e « dernier élément visible ».

## 4. Carte « Étapes de vos demandes »

1. `etapesEnUneLigne` (Demandée, Prise en compte, intermédiaires, dernière), testée.
2. La carte en tête de `/demandes/role/[id]`, avec « Régler les étapes » qui se déplie dedans ; seulement pour qui règle.

## 5. Fin

e2e courts par geste, doc (fonctionnel, deux aides), captures, relecture par un sous-agent, PR prête et compte rendu.

## Décisions à valider

- L'armement ne connaissait que VSAV, VTU et FPT : il connaît désormais chaque type du centre, sinon « Régler son armement » mènerait nulle part.
- Les suites d'un engin s'affichent dans une carte « À compléter » en tête de sa page, tant que la fiche de son type est vide (en bas, elles passaient sous la barre au téléphone).
- « Régler son armement » n'apparaît qu'à qui gère les listes du centre (sinon le lien mènerait à un refus).
- « Part à la retraite » n'est proposé ni au chef ni à l'adjoint, ni à une personne déjà extérieure. Sans profil des retraités, la liste demande de choisir. Après le passage, le bloc « Profil » s'ouvre.
- La barre « Enregistrer » collée garde son comportement de #130 : la resserrer en fin de page aurait caché « Archiver le rôle ».

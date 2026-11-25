# Fiche d'un rôle : plan

Design : [2026-11-25-fiche-role-design.md](../specs/2026-11-25-fiche-role-design.md).

1. **Icône repliée** (`reglages/ChoixIcone.svelte`) : l'icône choisie et son nom, « Changer d'icône » déplie la grille, un choix la referme. Sans JavaScript, un repli simple. Tests du composant.
2. **Vocabulaire** (`reglages/roles.ts`, `formulaire-reglages.ts`, libellés des droits) : « Doit toujours être tenu », « Tenu pour » (tout le centre, chaque équipe, chaque comité, avec une sous-ligne), « Qui nomme », « rôle ». Le serveur lit l'interrupteur : coché, `fonction`, sinon `mission`. Tests serveur.
3. **Création d'un rôle** : les nouveaux champs, dans l'ordre de la fiche. Tests de la page.
4. **Fiche d'un rôle** : Titulaires, Identité, Ce qu'il peut faire, Demandes, puis en bas « Détail droit par droit » et « Archiver le rôle » (geste grave visible, confirmé). Tests de la page.
5. **Comité** : la fiche et la création prennent l'icône repliée ; l'avertissement de dissolution parle de rôles.
6. **Qui fait quoi** : « Autres rôles toujours tenus » et « Autres rôles ».
7. **e2e, aides et page fonctionnelle** mis à jour.
8. Gardes, types, captures, relecture, PR prête.

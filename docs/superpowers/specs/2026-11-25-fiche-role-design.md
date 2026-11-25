# Fiche d'un rôle : ordre, vocabulaire et icône repliée (design court)

C'est le dernier lot issu de l'audit des réglages du 24/11/2026. Le porteur l'a lancé le 25/11.

## Pourquoi

La fiche d'un rôle (Réglages, puis Rôles, puis le rôle) mélange trop d'intentions. Plusieurs défauts reviennent :
- l'identité du rôle n'arrive qu'en 7e position ;
- les 34 icônes sont toujours dépliées ;
- le vocabulaire est technique : « Nature », « Portée », « Qui attribue », « responsabilité » ;
- le bloc « Nom, icône et nomination » ne sert à nommer personne.

Les mêmes défauts touchent la création d'un rôle, la fiche et la création d'un comité.

## Ce qui change

**Ordre de la fiche d'un rôle**, du plus courant au plus rare :
1. **Titulaires** : le bloc du lot « Qui fait quoi », avec « Prévenu pour… ». Inchangé.
2. **Identité** : le nom, « Doit toujours être tenu », « Tenu pour », « Qui nomme » et l'icône.
3. **Ce qu'il peut faire** : les domaines de droits et l'administration. Inchangé sur le fond.
4. **Demandes** : « Reçoit des demandes » et les étapes. Inchangé.
5. **En bas de page**, deux gestes rares :
   - « Détail droit par droit », en repli simple ;
   - « Archiver le rôle », geste grave confirmé, visible sans menu « Plus ».

Il n'y a qu'un seul bouton « Enregistrer » pour toute la page, comme aujourd'hui.

**Vocabulaire**, les mêmes mots partout (fiche et création d'un rôle, Qui fait quoi, aides) :

| Avant | Après |
|---|---|
| Nature, Fonction ou Mission | Interrupteur « Doit toujours être tenu », avec une phrase : « Signalé à pourvoir dès qu'il n'a plus de titulaire. » |
| Portée, Centre, Équipe ou Comité | « Tenu pour » : tout le centre, chaque équipe ou chaque comité, en choix avec une sous-ligne |
| Qui attribue | Qui nomme |
| Responsabilité | Rôle |
| Nom, icône et nomination | Identité |

- **Les données ne changent pas** : « Doit toujours être tenu » écrit `fonction`, sinon `mission`. Pas de migration.
- **Les décisions et la doc technique** peuvent garder les mots du code. L'interface et l'aide utilisent les nouveaux mots.
- **Les groupes de « Qui fait quoi »** : « Autres fonctions » devient « Autres rôles toujours tenus » s'il reste affiché, et « Missions » devient « Autres rôles ».

**Icône** (rôle, nouveau rôle, comité, nouveau comité) :
- L'icône choisie s'affiche, avec un bouton **« Changer d'icône »** qui déplie la grille sur place.
- Choisir une icône referme la grille.
- Sans JavaScript, la grille reste dans un repli simple.

## Contraintes

- **Aucun marqueur de texte généré** (règle stricte du porteur) : pas de « · », « — », « → » ni « | » comme séparateurs, pas de deux-points entre deux idées, pas d'emoji, pas de « … » dans les boutons. Les gardes doivent rester vertes.
- **Pas de menu « Plus »** pour les gestes.
- **Téléphone et ordinateur** : captures du téléphone en clair et de l'ordinateur en sombre (fiche d'un rôle, création d'un rôle, fiche d'un comité avec l'icône repliée). La page doit respirer.
- **Aucune requête de plus**, et les budgets restent verts.
- **Tests** : les tests et e2e qui citent les anciens libellés sont mis à jour.
- **Doc** : les aides (créer un rôle, nommer quelqu'un) et la page fonctionnelle des rôles sont mises à jour.

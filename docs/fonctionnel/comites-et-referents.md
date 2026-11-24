# Qui fait quoi

## À quoi ça sert

Savoir qui tient quoi au centre, et le changer au même endroit : qui est dans quel comité, qui est référent de quoi, qui est chef de garde de chaque équipe. Caserne → « Qui fait quoi » (`/comites`). Un agent y lit ; qui peut nommer y trouve en plus ses gestes, seulement sur ce qu'il a le droit de nommer ([décision 0045](../decisions/0045-qui-fait-quoi.md)). L'ancienne adresse `/nominations` y mène.

## Ce qu'on y voit

**À pourvoir**, en tête, seulement pour qui peut nommer et s'il manque quelqu'un : chaque fonction qu'il peut nommer et que personne ne tient ni ne tiendra (pour un rôle d'équipe, chaque équipe active sans titulaire ; pour un rôle de comité, chaque comité en cours). Chaque ligne a son bouton **Nommer**. Une mission vide n'est pas à pourvoir.

Puis des **groupes repliés**, chacun avec une ligne de résumé (« 4 équipes, 1 à pourvoir », « 6 rôles »). Un groupe s'ouvre quand on vise l'un de ses éléments (volet ouvert, refus, réussite). Dans l'ordre :
- **Comités** (en cours), une carte par comité : ses membres et leur rôle dans le comité (« Rapporteur », « Membre ») ; le lien vers son mur, seulement pour qui peut le lire (ses membres, le chef de centre, l'adjoint, le super administrateur) ; **À réserver**, son matériel, pour qui peut le réserver ou le gère ;
- **Chef de centre et adjoint** ;
- **Chefs de garde**, une ligne par équipe active, et de même pour tout rôle d'équipe ;
- **Autres fonctions** (référent technique…) ;
- **Missions** (pharmacie, engins, habillement…), puis les missions tenues par équipe.

Un groupe sans rôle n'apparaît pas. Chaque nom porte l'insigne de son grade. Sont comptés les agents qui ont accès à l'appli : ni partis, ni suspendus, ni comptes extérieurs.

## Pour un agent

La page se lit sans aucun geste : les titulaires du jour, ou « Personne pour l'instant ». **Écrire**, à côté d'un membre ou d'un titulaire, ouvre la conversation à deux ; **Demander**, sur la ligne d'un rôle qui reçoit des demandes, ouvre la nouvelle demande ([demandes aux référents](demandes-aux-referents.md)).

## Pour qui nomme

Il voit **une carte par rôle**, et les groupes laissent de l'air entre elles :
- en tête de la carte, le nom du rôle et un seul bouton **Nommer** (**Ajouter un membre** pour les membres d'un comité) ;
- dessous, ses titulaires, une ligne par personne avec la flèche qui ouvre son **volet**, ou une ligne « À pourvoir » (fonction) ou « Personne pour l'instant » (mission) s'il n'y a personne. Un mandat qui commence plus tard le dit (« à partir du 3 déc. 2026 ») ;
- au-delà de cinq titulaires, les autres se déplient par « Voir les N titulaires » ;
- **un rôle d'équipe** (chef de garde) : une seule carte, une ligne par équipe, avec le titulaire, ou « À pourvoir » et **Nommer** sur la ligne, chaque équipe ayant son poste ;
- **un comité** : son nom, puis une carte par rôle du comité, au nom du rôle (Rapporteur, Membre, Président…), puis son mur et son matériel ;
- un rôle qu'il ne nomme pas garde sa carte, sans geste.

Le **volet de la personne** dit son rôle, l'équipe ou le comité, et « Depuis le … ». Dessous, une rangée de gestes visibles :
- **Remplacer**, l'action principale : il déplie sur place la recherche, le nouveau titulaire et sa date de début, puis **Confirmer le remplacement**. Le mandat en cours finit la veille, le nouveau commence à la date choisie, en une seule écriture ;
- **Voir sa fiche**, pour qui gère les agents, et **Écrire** si l'on peut lui écrire ;
- **Finir le mandat** (contour rouge) : il déplie sur place la date du dernier jour (aujourd'hui par défaut), « Je confirme » et **Confirmer la fin du mandat**. Un mandat qui n'a pas commencé propose à la place **Annuler la nomination**, sans Remplacer, confirmée de même.

Sans JavaScript, les deux formulaires sont dépliés d'emblée.

Le **volet Nommer**, le même partout : l'agent (ceux de l'équipe du poste d'abord, puis les autres ; une recherche par nom), la date de début (aujourd'hui par défaut), et, replié, une date de fin facultative pour une mission d'une durée connue.

Une réussite ferme le volet et s'annonce en tête de la page. Un refus garde le volet ouvert, l'erreur dedans. Sans JavaScript, tout marche par l'adresse de la page.

Les règles ne changent pas ([Accès et attributions](acces-et-attributions.md)) : qui peut nommer quoi, pas de personne extérieure dans un rôle de comité, pas de doublon sur une même période, l'agent nommé est prévenu.

## Ailleurs

- **La fiche d'un rôle** et **la fiche d'un comité** (Réglages) ont un bloc **Titulaires** en tête, avec les mêmes cartes et les mêmes volets : une carte pour le rôle (une ligne par équipe ou par comité s'il en a), une carte par rôle pour un comité. Après « Créer le rôle », la fiche s'ouvre avec ce bloc ouvert et « Qui le tiendra ? » ; après « Créer le comité », « Qui seront son rapporteur et ses membres ? ».
- **La fiche d'un agent** garde son bloc « Rôles », avec **Nommer à un rôle**.
- **Caserne** : « Qui fait quoi », avec le nombre de postes à pourvoir pour qui peut nommer.

## Qui y entre

Tout agent qui a accès, et le super administrateur. Le compte de la réserve citoyenne n'a pas le lien dans Caserne et reçoit un refus s'il ouvre l'adresse. « Régler les rôles et les comités », en haut de la page, mène aux réglages pour qui les règle : créer un rôle ou un comité, ses droits, qui le nomme. Les nominations, elles, se font sur la page.

## Exemple

Claire, cheffe de centre, ouvre Qui fait quoi : en tête, « À pourvoir » montre « Chef de garde, Équipe 3 ». Elle appuie sur **Nommer**, choisit Marc (de l'équipe 3, en haut de la liste) et valide. Le mois suivant, Marc part en formation : dans « Chefs de garde », elle appuie sur sa ligne, puis **Remplacer**, choisit Julie à partir du 1er décembre. Le mandat de Marc finit le 30 novembre, celui de Julie commence le lendemain.

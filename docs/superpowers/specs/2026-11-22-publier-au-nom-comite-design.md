# Publier au nom d'un comité : design

Sujet B du lot « comités ». Cadré et validé par le porteur le 22/11/2026.

## Pourquoi

Le rapporteur de l'Amicale veut annoncer dans Vie du centre au nom du comité, par exemple le repas de Sainte-Barbe, et non en son nom propre.

## Décisions du porteur

- Seul le **rapporteur** du comité peut publier en son nom.
- On ne publie au nom d'un comité que dans **Vie du centre**.

## Design

- **Base** : la colonne `publication.comite_id` (nullable), ajoutée par la migration 0034, qui ne fait qu'ajouter. La publication garde son auteur, la personne.
- **Écriture** : un choix « Publier en tant que », avec « Moi » ou le nom du comité, sur l'écran de publication de Vie du centre.
  - **Qui le voit** : seulement un rapporteur en fonction, avec un choix par comité s'il en anime plusieurs.
  - **Contrôle du serveur** : il refuse si l'auteur n'est pas rapporteur de ce comité à cette date, si le comité est dissous, ou si le mur n'est pas Vie du centre.
- **Affichage** :
  - **La publication** porte l'icône et le nom du comité, avec « par Prénom Nom » dessous.
  - **Dans la cloche et sur le téléphone** : « Amicale a publié dans Vie du centre ».
- **Après publication** :
  - La signature reste même si l'auteur n'est plus rapporteur, ou si le comité est dissous.
  - Modifier et supprimer se fait comme aujourd'hui, par l'auteur et les modérateurs. Le choix « en tant que » ne se change pas après la publication.
- **Inchangé** : les événements, les sondages, « Répondre en privé » (qui écrit à l'auteur), Le centre et les autres murs.
- **Journal** : la publication y figure avec le nom du comité.

## Approches

1. **Une colonne comité en plus de l'auteur** : retenue. On garde qui a écrit, ce dont ont besoin la modération, « Répondre en privé » et le journal.
2. **Le comité comme auteur** : écartée, parce qu'on perdrait la personne.

## Contraintes

- **Temps de calcul** : aucune requête de plus. Le nom et l'icône du comité se lisent avec les lectures existantes. Les budgets restent verts sans relever les plafonds.
- **Charte stricte** : aucun marqueur d'interface générée, et `ACTIONS` à jour si un geste s'ajoute.
- **Fin du lot** : la doc de `docs/fonctionnel/salons.md` et de la page d'utilisation « publier sur un mur », plus un test e2e court.

# Remplacement sur un créneau (plan)

> Exécuté en ligne, en TDD (superpowers:executing-plans). Cases à cocher pour le suivi.

**But** : un cinquième choix « Un créneau » dans « Me faire remplacer », qui suit le circuit de la garde entière.

**Architecture** : une demande `genre = 'remplacement'` ordinaire, une seule période libre dans `periodes`, et une marque `creneau = 1` (colonne nullable, migration 0042) pour la dire juste partout (« du vendredi 4 décembre, 21 h au samedi 5 décembre, 7 h », jamais « nuit du ») et la montrer sur la plaque quelle que soit sa durée. Le reste (acceptation, validation, annulation, « Ouvrir à tous », relance, expiration) ne change pas.

**Spec** : [`2026-11-28-remplacement-sur-creneau-design.md`](../specs/2026-11-28-remplacement-sur-creneau-design.md).

## Contraintes

- Les quatre choix actuels ne changent pas.
- Créneau dans les astreintes du demandeur (deux qui se suivent, jamais un trou), au moins 1 h, demandé au moins 1 h avant son début, un message clair à chaque refus.
- Aucune requête de plus par page ; budgets verts sans relever les plafonds.
- Textes de la charte : ni « · », ni tiret cadratin, ni deux-points entre deux idées, ni emoji, ni « … » dans un bouton.

## Points d'attention

- Fin à minuit : « de 20 h à minuit », pas « au mardi, 0 h ».
- Passage à l'heure d'été : une heure qui n'existe pas est refusée.
- Une garde entière ou un court qui chevauche un créneau (et l'inverse) : refusé, « Période déjà dans une demande ».
- Un collègue d'astreinte ou en vacances sur une partie du créneau seulement : pas disponible.
- Plaque : un créneau de plus de 3 h s'y voit, une garde entière toujours pas.

## Tâches

1. **Non-régression d'abord** : repérer les tests qui figent les quatre choix (`remplacements.test.ts`, `remplacements-court.test.ts`, `demander/page.test.ts`, `court/page.test.ts`, `manoeuvre`), ajouter ceux qui manquent : textes `texteTranche` et `texteDemande` actuels, plaque (`remplacantsCourts`, `requeteCourtsCedes`) sans créneau.
2. **Base** : migration 0042, colonne `creneau` sur `demande_remplacement`.
3. **Textes** (`tranches.ts`) : `texteCreneau(p)`, `texteDemande(periodes, creneau = false)`. Chaque lieu qui dit une demande passe la marque : demandes, relance et expiration, départ, fêtes, lectures (vue, réduite, À valider), À ne pas manquer, cloche, planning (repères, chef), répartition de l'été, carte de demande.
4. **Socle** (`creneau.ts`) : `exigerCreneau(ctx, id, p)` (les règles et leurs messages), `pourDemanderCreneau(base, acteur, maintenant, reglage, p | null)`, `demanderCreneau(base, acteur, { debut, fin, cibleId, mot }, maintenant, reglage)` ; l'envoi commun avec `demanderRemplacement`, sans changer celui-ci. Tests : chaque refus, ouverte et ciblée, aptitude manquante puis validation du chef, refus du collègue puis « Ouvrir à tous », annulation, relance la veille, chevauchements avec garde entière, court et échange, disponibles partiels.
5. **Effets** : `effectifs` et `requeteConclues` portent `creneau` ; plaque de l'accueil et du planning ; agenda (le créneau sort de l'astreinte du titulaire, entre chez le remplaçant). Tests sur chacun.
6. **Écran** `routes/remplacements/creneau` : trois étapes dans l'adresse (quand, à qui, vérifier), début et fin en champs date et heure du téléphone, `ListeCollegues`, une seule action. Ligne « Un créneau » dans le choix, après « Une ou plusieurs gardes ». Tests de rendu et du serveur ; budget de la page ajouté à `budget.test.ts`.
7. **e2e** : un cas rejouable (insertions idempotentes, `exact: true`, nettoyage en `afterAll`).
8. **Banc apparié** avant et après (hors dépôt) : étapes de la demande et accueil.
9. **Doc** : `me-faire-remplacer.md`, `me-faire-remplacer-sur-un-creneau.md`, page fonctionnelle des remplacements, décision 0050 (la marque `creneau`).
10. PR en brouillon dès le premier push ; compte rendu tenu à jour.

# 0050, Remplacement sur un créneau

- **Contexte** : un agent qui sait à l'avance qu'il sera empêché quelques heures ne pouvait demander que la garde entière, ou attendre le jour même. Spec : `docs/superpowers/specs/2026-11-28-remplacement-sur-creneau-design.md` (approche A, une demande de remplacement ordinaire).
- **Choix** :
  - une colonne `creneau` (1, vide sinon) sur `demande_remplacement`, migration 0042, qui ne fait qu'ajouter. Sans elle, un créneau du vendredi 21 h au samedi 7 h se lirait « nuit du vendredi », et la plaque, qui ne montre que les plages de 3 h au plus, ne verrait pas un créneau plus long ;
  - le circuit de la garde entière, sans rien changer à l'acceptation, la validation, l'annulation, « Ouvrir à tous », la relance ni l'expiration ;
  - pour savoir qui est libre, le créneau est coupé à ses tranches : les vacances se voient au jour de chaque tranche, comme pour une garde ; les gardes entières et les courts sont pris tels quels ;
  - une semaine au plus : une demande porte sur une semaine au plus, ce qui borne les demandes lues (décision 0021).
- **Lectures** : aucune de plus. L'étape « Quand ? » ne lit rien ; « À qui ? », « Vérifier » et l'envoi lisent le contexte en un batch, comme les gardes. La plaque de l'Accueil lit ses créneaux dans la requête des courts, déjà dans le batch.
- **Pourquoi** : le plus simple qui ne touche pas aux quatre autres choix ; un genre à part doublait l'acceptation, la validation, les notifications et l'affichage.
- **Validé par** : le porteur, le 28/11/2026 (design) ; le reste dans la PR #138.

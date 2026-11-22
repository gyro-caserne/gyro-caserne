# Ouvrir des murs à un profil : plan

> Pour le sous-agent : exécuter tâche par tâche, en TDD (test d'abord, le voir échouer, coder, le voir passer), commit + push à chaque tâche verte, une ligne horodatée par étape dans `/home/maxvm/suivi-acces.log`.

**But** : un profil extérieur peut se voir ouvrir des murs (centre, vie, comités) en lecture ou en écriture ; un profil se crée, se renomme, se supprime ; un agent passe à un profil extérieur (retraité) sans être effacé.

**Architecture** : une colonne JSON `murs_ouverts` sur `profil`, lue dans les requêtes qui joignent déjà le profil ; aucune requête de plus.

**Spec** : `docs/superpowers/specs/2026-11-22-acces-profils-design.md` (à lire en entier ; elle l'emporte).

## Contraintes globales

- Temps de calcul : aucune requête de plus ; `apps/web/src/routes/budget.test.ts` et les tests de budget du socle verts sans relever un plafond ; banc avant/après (accueil agent, accueil d'un extérieur avec murs ouverts, mur Vie du centre), écart apparié rapporté.
- Migration 0033 additive seulement (`packages/socle/migrations`, via drizzle comme 0032).
- Charte stricte (`.claude/skills/charte-gyro/SKILL.md`, section « Les textes ») ; `apps/web/src/textes.test.ts` et `formes.test.ts` verts ; aucun marqueur d'IA (« · », « — », deux-points entre deux idées…).
- Actions nouvelles dans `ACTIONS` (`page-au-journal.ts`) ; gestes au journal.
- Machine : `export PATH="$HOME/.local/lib/node/bin:$PATH"` ; commandes lourdes dans `timeout 400 systemd-run --user --scope -q -p MemoryMax=1500M …` ; svelte-check avec `NODE_OPTIONS=--max-old-space-size=1350` ; jamais Playwright en local.

## Points de vigilance (à couvrir par un test)

1. Une entrée `murs_ouverts` vers un comité dissous ou supprimé : ignorée, aucun plantage.
2. Un extérieur **parti** ou **suspendu** avec un profil ouvert : aucun mur.
3. « Écriture » sur Le centre : commenter/aimer/voter/répondre, jamais publier.
4. Un extérieur ne modère jamais, même si une attribution de comité existait déjà en base.
5. Passage d'un chef de centre ou adjoint à un profil extérieur : refusé.

---

### Tâche 1 : la colonne et le calcul des murs

**Fichiers** : `packages/socle/src/schema.ts` (`profil.mursOuverts`, texte JSON, défaut `'{}'`), migration 0033, `packages/socle/src/murs.ts`, `packages/socle/test/murs.test.ts`.

**Produit** : `type NiveauOuvert = 'lecture' | 'ecriture'` ; `lireMursOuverts(json: string | null): Record<string, NiveauOuvert>` (tolérant : JSON invalide → `{}`, clés hors `centre`/`vie`/`comite:<id>` ignorées) dans `murs.ts`. `mursEtAppartenances` : un extérieur au statut avec accès reçoit les murs ouverts de son profil (comités non dissous seulement), `peutPublier` = écriture et mur ≠ centre, jamais `peutModerer`. `Appartenances` porte de quoi répondre à `estMembre`/`estConvoque` pour ces murs (lecture → membre ; écriture → convoqué à « tous »).

Tests (`murs.test.ts`, describe « murs ouverts à un profil ») : lecture/écriture sur vie et comité ; centre en écriture sans publier ; comité dissous ignoré ; parti/suspendu sans mur ; équipe jamais ouvrable ; agent inchangé ; points de vigilance 1, 2, 3, 4.

### Tâche 2 : membres, convocations, annonces, à ne pas manquer, notifications

**Fichiers** : `murs.ts` (`membresDe`, `lecturesAgents` ou une lecture voisine dans le même batch), `actions/publications.ts` (`suiviPublication`, lecture du mur), `a-ne-pas-manquer.ts`, `notifications.ts` (nouvelle publication sur un mur), leurs tests.

Comportement : les personnes au mur ouvert (lecture ou écriture) comptent dans « qui a lu » d'une annonce et reçoivent la notification d'une nouvelle publication ; celles en écriture comptent parmi les convoqués d'un événement « tous » de ce mur et peuvent y répondre et voter ; « À ne pas manquer » reprend leurs murs ouverts. Sans ralentir le planning, les remplacements ni « qui fait quoi » (ne pas élargir ce qu'ils lisent). Tests de budget inchangés.

### Tâche 3 : messagerie

**Fichiers** : `packages/socle/src/messagerie.ts` (`aLaMessagerie`, `annuaire`, `conversationAvec`, `envoyer`, `creerGroupe`, `ajouterMembres`), `test/messagerie.test.ts`.

Comportement (spec, « Messagerie ») : un extérieur avec au moins un comité ouvert en écriture a la messagerie, sans droit à cocher ; il écrit à deux aux membres de ces comités (agents qui y tiennent un rôle, et extérieurs qui l'ont en écriture), au chef et à l'adjoint ; ceux-ci peuvent lui écrire ; il ne crée pas de groupe et n'est pas ajouté à un groupe ; une conversation avec quelqu'un qui n'est plus joignable reste lisible mais refuse l'envoi. Règle SQL unique gardée (pas de requête de plus dans `nonLusTotal`, `pourVous`).

### Tâche 4 : créer, renommer, supprimer un profil ; régler ses murs ouverts

**Fichiers** : `packages/socle/src/actions/profils.ts` (`creerProfil(base, acteur, { nom, typePersonne }, maintenant): Promise<number>`, `renommerProfil`, `supprimerProfil`, `modifierMursOuverts(base, acteur, profilId, ouverts: Record<string, NiveauOuvert>, maintenant)`), `test/actions-profils.test.ts`, `apps/web/src/routes/reglages/profils/` (liste avec « Nouveau profil », page `[id]` avec partie « Murs ouverts » pour un extérieur : une ligne par mur ouvrable, choix Aucun accès / Lecture / Écriture), `ACTIONS`, journal, tests de page.

Règles : même droit que `modifierDroitsProfil` ; nom unique (60 caractères) ; suppression refusée si une personne a ce profil, et toujours pour le profil « Agent » de départ ; murs ouverts seulement sur un profil extérieur ; clés validées (centre, vie, comité existant non dissous).

### Tâche 5 : passage d'un agent à un profil extérieur ; pas de rôle de comité pour un extérieur

**Fichiers** : `packages/socle/src/actions/personnes.ts` (`modifierFiche` sur `profilId`, en réutilisant les suites de `changerStatut`), `actions/attributions.ts` (refus d'un rôle de comité pour un extérieur), `apps/web/src/routes/agents/[id]/` (confirmation listant l'équipe et les rôles quittés), tests.

Comportement (spec, « Les retraités ») : équipe et rôles finis la veille ; remplacements et échanges en cours, réservations et demandes d'habillement en cours annulés ; retiré des groupes de messagerie d'agents ; fiche, notifications et conversations à deux gardées ; jamais effacé (`partis.ts` inchangé) ; chef de centre et adjoint refusés (vigilance 5). Retour d'un extérieur vers « Agent » : simple changement de profil.

### Tâche 6 : icônes, navigation, doc, captures

**Fichiers** : `packages/socle/src/icones.ts` (`NOMS_ICONES`), `apps/web/src/lib/ui/icones-roles.ts`, `apps/web/src/routes/reglages/roles.ts` (libellés), navigation (onglet Échanges pour un extérieur avec au moins un mur), `docs/fonctionnel/` (profils, salons, messagerie), `docs/utilisation/` (« Comment ouvrir un mur à un profil ? », « Comment passer un agent en retraité ? »), décision 0042, e2e court (profil extérieur avec un comité ouvert : il voit le mur, publie, ne voit pas Le centre).

Icônes ajoutées (tracés à l'encre, style des 26 actuelles) : retraites, pharmacie, sport, informatique, formation, cuisine, outils, musique, photo, medaille. Captures téléphone clair : Réglages → Profils → Retraité ; Échanges d'un retraité ; le choix d'icônes.

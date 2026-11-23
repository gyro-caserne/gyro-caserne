# Demandes aux référents (C1) : plan

> Pour le sous-agent : exécuter tâche par tâche, en TDD (test d'abord, le voir échouer, coder, le voir passer), commit + push à chaque tâche verte, une ligne horodatée par étape dans `/home/maxvm/suivi-demandes.log`.

**But** : tout rôle de centre (hors rôles système et habillement) peut « recevoir des demandes », avec des étapes intermédiaires réglables ; un agent fait une demande, le référent la suit jusqu'à la fin, comme l'habillement.

**Architecture** : réglages en colonne JSON sur `responsabilite` (lue avec les rôles) ; trois tables neuves (demande, fil, avis) calquées sur l'habillement ; étapes repérées par identifiant stable. L'habillement n'est pas modifié.

**Spec** : `docs/superpowers/specs/2026-11-23-demandes-referents-design.md` (à lire en entier, avec « Choix de Claude après relecture » ; elle l'emporte). Modèle à suivre : `docs/fonctionnel/habillement.md`, `packages/socle/src/habillement.ts`, `apps/web/src/routes/habillement`.

## Contraintes globales

- Temps de calcul : aucune requête de plus pour qui n'a pas de casquette de demandes ; lectures des titulaires et du chef dans le batch existant de l'accueil ; `budget.test.ts` vert sans relever un plafond ; banc apparié avant/après (accueil agent, accueil référent, accueil chef, liste des demandes).
- Migration 0035 additive seulement.
- Charte stricte (section « Les textes ») ; `textes.test.ts`, `formes.test.ts` verts ; aucun marqueur d'IA.
- Gestes dans `ACTIONS` et au journal.
- Machine : `export PATH="$HOME/.local/lib/node/bin:$PATH"` ; lourd dans `timeout 400 systemd-run --user --scope -q -p MemoryMax=1500M …` ; svelte-check avec `NODE_OPTIONS=--max-old-space-size=1350` ; jamais Playwright en local hors captures (un chromium, fermé ensuite).

## Points de vigilance (chacun son test)

1. Passer à une étape retirée ou inconnue, ou en arrière selon l'ordre du moment : refusé.
2. Deux référents prennent en compte la même demande en même temps : un seul gagne, l'autre reçoit un message clair.
3. Un titulaire dont le rôle a pris fin ne voit plus ni n'agit plus.
4. Un extérieur (retraité) ou le super administrateur ne peut pas demander.
5. Rôle sans titulaire : la demande arrive au chef et à l'adjoint (cloche et « Le centre »).

---

### Tâche 1 : réglages du rôle

`packages/socle/src/schema.ts` (`responsabilite.demandes`, JSON nullable : `{ etapes: { id: string; nom: string }[]; derniere: string }`), migration 0035, `actions/responsabilites` (ou fichier des rôles existant) : `reglerDemandes(base, acteur, roleId, reglage | null, maintenant)`. Règles de la spec (« Le réglage, par rôle ») et des choix de Claude : 0 à 6 étapes de 30 caractères, ids stables générés côté serveur, retrait refusé si une demande en cours y est, décocher et archiver refusés si demandes en cours, rôles système et rôle portant `GERER_HABILLEMENT` refusés ; qui règle : gestion des rôles, ou titulaires en cours (étapes et dernière étape seulement). Modèles pharmacie et matériel cochés pour un nouveau centre (`modeles.ts`, `jeu-de-depart.ts`). Écran : partie « Demandes » dans Réglages → Rôles → [id].

### Tâche 2 : le cycle d'une demande (socle)

Nouveau `packages/socle/src/demandes.ts` + tables `demande`, `fil_demande`, `avis_demande`. Fonctions (noms au choix, calqués sur `habillement.ts`) : demander, prendre en compte, reprendre, poser une question / répondre (drapeau, l'étape ne change pas), préciser, avancer (vers toute étape après l'actuelle selon l'ordre du moment, ou la dernière avec mot facultatif), refuser (mot obligatoire), annuler (agent, tant que pas au-delà de « Prise en compte »), lire une demande, mes demandes, demandes d'un rôle. Droits et visibilité : spec « Qui voit, qui agit ». Effacement des demandes finies 24 mois après leur fin dans la tâche de nuit existante.

### Tâche 3 : notifications et accueil

Cloche + téléphone, mêmes règles que l'habillement (spec « Notifications »). Casquette du rôle à l'accueil : « À décider » (à prendre en compte, réponses arrivées) + lien vers toutes les demandes du rôle ; sans titulaire, chez le chef et l'adjoint dans « Le centre ». Lectures dans le batch existant ; budgets.

### Tâche 4 : écrans

`apps/web/src/routes/demandes/` : « Faire une demande » (choix du rôle avec icône, un champ), « Mes demandes », la demande et son fil, la liste du rôle pour les référents. Entrée dans Caserne, et depuis la fiche d'un référent dans Comités et référents. Téléphone d'abord, ordinateur soigné ; sans JavaScript, tout marche.

### Tâche 5 : doc, e2e, captures, relecture

`docs/fonctionnel/demandes-aux-referents.md`, `docs/utilisation/` (« Comment faire une demande à un référent ? », « Comment régler les étapes de mon rôle ? »), décision 0043, `docs/technique/` si besoin. E2e court : le chef coche la pharmacie avec une étape « Commandée » ; un agent demande ; le référent prend en compte, pose une question, l'agent répond, le référent passe à « Commandée » puis à la fin. Captures téléphone clair : réglage des étapes, nouvelle demande, une demande suivie ; ordinateur sombre : la liste du rôle. Relecture indépendante (sous-agent, modèle le plus capable), retours traités en une vague. Description de la PR au format compte rendu.

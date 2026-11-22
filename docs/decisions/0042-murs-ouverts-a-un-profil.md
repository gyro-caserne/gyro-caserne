# 0042 — Ouvrir des murs à un profil (retraités)

- **Contexte** : le centre veut un comité des retraités, d'anciens agents qui gardent un lien avec la caserne par leur mur et celui de l'Amicale. Spec : `docs/superpowers/specs/2026-11-22-acces-profils-design.md`.
- **Choix** : un réglage générique. Le chef ouvre à un profil extérieur Le centre, Vie du centre ou des comités en cours, en lecture ou en écriture. Rien de propre aux retraités dans le code.
- **Stockage** : migration additive 0033, colonne `profil.murs_ouverts` (JSON, `'{}'` par défaut), lue dans les requêtes qui joignent déjà le profil (`mursEtAppartenances`, `lecturesAgents`, messagerie). Aucune requête de plus. Une entrée illisible, vers une équipe, un comité dissous ou inconnu, est ignorée à la lecture.
- **Règles** : jamais plus qu'un agent (pas de publication sur Le centre), jamais de modération, les rôles et équipes d'un extérieur ne comptent pas. Lecture : membre du mur (suivis, notifications). Écriture : en plus convoqué aux événements de tout le mur et réagit. Un comité en écriture donne la messagerie à deux avec ses membres, le chef et l'adjoint.
- **Passage d'un agent en retraité** : changer son profil sur sa fiche, avec les suites d'un départ (équipe et rôles finis la veille, remplacements, réservations et demandes d'habillement en cours annulés, sortie des groupes), mais la fiche, les notifications et les conversations à deux restent et il n'est jamais effacé.
- **Décisions prises en route, à valider** : voir la PR #120.
- **Validé par** : le porteur, le 22/11/2026 (design) ; le reste dans la PR.

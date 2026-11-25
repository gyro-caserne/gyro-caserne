# Raccourcis et finitions : design court

Ce lot vient de l'audit des réglages (24/11/2026) et des retours du porteur. Le porteur l'a validé le 25/11.

## 1. Nouveau type d'engin depuis « Ajouter un engin »

- **Aujourd'hui** : pour un engin d'un type qui n'existe pas encore (un CCF, par exemple), il faut créer le type en bas d'Engins, puis passer par Fiches de prise de garde, puis ajouter l'engin, et enfin régler l'armement dans Réglages. Cela fait trois rubriques.
- **Ce qui change** :
  - Dans « Ajouter un engin », le choix du type propose aussi **« Nouveau type »**. Ce choix demande sur place le nom du type, qui suit les mêmes règles qu'aujourd'hui.
  - L'engin et son type sont créés en une seule fois.
  - **Après la création**, la page de l'engin propose les suites logiques, en deux boutons secondaires visibles : **« Compléter sa fiche de prise de garde »** et **« Régler son armement »**. Ce sont des liens vers les écrans existants.
  - Ces suites restent aussi proposées après l'ajout d'un engin d'un type existant si sa fiche est vide.
- **Droits** : les mêmes qu'aujourd'hui pour créer un type et un engin.

## 2. « Part à la retraite » dans le départ d'un agent

- **Aujourd'hui** : pour passer un agent en retraité, on change son profil dans le bloc Parcours de sa fiche. Pourtant, c'est le bloc **« Départ du centre »** qui semble la voie naturelle.
- **Ce qui change** :
  - Dans « Départ du centre », deux choix se présentent : **« Quitte le centre »**, le départ actuel, et **« Part à la retraite, reste dans l'appli »**.
  - Le second choix propose les profils extérieurs existants et préchoisit celui des retraités s'il y en a un. Il déclenche le même passage à un profil extérieur qu'aujourd'hui : même confirmation, mêmes suites, rien d'effacé, et refus pour le chef et l'adjoint.
  - **Sans aucun profil extérieur**, le choix explique en une phrase qu'il faut d'abord en créer un, avec un lien vers Réglages, puis Profils.
  - Le changement de profil dans le bloc Parcours reste possible.

## 3. Espace en bas de page (téléphone)

- **Défaut** : au téléphone, le dernier élément d'une page longue passe sous la barre de navigation du bas. C'est le cas de la carte « Toutes les demandes » sur l'accueil du Référent technique.
- **Correction** : dans la mise en page commune, un espace sous le contenu égal à la hauteur de la barre, plus la zone de sécurité du bas de l'iPhone (`env(safe-area-inset-bottom)`) et un espacement de la charte.
- **Barre « Enregistrer » collée** : les pages qui l'ont gardent le comportement corrigé en #130, sans double espace.
- **Contrôle** : un test vérifie que le dernier élément d'une page longue reste visible au-dessus de la barre.

## 4. « Demandes reçues » : la carte « Étapes de vos demandes »

- **Défaut** : sur `/demandes/role/[id]`, le bouton « Régler les étapes » flotte sous l'écran vide, sans rapport visible avec ce qu'il règle.
- **Correction** :
  - En tête de page, une petite carte **« Étapes de vos demandes »** donne les étapes actuelles en une ligne (« Demandée, Prise en compte, Commandée, Livrée ») et porte le bouton **« Régler les étapes »**. Le réglage se déplie sur place, comme aujourd'hui.
  - La carte reste en tête quand il y a des demandes.
  - Elle n'apparaît que pour qui peut régler les étapes.

## Contraintes

- **Textes** : aucun marqueur de texte généré, règle stricte du porteur. Pas de « · », « — », « → » ni « | » comme séparateurs, pas de deux-points entre deux idées, pas d'emoji, pas de « … » dans les boutons.
- **Gestes** : pas de menu « Plus » pour des gestes courants.
- **Écrans** : au téléphone et à l'ordinateur. Captures du téléphone en clair et de l'ordinateur en sombre.
- **Temps de calcul** : aucune requête de plus sur les pages courantes. Les budgets restent verts sans relever les plafonds.
- **Base** : pas de migration attendue. Si une migration devient nécessaire, elle ne fait qu'ajouter.
- **Livrables** : doc (fonctionnel, aide « Comment ajouter un engin d'un nouveau type ? », mise à jour de « Comment passer un agent en retraité ? »), et un e2e court par geste.

# Date d'engagement saisie par l'agent (design)

Demande du porteur, le 28/11/2026. Validé : option 1.

## Pourquoi

Un agent qui arrive d'un autre centre sait mieux que quiconque depuis quand il est engagé. Aujourd'hui, tout le bloc Parcours est réservé au chef et à l'adjoint : l'ancienneté (médailles, carte « Féliciter », e-mail à 30 jours) reste vide ou fausse.

## Ce qui change

- Dans son profil (Moi, Mon profil), l'agent saisit sa **date d'engagement SPV**, seulement si elle est **vide**.
- Une fois remplie, la date se lit sans se modifier ; une ligne dit que le chef de centre ou l'adjoint la corrige.
- À l'enregistrement, le **chef de centre et l'adjoint** reçoivent chacun la même ligne dans leur cloche : « Thomas Agent a renseigné le 3 mars 2014 comme date d'engagement. » Pas de notification sur le téléphone, pas d'e-mail.
- Grade, date de nomination, profil et entrée au centre restent aux chefs. Une personne extérieure n'a pas ce champ.

## Règles

- Refus côté socle si une autre date existe déjà (pas seulement côté écran) ; la même date renvoyée est ignorée. Si deux envois se croisent, seule la première date est écrite, et les chefs ne sont prévenus que si elle l’a été.
- Date plausible : pas dans le futur, pas avant la naissance plus 16 ans si la naissance est connue, sinon pas avant 1950.
- Journal : le nom du champ seulement, comme le reste du profil.
- Si l'agent est lui-même chef de centre ou adjoint, l'autre est prévenu, pas lui.

## Contraintes

- Pas de migration : la colonne existe.
- Offre gratuite Cloudflare : aucune requête de plus au chargement du profil ; l'enregistrement reste dans un `base.batch`.
- Données de Laillé : les dates provisoires de l'import (1 an pour tous) seront vidées à part, dans la base de Laillé, avec l'accord du porteur. Hors de ce lot.

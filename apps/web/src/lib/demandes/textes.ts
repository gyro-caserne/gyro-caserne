// Les textes des demandes aux référents, dits pour l'agent.

// Les messages du socle sur le réglage d'un rôle.
const PHRASES_REGLAGE: Record<string, string> = {
	'Trop d’étapes': 'Six étapes au plus, en plus des étapes fixes.',
	'Nom d’étape vide': 'Donnez un nom à chaque étape.',
	'Nom d’étape trop long': 'Un nom d’étape tient en 30 caractères au plus.',
	'Nom d’étape en double': 'Chaque étape porte un nom différent, autre que Demandée, Prise en compte, Refusée ou Annulée.',
	'Étape occupée': 'Une demande en cours se trouve à cette étape. Elle ne se retire qu’une fois cette demande avancée ou finie. Vous pouvez la renommer.',
	'Étape inconnue': 'Une étape a changé entre-temps. Rechargez la page.',
	'Demandes en cours': 'Des demandes sont en cours. Le rôle les reçoit jusqu’à ce qu’elles soient finies.',
	'Ce rôle ne reçoit pas de demandes': 'Ce rôle ne peut pas recevoir de demandes.'
};
export const phraseReglage = (message: string) => PHRASES_REGLAGE[message] ?? 'Le réglage n’a pas pu être enregistré.';

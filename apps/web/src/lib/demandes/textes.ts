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
	'Ce rôle ne reçoit pas de demandes': 'Ce rôle ne peut pas recevoir de demandes.',
	'Demande changée entre-temps': 'Le réglage ou une demande vient de changer. Rechargez la page, puis refaites votre geste.'
};
export const phraseReglage = (message: string) => PHRASES_REGLAGE[message] ?? 'Le réglage n’a pas pu être enregistré.';
export const estMessageReglage = (message: string) => Object.hasOwn(PHRASES_REGLAGE, message);

type Ton = 'ok' | 'info' | 'alerte' | 'danger' | 'neutre';

// Où en est une demande, en un ou deux mots et un ton (la pastille dit le mot : jamais la couleur seule). Une question en attente
// passe avant l'étape, la réponse arrivée aussi, pour qui la suit.
export function etatDemandeReferent(d: { etape: string; nomEtape: string; question: 'posee' | 'repondue' | null }): { texte: string; ton: Ton } {
	if (d.etape === 'faite') return { texte: d.nomEtape, ton: 'ok' };
	if (d.etape === 'refusee') return { texte: 'Refusée', ton: 'danger' };
	if (d.etape === 'annulee') return { texte: 'Annulée', ton: 'neutre' };
	if (d.question === 'posee') return { texte: 'Question posée', ton: 'alerte' };
	if (d.question === 'repondue') return { texte: 'Réponse reçue', ton: 'alerte' };
	if (d.etape === 'demandee') return { texte: 'Demandée', ton: 'alerte' };
	return { texte: d.nomEtape, ton: 'info' };
}

// Les lignes du fil ; une étape atteinte se dit par son nom.
const TEXTES_FIL: Record<string, string> = {
	prise: 'Prise en compte',
	reprise: 'Reprise en main',
	question: 'Question',
	reponse: 'Réponse',
	precision: 'Précision',
	refus: 'Refusée',
	annulation: 'Annulée'
};
export const texteDuFil = (f: { quoi: string; etape: string | null }) => (f.quoi === 'etape' || f.quoi === 'fin' ? (f.etape ?? 'Étape') : (TEXTES_FIL[f.quoi] ?? f.quoi));

// Les messages du socle sur une demande et ses gestes.
const PHRASES: Record<string, string> = {
	'Demande vide': 'Décrivez votre besoin, ce qu’il vous faut et pourquoi.',
	'Demande trop longue': 'La demande est trop longue (500 caractères au plus).',
	'Réservé aux agents du centre': 'Les demandes sont réservées aux agents du centre.',
	'Ce rôle ne reçoit pas de demandes': 'Choisissez à qui adresser la demande.',
	'Message vide': 'Écrivez votre message.',
	'Texte trop long': 'Le message est trop long (500 caractères au plus).',
	'Refus sans explication': 'Expliquez le refus en un mot. L’agent le lira.',
	'Étape impossible': 'Choisissez une étape placée après l’étape actuelle.',
	'Geste impossible': 'Ce geste n’est plus possible. La demande a avancé.',
	'Demande changée entre-temps': 'La demande vient de changer. Elle est rechargée, refaites votre geste.'
};
export const phraseDemande = (message: string) => PHRASES[message] ?? 'Ce geste n’a pas pu être enregistré.';

// Le titre d'une demande : son texte sur une ligne, coupé à la fin d'un mot autour de `max` caractères, avec « … » comme les
// autres titres coupés. Le texte complet reste dans le fil.
export function titreDeDemande(texte: string, max = 60): string {
	const ligne = texte.replace(/\s+/g, ' ').trim();
	if (ligne.length <= max) return ligne;
	const coupe = ligne.slice(0, max + 1);
	const fin = coupe.lastIndexOf(' ');
	return `${(fin > max / 2 ? coupe.slice(0, fin) : ligne.slice(0, max)).replace(/[\s,;:.!?-]+$/, '')}…`;
}

// Les étapes du rôle, dans l'ordre d'une demande, en une ligne (« Demandée, Prise en compte, Commandée, Livrée »).
export const etapesEnUneLigne = (r: { etapes: { nom: string }[]; derniere: string }) => ['Demandée', 'Prise en compte', ...r.etapes.map((e) => e.nom), r.derniere].join(', ');

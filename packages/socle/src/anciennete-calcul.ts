// L'ancienneté de service, comptée depuis l'engagement SPV (décision 0047). Sans base : la fiche, Moi et les tests s'en servent.
// Dates au format AAAA-MM-JJ.

// Par défaut, un palier tous les 5 ans.
export const PALIERS_PAR_DEFAUT = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
// Pas de palier à 1 an : « 1 an de service » n'est pas une étape fêtée.
export const PALIER_MIN = 2;
export const PALIER_MAX = 60;

// « 10 ans », jamais coupé en fin de ligne (espace insécable) ; « 1 an ». Pour tout texte d'ancienneté : écrans, cloche, e-mail.
export const ans = (n: number) => `${n}\u00a0${n > 1 ? 'ans' : 'an'}`;

// Les échelons de la médaille d'honneur des sapeurs-pompiers. Ils disent où en est l'ancienneté, pas qu'une médaille a été remise.
export const ECHELONS = [
	{ annees: 40, echelon: 'grand_or' },
	{ annees: 30, echelon: 'or' },
	{ annees: 25, echelon: 'vermeil' },
	{ annees: 20, echelon: 'argent' },
	{ annees: 10, echelon: 'bronze' }
] as const;
export type Echelon = (typeof ECHELONS)[number]['echelon'];
export const NOMS_ECHELON: Record<Echelon, string> = { bronze: 'bronze', argent: 'argent', vermeil: 'vermeil', or: 'or', grand_or: 'grand or' };

export type Anciennete = {
	annees: number | null;
	auCentre: number | null;
	echelon: Echelon | null;
	// `part` : de 0 à 1, le chemin fait depuis le palier précédent (ou l'engagement).
	prochain: { annees: number; jour: string; part: number } | null;
};

const bissextile = (annee: number) => (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;

// Le jour anniversaire d'une date, une année donnée : un 29 février tombe le 28 les années non bissextiles.
function anniversaire(date: string, annee: number): string {
	const jour = date.slice(5) === '02-29' && !bissextile(annee) ? '02-28' : date.slice(5);
	return `${String(annee).padStart(4, '0')}-${jour}`;
}

// Les années pleines entre deux dates, la nouvelle année comptée au jour anniversaire. Jamais moins de 0.
export function anneesEntre(debut: string, jour: string): number {
	const annee = Number(jour.slice(0, 4));
	const n = annee - Number(debut.slice(0, 4)) - (jour < anniversaire(debut, annee) ? 1 : 0);
	return Math.max(0, n);
}

export const dateDuPalier = (engagement: string, annees: number) => anniversaire(engagement, Number(engagement.slice(0, 4)) + annees);

export const echelonDe = (annees: number): Echelon | null => ECHELONS.find((e) => annees >= e.annees)?.echelon ?? null;

const jours = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000;

export function anciennete(engagement: string | null, entree: string | null, aujourdhui: string, paliers: number[]): Anciennete {
	const auCentre = entree ? anneesEntre(entree, aujourdhui) : null;
	if (!engagement) return { annees: null, auCentre, echelon: null, prochain: null };
	const annees = anneesEntre(engagement, aujourdhui);
	const suivant = paliers.find((p) => p > annees);
	let prochain: Anciennete['prochain'] = null;
	if (suivant !== undefined) {
		const precedent = [...paliers].reverse().find((p) => p <= annees);
		const depart = precedent === undefined ? engagement : dateDuPalier(engagement, precedent);
		const jour = dateDuPalier(engagement, suivant);
		const part = Math.min(1, Math.max(0, (jours(aujourdhui) - jours(depart)) / (jours(jour) - jours(depart))));
		prochain = { annees: suivant, jour, part };
	}
	return { annees, auCentre, echelon: echelonDe(annees), prochain };
}

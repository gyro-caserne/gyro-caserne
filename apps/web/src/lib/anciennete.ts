import { ans, NOMS_ECHELON, type Anciennete } from '@gyro-caserne/socle';
import { formatDeDate } from '@gyro-caserne/socle/dates';

// Les textes du bloc d'ancienneté (fiche, Moi). Sans aucune date, rien à montrer : null.
export type TextesAnciennete = { nombre: string; sous: string; echelon: string | null; prochain: string | null; part: number | null };

const annees = (n: number) => (n === 0 ? 'Moins d’un an' : ans(n));
// « 3 mars 2029 », « 1er avril 2030 ».
export const dateEnLettres = (iso: string) => formatDeDate({ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)).replace(/^1(?=\s)/, '1er');

export function textesAnciennete(a: Anciennete): TextesAnciennete | null {
	if (a.annees === null) return a.auCentre === null ? null : { nombre: annees(a.auCentre), sous: 'au centre', echelon: null, prochain: null, part: null };
	const centre = a.auCentre === null ? '' : a.auCentre >= a.annees ? ' au centre' : `, dont ${a.auCentre === 0 ? 'moins d’un an' : a.auCentre} au centre`;
	return {
		nombre: annees(a.annees),
		sous: `de service${centre}`,
		echelon: a.echelon ? `Échelon ${NOMS_ECHELON[a.echelon]}` : null,
		prochain: a.prochain ? `Prochain palier, ${ans(a.prochain.annees)} le ${dateEnLettres(a.prochain.jour)}` : null,
		part: a.prochain ? Math.round(a.prochain.part * 100) : null
	};
}

// « Claire Martin et Marc Petit vous félicitent. » : trois noms au plus, puis un nombre.
export function phraseFelicitations(par: { prenom: string; nom: string }[]): string {
	if (par.length === 0) return '';
	const noms = par.map((p) => `${p.prenom} ${p.nom}`.trim());
	const liste = noms.length <= 3 ? noms : [...noms.slice(0, 2), `${noms.length - 2} autres collègues`];
	return `${new Intl.ListFormat('fr', { type: 'conjunction' }).format(liste)} vous ${par.length === 1 ? 'félicite' : 'félicitent'}.`;
}

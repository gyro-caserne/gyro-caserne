import { eq } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { exigerDateHeure } from '../dates.ts';
import { aLeDroit, type Acteur } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import { nomActeur } from '../actions/personnes.ts';
import { reglageCourt } from '../schema.ts';

// Les durées proposées au remplacement court, réglées par le centre (Réglages). Seules les nouvelles demandes les suivent.

export const DUREES_COURT = [1, 2, 3, 4] as const;
export const DUREES_COURT_PAR_DEFAUT = [2, 3];

// La lecture des durées, à placer dans un batch.
export const requeteDureesCourt = (base: Base) => base.select({ durees: reglageCourt.durees }).from(reglageCourt).where(eq(reglageCourt.id, 1));
export const dureesDe = (lignes: { durees: string }[]): number[] => (lignes[0] ? (JSON.parse(lignes[0].durees) as number[]) : DUREES_COURT_PAR_DEFAUT);

export async function lireDureesCourt(base: Base): Promise<number[]> {
	return dureesDe(await requeteDureesCourt(base));
}

// « 2 h ou 3 h », « 1 h, 2 h ou 4 h », « 2 h ».
export const texteDurees = (durees: number[]) => {
	const h = durees.map((d) => `${d} h`);
	return h.length === 1 ? h[0]! : `${h.slice(0, -1).join(', ')} ou ${h.at(-1)}`;
};

// Avec le droit de gérer les listes du centre (chef de centre, adjoint) : de 1 à 4 h, rangées, sans doublon. Au moins une.
export async function reglerDureesCourt(base: Base, acteur: Acteur, durees: number[], maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await aLeDroit(base, acteur, 'GERER_LISTES', { type: 'centre' }, aujourdhui))) throw new RefusDroit('GERER_LISTES', { type: 'centre' });
	if (!durees.every((d) => (DUREES_COURT as readonly number[]).includes(d))) throw new DonneeInvalide('Durée de 1 à 4 h');
	const rangees = [...new Set(durees)].sort((a, b) => a - b);
	if (rangees.length === 0) throw new DonneeInvalide('Au moins une durée');
	const valeur = JSON.stringify(rangees);
	await base.batch([
		base.insert(reglageCourt).values({ id: 1, durees: valeur }).onConflictDoUpdate({ target: reglageCourt.id, set: { durees: valeur } }),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'regler_court', cibleType: 'centre', cibleId: null, details: { durees: rangees } }, maintenant)
	]);
}

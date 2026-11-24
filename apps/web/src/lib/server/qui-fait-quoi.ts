import { estGestionnaire, quiFaitQuoi, RefusDroit, type Acteur } from '@gyro-caserne/socle';

// Qui fait quoi pour une fiche de réglage (un rôle, un comité) : null pour qui n'y a pas accès (le bloc « Titulaires » ne s'affiche pas).
// `peutNominations` vient du layout ; « Voir sa fiche » pour qui ouvre les fiches (droits déjà lus, aucune requête).
export async function lireQuiFaitQuoi(base: App.Locals['base'], acteur: Acteur, aujourdhui: string, peutNominations: boolean) {
	try {
		const vue = await quiFaitQuoi(base, acteur, aujourdhui, { gestes: peutNominations });
		return { vue, fiches: vue.gestes !== null && (await estGestionnaire(base, acteur, aujourdhui)) };
	} catch (erreur) {
		if (erreur instanceof RefusDroit) return null;
		throw erreur;
	}
}

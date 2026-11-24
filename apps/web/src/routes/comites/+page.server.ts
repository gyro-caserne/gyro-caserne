import { error, redirect } from '@sveltejs/kit';
import { estGestionnaire, quiFaitQuoi, RefusDroit } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { actionsNommer } from '#lib/server/actions-nommer.ts';
import type { Actions, PageServerLoad } from './$types';

// Caserne → Qui fait quoi : qui fait quoi au centre. Pour qui peut nommer (d'après le layout), les gestes, lus dans le même envoi.
export const load: PageServerLoad = async ({ locals, parent }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();
	const { peutNominations } = await parent();
	try {
		const vue = await quiFaitQuoi(base, acteur, aujourdhui, { gestes: peutNominations });
		// « Voir sa fiche » dans le volet d'une personne : pour qui ouvre les fiches (droits déjà lus, aucune requête).
		return { ...vue, aujourdhui, fiches: vue.gestes !== null && (await estGestionnaire(base, acteur, aujourdhui)) };
	} catch (erreur) {
		if (erreur instanceof RefusDroit) error(403, 'Réservé aux agents du centre');
		throw erreur;
	}
};

export const actions: Actions = actionsNommer;

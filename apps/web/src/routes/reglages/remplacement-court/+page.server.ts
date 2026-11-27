import { error } from '@sveltejs/kit';
import { lireDureesCourt, reglerDureesCourt } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { accesReglages, echec } from '#lib/server/formulaire-reglages.ts';
import type { Actions, PageServerLoad } from './$types';

// Les durées du remplacement court : réservées à qui gère les listes du centre (chef de centre, adjoint), comme l'ancienneté.
async function acces(locals: App.Locals) {
	const a = await accesReglages(locals, aujourdhuiParis());
	if (!a.listes) error(403, 'Accès réservé à qui gère les listes du centre');
	return a;
}

export const load: PageServerLoad = async ({ locals }) => {
	const { base } = await acces(locals);
	return { durees: await lireDureesCourt(base) };
};

export const actions: Actions = {
	// Champs : « duree », une fois par durée cochée (en heures).
	enregistrer: async ({ locals, request }) => {
		const { acteur, base } = await acces(locals);
		const durees = (await request.formData()).getAll('duree').map((v) => (typeof v === 'string' && /^\d$/.test(v) ? Number(v) : NaN));
		try {
			await reglerDureesCourt(base, acteur, durees, maintenantParis());
		} catch (erreur) {
			return echec(erreur, 'court');
		}
		return { cible: 'court', succes: 'Durées enregistrées. Les nouvelles demandes les suivent.' };
	}
};

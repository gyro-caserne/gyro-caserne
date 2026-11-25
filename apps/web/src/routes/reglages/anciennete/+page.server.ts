import { error } from '@sveltejs/kit';
import { lirePaliers, reglerPaliers } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { accesReglages, echec } from '#lib/server/formulaire-reglages.ts';
import type { Actions, PageServerLoad } from './$types';

// Les paliers d'ancienneté du centre (décision 0047) : réservés à qui gère les listes du centre, comme l'armement.
async function acces(locals: App.Locals) {
	const a = await accesReglages(locals, aujourdhuiParis());
	if (!a.listes) error(403, 'Accès réservé à qui gère les listes du centre');
	return a;
}

export const load: PageServerLoad = async ({ locals }) => {
	const { base } = await acces(locals);
	return { paliers: await lirePaliers(base) };
};

export const actions: Actions = {
	// Champs : « palier », une fois par palier coché (en années).
	enregistrer: async ({ locals, request }) => {
		const { acteur, base } = await acces(locals);
		const paliers = (await request.formData()).getAll('palier').map((v) => (typeof v === 'string' && /^\d{1,2}$/.test(v) ? Number(v) : NaN));
		try {
			await reglerPaliers(base, acteur, paliers, maintenantParis());
		} catch (erreur) {
			return echec(erreur, 'anciennete');
		}
		return { cible: 'anciennete', succes: 'Paliers d’ancienneté enregistrés.' };
	}
};

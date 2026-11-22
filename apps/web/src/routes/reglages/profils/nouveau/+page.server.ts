import { error, redirect } from '@sveltejs/kit';
import { creerProfil, type TypePersonne } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { accesReglages, echec, texte } from '#lib/server/formulaire-reglages.ts';
import type { Actions, PageServerLoad } from './$types';

// Les profils : chef de centre, adjoint et super administrateur seulement.
async function acces(locals: App.Locals) {
	const aujourdhui = aujourdhuiParis();
	const { acteur, base, pouvoir } = await accesReglages(locals, aujourdhui);
	if (!pouvoir) error(403, 'Accès réservé au chef de centre, à son adjoint et au super administrateur');
	return { acteur, base, aujourdhui };
}

export const load: PageServerLoad = async ({ locals }) => {
	await acces(locals);
	return {};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const { acteur, base, aujourdhui } = await acces(locals);
		const formulaire = await request.formData();
		const valeurs = { nom: texte(formulaire, 'nom') ?? '', type: texte(formulaire, 'type') ?? '' };
		let id: number;
		try {
			id = await creerProfil(base, acteur, { nom: valeurs.nom, typePersonne: valeurs.type as TypePersonne }, aujourdhui);
		} catch (erreur) {
			return echec(erreur, 'profil-nouveau', valeurs);
		}
		redirect(303, `/reglages/profils/${id}`);
	}
};

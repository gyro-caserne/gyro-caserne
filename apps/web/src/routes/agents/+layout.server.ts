import { error, redirect } from '@sveltejs/kit';
import { estExterieur, estGestionnaire, FILTRES_GESTION, listeGestion, vueEffectif } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();

	if (!(await estGestionnaire(base, acteur, aujourdhui))) {
		// L'effectif est réservé aux agents du centre, comme les fiches.
		if (await estExterieur(base, acteur)) error(403, 'La liste des agents est réservée aux agents du centre.');
		return { gestion: false as const, groupes: await vueEffectif(base, aujourdhui) };
	}

	const texte = url.searchParams.get('texte')?.trim() ?? '';
	const filtre = FILTRES_GESTION.find((f) => f === url.searchParams.get('filtre'));
	const { groupes, comptes } = await listeGestion(base, acteur, { texte, filtre }, aujourdhui);
	return { gestion: true as const, groupes, comptes, filtres: { texte, filtre: filtre ?? '' } };
};

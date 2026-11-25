import { error, redirect } from '@sveltejs/kit';
import { demandesDuRole, iconeDuRole, peutReglerDemandes, RefusDroit } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { idDe } from '#lib/server/engins.ts';
import { actionReglage, apercuReglage } from '#lib/server/reglage-demandes.ts';
import type { Actions, PageServerLoad } from './$types';

async function lireRole(locals: App.Locals, brut: string) {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();
	try {
		return { ...(await demandesDuRole(base, acteur, idDe(brut), aujourdhui)), aujourdhui };
	} catch (erreur) {
		if (erreur instanceof RefusDroit) error(403, 'Réservé aux titulaires du rôle, au chef de centre et à son adjoint.');
		throw erreur;
	}
}

// Les demandes reçues par un rôle : en cours (les nouvelles d'abord), puis terminées. En tête, la carte de ses étapes et leur réglage,
// pour ses titulaires et qui gère les rôles.
export const load: PageServerLoad = async ({ locals, params }) => {
	const { role, aujourdhui, ...liste } = await lireRole(locals, params.id);
	const regler = role.demandes === null ? null : await peutReglerDemandes(locals.base, locals.acteur!, role.id, true, aujourdhui);
	return { ...liste, role: { id: role.id, nom: role.nom, icone: iconeDuRole({ ...role, portee: role.typePerimetre }), demandes: role.demandes }, regler };
};

export const actions: Actions = {
	// Les étapes du rôle (les titulaires ne décochent pas : le socle le refuse).
	demandes: async ({ locals, params, request }) => {
		const { role } = await lireRole(locals, params.id);
		return actionReglage(locals, role.id, role.demandes, await request.formData());
	},
	// Monter, descendre, retirer, ajouter : la saisie revient changée, rien n'est enregistré.
	apercu: async ({ locals, params, request }) => {
		const { role } = await lireRole(locals, params.id);
		return apercuReglage(await request.formData(), role.demandes);
	}
};

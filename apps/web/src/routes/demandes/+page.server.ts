import { fail, redirect } from '@sveltejs/kit';
import { demanderAuReferent, DonneeInvalide, iconeDuRole, pageDesDemandes, peutDemander } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { phraseDemande } from '#lib/demandes/textes.ts';
import { envoyerDemandeParCourriel } from '#lib/server/courriel-demandes.ts';
import { champ, idDe } from '#lib/server/engins.ts';
import type { Actions, PageServerLoad } from './$types';

const icone = (r: { nom: string; icone: string | null; modele: string | null }) => iconeDuRole({ ...r, systeme: null, portee: 'centre' });

// Caserne → Faire une demande : la nouvelle demande à un référent, mes demandes, et celles que je reçois (titulaire, chef, adjoint).
// `?role=` choisit d'avance le rôle (depuis Comités et référents).
export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const [page, demande] = await Promise.all([pageDesDemandes(base, acteur, aujourdhuiParis()), peutDemander(base, acteur)]);
	const role = idDe(url.searchParams.get('role'));
	return {
		...page,
		roles: page.roles.map((r) => ({ id: r.id, nom: r.nom, icone: icone(r) })),
		recus: page.recus.map((r) => ({ ...r, icone: icone(r) })),
		peutDemander: demande,
		choisi: page.roles.some((r) => r.id === role) ? role : page.roles.length === 1 ? page.roles[0]!.id : null
	};
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		const { acteur, base } = locals;
		if (!acteur) redirect(303, '/connexion');
		const f = await request.formData();
		const texte = champ(f, 'texte');
		const role = idDe(champ(f, 'role'));
		let id: number;
		try {
			id = await demanderAuReferent(base, acteur, role, texte, maintenantParis());
		} catch (erreur) {
			if (erreur instanceof DonneeInvalide) return fail(400, { texte, role, champ: erreur.message === 'Ce rôle ne reçoit pas de demandes' ? 'role' : 'texte', message: phraseDemande(erreur.message) });
			throw erreur;
		}
		// Aussi par e-mail à ceux qui la reçoivent, après la réponse.
		envoyerDemandeParCourriel(locals, url, { genre: 'demande', id });
		redirect(303, `/demandes/${id}?envoyee`);
	}
};

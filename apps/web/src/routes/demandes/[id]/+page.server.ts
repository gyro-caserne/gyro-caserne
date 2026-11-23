import { error, fail, redirect } from '@sveltejs/kit';
import { DonneeInvalide, gesteDemande, iconeDuRole, lireDemandeReferent, type GesteDemande } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { phraseDemande } from '#lib/demandes/textes.ts';
import { champ, idDe } from '#lib/server/engins.ts';
import type { Actions, PageServerLoad } from './$types';

// Une demande à un référent : son suivi, son fil et les gestes permis. Inconnue (404) pour qui n'a pas à la voir.
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	try {
		const demande = await lireDemandeReferent(base, acteur, idDe(params.id), maintenantParis());
		return { demande: { ...demande, icone: iconeDuRole({ nom: demande.role, icone: demande.icone, modele: null, systeme: null, portee: 'centre' }) }, envoyee: url.searchParams.has('envoyee') };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Cette demande n’existe pas.');
		throw erreur;
	}
};

const SUCCES: Record<GesteDemande['quoi'], string> = {
	prendre: 'Vous l’avez prise en compte.',
	reprendre: 'Vous l’avez reprise.',
	question: 'Question envoyée.',
	repondre: 'Message envoyé.',
	avancer: 'Étape enregistrée.',
	refuser: 'Demande refusée.',
	annuler: 'Demande annulée.'
};

function gesteDe(f: FormData): GesteDemande | null {
	const texte = champ(f, 'texte');
	switch (champ(f, 'quoi')) {
		case 'prendre':
			return { quoi: 'prendre' };
		case 'reprendre':
			return { quoi: 'reprendre' };
		case 'question':
			return { quoi: 'question', texte };
		case 'repondre':
			return { quoi: 'repondre', texte };
		case 'avancer':
			// Une étape inconnue passe telle quelle : le socle la refuse.
			return { quoi: 'avancer', vers: champ(f, 'vers'), texte };
		case 'refuser':
			return { quoi: 'refuser', texte };
		case 'annuler':
			return { quoi: 'annuler' };
		default:
			return null;
	}
}

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const { acteur, base } = locals;
		if (!acteur) redirect(303, '/connexion');
		const geste = gesteDe(await request.formData());
		if (!geste) return fail(400, { quoi: null, message: 'Ce geste n’existe pas.' });
		try {
			await gesteDemande(base, acteur, idDe(params.id), geste, maintenantParis());
		} catch (erreur) {
			if (erreur instanceof DonneeInvalide) {
				if (erreur.message === 'Demande inconnue') error(404, 'Cette demande n’existe pas.');
				return fail(400, { quoi: geste.quoi, message: phraseDemande(erreur.message) });
			}
			throw erreur;
		}
		return { quoi: geste.quoi, succes: SUCCES[geste.quoi] };
	}
};

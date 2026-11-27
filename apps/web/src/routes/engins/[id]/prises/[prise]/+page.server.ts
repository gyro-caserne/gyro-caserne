import { error, redirect } from '@sveltejs/kit';
import centre from '$centre';
import { DonneeInvalide, lirePriseFaite } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { accesEngins, idDe } from '#lib/server/engins.ts';
import type { PageServerLoad } from './$types';

// Une prise validée, telle qu'elle a été faite (la fiche de son époque).
export const load: PageServerLoad = async ({ locals, params }) => {
	const { acteur, base } = await accesEngins(locals);
	try {
		const prise = await lirePriseFaite(base, acteur, idDe(params.prise), maintenantParis(), centre.astreinte);
		if (prise.engin.id !== idDe(params.id)) error(404, 'Cette prise n’existe pas.');
		// Rouverte pendant sa relève : la prise en cours, où elle se corrige. Après, elle se relit validée.
		if (prise.enCours && prise.courante) redirect(303, `/engins/${params.id}/prise`);
		return { prise };
	} catch (erreur) {
		if (erreur instanceof DonneeInvalide) error(404, 'Cette prise n’existe pas.');
		throw erreur;
	}
};

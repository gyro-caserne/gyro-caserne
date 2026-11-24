import { redirect } from '@sveltejs/kit';
import { demandeReprise } from '@gyro-caserne/socle';
import { idDe } from '#lib/server/engins.ts';
import type { PageServerLoad } from './$types';

// Une ancienne adresse d'une demande d'habillement (notifications, journal) : la demande reprise, sinon « Mes demandes ».
// La demande vérifie elle-même qui peut la voir.
export const load: PageServerLoad = async ({ locals, params }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const id = idDe(params.id);
	const reprise = id > 0 ? await demandeReprise(base, id) : null;
	redirect(303, reprise === null ? '/demandes' : `/demandes/${reprise}`);
};

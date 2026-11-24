import { redirect } from '@sveltejs/kit';
import { roleDeLHabillement } from '@gyro-caserne/socle';
import type { PageServerLoad } from './$types';

// Caserne → Habillement : « Faire une demande », le référent habillement déjà choisi (décision 0044).
export const load: PageServerLoad = async ({ locals }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const role = await roleDeLHabillement(base);
	redirect(303, role === null ? '/demandes' : `/demandes?role=${role}`);
};

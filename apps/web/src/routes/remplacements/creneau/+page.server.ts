import { fail, redirect } from '@sveltejs/kit';
import centre from '$centre';
import { demanderCreneau, pourDemanderCreneau } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { ouRefus } from '#lib/server/planning.ts';
import { exigerConnecte, refus } from '#lib/server/remplacements.ts';
import type { Actions, PageServerLoad } from './$types';

const MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const moment = (brut: unknown) => (typeof brut === 'string' && MOMENT.test(brut) ? brut : null);
const entier = (brut: unknown) => (typeof brut === 'string' && /^\d{1,9}$/.test(brut) ? Number(brut) : null);
const ORDRE = ['quand', 'qui', 'verifier'] as const;
type Etape = (typeof ORDRE)[number];

// Le remplacement sur un créneau, une page par étape ; tout l'état est dans l'adresse (marche sans JavaScript, retour possible).
// debut, fin (date et heure, à la minute), pour (tous ou un collègue), q (recherche), etape.
// Sans créneau, rien n'est lu : la vérification et les collègues libres viennent avec lui, dans le même lot.
export const load: PageServerLoad = async ({ locals, url }) => {
	const acteur = exigerConnecte(locals);
	if (acteur.type !== 'personne') redirect(303, '/remplacements');
	const maintenant = maintenantParis().slice(0, 16);
	const q = url.searchParams;
	const debut = moment(q.get('debut'));
	const fin = moment(q.get('fin'));
	const lu = await ouRefus(pourDemanderCreneau(locals.base, acteur, maintenant, centre.astreinte, debut && fin ? { debut, fin } : null), 'Réservé aux agents du centre.');
	const pourBrut = q.get('pour');
	const pour = pourBrut === 'tous' ? ('tous' as const) : (lu.candidats.find((c) => c.id === entier(pourBrut)) ?? null);

	// L'étape montrée : celle demandée, si les précédentes sont faites ; sinon la première qui manque, avec la raison.
	const faite: Record<Etape, boolean> = { quand: lu.creneau !== null, qui: pour !== null, verifier: false };
	const index = Math.max(0, ORDRE.indexOf((q.get('etape') ?? 'quand') as Etape));
	const manquante = ORDRE.slice(0, index).find((e) => !faite[e]);
	const etape = manquante ?? ORDRE[index]!;
	const raison = manquante === 'quand' ? (lu.erreur ?? 'Indiquez le début et la fin du créneau') : 'Choisissez « Tout le monde » ou un collègue';
	const message = manquante && q.has('etape') ? `${raison}.` : null;

	return { maintenant, etape, message, debut: debut ?? '', fin: fin ?? '', creneau: lu.creneau, candidats: lu.candidats, pour, recherche: q.get('q') ?? '' };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const acteur = exigerConnecte(locals);
		const f = await request.formData();
		const debut = moment(f.get('debut'));
		const fin = moment(f.get('fin'));
		const pour = f.get('pour');
		const cible = pour === 'tous' ? null : entier(pour);
		const mot = f.get('mot');
		if (!debut || !fin) return fail(400, { message: 'Indiquez le début et la fin du créneau.' });
		if (pour !== 'tous' && cible === null) return fail(400, { message: 'Choisissez « Tout le monde » ou un collègue.' });
		let id: number;
		try {
			id = await demanderCreneau(locals.base, acteur, { debut, fin, cibleId: cible, mot: typeof mot === 'string' ? mot : null }, maintenantParis(), centre.astreinte);
		} catch (erreur) {
			return refus(erreur);
		}
		redirect(303, `/remplacements/${id}?envoyee`);
	}
};

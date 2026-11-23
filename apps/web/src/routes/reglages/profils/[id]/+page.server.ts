import { error, redirect } from '@sveltejs/kit';
import { enregistrerProfil, listerProfils, renommerProfil, RefusDroit, supprimerProfil, type NiveauOuvert } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { appliquerNiveaux } from '#lib/paquets.ts';
import { accesReglages, echec, manque, niveauxChoisis, numero, texte, type Reponse } from '#lib/server/formulaire-reglages.ts';
import type { Actions, PageServerLoad } from './$types';

// Les profils : chef de centre, adjoint et super administrateur seulement.
async function lireProfil(locals: App.Locals, brut: string) {
	const aujourdhui = aujourdhuiParis();
	const { acteur, base, pouvoir } = await accesReglages(locals, aujourdhui);
	if (!pouvoir) error(403, 'Accès réservé au chef de centre, à son adjoint et au super administrateur');
	const id = numero(brut);
	const profil = id === null ? undefined : (await listerProfils(base, acteur, aujourdhui)).find((p) => p.id === id);
	if (!profil) error(404, 'Profil introuvable');
	return { acteur, base, aujourdhui, profil };
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { profil } = await lireProfil(locals, params.id);
	return { profil };
};

export const actions: Actions = {
	// Un seul « Enregistrer » : les droits et, pour un extérieur, les murs ouverts (« mur-<clé> » vaut 0 aucun accès, 1 lecture, 2 écriture),
	// en un geste du socle (une lecture et une écriture groupées) ; chacun garde sa ligne au journal.
	default: async ({ locals, params, request }) => {
		const { acteur, base } = locals;
		if (!acteur) redirect(303, '/connexion');
		const id = numero(params.id);
		if (id === null) error(404, 'Profil introuvable');
		const cible = 'profil';
		const formulaire = await request.formData();
		const murs: Record<string, NiveauOuvert> = {};
		for (const [cle, valeur] of formulaire.entries())
			if (cle.startsWith('mur-') && valeur !== '0') murs[cle.slice('mur-'.length)] = (valeur === '1' ? 'lecture' : valeur === '2' ? 'ecriture' : String(valeur)) as NiveauOuvert;
		try {
			const { nom } = await enregistrerProfil(base, acteur, id, { droits: (avant) => appliquerNiveaux(avant, niveauxChoisis(formulaire)), murs }, aujourdhuiParis());
			return { cible, succes: `Le profil « ${nom} » est enregistré.` } satisfies Reponse;
		} catch (erreur) {
			// Pas le droit de régler les profils : la page entière est refusée, comme à l'affichage.
			if (erreur instanceof RefusDroit) error(403, 'Accès réservé au chef de centre, à son adjoint et au super administrateur');
			if (erreur instanceof Error && erreur.message === 'Profil inconnu') error(404, 'Profil introuvable');
			return echec(erreur, cible);
		}
	},
	renommer: async ({ locals, params, request }) => {
		const { acteur, base, aujourdhui, profil } = await lireProfil(locals, params.id);
		const cible = 'renommer';
		const nom = texte(await request.formData(), 'nom') ?? '';
		try {
			await renommerProfil(base, acteur, profil.id, nom, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible, { nom });
		}
		return { cible, succes: `Le profil s’appelle désormais « ${nom.trim()} ».` } satisfies Reponse;
	},
	supprimer: async ({ locals, params, request }) => {
		const { acteur, base, aujourdhui, profil } = await lireProfil(locals, params.id);
		const cible = 'supprimer';
		if (texte(await request.formData(), 'confirmation') !== 'oui') return manque(cible, 'Cochez « Je confirme » pour continuer.');
		try {
			await supprimerProfil(base, acteur, profil.id, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible);
		}
		redirect(303, '/reglages');
	}
};

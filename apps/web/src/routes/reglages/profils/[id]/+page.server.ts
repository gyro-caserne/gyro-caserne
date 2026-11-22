import { error, redirect } from '@sveltejs/kit';
import { listerProfils, modifierDroitsProfil, modifierMursOuverts, renommerProfil, supprimerProfil, type Droit, type NiveauOuvert } from '@gyro-caserne/socle';
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
	default: async ({ locals, params, request }) => {
		const { acteur, base, aujourdhui, profil } = await lireProfil(locals, params.id);
		const cible = 'profil';
		try {
			await modifierDroitsProfil(base, acteur, profil.id, appliquerNiveaux(profil.droits as Droit[], niveauxChoisis(await request.formData())), aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible);
		}
		return { cible, succes: `Le profil « ${profil.nom} » est enregistré.` } satisfies Reponse;
	},
	// Un choix par mur : « mur-<clé> » vaut 0 (aucun accès), 1 (lecture) ou 2 (écriture).
	murs: async ({ locals, params, request }) => {
		const { acteur, base, aujourdhui, profil } = await lireProfil(locals, params.id);
		const cible = 'murs';
		const ouverts: Record<string, NiveauOuvert> = {};
		for (const [cle, valeur] of (await request.formData()).entries())
			if (cle.startsWith('mur-') && valeur !== '0') ouverts[cle.slice('mur-'.length)] = (valeur === '1' ? 'lecture' : valeur === '2' ? 'ecriture' : String(valeur)) as NiveauOuvert;
		try {
			await modifierMursOuverts(base, acteur, profil.id, ouverts, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible);
		}
		return { cible, succes: 'Les murs ouverts sont enregistrés.' } satisfies Reponse;
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

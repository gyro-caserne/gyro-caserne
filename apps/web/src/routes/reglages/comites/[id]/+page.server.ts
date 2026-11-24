import { error } from '@sveltejs/kit';
import { dissoudreComite, iconeDuComite, listerComites, modifierComite, type NomIcone } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { accesReglages, echec, manque, numero, texte, type Reponse } from '#lib/server/formulaire-reglages.ts';
import { postesDuComite } from '#lib/nommer/postes.ts';
import { actionsNommerApres } from '#lib/server/actions-nommer.ts';
import { lireQuiFaitQuoi } from '#lib/server/qui-fait-quoi.ts';
import type { Actions, PageServerLoad } from './$types';

async function lireComite(locals: App.Locals, brut: string) {
	const aujourdhui = aujourdhuiParis();
	const acces = await accesReglages(locals, aujourdhui);
	if (!acces.comites) error(403, 'Accès réservé à qui gère les comités du centre');
	const id = numero(brut);
	const comite = id === null ? undefined : (await listerComites(acces.base, acces.acteur, aujourdhui)).find((c) => c.id === id);
	if (!comite) error(404, 'Comité introuvable');
	return { ...acces, aujourdhui, comite };
}

export const load: PageServerLoad = async ({ locals, params, parent, url }) => {
	const { acteur, base, aujourdhui, comite } = await lireComite(locals, params.id);
	// Le bloc « Titulaires » : ses membres, et pour qui peut y nommer, les mêmes gestes que Qui fait quoi (un envoi de plus).
	const qfq = comite.dissousLe === null ? await lireQuiFaitQuoi(base, acteur, aujourdhui, (await parent()).peutNominations) : null;
	return {
		comite,
		aujourdhui,
		titulairesDuComite: qfq && { ...postesDuComite(qfq.vue, comite.id), gestes: qfq.vue.gestes, fiches: qfq.fiches },
		// Juste après « Créer le comité » : le bloc s'ouvre et demande qui l'animera.
		nouveau: url.searchParams.has('nouveau')
	};
};

export const actions: Actions = {
	// Nommer, remplacer, finir : les gestes du bloc « Titulaires », pour qui ouvre cette page.
	...actionsNommerApres(({ locals, params }) => lireComite(locals, params.id ?? '')),

	modifier: async ({ locals, params, request }) => {
		const { acteur, base, aujourdhui, comite } = await lireComite(locals, params.id);
		const formulaire = await request.formData();
		const valeurs = { nom: texte(formulaire, 'nom') ?? '', theme: texte(formulaire, 'theme') ?? '', icone: texte(formulaire, 'icone') ?? '' };
		const cible = 'comite';
		// Tant que l'agent ne change pas l'icône affichée, on n'en enregistre pas : elle suit le thème.
		const choisie = valeurs.icone === '' || (comite.icone === null && valeurs.icone === iconeDuComite(comite)) ? undefined : (valeurs.icone as NomIcone);
		try {
			await modifierComite(base, acteur, comite.id, { nom: valeurs.nom, theme: valeurs.theme, icone: choisie }, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible, valeurs);
		}
		return { cible, succes: `Le comité « ${valeurs.nom.trim()} » est enregistré.` } satisfies Reponse;
	},

	dissoudre: async ({ locals, params, request }) => {
		const { acteur, base, aujourdhui, comite } = await lireComite(locals, params.id);
		const formulaire = await request.formData();
		const cible = 'dissoudre';
		if (texte(formulaire, 'confirmation') !== 'oui') return manque(cible, 'Cochez « Je confirme » pour continuer.');
		try {
			await dissoudreComite(base, acteur, comite.id, aujourdhui);
		} catch (erreur) {
			return echec(erreur, cible);
		}
		return { cible, succes: 'Le comité est dissous.' } satisfies Reponse;
	}
};

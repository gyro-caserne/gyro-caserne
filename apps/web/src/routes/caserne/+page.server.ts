import { redirect } from '@sveltejs/kit';
import { ouvreQuiFaitQuoi, listerAnomalies, listerEngins, quiFaitQuoi, voitLesEngins, vueEffectif } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { aPourvoir, postesDe } from '#lib/nommer/postes.ts';
import type { PageServerLoad } from './$types';

// Les droits (nommer, Réglages) viennent du layout. Ici, des chiffres utiles : l'effectif, les engins, et, pour qui peut nommer, les postes à pourvoir (le compte de Qui fait quoi).
export const load: PageServerLoad = async ({ locals, parent }) => {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	const aujourdhui = aujourdhuiParis();
	const { peutNominations } = await parent();
	const [groupes, voitEngins, comites] = await Promise.all([vueEffectif(base, aujourdhui), voitLesEngins(base, acteur, aujourdhui), ouvreQuiFaitQuoi(base, acteur)]);
	// Les engins présents au centre (les partis ne comptent pas) ; null pour qui ne les voit pas.
	// Et les anomalies ouvertes.
	const [liste, anomalies] = voitEngins ? await Promise.all([listerEngins(base, acteur, aujourdhui), listerAnomalies(base, acteur, aujourdhui, null)]) : [null, null];
	return {
		engins: liste ? liste.engins.filter((e) => e.situation !== 'parti').length : null,
		anomalies: anomalies ? anomalies.ouvertes.length : null,
		// « Qui fait quoi » : pas pour le compte de la réserve citoyenne, qui y serait refusé.
		comites,
		agents: groupes.filter((g) => g.cle !== 'exterieurs').reduce((n, g) => n + g.personnes.length, 0),
		aPourvoir: peutNominations && comites ? aPourvoir(postesDe(await quiFaitQuoi(base, acteur, aujourdhui, { gestes: true }))).length : null
	};
};

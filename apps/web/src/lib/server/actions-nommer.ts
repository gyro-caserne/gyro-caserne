import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { finirAttribution, remplacerTitulaire, terminerAttribution, type Acteur } from '@gyro-caserne/socle';
import { aujourdhuiParis, maintenantParis } from '#lib/aujourdhui.ts';
import { nommer } from './actions-attribution.ts';
import { echecAttribution } from './erreurs-attribution.ts';
import { dateValide, type Reponse } from './formulaire-agent.ts';

// Les gestes des volets « Nommer » et de la personne (Qui fait quoi, fiche d'un rôle, fiche d'un comité) : le socle décide des droits.
// La réponse porte `cible` (le volet à rouvrir après un refus) et, après une réussite, `succes`.
type Evenement = Pick<RequestEvent, 'locals' | 'request'>;

const entier = (brut: FormDataEntryValue | null) => (/^\d+$/.test(String(brut ?? '')) ? Number(brut) : null);

async function lire({ locals, request }: Evenement) {
	const { acteur, base } = locals;
	if (!acteur) redirect(303, '/connexion');
	return { acteur: acteur as Acteur, base, aujourdhui: aujourdhuiParis(), formulaire: await request.formData() };
}

export const actionsNommer = {
	nommer: async (e: Evenement) => {
		const { acteur, base, aujourdhui, formulaire } = await lire(e);
		const cible = `nommer-${String(formulaire.get('poste') ?? '')}`;
		const reponse = await nommer({ base, acteur, aujourdhui, formulaire, cible }, entier(formulaire.get('personneId')));
		return 'succes' in reponse ? { cible, succes: 'Nomination enregistrée.' } : reponse;
	},

	// Le nouveau titulaire et la date où il commence ; l'ancien finit la veille.
	remplacer: async (e: Evenement) => {
		const { acteur, base, aujourdhui, formulaire } = await lire(e);
		const mandat = entier(formulaire.get('attributionId'));
		const cible = `mandat-${mandat ?? ''}`;
		const valeurs = { personneId: String(formulaire.get('personneId') ?? ''), debut: String(formulaire.get('debut') ?? '').trim() };
		const personneId = entier(valeurs.personneId);
		const erreurs: Record<string, string> = {};
		if (personneId === null) erreurs.personneId = 'Choisissez un agent.';
		if (!valeurs.debut) erreurs.debut = 'Indiquez la date de début.';
		else if (!dateValide(valeurs.debut)) erreurs.debut = 'Date invalide';
		if (mandat === null || personneId === null || Object.keys(erreurs).length > 0) return fail<Reponse>(400, { cible, erreurs, valeurs });
		try {
			await remplacerTitulaire(base, acteur, { attributionId: mandat, personneId, debut: valeurs.debut }, aujourdhui, { maintenant: maintenantParis() });
		} catch (erreur) {
			return echecAttribution(erreur, { cible, valeurs });
		}
		return { cible, succes: 'Remplacement enregistré.' };
	},

	// « Finir le mandat » : grave, confirmé, avec sa date de fin.
	finir: async (e: Evenement) => {
		const { acteur, base, aujourdhui, formulaire } = await lire(e);
		const mandat = entier(formulaire.get('attributionId'));
		const cible = `mandat-${mandat ?? ''}`;
		const valeurs = { fin: String(formulaire.get('fin') ?? '').trim() };
		const erreurs: Record<string, string> = {};
		if (!valeurs.fin) erreurs.fin = 'Indiquez la date de fin.';
		else if (!dateValide(valeurs.fin)) erreurs.fin = 'Date invalide';
		if (formulaire.get('confirmation') !== 'oui') erreurs.confirmation = 'Cochez « Je confirme » pour finir le mandat.';
		if (mandat === null || Object.keys(erreurs).length > 0) return fail<Reponse>(400, { cible, erreurs, valeurs });
		try {
			await finirAttribution(base, acteur, mandat, valeurs.fin, aujourdhui);
		} catch (erreur) {
			return echecAttribution(erreur, { cible, valeurs });
		}
		return { cible, succes: 'Fin du mandat enregistrée.' };
	},

	// Un mandat qui n'a pas commencé : on annule la nomination, confirmée.
	terminer: async (e: Evenement) => {
		const { acteur, base, aujourdhui, formulaire } = await lire(e);
		const mandat = entier(formulaire.get('attributionId'));
		const cible = `mandat-${mandat ?? ''}`;
		if (formulaire.get('confirmation') !== 'oui') return fail<Reponse>(400, { cible, erreurs: { confirmation: 'Cochez « Je confirme » pour annuler la nomination.' } });
		if (mandat === null) return fail<Reponse>(400, { cible, message: 'Attribution inconnue' });
		try {
			await terminerAttribution(base, acteur, mandat, aujourdhui);
		} catch (erreur) {
			return echecAttribution(erreur, { cible });
		}
		return { cible, succes: 'Nomination annulée.' };
	}
};

// Les mêmes gestes, sur une page qui a sa propre règle d'entrée (la fiche d'un rôle, d'un comité) : elle passe d'abord.
export function actionsNommerApres(exiger: (e: RequestEvent) => Promise<unknown>) {
	const garde =
		<R>(geste: (e: Evenement) => Promise<R>) =>
		async (e: RequestEvent) => {
			await exiger(e);
			return geste(e);
		};
	return { nommer: garde(actionsNommer.nommer), remplacer: garde(actionsNommer.remplacer), finir: garde(actionsNommer.finir), terminer: garde(actionsNommer.terminer) };
}

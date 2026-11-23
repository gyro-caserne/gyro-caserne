import { fail } from '@sveltejs/kit';
import { DonneeInvalide, RefusDroit, reglerDemandes, type ReglageDemandes } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { phraseReglage } from '#lib/demandes/textes.ts';

type Ligne = { id?: string; nom: string };
export type ReponseReglage = { cible: 'demandes'; succes?: string; message?: string };

// Les étapes à enregistrer : celles du formulaire des noms (dans l'ordre de la page), sinon celles du rôle ; puis le geste du bouton
// appuyé (ajouter, ou monter, descendre, retirer une étape par son identifiant). Un geste sur une étape absente ne change rien.
export function etapesDuFormulaire(f: FormData, actuel: ReglageDemandes | null): { etapes: Ligne[]; derniere: string } {
	const ids = f.getAll('etape-id').map(String);
	const noms = f.getAll('etape-nom').map(String);
	let etapes: Ligne[] = f.has('derniere') ? ids.map((id, i) => ({ id, nom: noms[i] ?? '' })) : (actuel?.etapes ?? []).map((e) => ({ ...e }));
	const derniere = f.has('derniere') ? String(f.get('derniere')) : (actuel?.derniere ?? 'Faite');
	const [geste, id] = String(f.get('geste') ?? '').split(':');
	const i = etapes.findIndex((e) => e.id === id);
	if (geste === 'ajouter') etapes = [...etapes, { nom: String(f.get('nouvelle') ?? '') }];
	else if (geste === 'retirer' && i >= 0) etapes = etapes.filter((_, j) => j !== i);
	else if ((geste === 'monter' || geste === 'descendre') && i >= 0) {
		const autre = geste === 'monter' ? i - 1 : i + 1;
		if (etapes[autre]) [etapes[i], etapes[autre]] = [etapes[autre]!, etapes[i]!];
	}
	return { etapes, derniere };
}

const SUCCES: Record<string, string> = {
	ajouter: 'Étape ajoutée.',
	retirer: 'Étape retirée.',
	monter: 'Étape déplacée.',
	descendre: 'Étape déplacée.'
};

// L'action commune aux Réglages du rôle et à la liste du rôle (titulaires) : cocher ou décocher, ou régler les étapes.
export async function actionReglage(locals: App.Locals, roleId: number, actuel: ReglageDemandes | null, f: FormData) {
	const { acteur, base } = locals;
	const cible = 'demandes' as const;
	const geste = String(f.get('geste') ?? '').split(':')[0]!;
	let reglage: { etapes: Ligne[]; derniere: string } | null;
	let succes: string;
	if (geste === 'basculer') {
		reglage = f.get('recoit') === '1' ? (actuel ?? { etapes: [], derniere: 'Faite' }) : null;
		succes = reglage ? 'Le rôle reçoit des demandes.' : 'Le rôle ne reçoit plus de demandes.';
	} else {
		reglage = etapesDuFormulaire(f, actuel);
		succes = SUCCES[geste] ?? 'Étapes enregistrées.';
	}
	try {
		await reglerDemandes(base, acteur!, roleId, reglage, maintenantParis());
	} catch (erreur) {
		if (erreur instanceof RefusDroit) return fail<ReponseReglage>(403, { cible, message: 'Réservé à qui gère les rôles et aux titulaires du rôle.' });
		if (erreur instanceof DonneeInvalide) return fail<ReponseReglage>(400, { cible, message: phraseReglage(erreur.message) });
		throw erreur;
	}
	return { cible, succes } satisfies ReponseReglage;
}

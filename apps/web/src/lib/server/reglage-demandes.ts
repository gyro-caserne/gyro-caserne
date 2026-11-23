import { fail } from '@sveltejs/kit';
import { DonneeInvalide, RefusDroit, reglerDemandes, type ReglageDemandes } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { phraseReglage } from '#lib/demandes/textes.ts';

type Ligne = { id?: string; nom: string };
// Le réglage tel que saisi : la case, les étapes dans l'ordre de la page (une nouvelle, sans identifiant), la dernière étape.
export type SaisieDemandes = { recoit: boolean; etapes: Ligne[]; derniere: string };

// Ce qu'affiche le bloc : la saisie renvoyée par le serveur, sinon le réglage du rôle (ou celui gardé au décochage).
export function saisieDuRole(actuel: ReglageDemandes | null, gardees: ReglageDemandes | null = null): SaisieDemandes {
	const base = actuel ?? gardees;
	return { recoit: actuel !== null, etapes: base?.etapes ?? [], derniere: base?.derniere ?? 'Faite' };
}

// La saisie envoyée, puis le geste du bouton appuyé : ajouter une étape, ou monter, descendre, retirer celle de ce rang.
// Sans les champs des étapes (formulaire sans le bloc), celles du rôle. `recoit` absent : la case n'est pas dans la page (titulaire).
export function saisieDuFormulaire(f: FormData, actuel: ReglageDemandes | null, gardees: ReglageDemandes | null = null): SaisieDemandes {
	const ids = f.getAll('etape-id').map(String);
	const noms = f.getAll('etape-nom').map(String);
	const depart = saisieDuRole(actuel, gardees);
	let etapes: Ligne[] = f.has('derniere') ? ids.map((id, i) => ({ ...(id ? { id } : {}), nom: noms[i] ?? '' })) : depart.etapes.map((e) => ({ ...e }));
	const [geste, rang] = String(f.get('geste') ?? '').split(':');
	const i = Number(rang);
	if (geste === 'ajouter') etapes = [...etapes, { nom: String(f.get('nouvelle') ?? '') }];
	else if (geste === 'retirer' && etapes[i]) etapes = etapes.filter((_, j) => j !== i);
	else if ((geste === 'monter' || geste === 'descendre') && etapes[i]) {
		const autre = geste === 'monter' ? i - 1 : i + 1;
		if (etapes[autre]) [etapes[i], etapes[autre]] = [etapes[autre]!, etapes[i]!];
	}
	return { recoit: f.has('case-demandes') ? f.get('recoit') === '1' : actuel !== null, etapes, derniere: f.has('derniere') ? String(f.get('derniere')) : depart.derniere };
}

export const reglageDeLaSaisie = (s: SaisieDemandes) => (s.recoit ? { etapes: s.etapes, derniere: s.derniere } : null);

export type ReponseReglage = { cible: 'demandes'; succes?: string; message?: string; demandes?: SaisieDemandes };

// La liste du rôle (titulaires) : « Enregistrer les étapes ». Un refus renvoie la saisie, pour ne rien perdre.
export async function actionReglage(locals: App.Locals, roleId: number, actuel: ReglageDemandes | null, f: FormData) {
	const { acteur, base } = locals;
	const cible = 'demandes' as const;
	const saisie = saisieDuFormulaire(f, actuel);
	try {
		await reglerDemandes(base, acteur!, roleId, reglageDeLaSaisie(saisie), maintenantParis());
	} catch (erreur) {
		if (erreur instanceof RefusDroit) return fail<ReponseReglage>(403, { cible, message: 'Réservé à qui gère les rôles et aux titulaires du rôle.', demandes: saisie });
		if (erreur instanceof DonneeInvalide) return fail<ReponseReglage>(400, { cible, message: phraseReglage(erreur.message), demandes: saisie });
		throw erreur;
	}
	return { cible, succes: 'Étapes enregistrées.' } satisfies ReponseReglage;
}

// Monter, descendre, retirer, ajouter : la page revient avec la saisie modifiée, rien n'est enregistré.
export const apercuReglage = (f: FormData, actuel: ReglageDemandes | null, gardees: ReglageDemandes | null = null) => ({ cible: 'demandes' as const, demandes: saisieDuFormulaire(f, actuel, gardees) });

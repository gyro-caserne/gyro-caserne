import { fail } from '@sveltejs/kit';
import { ajouterJours } from '@gyro-caserne/socle/dates';
import { eq } from 'drizzle-orm';
import centre from '$centre';
import { accepterProposition, ajouterVacances, anneePlanning, calculerAnnee, changerSemaines, enregistrerFete, noterFete, noterFeteCentre, preparerAnnee, supprimerFete, proposerAnnee, publierAnnee, reglerRoulement, remplacementsDeSemaine, retirerVacances } from '@gyro-caserne/socle';
import { maintenantParis } from '#lib/aujourdhui.ts';
import { deplacer, etapeDe } from '#lib/planning/preparer.ts';
import { champ, echecPlanning, nombres } from '#lib/server/formulaire-planning.ts';
import { annoncerSiJournee, anneeDe, connecte, ouRefus } from '#lib/server/planning.ts';
import type { Actions, PageServerLoad } from './$types';

const REFUS = 'Préparer l’année est réservé à qui gère le planning du centre.';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { acteur, base } = connecte(locals);
	const annee = anneeDe(url);
	const preparation = await ouRefus(preparerAnnee(base, acteur, annee, maintenantParis(), centre.astreinte), REFUS);
	const courante = Number(maintenantParis().slice(0, 4));
	// Avant le premier enregistrement, l'aperçu suit l'ordre proposé.
	const ordre = preparation.ordre.length ? preparation.ordre : preparation.ordrePropose;
	const apercu = (preparation.semaines.length ? preparation.semaines : calculerAnnee(annee, centre.astreinte, ordre, new Map())).slice(0, 6);
	// Année publiée, une semaine ouverte : commencée (elle ne change plus), et les remplacements qu'un changement toucherait.
	const ouverte = preparation.semaines.find((x) => x.debut === url.searchParams.get('semaine'));
	const m = maintenantParis();
	const commencee = ouverte ? (ouverte.periodes[0]?.debut ?? ouverte.debut) <= m.slice(0, 16) : false;
	const semaineTouche =
		ouverte && preparation.publiee
			? { commencee, remplacements: commencee ? [] : (await remplacementsDeSemaine(base, acteur, annee, ouverte.debut, m, centre.astreinte)).map(({ texte, conclu }) => ({ texte, conclu })) }
			: null;
	// La proposition ne se calcule que si le chef la demande, et pour une année sans roulement.
	const proposition = url.searchParams.has('proposition') && !preparation.ordre.length && preparation.ordrePropose.length >= 2 ? await proposerAnnee(base, acteur, annee, m, centre.astreinte) : null;
	const nombre = (cle: string) => (/^\d+$/.test(url.searchParams.get(cle) ?? '') ? Number(url.searchParams.get(cle)) : null);
	return {
		preparation,
		annees: [courante, courante + 1],
		etape: etapeDe(url),
		apercu,
		// Le panneau ouvert : une manœuvre (« nouvelle » ou son numéro), une semaine, ou l'échange proposé pour une fête.
		manoeuvre: url.searchParams.get('manoeuvre') === 'nouvelle' ? ('nouvelle' as const) : nombre('manoeuvre'),
		semaine: ouverte?.debut ?? null,
		semaineTouche,
		proposition,
		// Le panneau d'une fête du centre : « nouvelle » ou son numéro ; `supprimer` : la confirmation de la suppression.
		fete: url.searchParams.get('fete') === 'nouvelle' ? ('nouvelle' as const) : nombre('fete'),
		supprimer: url.searchParams.has('supprimer'),
		maintenant: m.slice(0, 16),
		proposer: url.searchParams.get('proposer') === 'noel' ? ('noel' as const) : url.searchParams.get('proposer') === 'nouvel_an' ? ('nouvel_an' as const) : null
	};
};

// Chaque action : l'année visée dans l'adresse (?annee=), une réponse pour son formulaire.
async function agir(locals: App.Locals, cible: string, succes: string, faire: (m: string) => Promise<unknown>, valeurs?: Record<string, string>) {
	connecte(locals);
	try {
		await faire(maintenantParis());
	} catch (erreur) {
		return echecPlanning(erreur, cible, valeurs);
	}
	return { cible, succes };
}

export const actions: Actions = {
	proposition: async ({ locals, url }) => agir(locals, 'proposition', 'Proposition acceptée. Le brouillon est écrit. Retouchez-le, puis publiez. Les agents ne voient rien avant.', (m) => accepterProposition(locals.base, locals.acteur!, anneeDe(url), m, centre.astreinte)),
	roulement: async ({ locals, request, url }) => {
		const ordre = nombres(await request.formData(), 'ordre');
		return agir(locals, 'roulement', 'Roulement enregistré.', (m) => reglerRoulement(locals.base, locals.acteur!, anneeDe(url), ordre, m));
	},
	// Monter ou descendre une équipe : l'ordre est enregistré tout de suite.
	deplacer: async ({ locals, request, url }) => {
		const f = await request.formData();
		const [rang, sens] = champ(f, 'deplacer').split(':');
		const ordre = deplacer(nombres(f, 'ordre'), Number(rang), sens === 'monter' ? -1 : 1);
		// Une année publiée ne change plus de roulement d'un geste : ses semaines se changent une à une.
		const [ligne] = await locals.base.select({ publieeLe: anneePlanning.publieeLe }).from(anneePlanning).where(eq(anneePlanning.annee, anneeDe(url)));
		if (ligne?.publieeLe) return fail(400, { cible: 'roulement', message: 'Année publiée. Changez plutôt l’équipe d’une semaine, à l’étape « Vérifier et publier ».' });
		return agir(locals, 'roulement', 'Roulement enregistré.', (m) => reglerRoulement(locals.base, locals.acteur!, anneeDe(url), ordre, m));
	},
	semaines: async ({ locals, request, url }) => {
		const choix: Record<string, number> = {};
		for (const [cle, valeur] of await request.formData()) {
			const debut = /^semaine-(\d{4}-\d{2}-\d{2})$/.exec(cle)?.[1];
			if (debut && typeof valeur === 'string' && /^\d+$/.test(valeur)) choix[debut] = Number(valeur);
		}
		return agir(locals, 'semaines', 'Semaines enregistrées.', (m) => changerSemaines(locals.base, locals.acteur!, anneeDe(url), choix, m, centre.astreinte));
	},
	fete: async ({ locals, request }) => {
		const f = await request.formData();
		const equipe = champ(f, 'equipe');
		const fete = champ(f, 'fete') === 'nouvel_an' ? 'nouvel_an' : 'noel';
		return agir(locals, 'fetes', equipe ? 'Historique enregistré.' : 'Ligne retirée.', (m) => noterFete(locals.base, locals.acteur!, Number(champ(f, 'annee')), fete, equipe ? Number(equipe) : null, m));
	},
	// Une fête du centre : la date, l'heure de début et de fin (une fin avant le début tombe le lendemain), l'équipe imposée.
	// Des remplacements deviendraient inutiles : la liste est rendue à confirmer (`confirme`).
	feteCentre: async ({ locals, request }) => {
		const f = await request.formData();
		const valeurs: Record<string, string> = { id: champ(f, 'id'), nom: champ(f, 'nom'), date: champ(f, 'date'), debut: champ(f, 'debut'), fin: champ(f, 'fin'), equipe: champ(f, 'equipe') };
		const jourDeFin = valeurs.fin && valeurs.fin < valeurs.debut && /^\d{4}-\d{2}-\d{2}$/.test(valeurs.date) ? ajouterJours(valeurs.date, 1) : valeurs.date;
		const donnees = { ...(valeurs.id ? { id: Number(valeurs.id) } : {}), nom: valeurs.nom, debut: `${valeurs.date}T${valeurs.debut}`, fin: `${jourDeFin}T${valeurs.fin}`, equipeId: Number(valeurs.equipe) };
		let inutiles: string[] = [];
		const reponse = await agir(locals, 'fete', 'Fête enregistrée.', async (m) => {
			const r = await enregistrerFete(locals.base, locals.acteur!, donnees, m, centre.astreinte, champ(f, 'confirme') === 'oui');
			if ('inutiles' in r) inutiles = r.inutiles;
		}, valeurs);
		return inutiles.length ? { cible: 'fete', inutiles, valeurs } : reponse;
	},
	supprimerFete: async ({ locals, request }) => {
		const f = await request.formData();
		const valeurs: Record<string, string> = { id: champ(f, 'id') };
		let inutiles: string[] = [];
		const reponse = await agir(locals, 'fete', 'Fête supprimée.', async (m) => {
			inutiles = (await supprimerFete(locals.base, locals.acteur!, Number(valeurs.id), m, centre.astreinte, champ(f, 'confirme') === 'oui')).inutiles;
		}, valeurs);
		return inutiles.length ? { cible: 'fete', inutiles, valeurs, suppression: true } : reponse;
	},
	noterFeteCentre: async ({ locals, request }) => {
		const f = await request.formData();
		const equipe = champ(f, 'equipe');
		return agir(locals, 'historique-fetes', equipe ? 'Historique enregistré.' : 'Ligne retirée.', (m) => noterFeteCentre(locals.base, locals.acteur!, Number(champ(f, 'annee')), champ(f, 'nom'), equipe ? Number(equipe) : null, m));
	},
	vacances: async ({ locals, request }) => {
		const f = await request.formData();
		const valeurs = { nom: champ(f, 'nom'), debut: champ(f, 'debut'), fin: champ(f, 'fin') };
		return agir(locals, 'vacances', 'Vacances ajoutées.', (m) => ajouterVacances(locals.base, locals.acteur!, valeurs, m), valeurs);
	},
	retirerVacances: async ({ locals, request }) => {
		const id = Number(champ(await request.formData(), 'id'));
		return agir(locals, 'vacances', 'Vacances retirées.', (m) => retirerVacances(locals.base, locals.acteur!, id, m));
	},
	publier: async ({ locals, url }) => {
		const reponse = await agir(locals, 'publier', 'L’année est publiée. Tous les agents la voient.', (m) => publierAnnee(locals.base, locals.acteur!, anneeDe(url), m));
		// Les manœuvres des deux prochaines semaines sont annoncées sans attendre le matin.
		if ('succes' in reponse) annoncerSiJournee(locals);
		return reponse;
	}
};

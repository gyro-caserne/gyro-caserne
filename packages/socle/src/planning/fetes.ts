import { and, eq, gte, sql, type SQL } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours, exigerDateHeure } from '../dates.ts';
import type { Acteur } from '../droits.ts';
import { DonneeInvalide } from '../erreurs.ts';
import { texte } from '../commun.ts';
import { nomActeur } from '../actions/personnes.ts';
import { ligneJournal } from '../journal.ts';
import { anneePlanning, demandeRemplacement, equipe, feteCentre, gardeFeteCentre } from '../schema.ts';
import { avis as avisEquipes } from './avis.ts';
import { avis as avisRemplacement } from '../remplacements/avis.ts';
import { dAstreinte, lireContexte, periodesDe, type Contexte } from '../remplacements/contexte.ts';
import { requeteFetes } from './plages.ts';
import { chevauche, dePlage, jourEnLettres, texteDemande } from '../remplacements/tranches.ts';
import { equipeLe, exigerAnnee, exigerGestion, journalPlanning } from './annee.ts';

// Au journal (suivi du centre), visant la fête : son nom et un lien vers l'étape Fêtes.
const journalFete = (base: Base, acteur: Acteur, action: string, details: object, maintenant: string, cibleId: number | SQL) => ligneJournal(base, { acteur: nomActeur(acteur), action, cibleType: 'fete_centre', cibleId, details }, maintenant);
import type { FeteCentre, Periode, Reglage } from './calendrier.ts';

// Les fêtes du centre : pendant leurs heures, une équipe choisie tient l'astreinte à la place de celle du roulement
// (appliquerFetes, calendrier.ts). Au plus 24 h, jamais deux en même temps.

export type DonneesFete = { id?: number; nom: string; debut: string; fin: string; equipeId: number };
export type FeteLue = FeteCentre & { id: number };

const DUREE_MAX = 24 * 3_600_000;
const duree = (p: Periode) => Date.parse(`${p.fin}:00Z`) - Date.parse(`${p.debut}:00Z`);

// « Sainte-Barbe, samedi 5 décembre de 18 h à 2 h »
export const quandFete = (f: FeteCentre) => `${f.nom}, ${jourEnLettres(f.debut)} ${dePlage(f)}`;
const majuscule = (t: string) => `${t[0]!.toUpperCase()}${t.slice(1)}`;

function exigerDonnees(d: DonneesFete): FeteCentre {
	const nom = texte(d.nom, 'Nom de la fête', 60);
	exigerDateHeure(d.debut, 'Début');
	exigerDateHeure(d.fin, 'Fin');
	const p = { debut: d.debut.slice(0, 16), fin: d.fin.slice(0, 16) };
	if (p.fin <= p.debut) throw new DonneeInvalide('La fin doit suivre le début');
	if (duree(p) > DUREE_MAX) throw new DonneeInvalide('Une fête dure 24 h au plus');
	if (!Number.isInteger(d.equipeId) || d.equipeId <= 0) throw new DonneeInvalide('Équipe inconnue');
	return { nom, ...p, equipeId: d.equipeId };
}

// Ce que le changement fait aux remplacements : ceux du nouveau tour d'astreinte (`apres`), dans les heures touchées,
// dont le demandeur n'a plus aucune heure d'astreinte (inutiles, annulés) ; les autres ne changent pas.
function inutilesDe(ctx: Contexte, touchees: Periode[], apres: FeteCentre[]) {
	ctx.fetes = apres;
	return ctx.demandes.filter((d) => {
		if (d.genre !== 'remplacement' || !['attente', 'a_valider', 'conclue'].includes(d.etat)) return false;
		const periodes = periodesDe(d.periodes);
		if (!periodes.some((p) => touchees.some((t) => chevauche(p, t)))) return false;
		return periodes.every((p) => p.debut > ctx.maintenant && !dAstreinte(ctx, d.demandeurId, p));
	});
}

// Les écritures et les avis d'un changement de fête dans une année publiée : les remplacements inutiles annulés (leurs personnes
// prévenues), puis les agents des équipes touchées (imposée et libérée, avant comme après).
async function effets(base: Base, acteur: Acteur, avant: FeteCentre | null, apres: FeteCentre | null, autres: FeteCentre[], maintenant: string, reglage: Reglage, confirme: boolean) {
	const reference = (apres ?? avant)!;
	const annee = Number(reference.debut.slice(0, 4));
	const [ligne] = await base.select({ publieeLe: anneePlanning.publieeLe }).from(anneePlanning).where(eq(anneePlanning.annee, annee));
	if (!ligne?.publieeLe) return { inutiles: [], ecritures: [] };
	const ctx = await lireContexte(base, maintenant, reglage);
	const touchees = [avant, apres].filter((f): f is FeteCentre => f !== null);
	const inutiles = inutilesDe(ctx, touchees, apres ? [...autres, apres] : autres);
	const nom = (id: number | null) => {
		const a = ctx.agents.find((x) => x.id === id);
		return a ? `${a.prenom} ${a.nom}` : 'un ancien agent';
	};
	const textes = inutiles.map((d) => `${majuscule(texteDemande(periodesDe(d.periodes)))}, ${d.remplacantId !== null && d.etat !== 'attente' ? `${nom(d.demandeurId)} remplacé par ${nom(d.remplacantId)}` : `${nom(d.demandeurId)} cherche un remplaçant`}`);
	if (inutiles.length > 0 && !confirme) return { inutiles: textes, ecritures: [] };
	const equipeNom = (id: number) => ctx.equipes.find((e) => e.id === id)?.nom ?? 'une autre équipe';
	const phrase = apres ? `${quandFete(apres)}. L’${equipeNom(apres.equipeId)} est d’astreinte.` : `${quandFete(avant!)}, annulée. L’astreinte suit le roulement.`;
	const moi = acteur.type === 'personne' ? acteur.id : 0;
	const ecritures = inutiles.flatMap((d) => {
		const prevenus = [...new Set([d.demandeurId, ...(d.remplacantId !== null && d.etat !== 'attente' ? [d.remplacantId] : []), ...(d.cibleId !== null && d.etat === 'attente' ? [d.cibleId] : [])])].filter((x) => x !== moi);
		return [
			base.update(demandeRemplacement).set({ etat: 'annulee', motif: 'Fête du centre', trancheePar: nomActeur(acteur), trancheeLe: maintenant }).where(and(eq(demandeRemplacement.id, d.id), eq(demandeRemplacement.etat, d.etat))),
			...avisRemplacement(base, prevenus, d.id, 'annulee', `${phrase} Ce remplacement n’est plus utile.`, `/remplacements/${d.id}`, maintenant)
		];
	});
	// Les équipes touchées : celles des fêtes, et celles des semaines dont elles prennent des heures.
	const ids = new Set(touchees.map((f) => f.equipeId));
	for (const s of ctx.semaines) if (s.periodes.some((p) => touchees.some((t) => chevauche(p, t)))) ids.add(s.equipeId);
	const parRemplacement = new Set(inutiles.flatMap((d) => [d.demandeurId, d.remplacantId, d.cibleId]));
	const jour = reference.debut.slice(0, 10);
	const agents = ctx.agents.filter((a) => !parRemplacement.has(a.id) && ids.has(equipeLe(ctx.affectations.filter((x) => x.personneId === a.id), jour) ?? 0) && a.id !== moi).map((a) => a.id);
	return { inutiles: textes, ecritures: [...ecritures, ...avisEquipes(base, agents, 'semaine', phrase, '/planning', maintenant)] };
}

// Créer (sans `id`) ou modifier une fête à venir. Des remplacements deviendraient inutiles : rien n'est écrit, la liste est rendue ;
// `confirme` : ils sont annulés et leurs personnes prévenues.
export async function enregistrerFete(base: Base, acteur: Acteur, d: DonneesFete, maintenant: string, reglage: Reglage, confirme = false): Promise<{ id: number } | { inutiles: string[] }> {
	await exigerGestion(base, acteur, maintenant);
	const f = exigerDonnees(d);
	exigerAnnee(Number(f.debut.slice(0, 4)));
	const m = maintenant.slice(0, 16);
	if (f.debut <= m) throw new DonneeInvalide('Fête passée');
	const [voisines, connue] = await base.batch([requeteFetes(base, ajouterJours(f.debut.slice(0, 10), -1), ajouterJours(f.debut.slice(0, 10), 2)), base.select({ id: equipe.id }).from(equipe).where(and(eq(equipe.id, f.equipeId), eq(equipe.active, 1)))]);
	if (connue.length === 0) throw new DonneeInvalide('Équipe inconnue');
	let avant: FeteCentre | null = null;
	if (d.id !== undefined) {
		const [ligne] = await base.select().from(feteCentre).where(eq(feteCentre.id, d.id));
		if (!ligne) throw new DonneeInvalide('Fête inconnue');
		if (ligne.debut <= m) throw new DonneeInvalide('Fête commencée : elle ne change plus');
		avant = { nom: ligne.nom, debut: ligne.debut, fin: ligne.fin, equipeId: ligne.equipeId };
	}
	if (voisines.some((v) => v.id !== d.id && chevauche(v, f))) throw new DonneeInvalide('Une autre fête tombe à ces heures');
	const autres = (await base.select({ nom: feteCentre.nom, debut: feteCentre.debut, fin: feteCentre.fin, equipeId: feteCentre.equipeId, id: feteCentre.id }).from(feteCentre).where(gte(feteCentre.fin, m))).filter((x) => x.id !== d.id);
	const { inutiles, ecritures } = await effets(base, acteur, avant, f, autres, maintenant, reglage, confirme);
	if (inutiles.length > 0 && !confirme) return { inutiles };
	const details = { nom: f.nom, debut: f.debut, fin: f.fin, equipeId: f.equipeId, remplacementsAnnules: inutiles.length };
	if (d.id === undefined) {
		const [lignes] = await base.batch([
			base.insert(feteCentre).values({ ...f, creePar: nomActeur(acteur), creeLe: maintenant }).returning({ id: feteCentre.id }),
			journalFete(base, acteur, 'ajouter_fete', details, maintenant, sql`last_insert_rowid()`),
			...ecritures
		]);
		return { id: lignes[0]!.id };
	}
	await base.batch([base.update(feteCentre).set(f).where(eq(feteCentre.id, d.id)), journalFete(base, acteur, 'modifier_fete', details, maintenant, d.id), ...ecritures]);
	return { id: d.id };
}

// Supprimer une fête à venir : l'astreinte revient au roulement, les équipes touchées sont prévenues (année publiée).
export async function supprimerFete(base: Base, acteur: Acteur, id: number, maintenant: string, reglage: Reglage, confirme = false): Promise<{ inutiles: string[] }> {
	await exigerGestion(base, acteur, maintenant);
	const m = maintenant.slice(0, 16);
	const [ligne] = await base.select().from(feteCentre).where(eq(feteCentre.id, id));
	if (!ligne) throw new DonneeInvalide('Fête inconnue');
	if (ligne.debut <= m) throw new DonneeInvalide('Fête commencée : elle ne change plus');
	const autres = (await base.select({ nom: feteCentre.nom, debut: feteCentre.debut, fin: feteCentre.fin, equipeId: feteCentre.equipeId, id: feteCentre.id }).from(feteCentre).where(gte(feteCentre.fin, m))).filter((x) => x.id !== id);
	const avant = { nom: ligne.nom, debut: ligne.debut, fin: ligne.fin, equipeId: ligne.equipeId };
	const { inutiles, ecritures } = await effets(base, acteur, avant, null, autres, maintenant, reglage, confirme);
	if (inutiles.length > 0 && !confirme) return { inutiles };
	await base.batch([base.delete(feteCentre).where(eq(feteCentre.id, id)), journalFete(base, acteur, 'supprimer_fete', { nom: ligne.nom, debut: ligne.debut, remplacementsAnnules: inutiles.length }, maintenant, id), ...ecritures]);
	return { inutiles: [] };
}

// Noter qui a tenu une fête du centre une année passée (`equipeId` nul : effacer la ligne).
export async function noterFeteCentre(base: Base, acteur: Acteur, annee: number, nom: string, equipeId: number | null, maintenant: string): Promise<void> {
	exigerAnnee(annee);
	await exigerGestion(base, acteur, maintenant);
	const propre = texte(nom, 'Nom de la fête', 60);
	if (equipeId !== null) {
		const [connue] = await base.select({ id: equipe.id }).from(equipe).where(eq(equipe.id, equipeId));
		if (!connue) throw new DonneeInvalide('Équipe inconnue');
	}
	const cle = and(eq(gardeFeteCentre.annee, annee), eq(gardeFeteCentre.nom, propre));
	await base.batch([
		equipeId === null ? base.delete(gardeFeteCentre).where(cle) : base.insert(gardeFeteCentre).values({ annee, nom: propre, equipeId }).onConflictDoUpdate({ target: [gardeFeteCentre.annee, gardeFeteCentre.nom], set: { equipeId } }),
		journalPlanning(base, acteur, 'noter_fete_centre', { annee, nom: propre, equipeId }, maintenant)
	]);
}

const memeNom = (a: string, b: string) => a.toLocaleLowerCase('fr') === b.toLocaleLowerCase('fr');

// L'historique des fêtes du centre (saisies et fêtes des années passées dans l'appli), le plus récent d'abord ; et pour chaque
// fête de l'année, les équipes dont c'est le tour (celles qui l'ont tenue il y a le plus longtemps, ou jamais).
export function fetesDeLAnnee(annee: number, lues: FeteLue[], saisies: { annee: number; nom: string; equipeId: number }[], equipes: number[]) {
	const historique = saisies.map((s) => ({ annee: s.annee, nom: s.nom, equipeId: s.equipeId }));
	for (const f of lues) {
		const a = Number(f.debut.slice(0, 4));
		if (a < annee && !historique.some((h) => h.annee === a && memeNom(h.nom, f.nom))) historique.push({ annee: a, nom: f.nom, equipeId: f.equipeId });
	}
	historique.sort((x, y) => y.annee - x.annee || x.nom.localeCompare(y.nom, 'fr'));
	const fetes = lues
		.filter((f) => f.debut.startsWith(`${annee}-`))
		.map((f) => {
			const derniere = (id: number) => Math.max(-Infinity, ...historique.filter((h) => h.annee < annee && h.equipeId === id && memeNom(h.nom, f.nom)).map((h) => h.annee));
			const plusAncienne = Math.min(...equipes.map(derniere));
			return { ...f, attendues: equipes.filter((id) => derniere(id) === plusAncienne) };
		});
	return { fetes, historique };
}

import { and, asc, eq, inArray, isNull, notExists, sql } from 'drizzle-orm';
import { anneesDeService, palierDuJour } from './a-ne-pas-manquer.ts';
import { nomActeur } from './actions/personnes.ts';
import { anciennete, PALIER_MAX, PALIERS_PAR_DEFAUT, type Anciennete } from './anciennete-calcul.ts';
import type { Base } from './base.ts';
import type { Courriel } from './courriels.ts';
import { ajouterJours, exigerDateHeure, formatDeDate } from './dates.ts';
import { aLeDroit, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { ligneJournal } from './journal.ts';
import { STATUTS_AVEC_ACCES } from './listes.ts';
import { mettreEnFile } from './notifications.ts';
import { avisAnciennete, coupure, personne, profil, reglageAnciennete } from './schema.ts';
import { estChefOuAdjointSql } from './suivi.ts';

// L'ancienneté de service (décision 0047) : les paliers du centre, « Féliciter » le jour J, et l'annonce aux chefs 30 jours avant.

// L'annonce aux chefs : ce nombre de jours avant le palier.
export const ANNONCE_JOURS = 30;

export async function lirePaliers(base: Base): Promise<number[]> {
	const [ligne] = await base.select({ paliers: reglageAnciennete.paliers }).from(reglageAnciennete).where(eq(reglageAnciennete.id, 1));
	return ligne ? (JSON.parse(ligne.paliers) as number[]) : PALIERS_PAR_DEFAUT;
}

// L'ancienneté d'un agent, pour Moi : ses dates et les paliers du centre, en une requête.
export async function ancienneteDe(base: Base, personneId: number, aujourdhui: string): Promise<Anciennete> {
	const [[p], [r]] = await base.batch([
		base.select({ engagement: personne.engagementSpv, entree: personne.entreeCentre }).from(personne).where(eq(personne.id, personneId)),
		base.select({ paliers: reglageAnciennete.paliers }).from(reglageAnciennete).where(eq(reglageAnciennete.id, 1))
	]);
	return anciennete(p?.engagement ?? null, p?.entree ?? null, aujourdhui, r ? (JSON.parse(r.paliers) as number[]) : PALIERS_PAR_DEFAUT);
}

// Les paliers du centre, avec ceux qui gèrent les listes du centre : de 1 à 60 ans, rangés, sans doublon. Au moins un.
export async function reglerPaliers(base: Base, acteur: Acteur, paliers: number[], maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await aLeDroit(base, acteur, 'GERER_LISTES', { type: 'centre' }, aujourdhui))) throw new RefusDroit('GERER_LISTES', { type: 'centre' });
	if (!paliers.every((p) => Number.isInteger(p) && p >= 1 && p <= PALIER_MAX)) throw new DonneeInvalide(`Palier de 1 à ${PALIER_MAX} ans`);
	const ranges = [...new Set(paliers)].sort((a, b) => a - b);
	if (ranges.length === 0) throw new DonneeInvalide('Au moins un palier');
	const valeur = JSON.stringify(ranges);
	await base.batch([
		base.insert(reglageAnciennete).values({ id: 1, paliers: valeur }).onConflictDoUpdate({ target: reglageAnciennete.id, set: { paliers: valeur } }),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'regler_anciennete', cibleType: 'centre', cibleId: null, details: { paliers: ranges } }, maintenant)
	]);
}

// « Féliciter » un collègue le jour de son palier : il est prévenu (cloche et téléphone), une fois par collègue et par palier.
// Une lecture, puis un batch, comme « Souhaiter ».
export async function feliciter(base: Base, acteur: Acteur, agentId: number, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux personnes ayant une fiche');
	if (acteur.id === agentId) throw new DonneeInvalide('On ne se félicite pas soi-même');
	const leJour = and(eq(personne.id, agentId), palierDuJour(aujourdhui));
	const [[fete], [auteur], [deja]] = await base.batch([
		base.select({ annees: anneesDeService(aujourdhui).as('annees') }).from(personne).leftJoin(profil, eq(profil.id, personne.profilId)).where(leJour),
		base.select({ prenom: personne.prenom, nom: personne.nom }).from(personne).where(eq(personne.id, acteur.id)),
		base
			.select({ id: avisAnciennete.id })
			.from(avisAnciennete)
			.where(and(eq(avisAnciennete.personneId, agentId), eq(avisAnciennete.jour, aujourdhui), eq(avisAnciennete.auteurId, acteur.id)))
	]);
	if (!fete || !auteur) throw new DonneeInvalide('Pas de palier à fêter aujourd’hui');
	if (deja) return;
	const titre = `${fete.annees} ans de service`;
	const texte = `${`${auteur.prenom} ${auteur.nom}`.trim()} vous félicite pour vos ${fete.annees} ans de service.`;
	await base.batch([
		// Revérifié à l'écriture ; deux appuis simultanés n'écrivent qu'une ligne (index unique).
		base
			.insert(avisAnciennete)
			.select(
				base
					.select({
						id: sql<number | null>`null`.as('id'),
						personneId: personne.id,
						agentId: sql<number>`${agentId}`.as('agent_id'),
						auteurId: sql<number>`${acteur.id}`.as('auteur_id'),
						annees: anneesDeService(aujourdhui).as('annees'),
						jour: sql<string>`${aujourdhui}`.as('jour'),
						titre: sql<string>`${titre}`.as('titre'),
						texte: sql<string>`${texte}`.as('texte'),
						url: sql<string>`'/'`.as('url'),
						creeLe: sql<string>`${maintenant}`.as('cree_le'),
						lueLe: sql<string | null>`null`.as('lue_le')
					})
					.from(personne)
					.leftJoin(profil, eq(profil.id, personne.profilId))
					.where(leJour)
			)
			.onConflictDoNothing(),
		// Seulement si la ligne vient d'être écrite. Lieu « anciennete » : seul « tout » le coupe.
		mettreEnFile(base, [agentId], 'anciennete', { titre, texte, url: '/', tag: `anciennete:${acteur.id}` }, maintenant, sql`changes() = 1`, 'anciennete')
	]);
}

// « le 12 décembre », « le 1er mars ».
const leJour = (iso: string) => `le ${formatDeDate({ day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)).replace(/^1(?=\s)/, '1er')}`;

const parmi = (ids: number[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;

// Au réveil de 8 h (et de 8 h 10, si 8 h a manqué) : les paliers dans 30 jours, en une lecture bornée par la date.
// Au chef de centre et à l'adjoint, une ligne de cloche par agent ; et les e-mails à envoyer (un par chef, qui les liste), sauf coupure « courriel ».
// Rien d'écrit ni d'envoyé sans palier, ni deux fois pour le même palier.
export async function ancienneteDuMatin(base: Base, maintenant: string): Promise<Courriel[]> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const cible = ajouterJours(aujourdhui, ANNONCE_JOURS);
	const [aVenir, chefs, deja] = await base.batch([
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, annees: anneesDeService(cible).as('annees') })
			.from(personne)
			.leftJoin(profil, eq(profil.id, personne.profilId))
			.where(palierDuJour(cible))
			.orderBy(asc(personne.nom), asc(personne.prenom)),
		base
			.select({ id: personne.id, a: personne.email, coupe: sql<number>`exists (select 1 from ${coupure} where ${coupure.personneId} = "personne"."id" and ${coupure.lieu} = 'courriel')`.as('coupe') })
			.from(personne)
			.where(and(inArray(personne.statut, [...STATUTS_AVEC_ACCES]), estChefOuAdjointSql(sql`"personne"."id"`, aujourdhui))),
		base
			.select({ agentId: avisAnciennete.agentId, annees: avisAnciennete.annees })
			.from(avisAnciennete)
			.where(and(isNull(avisAnciennete.auteurId), eq(avisAnciennete.jour, cible)))
	]);
	const nouveaux = aVenir.filter((p) => !deja.some((d) => d.agentId === p.id && d.annees === p.annees));
	if (nouveaux.length === 0 || chefs.length === 0) return [];
	const titre = nouveaux.length === 1 ? 'Palier d’ancienneté dans 30 jours' : 'Paliers d’ancienneté dans 30 jours';
	const lignes = nouveaux.map((p) => ({ p, texte: `Dans ${ANNONCE_JOURS} jours, ${leJour(cible)}, ${`${p.prenom} ${p.nom}`.trim()} atteint ${p.annees} ans de service.` }));
	const ids = chefs.map((c) => c.id);
	await base.batch(
		lignes.map(({ p, texte }) =>
			base.insert(avisAnciennete).select(
				base
					.select({
						id: sql<number | null>`null`.as('id'),
						personneId: personne.id,
						agentId: sql<number>`${p.id}`.as('agent_id'),
						auteurId: sql<number | null>`null`.as('auteur_id'),
						annees: sql<number>`${p.annees}`.as('annees'),
						jour: sql<string>`${cible}`.as('jour'),
						titre: sql<string>`${'Palier d’ancienneté dans 30 jours'}`.as('titre'),
						texte: sql<string>`${texte}`.as('texte'),
						url: sql<string>`${`/agents/${p.id}`}`.as('url'),
						creeLe: sql<string>`${maintenant}`.as('cree_le'),
						lueLe: sql<string | null>`null`.as('lue_le')
					})
					.from(personne)
					.where(and(inArray(personne.id, parmi(ids)), notExists(base.select({ un: sql`1` }).from(avisAnciennete).where(and(eq(avisAnciennete.personneId, personne.id), eq(avisAnciennete.agentId, p.id), eq(avisAnciennete.annees, p.annees), isNull(avisAnciennete.auteurId))))))
			)
		) as [never, ...never[]]
	);
	const url = nouveaux.length === 1 ? `/agents/${nouveaux[0]!.id}` : '/agents';
	return chefs.filter((c) => c.coupe === 0 && c.a !== '').map((c) => ({ a: c.a, titre, texte: lignes.map((l) => l.texte).join('\n'), url }));
}

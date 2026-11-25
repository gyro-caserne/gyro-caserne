import { and, asc, desc, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { instruction, type Base, type BasePhotos } from './base.ts';
import { avecPhotos, effacerPhotos, exigerPhotos, lireOctets, type Photo } from './commun.ts';
import { ajouterJours, enCours, exigerDateHeure } from './dates.ts';
import { aLeDroit, type Acteur } from './droits.ts';
import { lireEngin, voitLesEngins, type EnginVu } from './engins.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { lirePrevenir, type ElementFiche, type ZoneFiche } from './fiches.ts';
import { avisAnomalies, quiPrevenir } from './anomalies-avis.ts';
import { ligneJournalSi } from './journal.ts';
import { GENRES_ECART, STATUTS_AVEC_ACCES, type EtapeAnomalie, type EtatPrise, type GenreEcart, type MotifAttente } from './listes.ts';
import { rangDuJour, semainesDe, type Reglage } from './planning/calendrier.ts';
import { affectationEquipe, anneePlanning, anomalie, anomalieSuivi, attribution, engin, equipe, ficheElement, ficheVersion, ficheZone, personne, priseGarde, profil, responsabilite, semaineChangee, typeEngin } from './schema.ts';

// La prise de garde : à la relève, l'équipe d'astreinte vérifie chaque engin zone par zone. Un brouillon sur le serveur
// (une prise par engin et par relève), repris par n'importe qui ; à la validation, chaque écart devient une anomalie.

export type Ecart = { genre: GenreEcart; manque: number | null; note: string; photo: number | null };
// `zones` : refs des zones vues ; `ecarts` : par ref d'élément ; `retrouves` : anomalies ouvertes à clore ; `participants` : personnes.
export type Saisie = { zones: number[]; ecarts: Record<string, Ecart>; retrouves: number[]; participants: number[] };
export const SAISIE_VIDE: Saisie = { zones: [], ecarts: {}, retrouves: [], participants: [] };

export type GestePrise =
	| { quoi: 'zone'; zone: number; vue: boolean }
	| { quoi: 'ecart'; element: number; genre: GenreEcart; manque: number | null; note: string; photo?: Photo | null }
	| { quoi: 'retirer_ecart'; element: number }
	| { quoi: 'retrouve'; anomalie: number; oui: boolean }
	| { quoi: 'participants'; ids: number[] };

export type EquipeReleve = { id: number; nom: string; couleur: string };
export type Releve = { debut: string; equipe: EquipeReleve | null };
export type AnomalieVue = { id: number; ref: number | null; zone: string; libelle: string; genre: GenreEcart; manque: number | null; note: string | null; photo: number | null; signaleeLe: string; signaleePar: string; etape: EtapeAnomalie; motif: MotifAttente | null; bloquante: boolean };
// Après la validation : qui a modifié les participants, rouvert la prise ou demandé sa réouverture (identifiants en base, noms à l'écran).
export type TracesPrise = { participants?: { par: number; le: string }; rouverte?: { par: number; le: string; motif: string; valideeLe?: string }; demande?: { par: number; le: string; motif: string } };
type Trace = { par: string; le: string };
export type TracesVues = { participants: Trace | null; rouverte: (Trace & { motif: string }) | null; demande: (Trace & { motif: string }) | null };
export type PriseVue = { id: number; etat: EtatPrise; commenceePar: string; commenceeLe: string; modifieePar: string; modifieeLe: string; valideeLe: string | null; saisie: Saisie; traces: TracesVues };
export type AgentPrise = { id: number; nom: string; astreinte: boolean };
// Sur une prise validée de la relève en cours : modifier les participants, rouvrir, demander la réouverture.
export type GestesValidee = { participants: boolean; rouvrir: boolean; demander: boolean };
// Les anomalies encore ouvertes créées par cette prise (une prise rouverte) : `suivie`, quelqu'un s'en occupe déjà.
export type AnomaliePropre = { id: number; ref: number | null; suivie: boolean; suiviePar: string | null; close: boolean };
export type VuePrise = { engin: EnginVu; releve: Releve; peutFaire: boolean; prise: PriseVue | null; zones: ZoneFiche[]; ouvertes: AnomalieVue[]; propres: AnomaliePropre[]; agents: AgentPrise[]; gestes: GestesValidee };

export const LIMITES_PRISE = { note: 300, participants: 60, motif: 200 } as const;
// On peut commencer la prise deux heures avant la relève ; elle est en retard trois heures après.
const AVANCE_MIN = 120;
const RETARD_MIN = 180;
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// « AAAA-MM-JJTHH:MM » décalé de `minutes`.
function decaler(moment: string, minutes: number): string {
	return new Date(new Date(`${moment.slice(0, 16)}:00Z`).getTime() + minutes * 60_000).toISOString().slice(0, 16);
}

// La relève en cours : le dernier moment de prise d'astreinte commencé (deux heures d'avance comprises).
export function releveDe(maintenant: string, reglage: Reglage): string {
	exigerDateHeure(maintenant, 'Date');
	const m = decaler(maintenant, AVANCE_MIN);
	const jour = m.slice(0, 10);
	const date = ajouterJours(jour, -((rangDuJour(jour) - JOURS.indexOf(reglage.debut.jour) + 7) % 7));
	const moment = `${date}T${reglage.debut.heure}`;
	return moment <= m ? moment : `${ajouterJours(date, -7)}T${reglage.debut.heure}`;
}

// Le lien de l'accueil vers la prise de garde : de 2 h avant la relève à 24 h après, pour qui a son astreinte dans la semaine de cette relève.
// `debutAstreinte` : le début de ses heures, qui peut tomber plus tard dans la semaine (été, renfort). Sans requête.
export function lienPriseOuvert(debutAstreinte: string, maintenant: string, reglage: Reglage): boolean {
	const releve = releveDe(maintenant, reglage);
	return maintenant.slice(0, 16) <= decaler(releve, 24 * 60) && releve <= debutAstreinte && debutAstreinte < decaler(releve, 7 * 24 * 60);
}

// L'équipe d'astreinte d'une relève, d'après le planning publié de son année : trois lectures à placer dans un batch.
export function lecturesEquipe(base: Base, releve: string) {
	const annee = Number(releve.slice(0, 4));
	return [
		base.select().from(anneePlanning).where(eq(anneePlanning.annee, annee)),
		base.select().from(semaineChangee).where(sql`substr(${semaineChangee.debut}, 1, 4) = ${String(annee)}`),
		base.select({ id: equipe.id, nom: equipe.nom, couleur: equipe.couleur }).from(equipe)
	] as const;
}
// L'équipe d'astreinte de la relève en cours (son identifiant), ou rien sans planning publié. Une requête.
export async function equipeAstreinte(base: Base, maintenant: string, reglage: Reglage): Promise<number | null> {
	const releve = releveDe(maintenant, reglage);
	const [annees, changees, equipes] = await base.batch([...lecturesEquipe(base, releve)]);
	return equipeDe(releve, annees, changees, equipes, reglage)?.id ?? null;
}
// Seulement la semaine de la relève, comme `calculerAnnee` la donnerait : celle choisie par le chef, sinon le roulement. L'accueil du chef
// la demande deux fois ; calculer toute l'année pour une semaine coûtait (décision 0021).
export function equipeDe(releve: string, annees: (typeof anneePlanning.$inferSelect)[], changees: { debut: string; equipeId: number }[], equipes: EquipeReleve[], reglage: Reglage): EquipeReleve | null {
	const annee = Number(releve.slice(0, 4));
	const jour = releve.slice(0, 10);
	const ligne = annees.find((a) => a.annee === annee && a.publieeLe !== null);
	const ordre = JSON.parse(ligne?.ordre ?? '[]') as number[];
	const rang = semainesDe(annee, reglage).findIndex((s) => s.debut === jour);
	if (ordre.length === 0 || rang < 0) return null;
	const id = changees.findLast((c) => c.debut === jour)?.equipeId ?? ordre[rang % ordre.length]!;
	return equipes.find((e) => e.id === id) ?? null;
}

const nomComplet = (p: { prenom: string; nom: string } | undefined) => (p ? `${p.prenom} ${p.nom}` : 'Un ancien agent');
const lireSaisie = (texte: string): Saisie => ({ ...SAISIE_VIDE, ...(JSON.parse(texte) as Partial<Saisie>) });
const lireTraces = (texte: string) => JSON.parse(texte) as TracesPrise;
const idsDesTraces = (t: TracesPrise) => [t.participants?.par, t.rouverte?.par, t.demande?.par].filter((id): id is number => id !== undefined);
function tracesVues(t: TracesPrise, nom: (id: number) => string): TracesVues {
	return {
		participants: t.participants ? { par: nom(t.participants.par), le: t.participants.le } : null,
		rouverte: t.rouverte ? { par: nom(t.rouverte.par), le: t.rouverte.le, motif: t.rouverte.motif } : null,
		demande: t.demande ? { ...t.demande, par: nom(t.demande.par) } : null
	};
}

// Les chefs d'une prise : le chef de garde de son équipe d'astreinte, le chef de centre et l'adjoint, en fonction.
const SYSTEMES_CHEF = ['chef_equipe', 'chef_centre', 'chef_centre_adjoint'] as const;
type RoleChef = { id: number; systeme: string | null; perimetreId: number | null; debut: string; fin: string | null };
const lectureChefs = (base: Base, qui?: number) =>
	base
		.select({ id: attribution.personneId, systeme: responsabilite.systeme, perimetreId: attribution.perimetreId, debut: attribution.debut, fin: attribution.fin })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.innerJoin(personne, eq(personne.id, attribution.personneId))
		.where(and(inArray(responsabilite.systeme, [...SYSTEMES_CHEF]), inArray(personne.statut, [...STATUTS_AVEC_ACCES]), qui === undefined ? undefined : eq(attribution.personneId, qui)));
const chefsDe = (roles: RoleChef[], equipeId: number | null, aujourdhui: string) =>
	roles.filter((r) => enCours(r.debut, r.fin, aujourdhui) && (r.systeme !== 'chef_equipe' || (equipeId !== null && r.perimetreId === equipeId)));

// Un motif court, obligatoire.
function motifDe(texte: unknown): string {
	const motif = typeof texte === 'string' ? texte.trim().replace(/\s+/g, ' ') : '';
	if (!motif) throw new DonneeInvalide('Motif manquant');
	if (motif.length > LIMITES_PRISE.motif) throw new DonneeInvalide('Motif trop long');
	return motif;
}

// Faire la prise : FAIRE_PRISE_DE_GARDE sur le centre, et être un agent (la prise est au nom de personnes).
export async function peutFairePrise(base: Base, acteur: Acteur, aujourdhui: string): Promise<boolean> {
	return acteur.type === 'personne' && (await aLeDroit(base, acteur, 'FAIRE_PRISE_DE_GARDE', { type: 'centre' }, aujourdhui));
}
async function exigerPrise(base: Base, acteur: Acteur, maintenant: string): Promise<number> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux agents');
	if (!(await peutFairePrise(base, acteur, aujourdhui))) throw new RefusDroit('FAIRE_PRISE_DE_GARDE', { type: 'centre' });
	return acteur.id;
}

// Les zones et éléments d'une version de fiche (celle de la prise, ou la dernière du type), à placer dans un batch.
function lecturesVersion(base: Base, version: SQL<number>) {
	return [
		base.select({ id: ficheZone.id, ref: ficheZone.ref, nom: ficheZone.nom, prevenir: ficheZone.prevenir }).from(ficheZone).where(eq(ficheZone.versionId, version)).orderBy(asc(ficheZone.ordre)),
		base.select({ zoneId: ficheElement.zoneId, ref: ficheElement.ref, libelle: ficheElement.libelle, quantite: ficheElement.quantite }).from(ficheElement).where(eq(ficheElement.versionId, version)).orderBy(asc(ficheElement.ordre))
	] as const;
}
function zonesDe(zones: { id: number; ref: number; nom: string; prevenir: string | null }[], elements: ({ zoneId: number } & ElementFiche)[]): ZoneFiche[] {
	return zones.map((z) => ({ ref: z.ref, nom: z.nom, prevenir: lirePrevenir(z.prevenir), elements: elements.filter((e) => e.zoneId === z.id).map(({ ref, libelle, quantite }) => ({ ref, libelle, quantite })) }));
}

const colonnesAnomalie = {
	id: anomalie.id,
	ref: anomalie.ref,
	zone: anomalie.zone,
	libelle: anomalie.libelle,
	genre: anomalie.genre,
	manque: anomalie.manque,
	note: anomalie.note,
	photo: anomalie.photoId,
	signaleeLe: anomalie.signaleeLe,
	etape: anomalie.etape,
	motif: anomalie.motifAttente,
	bloquante: anomalie.bloquante,
	prenom: personne.prenom,
	nom: personne.nom
};
// Quelqu'un s'occupe déjà de l'anomalie : une étape, un preneur, un blocage ou une ligne d'historique.
const suivieSql = sql<number>`(${anomalie.etape} <> 'signalee' OR ${anomalie.priseEnChargePar} IS NOT NULL OR ${anomalie.bloquante} = 1 OR EXISTS (SELECT 1 FROM ${anomalieSuivi} WHERE ${anomalieSuivi.anomalieId} = ${anomalie.id}))`;
// `dela` : la prise de la relève ; ses anomalies se lisent aussi closes (une prise rouverte ne les compte pas comme nouveaux écarts).
const ouvertesDe = (base: Base, enginId: number, dela: SQL) =>
	base
		.select({
			...colonnesAnomalie,
			priseId: anomalie.priseId,
			suivie: suivieSql.as('suivie'),
			suiviePar: sql<string | null>`(SELECT p.prenom || ' ' || p.nom FROM ${personne} p WHERE p.id = ${anomalie.priseEnChargePar})`.as('suivie_par'),
			close: sql<number>`${anomalie.closeLe} IS NOT NULL`.as('close')
		})
		.from(anomalie)
		.innerJoin(personne, eq(personne.id, anomalie.signaleePar))
		.where(and(eq(anomalie.enginId, enginId), or(isNull(anomalie.closeLe), sql`${anomalie.priseId} = ${dela}`)))
		.orderBy(asc(anomalie.id));
const vueAnomalie = ({ prenom, nom, bloquante, ...a }: { prenom: string; nom: string; bloquante: number } & Omit<AnomalieVue, 'signaleePar' | 'bloquante'>): AnomalieVue => ({ ...a, bloquante: bloquante === 1, signaleePar: `${prenom} ${nom}` });

// La prise d'un engin pour la relève en cours : le brouillon (ou la prise faite), la fiche suivie, les anomalies encore ouvertes
// et les agents à cocher (l'équipe d'astreinte d'abord).
export async function lirePrise(base: Base, acteur: Acteur, enginId: number, maintenant: string, reglage: Reglage): Promise<VuePrise> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const { engin: e } = await lireEngin(base, acteur, enginId, aujourdhui);
	const releve = releveDe(maintenant, reglage);
	const laPrise = and(eq(priseGarde.enginId, enginId), eq(priseGarde.releve, releve));
	const version = sql<number>`coalesce((SELECT ${priseGarde.versionId} FROM ${priseGarde} WHERE ${laPrise}), (SELECT max(${ficheVersion.id}) FROM ${ficheVersion} WHERE ${ficheVersion.typeId} = ${e.typeId}))`;
	const moi = acteur.type === 'personne' ? acteur.id : 0;
	const [prises, zones, elements, ouvertes, annees, changees, equipes, agents, affectations, roles] = await base.batch([
		base.select().from(priseGarde).where(laPrise),
		...lecturesVersion(base, version),
		ouvertesDe(base, enginId, sql`(SELECT ${priseGarde.id} FROM ${priseGarde} WHERE ${laPrise})`),
		...lecturesEquipe(base, releve),
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom })
			.from(personne)
			.innerJoin(profil, eq(profil.id, personne.profilId))
			.where(and(inArray(personne.statut, [...STATUTS_AVEC_ACCES]), eq(profil.typePersonne, 'agent')))
			.orderBy(asc(personne.nom), asc(personne.prenom)),
		base.select().from(affectationEquipe),
		lectureChefs(base, moi)
	]);
	const eq_ = equipeDe(releve, annees, changees, equipes, reglage);
	const p = prises[0];
	const traces = p ? lireTraces(p.traces) : {};
	const noms = new Map(agents.map((a) => [a.id, `${a.prenom} ${a.nom}`]));
	const autres = p ? await nomsDe(base, [p.commenceePar, p.modifieePar, ...idsDesTraces(traces)].filter((id) => !noms.has(id))) : new Map<number, string>();
	const nom = (id: number) => noms.get(id) ?? autres.get(id) ?? 'Un ancien agent';
	const dAstreinte = (id: number) => eq_ !== null && affectations.some((a) => a.personneId === id && a.equipeId === eq_.id && enCours(a.debut, a.fin, aujourdhui));
	const saisie = p ? lireSaisie(p.saisie) : SAISIE_VIDE;
	// Sur une prise validée : un participant ou un chef modifie les participants ; un chef rouvre ; un participant ou un agent d'astreinte le demande.
	const validee = p?.etat === 'validee' && e.situation !== 'parti' && acteur.type === 'personne';
	const chef = validee && chefsDe(roles, p.equipeId, aujourdhui).length > 0;
	const participant = validee && saisie.participants.includes(moi);
	const deLEquipe = validee && affectations.some((a) => a.personneId === moi && a.equipeId === p.equipeId && enCours(a.debut, a.fin, aujourdhui));
	// Les anomalies ouvertes créées par cette prise sont ses propres écarts (une prise rouverte) : pas « déjà signalés ».
	const propres = ouvertes.filter((o) => p !== undefined && o.priseId === p.id);
	const peutFaire = e.situation !== 'parti' && (await peutFairePrise(base, acteur, aujourdhui));
	return {
		engin: e,
		releve: { debut: releve, equipe: eq_ },
		peutFaire,
		prise: p
			? { id: p.id, etat: p.etat, commenceePar: nom(p.commenceePar), commenceeLe: p.commenceeLe, modifieePar: nom(p.modifieePar), modifieeLe: p.modifieeLe, valideeLe: p.valideeLe, saisie, traces: tracesVues(traces, nom) }
			: null,
		zones: zonesDe(zones, elements),
		ouvertes: ouvertes.filter((o) => !propres.includes(o) && o.close === 0).map(({ priseId: _, suivie: __, suiviePar: ___, close: ____, ...o }) => vueAnomalie(o)),
		propres: propres.map((o) => ({ id: o.id, ref: o.ref, suivie: o.suivie === 1, suiviePar: o.suiviePar, close: o.close === 1 })),
		// Rouvrir sans pouvoir faire la prise laisserait une prise que l'on ne peut pas corriger.
		gestes: { participants: participant || chef, rouvrir: chef && peutFaire, demander: !chef && (participant || deLEquipe) },
		agents: agents.map((a) => ({ id: a.id, nom: `${a.prenom} ${a.nom}`, astreinte: dAstreinte(a.id) })).sort((a, b) => Number(b.astreinte) - Number(a.astreinte))
	};
}

async function nomsDe(base: Base, ids: number[]): Promise<Map<number, string>> {
	if (ids.length === 0) return new Map();
	const lignes = await base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne).where(inArray(personne.id, ids));
	return new Map(lignes.map((l) => [l.id, nomComplet(l)]));
}

// Une prise rouverte a déjà créé ses anomalies : elle ne s'abandonne pas et n'est jamais effacée.
const pasRouverte = sql`json_extract(${priseGarde.traces}, '$.rouverte') IS NULL`;
// Rouverte et pas revalidée avant la relève suivante : elle redevient validée, à la date de sa validation d'avant.
const valideeAvant = sql<string | null>`json_extract(${priseGarde.traces}, '$.rouverte.valideeLe')`;
const revaliderPassees = (base: Base, enginId: number, releve: string) =>
	base
		.update(priseGarde)
		.set({ etat: 'validee', valideeLe: valideeAvant, compteur: sql`${priseGarde.compteur} + 1` })
		.where(and(eq(priseGarde.enginId, enginId), eq(priseGarde.etat, 'en_cours'), ne(priseGarde.releve, releve), sql`${valideeAvant} IS NOT NULL`));
// Validée, ou rouverte avec une validation d'avant : lisible dans l'historique et en prise faite, sans attendre la relève suivante.
const faiteSql = sql`(${priseGarde.etat} = 'validee' OR ${valideeAvant} IS NOT NULL)`;

// Commencer la prise d'un engin pour la relève en cours ; si un collègue l'a déjà commencée, c'est la sienne qu'on reprend.
// La version de fiche suivie est marquée utilisée : la modifier en crée une nouvelle, la prise garde la sienne.
// Un brouillon d'une relève passée, jamais validé, ne se reprend plus : il est effacé, ses photos aussi.
export async function commencerPrise(base: Base, basePhotos: BasePhotos, acteur: Acteur, enginId: number, maintenant: string, reglage: Reglage): Promise<number> {
	const moi = await exigerPrise(base, acteur, maintenant);
	const releve = releveDe(maintenant, reglage);
	const passes = and(eq(priseGarde.enginId, enginId), eq(priseGarde.etat, 'en_cours'), ne(priseGarde.releve, releve), pasRouverte);
	const [[e], anciens, [version], annees, changees, equipes] = await base.batch([
		base.select({ situation: engin.situation, typeId: engin.typeId }).from(engin).where(eq(engin.id, enginId)),
		base.select({ saisie: priseGarde.saisie }).from(priseGarde).where(passes),
		base.select({ id: sql<number>`max(${ficheVersion.id})` }).from(ficheVersion).innerJoin(engin, eq(engin.typeId, ficheVersion.typeId)).where(eq(engin.id, enginId)),
		...lecturesEquipe(base, releve)
	]);
	if (!e) throw new DonneeInvalide('Engin inconnu');
	if (e.situation === 'parti') throw new DonneeInvalide('Engin parti');
	if (!version?.id) throw new DonneeInvalide('Type inconnu');
	const equipeId = equipeDe(releve, annees, changees, equipes, reglage)?.id ?? null;
	const saisie: Saisie = { ...SAISIE_VIDE, participants: [moi] };
	const [, , , , [ligne]] = await base.batch([
		revaliderPassees(base, enginId, releve),
		base.delete(priseGarde).where(passes),
		base
			.insert(priseGarde)
			.values({ enginId, releve, versionId: version.id, equipeId, saisie: JSON.stringify(saisie), commenceePar: moi, commenceeLe: maintenant, modifieePar: moi, modifieeLe: maintenant })
			.onConflictDoNothing(),
		base.update(ficheVersion).set({ utilisee: 1 }).where(sql`${ficheVersion.id} = (SELECT ${priseGarde.versionId} FROM ${priseGarde} WHERE ${priseGarde.enginId} = ${enginId} AND ${priseGarde.releve} = ${releve})`),
		base.select({ id: priseGarde.id }).from(priseGarde).where(and(eq(priseGarde.enginId, enginId), eq(priseGarde.releve, releve)))
	]);
	await effacerPhotos(basePhotos, anciens.flatMap((a) => photosDe(lireSaisie(a.saisie))));
	return ligne!.id;
}

const entier = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n);

// Applique un geste au brouillon, sans rien écrire. `ouvertes` : anomalies encore ouvertes sur l'engin ; `agents` : personnes cochables.
export function appliquerGestePrise(saisie: Saisie, geste: GestePrise, ctx: { zones: ZoneFiche[]; ouvertes: { id: number; ref: number | null }[]; agents: number[] }): Saisie {
	const element = (ref: number) => {
		const trouve = ctx.zones.flatMap((z) => z.elements).find((e) => e.ref === ref);
		if (!trouve) throw new DonneeInvalide('Élément inconnu');
		return trouve;
	};
	switch (geste.quoi) {
		case 'zone': {
			if (!ctx.zones.some((z) => z.ref === geste.zone)) throw new DonneeInvalide('Zone inconnue');
			const zones = saisie.zones.filter((z) => z !== geste.zone);
			return { ...saisie, zones: geste.vue ? [...zones, geste.zone] : zones };
		}
		case 'ecart': {
			const e = element(geste.element);
			// Un élément encore signalé : on dit d'abord s'il est retrouvé ; retrouvé, il peut avoir un nouvel écart.
			if (ctx.ouvertes.some((o) => o.ref === e.ref && !saisie.retrouves.includes(o.id))) throw new DonneeInvalide('Élément déjà signalé');
			if (!(GENRES_ECART as readonly string[]).includes(geste.genre)) throw new DonneeInvalide('Écart inconnu');
			const note = typeof geste.note === 'string' ? geste.note.trim().replace(/\s+/g, ' ') : '';
			if (note.length > LIMITES_PRISE.note) throw new DonneeInvalide('Note trop longue');
			// Le nombre manquant ne se dit que d'un élément qui se compte ; sans nombre, tout manque.
			const compte = geste.genre === 'manquant' && e.quantite !== null;
			if (compte && geste.manque !== null && !(entier(geste.manque) && geste.manque >= 1 && geste.manque <= e.quantite!)) throw new DonneeInvalide('Nombre manquant invalide');
			const avant = saisie.ecarts[String(e.ref)];
			return { ...saisie, ecarts: { ...saisie.ecarts, [String(e.ref)]: { genre: geste.genre, manque: compte ? geste.manque : null, note, photo: avant?.photo ?? null } } };
		}
		case 'retirer_ecart': {
			const { [String(geste.element)]: _, ...ecarts } = saisie.ecarts;
			return { ...saisie, ecarts };
		}
		case 'retrouve': {
			if (!ctx.ouvertes.some((o) => o.id === geste.anomalie)) throw new DonneeInvalide('Anomalie inconnue');
			const retrouves = saisie.retrouves.filter((id) => id !== geste.anomalie);
			return { ...saisie, retrouves: geste.oui ? [...retrouves, geste.anomalie] : retrouves };
		}
		case 'participants': {
			const ids = [...new Set(geste.ids)];
			if (ids.length > LIMITES_PRISE.participants || ids.some((id) => !ctx.agents.includes(id))) throw new DonneeInvalide('Participant inconnu');
			return { ...saisie, participants: ids };
		}
		default:
			throw new DonneeInvalide('Geste inconnu');
	}
}

// Le brouillon d'une prise et ce qu'il faut pour en vérifier un geste : une requête.
// `enginId` : l'engin de la page ; une prise d'un autre engin est refusée.
async function lireBrouillon(base: Base, id: number, enginId?: number) {
	const version = sql<number>`(SELECT ${priseGarde.versionId} FROM ${priseGarde} WHERE ${priseGarde.id} = ${id})`;
	const [[p], zones, elements, ouvertes, agents] = await base.batch([
		base.select({ prise: priseGarde, situation: engin.situation, nomEngin: sql<string>`${engin.nom}`.as('nom_engin') }).from(priseGarde).innerJoin(engin, eq(engin.id, priseGarde.enginId)).where(eq(priseGarde.id, id)),
		...lecturesVersion(base, version),
		base
			.select({ id: anomalie.id, ref: anomalie.ref, zone: anomalie.zone, libelle: anomalie.libelle, signaleePar: anomalie.signaleePar, priseEnChargePar: anomalie.priseEnChargePar, priseId: anomalie.priseId, closeLe: anomalie.closeLe })
			.from(anomalie)
			.where(and(sql`${anomalie.enginId} = (SELECT ${priseGarde.enginId} FROM ${priseGarde} WHERE ${priseGarde.id} = ${id})`, or(isNull(anomalie.closeLe), eq(anomalie.priseId, id)))),
		base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne).innerJoin(profil, eq(profil.id, personne.profilId)).where(and(inArray(personne.statut, [...STATUTS_AVEC_ACCES]), eq(profil.typePersonne, 'agent')))
	]);
	if (!p || (enginId !== undefined && p.prise.enginId !== enginId)) throw new DonneeInvalide('Prise inconnue');
	if (p.situation === 'parti') throw new DonneeInvalide('Engin parti');
	// `ouvertes` : celles des autres prises, encore ouvertes ; `propres` : celles que cette prise a créées (rouverte), closes ou non.
	return {
		prise: p.prise,
		nomEngin: p.nomEngin,
		saisie: lireSaisie(p.prise.saisie),
		traces: lireTraces(p.prise.traces),
		zones: zonesDe(zones, elements),
		ouvertes: ouvertes.filter((o) => o.priseId !== id && o.closeLe === null),
		propres: ouvertes.filter((o) => o.priseId === id),
		agents: agents.map((a) => a.id),
		noms: new Map(agents.map((a) => [a.id, `${a.prenom} ${a.nom}`]))
	};
}

function exigerEnCours(p: { etat: EtatPrise; releve: string }, maintenant: string, reglage: Reglage) {
	if (p.etat === 'validee') throw new DonneeInvalide('Prise déjà validée');
	if (p.releve !== releveDe(maintenant, reglage)) throw new DonneeInvalide('Relève passée');
}

// Un geste sur le brouillon. Deux collègues peuvent écrire en même temps : l'écriture est gardée par le compteur et refaite une fois
// sur la saisie relue. Une photo d'écart part d'abord dans la base des photos ; celle qu'elle remplace est effacée.
export async function gestePrise(base: Base, basePhotos: BasePhotos, acteur: Acteur, id: number, geste: GestePrise, maintenant: string, reglage: Reglage, enginId?: number): Promise<void> {
	const moi = await exigerPrise(base, acteur, maintenant);
	const nouvelle = geste.quoi === 'ecart' && geste.photo ? exigerPhotos([geste.photo]) : [];
	await avecPhotos(basePhotos, nouvelle, maintenant, async ([idPhoto]) => {
		for (let essai = 0; ; essai++) {
			const b = await lireBrouillon(base, id, enginId);
			exigerEnCours(b.prise, maintenant, reglage);
			let saisie = appliquerGestePrise(b.saisie, geste, b);
			if (geste.quoi === 'ecart' && geste.photo !== undefined) {
				const cle = String(geste.element);
				saisie = { ...saisie, ecarts: { ...saisie.ecarts, [cle]: { ...saisie.ecarts[cle]!, photo: idPhoto ?? null } } };
			}
			const ecrit = await base
				.update(priseGarde)
				.set({ saisie: JSON.stringify(saisie), compteur: b.prise.compteur + 1, modifieePar: moi, modifieeLe: maintenant })
				.where(and(eq(priseGarde.id, id), eq(priseGarde.compteur, b.prise.compteur), eq(priseGarde.etat, 'en_cours')))
				.returning({ id: priseGarde.id });
			if (ecrit.length > 0) {
				// Rouverte, ses photos peuvent être celles de ses anomalies : le ménage de nuit efface les orphelines.
				if (!b.traces.rouverte) await effacerPhotos(basePhotos, photosDe(b.saisie).filter((ph) => !photosDe(saisie).includes(ph)));
				return;
			}
			if (essai > 0) throw new DonneeInvalide('Prise changée entre-temps');
		}
	});
}

// Le premier geste sur la fiche, sans prise encore en cours : il la commence (ou reprend celle d'un collègue), puis s'applique.
// Annuler ou choisir les participants ne commence rien.
export async function premierGestePrise(base: Base, basePhotos: BasePhotos, acteur: Acteur, enginId: number, geste: GestePrise, maintenant: string, reglage: Reglage): Promise<number> {
	if (geste.quoi === 'participants' || geste.quoi === 'retirer_ecart' || (geste.quoi === 'zone' && !geste.vue)) throw new DonneeInvalide('Prise inconnue');
	const id = await commencerPrise(base, basePhotos, acteur, enginId, maintenant, reglage);
	try {
		await gestePrise(base, basePhotos, acteur, id, geste, maintenant, reglage, enginId);
	} catch (erreur) {
		// Geste refusé : pas de brouillon vide. Celui d'un collègue, ou déjà touché, reste.
		const moi = acteur.type === 'personne' ? acteur.id : 0;
		await base.delete(priseGarde).where(and(eq(priseGarde.id, id), eq(priseGarde.etat, 'en_cours'), eq(priseGarde.compteur, 0), eq(priseGarde.commenceePar, moi)));
		throw erreur;
	}
	return id;
}

const photosDe = (s: Saisie) => Object.values(s.ecarts).flatMap((e) => (e.photo === null ? [] : [e.photo]));

// Abandonner un brouillon : il est effacé, ses photos aussi.
export async function abandonnerPrise(base: Base, basePhotos: BasePhotos, acteur: Acteur, id: number, maintenant: string, enginId?: number): Promise<void> {
	await exigerPrise(base, acteur, maintenant);
	const [p] = await base
		.delete(priseGarde)
		.where(and(eq(priseGarde.id, id), eq(priseGarde.etat, 'en_cours'), pasRouverte, enginId === undefined ? undefined : eq(priseGarde.enginId, enginId)))
		.returning({ saisie: priseGarde.saisie });
	if (!p) throw new DonneeInvalide('Prise inconnue');
	await effacerPhotos(basePhotos, photosDe(lireSaisie(p.saisie)));
}

// Valider : toutes les zones vues. D'un bloc, gardé par le compteur : la prise passe validée (au nom des participants, celui qui
// valide compris), les anomalies retrouvées sont closes, chaque écart devient une anomalie (sauf une déjà ouverte sur le même élément).
// La cloche : les nouvelles anomalies à ceux qui les traitent et au chef de garde de l'équipe d'astreinte ; un élément retrouvé,
// à son déclarant et à qui l'avait pris en charge.
export async function validerPrise(base: Base, acteur: Acteur, id: number, maintenant: string, reglage: Reglage, enginAttendu?: number): Promise<void> {
	const moi = await exigerPrise(base, acteur, maintenant);
	const b = await lireBrouillon(base, id, enginAttendu);
	exigerEnCours(b.prise, maintenant, reglage);
	if (b.zones.some((z) => !b.saisie.zones.includes(z.ref))) throw new DonneeInvalide('Zones à voir');
	const saisie: Saisie = { ...b.saisie, participants: [...new Set([moi, ...b.saisie.participants])] };
	const compteur = b.prise.compteur + 1;
	const validee = sql`EXISTS (SELECT 1 FROM ${priseGarde} WHERE ${priseGarde.id} = ${id} AND ${priseGarde.compteur} = ${compteur} AND ${priseGarde.etat} = 'validee')`;
	const ecarts = JSON.stringify(
		b.zones.flatMap((z) =>
			z.elements.flatMap((e) => {
				const x = saisie.ecarts[String(e.ref)];
				return x ? [{ ref: e.ref, zone: z.nom, libelle: e.libelle, genre: x.genre, manque: x.manque, note: x.note || null, photo: x.photo }] : [];
			})
		)
	);
	const enginId = b.prise.enginId;
	// Un écart sur un élément encore signalé (et non retrouvé), ou qui a déjà son anomalie de cette prise (rouverte), n'en crée pas.
	const nouvelles = b.zones
		.flatMap((z) => z.elements)
		.filter((e) => saisie.ecarts[String(e.ref)] && !b.ouvertes.some((o) => o.ref === e.ref && !saisie.retrouves.includes(o.id)) && !b.propres.some((o) => o.ref === e.ref));
	// Rouverte : les anomalies de la première validation que personne ne suit encore suivent leur écart, modifié ou retiré.
	const libre = sql`${anomalie.priseId} = ${id} AND ${anomalie.closeLe} IS NULL AND NOT ${suivieSql}`;
	const refs = sql`(SELECT json_extract(value, '$.ref') FROM json_each(${ecarts}))`;
	const qui = b.noms.get(moi) ?? 'un agent';
	// Chaque nouvelle anomalie prévient selon sa zone ; chacun reçoit un avis avec les seules anomalies qui le regardent.
	const zoneDe = (ref: number) => b.zones.find((z) => z.elements.some((e) => e.ref === ref))!;
	const prevenus = nouvelles.length ? await quiPrevenir(base, maintenant.slice(0, 10), b.prise.equipeId, moi, nouvelles.map((e) => zoneDe(e.ref).prevenir)) : [];
	const parPersonne = new Map<number, string[]>();
	nouvelles.forEach((e, i) => {
		for (const p of prevenus[i]!) if (p !== moi) parPersonne.set(p, [...(parPersonne.get(p) ?? []), e.libelle]);
	});
	const parTexte = new Map<string, number[]>();
	for (const [p, libelles] of parPersonne) {
		const texte = `${libelles.length} ${libelles.length > 1 ? 'anomalies signalées' : 'anomalie signalée'} par ${qui} (${libelles.join(', ')})`;
		parTexte.set(texte, [...(parTexte.get(texte) ?? []), p]);
	}
	const avis = [
		...[...parTexte].flatMap(([texte, ids]) => avisAnomalies(base, ids, { titre: `${b.nomEngin}, prise de garde`, texte, url: `/engins/anomalies?engin=${enginId}` }, maintenant, validee)),
		...b.ouvertes
			.filter((o) => saisie.retrouves.includes(o.id))
			// Seulement si c'est bien cette prise qui l'a close (un collègue a pu la clore entre-temps).
			.flatMap((o) => avisAnomalies(base, [...new Set([o.signaleePar, o.priseEnChargePar])].filter((x): x is number => x !== null && x !== moi), { titre: `${b.nomEngin}, ${o.libelle}`, texte: `Retrouvée à la prise de garde par ${qui}`, url: `/engins/anomalies/${o.id}` }, maintenant, sql`${validee} AND EXISTS (SELECT 1 FROM ${anomalie} WHERE ${anomalie.id} = ${o.id} AND ${anomalie.closePriseId} = ${id})`))
	];
	const [ecrit] = await base.batch([
		base
			.update(priseGarde)
			.set({ etat: 'validee', valideeLe: maintenant, saisie: JSON.stringify(saisie), compteur, modifieePar: moi, modifieeLe: maintenant })
			.where(and(eq(priseGarde.id, id), eq(priseGarde.compteur, b.prise.compteur), eq(priseGarde.etat, 'en_cours')))
			.returning({ id: priseGarde.id }),
		base
			.update(anomalie)
			.set({ closePar: moi, closeLe: maintenant, closePriseId: id })
			.where(and(inArray(anomalie.id, saisie.retrouves.length ? saisie.retrouves : [0]), eq(anomalie.enginId, enginId), isNull(anomalie.closeLe), validee)),
		instruction(
		base,
			sql`INSERT INTO ${anomalie} (engin_id, ref, zone, libelle, genre, manque, note, photo_id, prise_id, signalee_par, signalee_le)
				SELECT ${enginId}, json_extract(value, '$.ref'), json_extract(value, '$.zone'), json_extract(value, '$.libelle'), json_extract(value, '$.genre'),
					json_extract(value, '$.manque'), json_extract(value, '$.note'), json_extract(value, '$.photo'), ${id}, ${moi}, ${maintenant}
				FROM json_each(${ecarts})
				WHERE ${validee} AND NOT EXISTS (SELECT 1 FROM ${anomalie} a WHERE a.engin_id = ${enginId} AND a.ref = json_extract(value, '$.ref') AND (a.close_le IS NULL OR a.prise_id = ${id}))`
		),
		...(b.propres.length
			? [
					instruction(
						base,
						sql`UPDATE ${anomalie} SET genre = json_extract(e.value, '$.genre'), manque = json_extract(e.value, '$.manque'), note = json_extract(e.value, '$.note'), photo_id = json_extract(e.value, '$.photo')
							FROM json_each(${ecarts}) e WHERE ${libre} AND ${anomalie.ref} = json_extract(e.value, '$.ref') AND ${validee}`
					),
					// L'écart retiré : son anomalie est annulée (close, détachée de la prise), puis son historique le dit.
					base
						.update(anomalie)
						.set({ closePar: moi, closeLe: maintenant, priseId: null })
						.where(and(libre, sql`${anomalie.ref} NOT IN ${refs}`, validee)),
					instruction(
						base,
						sql`INSERT INTO ${anomalieSuivi} (anomalie_id, quoi, texte, par, le) SELECT ${anomalie.id}, 'close', ${'Annulée, écart retiré de la prise de garde'}, ${moi}, ${maintenant}
							FROM ${anomalie} WHERE ${anomalie.id} IN (SELECT value FROM json_each(${JSON.stringify(b.propres.map((o) => o.id))})) AND ${anomalie.priseId} IS NULL AND ${anomalie.closeLe} = ${maintenant}
							AND NOT EXISTS (SELECT 1 FROM ${anomalieSuivi} s WHERE s.anomalie_id = ${anomalie.id})`
					)
				]
			: []),
		...avis
	]);
	if (ecrit.length === 0) {
		// Un collègue a validé juste avant : rien n'a été écrit deux fois (anomalies déjà closes ou déjà ouvertes).
		const [relue] = await base.select({ etat: priseGarde.etat }).from(priseGarde).where(eq(priseGarde.id, id));
		throw new DonneeInvalide(relue?.etat === 'validee' ? 'Prise déjà validée' : 'Prise changée entre-temps');
	}
}

// Une prise validée de la relève en cours, et les chefs du centre (une lecture de plus) : de quoi vérifier un geste après validation.
async function lireValidee(base: Base, acteur: Acteur, id: number, maintenant: string, reglage: Reglage, enginId?: number) {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux agents');
	const b = await lireBrouillon(base, id, enginId);
	if (b.prise.etat !== 'validee') throw new DonneeInvalide('Prise pas encore validée');
	if (b.prise.releve !== releveDe(maintenant, reglage)) throw new DonneeInvalide('Relève passée');
	const [chefs, equipiers] = await base.batch([
		lectureChefs(base),
		base.select({ personneId: affectationEquipe.personneId, debut: affectationEquipe.debut, fin: affectationEquipe.fin }).from(affectationEquipe).where(and(eq(affectationEquipe.personneId, acteur.id), eq(affectationEquipe.equipeId, b.prise.equipeId ?? 0)))
	]);
	const chefsPrise = chefsDe(chefs, b.prise.equipeId, aujourdhui);
	return { ...b, moi: acteur.id, chefs: chefsPrise, chef: chefsPrise.some((c) => c.id === acteur.id), deLEquipe: equipiers.some((a) => enCours(a.debut, a.fin, aujourdhui)) };
}

// La prise validée est écrite seulement si personne ne l'a changée entre-temps (compteur) ; `apres` : la ligne de journal ou la
// cloche, écrites seulement si la prise l'a été.
async function ecrireValidee(base: Base, v: Awaited<ReturnType<typeof lireValidee>>, maj: { saisie?: Saisie; traces: TracesPrise; rouvrir?: boolean }, maintenant: string, apres: (ecrite: SQL) => BatchItem<'sqlite'>[]) {
	const compteur = v.prise.compteur + 1;
	// Notre écriture, pas celle d'un collègue parti du même compteur : la trace porte qui et quand.
	const traces = JSON.stringify(maj.traces);
	const ecrite = sql`EXISTS (SELECT 1 FROM ${priseGarde} WHERE ${priseGarde.id} = ${v.prise.id} AND ${priseGarde.compteur} = ${compteur} AND ${priseGarde.traces} = ${traces})`;
	const [ecrit] = await base.batch([
		base
			.update(priseGarde)
			.set({
				traces,
				compteur,
				...(maj.saisie ? { saisie: JSON.stringify(maj.saisie) } : {}),
				...(maj.rouvrir ? { etat: 'en_cours' as const, valideeLe: null, modifieePar: v.moi, modifieeLe: maintenant } : {})
			})
			.where(and(eq(priseGarde.id, v.prise.id), eq(priseGarde.compteur, v.prise.compteur), eq(priseGarde.etat, 'validee')))
			.returning({ id: priseGarde.id }),
		...apres(ecrite)
	]);
	if (ecrit.length === 0) {
		const relue = await lireBrouillon(base, v.prise.id);
		throw (maj.rouvrir && relue.prise.etat !== 'validee' ? dejaRouverte(relue, v.moi) : null) ?? new DonneeInvalide('Prise changée entre-temps');
	}
}

// « Déjà traité par… » quand un autre a rouvert la prise ; nul sinon.
function dejaRouverte(b: { traces: TracesPrise; noms: Map<number, string> }, moi: number): DonneeInvalide | null {
	const r = b.traces.rouverte;
	return r && r.par !== moi ? new DonneeInvalide(`Déjà traité par ${b.noms.get(r.par) ?? 'un ancien agent'}`) : null;
}

const journalPrise = (base: Base, v: { moi: number; prise: { enginId: number } }, action: string, maintenant: string, si: SQL, details?: object) =>
	ligneJournalSi(base, { acteur: `personne:${v.moi}`, action, cibleType: 'engin', cibleId: v.prise.enginId, details }, maintenant, si);

// Après la validation, jusqu'à la relève suivante : les participants se corrigent (un collègue oublié), sans toucher à l'inventaire.
// Par un participant, le chef de garde de l'équipe d'astreinte, le chef de centre ou l'adjoint. Au journal (suivi du centre).
export async function modifierParticipantsPrise(base: Base, acteur: Acteur, id: number, ids: number[], maintenant: string, reglage: Reglage, enginId?: number): Promise<void> {
	const v = await lireValidee(base, acteur, id, maintenant, reglage, enginId);
	if (!v.chef && !v.saisie.participants.includes(v.moi)) throw new RefusDroit('FAIRE_PRISE_DE_GARDE', { type: 'centre' }, 'Réservé aux participants et aux chefs');
	if (ids.length === 0) throw new DonneeInvalide('Participants manquants');
	const saisie = appliquerGestePrise(v.saisie, { quoi: 'participants', ids }, v);
	await ecrireValidee(base, v, { saisie, traces: { ...v.traces, participants: { par: v.moi, le: maintenant } } }, maintenant, (si) => [journalPrise(base, v, 'modifier_participants_prise', maintenant, si)]);
}

// Rouvrir une prise validée, jusqu'à la relève suivante, avec un motif : par le chef de garde de l'équipe d'astreinte, le chef de centre
// ou l'adjoint. Elle redevient en cours (zones vues gardées, écarts modifiables) ; une demande en attente est effacée.
export async function rouvrirPrise(base: Base, acteur: Acteur, id: number, motif: string, maintenant: string, reglage: Reglage, enginId?: number): Promise<void> {
	// Rouverte par un autre chef (le chef de centre et l'adjoint agissent tous les deux) : le second l'apprend.
	const v = await lireValidee(base, acteur, id, maintenant, reglage, enginId).catch(async (e: unknown) => {
		if (e instanceof DonneeInvalide && e.message === 'Prise pas encore validée' && acteur.type === 'personne') throw dejaRouverte(await lireBrouillon(base, id, enginId), acteur.id) ?? e;
		throw e;
	});
	if (!v.chef) throw new RefusDroit('FAIRE_PRISE_DE_GARDE', { type: 'centre' }, 'Réservé au chef de garde, au chef de centre et à l’adjoint');
	// Sinon il rouvrirait une prise qu'il ne pourrait pas corriger.
	if (!(await peutFairePrise(base, acteur, maintenant.slice(0, 10)))) throw new RefusDroit('FAIRE_PRISE_DE_GARDE', { type: 'centre' }, 'Réservé à qui fait la prise de garde');
	const texte = motifDe(motif);
	const { demande: _, ...traces } = v.traces;
	await ecrireValidee(base, v, { traces: { ...traces, rouverte: { par: v.moi, le: maintenant, motif: texte, valideeLe: v.prise.valideeLe ?? undefined } }, rouvrir: true }, maintenant, (si) => [journalPrise(base, v, 'rouvrir_prise', maintenant, si, { motif: texte })]);
}

// Demander la réouverture (un participant ou un agent de l'équipe d'astreinte), avec un motif : à la cloche du chef de garde de l'équipe,
// à défaut du chef de centre et de l'adjoint, avec un lien vers la prise. La dernière demande reste notée sur la prise.
export async function demanderReouverture(base: Base, acteur: Acteur, id: number, motif: string, maintenant: string, reglage: Reglage, enginId?: number): Promise<void> {
	const v = await lireValidee(base, acteur, id, maintenant, reglage, enginId);
	if (!v.saisie.participants.includes(v.moi) && !v.deLEquipe) throw new RefusDroit('FAIRE_PRISE_DE_GARDE', { type: 'centre' }, 'Réservé aux participants et à l’équipe d’astreinte');
	const texte = motifDe(motif);
	const deGarde = v.chefs.filter((c) => c.systeme === 'chef_equipe' && c.id !== v.moi).map((c) => c.id);
	const prevenus = deGarde.length ? deGarde : v.chefs.filter((c) => c.systeme !== 'chef_equipe' && c.id !== v.moi).map((c) => c.id);
	if (prevenus.length === 0) throw new DonneeInvalide('Aucun chef à prévenir');
	const qui = v.noms.get(v.moi) ?? 'Un agent';
	const avis = { titre: `Réouverture demandée par ${qui}`, texte: `${v.nomEngin}, motif « ${texte} »`, url: `/engins/${v.prise.enginId}/prise` };
	await ecrireValidee(base, v, { traces: { ...v.traces, demande: { par: v.moi, le: maintenant, motif: texte } } }, maintenant, (si) => [...avisAnomalies(base, [...new Set(prevenus)], avis, maintenant, si)]);
}

export type PriseDeLaReleve = { engin: EnginVu; prise: { etat: EtatPrise; valideeLe: string | null; equipe: string | null; par: string } | null; ouvertes: number };

// La relève en cours, engin par engin (partis exclus) : prise faite (par quelle équipe, quand), en cours ou à faire ; anomalies ouvertes.
export async function prisesDeLaReleve(base: Base, acteur: Acteur, maintenant: string, reglage: Reglage): Promise<{ releve: Releve; peutFaire: boolean; engins: PriseDeLaReleve[] }> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await voitLesEngins(base, acteur, aujourdhui))) throw new RefusDroit('VOIR_ENGINS', { type: 'centre' });
	const releve = releveDe(maintenant, reglage);
	const [engins, prises, ouvertes, annees, changees, equipes] = await base.batch([
		base
			// Pas deux colonnes du même nom dans un batch (D1 n'en garde qu'une) : le nom du type est renommé.
			.select({ id: engin.id, nom: engin.nom, immatriculation: engin.immatriculation, typeId: engin.typeId, type: sql<string>`${typeEngin.nom}`.as('type'), ordreType: typeEngin.ordre, situation: engin.situation, provenance: engin.provenance, etat: engin.etat, partiLe: engin.partiLe })
			.from(engin)
			.innerJoin(typeEngin, eq(typeEngin.id, engin.typeId))
			.where(ne(engin.situation, 'parti')),
		base
			.select({ enginId: priseGarde.enginId, etat: priseGarde.etat, valideeLe: priseGarde.valideeLe, equipeId: priseGarde.equipeId, prenom: personne.prenom, nom: personne.nom })
			.from(priseGarde)
			.innerJoin(personne, eq(personne.id, priseGarde.modifieePar))
			.where(eq(priseGarde.releve, releve)),
		base.select({ enginId: anomalie.enginId, n: sql<number>`count(*)` }).from(anomalie).where(isNull(anomalie.closeLe)).groupBy(anomalie.enginId),
		...lecturesEquipe(base, releve)
	]);
	return {
		releve: { debut: releve, equipe: equipeDe(releve, annees, changees, equipes, reglage) },
		peutFaire: await peutFairePrise(base, acteur, aujourdhui),
		engins: engins
			.sort((a, b) => a.ordreType - b.ordreType || a.nom.localeCompare(b.nom, 'fr', { numeric: true }))
			.map(({ ordreType: _, ...e }) => {
				const p = prises.find((x) => x.enginId === e.id);
				return {
					engin: e,
					prise: p ? { etat: p.etat, valideeLe: p.valideeLe, equipe: equipes.find((x) => x.id === p.equipeId)?.nom ?? null, par: `${p.prenom} ${p.nom}` } : null,
					ouvertes: ouvertes.find((o) => o.enginId === e.id)?.n ?? 0
				};
			})
	};
}

// Les engins dont la prise n'est pas validée trois heures après la relève, et l'équipe d'astreinte (à qui le dire). Rien sinon.
// Une requête. Le retard est seulement signalé : jamais d'indisponibilité.
export async function prisesEnRetard(base: Base, maintenant: string, reglage: Reglage): Promise<{ equipeId: number | null; engins: string[] } | null> {
	const releve = releveDe(maintenant, reglage);
	if (maintenant.slice(0, 16) < decaler(releve, RETARD_MIN)) return null;
	const [engins, annees, changees, equipes] = await base.batch([
		base
			.select({ nom: engin.nom, ordreType: typeEngin.ordre })
			.from(engin)
			.innerJoin(typeEngin, eq(typeEngin.id, engin.typeId))
			.where(and(ne(engin.situation, 'parti'), sql`NOT EXISTS (SELECT 1 FROM ${priseGarde} WHERE ${priseGarde.enginId} = ${engin.id} AND ${priseGarde.releve} = ${releve} AND ${priseGarde.etat} = 'validee')`)),
		...lecturesEquipe(base, releve)
	]);
	if (engins.length === 0) return null;
	const noms = engins.sort((a, b) => a.ordreType - b.ordreType || a.nom.localeCompare(b.nom, 'fr', { numeric: true })).map((e) => e.nom);
	return { equipeId: equipeDe(releve, annees, changees, equipes, reglage)?.id ?? null, engins: noms };
}

export type PriseHistorique = { id: number; releve: string; valideeLe: string; equipe: string | null; par: string; signalees: number; retrouvees: number };

// Les dernières prises validées d'un engin (accès vérifié par l'appelant, avec l'engin).
export async function historiquePrises(base: Base, enginId: number): Promise<PriseHistorique[]> {
	const lignes = await base
		.select({
			id: priseGarde.id,
			releve: priseGarde.releve,
			valideeLe: sql<string>`coalesce(${priseGarde.valideeLe}, ${valideeAvant})`.as('validee_le'),
			equipe: equipe.nom,
			prenom: personne.prenom,
			nom: personne.nom,
			signalees: sql<number>`(SELECT count(*) FROM ${anomalie} WHERE ${anomalie.priseId} = ${priseGarde.id})`,
			retrouvees: sql<number>`(SELECT count(*) FROM ${anomalie} WHERE ${anomalie.closePriseId} = ${priseGarde.id})`
		})
		.from(priseGarde)
		.innerJoin(personne, eq(personne.id, priseGarde.modifieePar))
		.leftJoin(equipe, eq(equipe.id, priseGarde.equipeId))
		.where(and(eq(priseGarde.enginId, enginId), faiteSql))
		.orderBy(desc(priseGarde.releve))
		.limit(20);
	return lignes.map(({ prenom, nom, ...l }) => ({ ...l, par: `${prenom} ${nom}` }));
}

export type PriseFaite = {
	id: number;
	engin: EnginVu;
	releve: string;
	valideeLe: string;
	// Rouverte, pas encore revalidée : pendant sa relève, la page renvoie à la prise en cours.
	enCours: boolean;
	equipe: string | null;
	participants: string[];
	zones: ZoneFiche[];
	signalees: AnomalieVue[];
	retrouvees: AnomalieVue[];
	dejaOuvertes: number[];
	traces: TracesVues;
};

// Une prise validée, telle qu'elle a été faite : la fiche de son époque, les écarts signalés et les anomalies retrouvées.
export async function lirePriseFaite(base: Base, acteur: Acteur, id: number): Promise<PriseFaite> {
	const [p] = await base.select().from(priseGarde).where(and(eq(priseGarde.id, id), faiteSql));
	if (!p) throw new DonneeInvalide('Prise inconnue');
	const traces = lireTraces(p.traces);
	const valideeLe = p.valideeLe ?? traces.rouverte!.valideeLe!;
	const { engin: e } = await lireEngin(base, acteur, p.enginId, valideeLe.slice(0, 10));
	const saisie = lireSaisie(p.saisie);
	const ids = [...saisie.participants, ...idsDesTraces(traces)];
	const [zones, elements, liees, [eq_], gens] = await base.batch([
		...lecturesVersion(base, sql<number>`${p.versionId}`),
		base.select(colonnesAnomalie).from(anomalie).innerJoin(personne, eq(personne.id, anomalie.signaleePar)).where(or(eq(anomalie.priseId, id), eq(anomalie.closePriseId, id))).orderBy(asc(anomalie.id)),
		base.select({ nom: equipe.nom }).from(equipe).where(eq(equipe.id, p.equipeId ?? 0)),
		base.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom }).from(personne).where(inArray(personne.id, ids.length ? ids : [0]))
	]);
	const signalees = liees.filter((a) => !saisie.retrouves.includes(a.id)).map(vueAnomalie);
	// Un écart noté sur un élément déjà signalé et ouvert n'a pas créé d'anomalie de plus.
	const dejaOuvertes = Object.keys(saisie.ecarts).map(Number).filter((ref) => !signalees.some((a) => a.ref === ref));
	return {
		id,
		engin: e,
		releve: p.releve,
		valideeLe,
		enCours: p.etat === 'en_cours',
		equipe: eq_?.nom ?? null,
		participants: saisie.participants.map((pid) => nomComplet(gens.find((g) => g.id === pid))),
		zones: zonesDe(zones, elements),
		signalees,
		retrouvees: liees.filter((a) => saisie.retrouves.includes(a.id)).map(vueAnomalie),
		dejaOuvertes,
		traces: tracesVues(traces, (pid) => nomComplet(gens.find((g) => g.id === pid)))
	};
}

// La photo d'un écart (brouillon ou anomalie), à qui voit les engins.
export async function photoAnomalie(base: Base, basePhotos: BasePhotos, acteur: Acteur, idPhoto: number, aujourdhui: string): Promise<Photo> {
	if (!(await voitLesEngins(base, acteur, aujourdhui))) throw new RefusDroit('VOIR_ENGINS', { type: 'centre' });
	const [connue] = await base.all<{ x: number }>(
		sql`SELECT 1 AS x WHERE EXISTS (SELECT 1 FROM ${anomalie} WHERE ${anomalie.photoId} = ${idPhoto})
			OR EXISTS (SELECT 1 FROM ${priseGarde}, json_each(${priseGarde.saisie}, '$.ecarts') e WHERE ${priseGarde.etat} = 'en_cours' AND json_extract(e.value, '$.photo') = ${idPhoto})`
	);
	if (!connue) throw new DonneeInvalide('Photo inconnue');
	return lireOctets(basePhotos, idPhoto);
}

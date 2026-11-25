import { and, asc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import type { Base } from './base.ts';
import { requeteTenues, tenuesValides } from './casquettes.ts';
import { enCours } from './dates.ts';
import type { Acteur, Perimetre } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { STATUTS_AVEC_ACCES } from './listes.ts';
import { affectationEquipe, comite, equipe, personne, profil } from './schema.ts';

export type CleMur = 'centre' | 'vie' | `equipe:${number}` | `comite:${number}`;
// `peutReagir` : commenter, aimer, voter et répondre à un événement.
export type Mur = { cle: CleMur; nom: string; type: 'centre' | 'vie' | 'equipe' | 'comite'; peutPublier: boolean; peutReagir: boolean; peutModerer: boolean; lectureSeule: boolean };

// Un modérateur peut aussi publier ; un mur en lecture seule (équipe inactive, comité dissous) ne reçoit plus rien.
function mur(cle: CleMur, nom: string, type: Mur['type'], publie: boolean, modere: boolean, lectureSeule = false, reagit = true): Mur {
	return { cle, nom, type, peutPublier: !lectureSeule && (publie || modere), peutReagir: !lectureSeule && reagit, peutModerer: modere, lectureSeule };
}

// Un profil extérieur peut se voir ouvrir Le centre, Vie du centre et des comités, en lecture ou en écriture. Jamais une équipe.
export type NiveauOuvert = 'lecture' | 'ecriture';
export const NIVEAUX_OUVERTS = ['lecture', 'ecriture'] as const;
export const estCleOuvrable = (cle: string) => /^(?:centre|vie|comite:[1-9]\d*)$/.test(cle);

// La colonne profil.murs_ouverts, lue sans jamais échouer : ce qui n'est pas compris est ignoré.
export function lireMursOuverts(json: string | null): Record<string, NiveauOuvert> {
	let lu: unknown;
	try {
		lu = JSON.parse(json ?? '{}');
	} catch {
		return {};
	}
	if (lu === null || typeof lu !== 'object' || Array.isArray(lu)) return {};
	const ouverts: Record<string, NiveauOuvert> = {};
	for (const [cle, niveau] of Object.entries(lu)) if (estCleOuvrable(cle) && (NIVEAUX_OUVERTS as readonly unknown[]).includes(niveau)) ouverts[cle] = niveau as NiveauOuvert;
	return ouverts;
}

// Ce qui relie une personne aux murs ce jour-là. `fiche` : faux pour le super administrateur.
// `ouverts` : pour une personne d'un profil extérieur, les murs que son profil lui ouvre (null pour un agent).
export type Appartenances = { fiche: boolean; tous: boolean; membreEquipe: Set<number>; chefEquipe: Set<number>; membreComite: Set<number>; rapporteur: Set<number>; ouverts: Map<string, NiveauOuvert> | null };

// Règle unique, partagée par mursDe et le suivi des publications : à partir des affectations et des rôles tenus (lignes de requeteTenues).
// Une personne d'un profil extérieur (`ouverts` donné) ne tient compte ni de ses équipes ni de ses rôles : seulement de ses murs ouverts.
export function appartenances(
	affectations: { equipeId: number; debut: string; fin: string | null }[],
	tenues: { type: string; portee: string; perimetreId: number | null; systeme: string | null; nomme: string | null }[],
	aujourdhui: string,
	ouverts: Record<string, NiveauOuvert> | null = null
): Appartenances {
	const vide = { fiche: true, tous: false, membreEquipe: new Set<number>(), chefEquipe: new Set<number>(), membreComite: new Set<number>(), rapporteur: new Set<number>() };
	if (ouverts !== null) return { ...vide, ouverts: new Map(Object.entries(ouverts)) };
	const valides = tenuesValides(tenues);
	const a: Appartenances = { ...vide, tous: valides.some((l) => l.systeme === 'chef_centre' || l.systeme === 'chef_centre_adjoint'), ouverts: null };
	for (const x of affectations) if (enCours(x.debut, x.fin, aujourdhui)) a.membreEquipe.add(x.equipeId);
	for (const l of valides) {
		if (l.perimetreId === null) continue;
		if (l.type === 'equipe' && l.systeme === 'chef_equipe') a.chefEquipe.add(l.perimetreId);
		if (l.type === 'comite') a.membreComite.add(l.perimetreId);
		if (l.type === 'comite' && l.nomme !== null) a.rapporteur.add(l.perimetreId);
	}
	return a;
}

const SANS_FICHE: Appartenances = { fiche: false, tous: true, membreEquipe: new Set(), chefEquipe: new Set(), membreComite: new Set(), rapporteur: new Set(), ouverts: null };

// Membre naturel d'un mur (attendu dans les suivis) : tout agent pour Le centre et Vie du centre ; membres en cours et chef de garde
// pour une équipe ; membres en cours (rapporteur compris) pour un comité. Le chef de centre, l'adjoint et le super administrateur qui
// supervisent une équipe ou un comité n'en sont pas membres. Une personne d'un profil extérieur : membre des murs qui lui sont ouverts.
export function estMembre(a: Appartenances, cle: string): boolean {
	if (!a.fiche) return false;
	if (a.ouverts !== null) return a.ouverts.has(cle);
	if (cle === 'centre' || cle === 'vie') return true;
	const [type, numero] = cle.split(':');
	const id = Number(numero);
	if (type === 'equipe') return a.membreEquipe.has(id) || a.chefEquipe.has(id);
	return type === 'comite' && a.membreComite.has(id);
}

// Lectures à placer dans un batch : les agents qui ont accès (ni partis, ni suspendus, ni extérieurs, comme mursDe),
// toutes les affectations en cours et tous les rôles tenus ce jour-là. `avecOuverts` : aussi les personnes d'un profil extérieur
// à qui des murs sont ouverts (pour les murs seulement : le planning et les remplacements n'en veulent pas).
// Les murs ouverts du profil, sans les comités dissous ou inconnus, dans la même lecture (comme mursOuvertsDe).
const sansComiteDissous = sql<string>`(select json_group_object(j.key, j.value) from json_each(case when json_valid("profil"."murs_ouverts") then "profil"."murs_ouverts" else '{}' end) j
	where j.key not like 'comite:%' or exists (select 1 from comite c where 'comite:' || c.id = j.key and c.dissous_le is null))`.as('murs_ouverts_en_cours');

export function lecturesAgents(base: Base, aujourdhui: string, avecOuverts = false) {
	const agent = or(isNull(profil.typePersonne), ne(profil.typePersonne, 'exterieur'));
	return [
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, statut: personne.statut, typePersonne: profil.typePersonne, mursOuverts: avecOuverts ? sansComiteDissous : profil.mursOuverts })
			.from(personne)
			.leftJoin(profil, eq(profil.id, personne.profilId))
			.where(and(inArray(personne.statut, STATUTS_AVEC_ACCES), avecOuverts ? or(agent, ne(profil.mursOuverts, '{}')) : agent)),
		base
			.select({ personneId: affectationEquipe.personneId, equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin })
			.from(affectationEquipe)
			.where(and(lte(affectationEquipe.debut, aujourdhui), or(isNull(affectationEquipe.fin), gte(affectationEquipe.fin, aujourdhui)))),
		requeteTenues(base, null, aujourdhui)
	] as const;
}

type Lu<T> = T extends PromiseLike<infer R> ? R : never;
export type AgentsLus = [Lu<ReturnType<typeof lecturesAgents>[0]>, Lu<ReturnType<typeof lecturesAgents>[1]>, Lu<ReturnType<typeof lecturesAgents>[2]>];
export type AgentDuJour = AgentsLus[0][number] & { a: Appartenances };

// Chaque agent avec ses appartenances du jour, à partir des résultats de lecturesAgents.
export function agentsDuJour([agents, affectations, tenues]: AgentsLus, aujourdhui: string): AgentDuJour[] {
	return agents.map((ag) => ({
		...ag,
		a: appartenances(
			affectations.filter((x) => x.personneId === ag.id),
			tenues.filter((t) => t.personneId === ag.id),
			aujourdhui,
			ag.typePersonne === 'exterieur' ? lireMursOuverts(ag.mursOuverts) : null
		)
	}));
}

export const membresDe = (agents: AgentDuJour[], cle: string) => agents.filter((x) => estMembre(x.a, cle));

// Nombre de membres naturels de chaque mur demandé. Une seule requête (un batch).
export async function audiences(base: Base, cles: CleMur[], aujourdhui: string): Promise<Map<CleMur, number>> {
	const [personnes, affectations, tenues] = await base.batch(lecturesAgents(base, aujourdhui, true));
	const agents = agentsDuJour([personnes, affectations, tenues], aujourdhui);
	return new Map(cles.map((cle) => [cle, membresDe(agents, cle).length]));
}

// La convocation d'un événement : tout le mur, des équipes, ou des équipes avec des agents ajoutés ou retirés (échanges de manœuvre).
export type Convocation = 'tous' | number[] | { equipes: number[]; ajoutes: number[]; retires: number[] };
export const equipesConvoquees = (c: Convocation): 'tous' | number[] => (c === 'tous' || Array.isArray(c) ? c : c.equipes);

// Convoqué : membre du mur et, si des équipes sont convoquées, membre en cours ou chef de l'une d'elles, sauf retiré ; ou ajouté.
// Une personne d'un profil extérieur : seulement si le mur lui est ouvert en écriture et que tout le mur est convoqué, et jamais à ce que
// publie le planning (les manœuvres) : elle est hors du planning. `auteur` : l'auteur de la publication.
export function estConvoque(a: Appartenances, cle: string, convoques: Convocation, personneId: number | null, auteur: string): boolean {
	if (!estMembre(a, cle)) return false;
	if (a.ouverts !== null) return a.ouverts.get(cle) === 'ecriture' && convoques === 'tous' && auteur !== 'planning';
	if (convoques === 'tous') return true;
	const exceptions = Array.isArray(convoques) ? null : convoques;
	if (exceptions && personneId !== null && exceptions.retires.includes(personneId)) return false;
	if (exceptions && personneId !== null && exceptions.ajoutes.includes(personneId)) return true;
	return (exceptions ? exceptions.equipes : (convoques as number[])).some((id) => a.membreEquipe.has(id) || a.chefEquipe.has(id));
}

// Droits déduits de l'appartenance du jour : rien n'est enregistré par mur. Une seule requête (un batch).
// Ordre : Le centre, Vie du centre, équipes (actives puis inactives), comités (en cours puis dissous).
export async function mursDe(base: Base, acteur: Acteur, aujourdhui: string): Promise<Mur[]> {
	return (await mursEtAppartenances(base, acteur, aujourdhui)).murs;
}

// Tous les comités, dissous compris : de quoi signer une publication faite au nom de l'un d'eux.
export type ComiteLu = { id: number; nom: string; dissousLe: string | null; icone: string | null; theme: string };

type MursLus = { murs: Mur[]; appartenances: Appartenances; comites: ComiteLu[] };
// Les murs déjà lus, par base : une base sert une seule requête HTTP (comme les droits, droits.ts). Toute écriture vide le cache (base.ts).
const mursLus = new WeakMap<Base, Map<string, Promise<MursLus>>>();

export function oublierMurs(base: Base): void {
	mursLus.delete(base);
}

// Lus une fois par requête : le layout, la page et ses gestes les demandent chacun.
export function mursEtAppartenances(base: Base, acteur: Acteur, aujourdhui: string): Promise<MursLus> {
	const parActeur = mursLus.get(base) ?? new Map<string, Promise<MursLus>>();
	mursLus.set(base, parActeur);
	const cle = `${acteur.type === 'super' ? 'super' : acteur.id}|${aujourdhui}`;
	const dejaLus = parActeur.get(cle);
	if (dejaLus) return dejaLus;
	const lus = lireMurs(base, acteur, aujourdhui);
	parActeur.set(cle, lus);
	// Un échec n'est pas gardé.
	lus.catch(() => {
		if (parActeur.get(cle) === lus) parActeur.delete(cle);
	});
	return lus;
}

async function lireMurs(base: Base, acteur: Acteur, aujourdhui: string): Promise<MursLus> {
	const lesEquipes = base.select({ id: equipe.id, nom: equipe.nom, active: equipe.active }).from(equipe).orderBy(asc(equipe.ordreRotation));
	const lesComites = base.select({ id: comite.id, nom: comite.nom, dissousLe: comite.dissousLe, icone: comite.icone, theme: comite.theme }).from(comite).orderBy(asc(comite.nom));

	// Chef de centre, adjoint et super administrateur : tous les murs.
	let a = SANS_FICHE;
	let equipes: { id: number; nom: string; active: number }[];
	let comites: ComiteLu[];

	if (acteur.type === 'super') {
		[equipes, comites] = await base.batch([lesEquipes, lesComites]);
	} else {
		// Pas de colonnes de même nom issues de tables jointes : dans un batch, D1 n'en garde qu'une.
		const [fiches, tenues, affectations, e, c] = await base.batch([
			base.select({ statut: personne.statut, typePersonne: profil.typePersonne, mursOuverts: profil.mursOuverts }).from(personne).leftJoin(profil, eq(profil.id, personne.profilId)).where(eq(personne.id, acteur.id)),
			requeteTenues(base, acteur.id, aujourdhui),
			base.select({ equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin }).from(affectationEquipe).where(eq(affectationEquipe.personneId, acteur.id)),
			lesEquipes,
			lesComites
		]);
		// Ni parti ni suspendu ; une personne d'un profil extérieur n'a que les murs que son profil lui ouvre.
		const fiche = fiches[0];
		if (!fiche || !(STATUTS_AVEC_ACCES as readonly string[]).includes(fiche.statut)) return { murs: [], appartenances: { ...SANS_FICHE, tous: false }, comites: c };
		if (fiche.typePersonne === 'exterieur') return { ...mursOuvertsDe(appartenances([], [], aujourdhui, lireMursOuverts(fiche.mursOuverts)), c), comites: c };
		[equipes, comites] = [e, c];
		a = appartenances(affectations, tenues, aujourdhui);
	}
	const { tous, membreEquipe, chefEquipe, membreComite, rapporteur } = a;

	const murEquipe = equipes
		.filter((e) => tous || membreEquipe.has(e.id) || chefEquipe.has(e.id))
		.map((e) => mur(`equipe:${e.id}`, e.nom, 'equipe', membreEquipe.has(e.id) || chefEquipe.has(e.id), tous || chefEquipe.has(e.id), e.active !== 1));
	// Un comité dissous reste une archive pour le chef, l'adjoint et le super seulement.
	const murComite = comites
		.filter((c) => tous || (membreComite.has(c.id) && c.dissousLe === null))
		.map((c) => mur(`comite:${c.id}`, c.nom, 'comite', membreComite.has(c.id), tous || rapporteur.has(c.id), c.dissousLe !== null));
	return { murs: [mur('centre', 'Le centre', 'centre', tous, tous), mur('vie', 'Vie du centre', 'vie', true, tous), ...ouvertsPuisFermes(murEquipe), ...ouvertsPuisFermes(murComite)], appartenances: a, comites };
}

// Les murs d'une personne d'un profil extérieur : Le centre et Vie du centre s'ils sont ouverts, puis les comités ouverts en cours.
// Écrire ne donne jamais plus qu'à un agent : pas de publication sur Le centre ; jamais de modération.
function mursOuvertsDe(a: Appartenances, comites: { id: number; nom: string; dissousLe: string | null }[]): { murs: Mur[]; appartenances: Appartenances } {
	const ouverts = a.ouverts!;
	const ecrit = (cle: string) => ouverts.get(cle) === 'ecriture';
	const murs: Mur[] = [];
	if (ouverts.has('centre')) murs.push(mur('centre', 'Le centre', 'centre', false, false, false, ecrit('centre')));
	if (ouverts.has('vie')) murs.push(mur('vie', 'Vie du centre', 'vie', ecrit('vie'), false, false, ecrit('vie')));
	for (const c of comites) if (c.dissousLe === null && ouverts.has(`comite:${c.id}`)) murs.push(mur(`comite:${c.id}`, c.nom, 'comite', ecrit(`comite:${c.id}`), false, false, ecrit(`comite:${c.id}`)));
	// Les entrées ignorées (comité dissous ou inconnu) ne comptent pas non plus comme appartenance.
	const gardes = new Map([...ouverts].filter(([cle]) => murs.some((m) => m.cle === cle)));
	return { murs, appartenances: { ...a, ouverts: gardes } };
}

const ouvertsPuisFermes = (murs: Mur[]) => [...murs.filter((m) => !m.lectureSeule), ...murs.filter((m) => m.lectureSeule)];

const BESOINS = { lire: 'LIRE_SALON', publier: 'PUBLIER_SALON', moderer: 'MODERER_SALON' } as const;

// Le mur, si l'acteur peut le lire, y publier ou le modérer ; RefusDroit sinon.
export async function exigerMur(base: Base, acteur: Acteur, cle: string, aujourdhui: string, besoin: 'lire' | 'publier' | 'moderer'): Promise<Mur> {
	return (await accesMur(base, acteur, cle, aujourdhui, besoin)).mur;
}

// Comme exigerMur, avec les appartenances de l'acteur (pour savoir s'il est convoqué) et les comités, sans requête de plus.
export async function accesMur(base: Base, acteur: Acteur, cle: string, aujourdhui: string, besoin: 'lire' | 'publier' | 'moderer'): Promise<{ mur: Mur; appartenances: Appartenances; comites: ComiteLu[] }> {
	const forme = /^(?:centre|vie|(equipe|comite):([1-9]\d*))$/.exec(cle);
	if (!forme) throw new DonneeInvalide('Mur inconnu');
	const { murs, appartenances, comites } = await mursEtAppartenances(base, acteur, aujourdhui);
	const trouve = murs.find((m) => m.cle === cle);
	const permis = trouve && (besoin === 'lire' || (besoin === 'publier' ? trouve.peutPublier : trouve.peutModerer));
	if (!permis) throw refusMur(cle, besoin);
	return { mur: trouve, appartenances, comites };
}

export function refusMur(cle: string, besoin: 'lire' | 'publier' | 'moderer', raison = 'Mur non accessible'): RefusDroit {
	const forme = /^(equipe|comite):(\d+)$/.exec(cle);
	const perimetre: Perimetre = forme ? { type: forme[1] as 'equipe' | 'comite', id: Number(forme[2]) } : { type: 'centre' };
	return new RefusDroit(BESOINS[besoin], perimetre, raison);
}

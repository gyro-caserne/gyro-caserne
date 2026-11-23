import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import { instruction, type Base } from './base.ts';
import { enCours, exigerDate, exigerDateHeure } from './dates.ts';
import { aLeDroit, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { peutDemander } from './habillement.ts';
import { ligneJournalSi } from './journal.ts';
import { STATUTS_AVEC_ACCES, type FilDemande, type QuestionDemande, type ReglageDemandes } from './listes.ts';
import { mettreEnFile } from './notifications.ts';
import { attribution, avisDemandeReferent, demandeReferent, filDemandeReferent, personne, responsabilite, responsabiliteDroit } from './schema.ts';

// Demandes aux référents : un rôle de centre qui « reçoit des demandes » (pharmacie, matériel…) les suit comme l'habillement,
// avec des étapes intermédiaires réglées sur le rôle. L'habillement garde son propre circuit (décision 0043).

export const ETAPES_MAX = 6;
export const NOM_ETAPE_MAX = 30;
export const DERNIERE_PAR_DEFAUT = 'Faite';
// Les étapes fixes, qui ne se renomment pas : un nom d'étape réglée ne les reprend pas.
const NOMS_FIXES = ['Demandée', 'Prise en compte', 'Refusée', 'Annulée'];

const nomPropre = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const nouvelId = () => `e${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

// Un rôle peut recevoir des demandes : de portée centre, ni système, ni archivé, ni chargé de l'habillement (avant C2).
export function recoitPossible(r: { typePerimetre: string; systeme: string | null; archiveeLe: string | null }, droits: string[]): boolean {
	return r.typePerimetre === 'centre' && r.systeme === null && r.archiveeLe === null && !droits.includes('GERER_HABILLEMENT');
}

// Qui règle : qui gère les rôles, le chef de centre et l'adjoint (tout), ou un titulaire en cours d'un rôle qui reçoit déjà
// des demandes (ses étapes seulement).
export async function peutReglerDemandes(base: Base, acteur: Acteur, roleId: number, recoit: boolean, aujourdhui: string): Promise<'tout' | 'etapes' | null> {
	if (acteur.type === 'super' || (await aLeDroit(base, acteur, 'GERER_LISTES', { type: 'centre' }, aujourdhui))) return 'tout';
	const g = gestionnairesDe(await lectureGestionnaires(base, roleId), aujourdhui);
	if (g.chefs.includes(acteur.id)) return 'tout';
	return recoit && g.titulaires.includes(acteur.id) ? 'etapes' : null;
}

// Le nouveau réglage, vérifié : chaque étape gardée par son identifiant, les nouvelles en reçoivent un.
function reglageVerifie(actuel: ReglageDemandes | null, demande: { etapes: { id?: string; nom: string }[]; derniere: string }): ReglageDemandes {
	if (!Array.isArray(demande.etapes)) throw new DonneeInvalide('Étapes inconnues');
	if (demande.etapes.length > ETAPES_MAX) throw new DonneeInvalide('Trop d’étapes');
	const connus = new Set(actuel?.etapes.map((e) => e.id) ?? []);
	const etapes = demande.etapes.map((e) => {
		if (e.id !== undefined && !connus.has(e.id)) throw new DonneeInvalide('Étape inconnue');
		return { id: e.id ?? nouvelId(), nom: nomPropre(e.nom) };
	});
	const derniere = nomPropre(demande.derniere);
	const noms = [...etapes.map((e) => e.nom), derniere];
	if (noms.some((n) => !n)) throw new DonneeInvalide('Nom d’étape vide');
	if (noms.some((n) => n.length > NOM_ETAPE_MAX)) throw new DonneeInvalide('Nom d’étape trop long');
	const enMinuscules = [...noms, ...NOMS_FIXES].map((n) => n.toLocaleLowerCase('fr'));
	if (new Set(enMinuscules).size !== enMinuscules.length) throw new DonneeInvalide('Nom d’étape en double');
	if (new Set(etapes.map((e) => e.id)).size !== etapes.length) throw new DonneeInvalide('Étape inconnue');
	return { etapes, derniere };
}

// Régler les demandes d'un rôle : `null` le décoche. Retirer une étape, ou décocher, est refusé tant qu'une demande en cours s'y trouve.
// Au journal. Une lecture, puis l'écriture (plus les droits).
export async function reglerDemandes(base: Base, acteur: Acteur, roleId: number, reglage: { etapes: { id?: string; nom: string }[]; derniere: string } | null, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const [[role], droits, occupees] = await base.batch([
		base.select().from(responsabilite).where(eq(responsabilite.id, roleId)),
		base.select({ droit: responsabiliteDroit.droit }).from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, roleId)),
		base.selectDistinct({ etape: demandeReferent.etape }).from(demandeReferent).where(and(eq(demandeReferent.responsabiliteId, roleId), isNull(demandeReferent.finLe)))
	]);
	if (!role) throw new DonneeInvalide('Responsabilité inconnue');
	if (!recoitPossible(role, droits.map((d) => d.droit))) throw new DonneeInvalide('Ce rôle ne reçoit pas de demandes');
	const actuel = role.demandes;
	const qui = await peutReglerDemandes(base, acteur, roleId, actuel !== null, aujourdhui);
	if (qui === null || (qui === 'etapes' && (reglage === null || actuel === null))) throw new RefusDroit('GERER_LISTES', { type: 'centre' }, 'Réservé à qui gère les rôles et aux titulaires du rôle');

	let nouveau: ReglageDemandes | null = null;
	let retirees: string[] = [];
	if (reglage === null) {
		if (occupees.length > 0) throw new DonneeInvalide('Demandes en cours');
	} else {
		// Recoché : les étapes gardées au décochage gardent leurs identifiants.
		nouveau = reglageVerifie(actuel ?? role.demandesGardees, reglage);
		const gardees = new Set(nouveau.etapes.map((e) => e.id));
		retirees = (actuel?.etapes ?? []).map((e) => e.id).filter((id) => !gardees.has(id));
		if (occupees.some((o) => retirees.includes(o.etape))) throw new DonneeInvalide('Étape occupée');
	}
	// Gardé : rien n'est écrit si le réglage a changé entre-temps, ou si une demande en cours est arrivée à une étape retirée
	// (à n'importe quelle étape, pour un décochage).
	const enCoursLa = and(eq(demandeReferent.responsabiliteId, roleId), isNull(demandeReferent.finLe), nouveau === null ? undefined : inArray(demandeReferent.etape, retirees.length ? retirees : ['']));
	const garde = and(
		eq(responsabilite.id, roleId),
		actuel === null ? isNull(responsabilite.demandes) : sql`${responsabilite.demandes} IS ${JSON.stringify(actuel)}`,
		sql`NOT EXISTS (SELECT 1 FROM ${demandeReferent} WHERE ${enCoursLa})`
	);
	const jeton = sql`(SELECT ${responsabilite.demandes} FROM ${responsabilite} WHERE ${responsabilite.id} = ${roleId}) IS ${nouveau === null ? null : JSON.stringify(nouveau)}`;
	// Une étape renommée : le fil des demandes du rôle suit son nouveau nom.
	const renommees = (nouveau?.etapes ?? []).filter((e) => actuel?.etapes.some((x) => x.id === e.id && x.nom !== e.nom));
	if (nouveau && actuel && nouveau.derniere !== actuel.derniere) renommees.push({ id: 'faite', nom: nouveau.derniere });
	const ecrit = await base.batch([
		base
			.update(responsabilite)
			.set(nouveau === null ? { demandes: null, demandesGardees: actuel } : { demandes: nouveau, demandesGardees: null })
			.where(garde)
			.returning({ id: responsabilite.id }),
		...renommees.map((e) =>
			base
				.update(filDemandeReferent)
				.set({ nomEtape: e.nom })
				.where(and(eq(filDemandeReferent.etape, e.id), inArray(filDemandeReferent.demandeId, base.select({ id: demandeReferent.id }).from(demandeReferent).where(eq(demandeReferent.responsabiliteId, roleId))), jeton))
		),
		ligneJournalSi(base, { acteur: acteur.type === 'super' ? `super:${acteur.email}` : `personne:${acteur.id}`, action: 'regler_demandes', cibleType: 'responsabilite', cibleId: roleId, details: nouveau ? { recoit: true, etapes: nouveau.etapes.map((e) => e.nom), derniere: nouveau.derniere } : { recoit: false } }, maintenant, jeton)
	]);
	if ((ecrit[0] as unknown[]).length === 0) throw new DonneeInvalide('Demande changée entre-temps');
}

// Des demandes en cours pour ce rôle (archiver est alors refusé). Une requête.
export async function aDesDemandesEnCours(base: Base, roleId: number): Promise<boolean> {
	const [l] = await base.select({ id: demandeReferent.id }).from(demandeReferent).where(and(eq(demandeReferent.responsabiliteId, roleId), isNull(demandeReferent.finLe))).limit(1);
	return l !== undefined;
}

// Le cycle d'une demande ---------------------------------------------------------------------------------------------------------

export const LIMITE_DEMANDE = 500;
export const FINIES_DEMANDE = ['faite', 'refusee', 'annulee'];
const TERMINEES_MAX = 50;
const CHEFS = ['chef_centre', 'chef_centre_adjoint'] as const;
const NOMS_ETAPES_FIXES: Record<string, string> = { demandee: 'Demandée', prise: 'Prise en compte', refusee: 'Refusée', annulee: 'Annulée' };

const propre = (texte: unknown) => (typeof texte === 'string' ? texte.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : '');
const nomDe = (p: { prenom: string; nom: string } | undefined | null) => (p ? `${p.prenom} ${p.nom}` : 'Un ancien agent');
// « de Paul Martin », « d’Alice Martin ».
const de = (nom: string) => (/^[aeiouyhàâéèêëîïôöûü]/i.test(nom) ? `d’${nom}` : `de ${nom}`);
const parmi = (ids: number[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;
export const lienDemande = (id: number) => `/demandes/${id}`;
// Le début de la demande, sur une ligne.
export function extraitDemandeReferent(texte: string, max = 80): string {
	const ligne = texte.replace(/\s+/g, ' ').trim();
	return ligne.length > max ? `${ligne.slice(0, max - 1).trimEnd()}…` : ligne;
}

// Le nom d'une étape : fixe, intermédiaire (son nom du moment), ou la dernière (son nom réglé).
export function nomEtape(etape: string, reglage: ReglageDemandes | null): string {
	if (etape === 'faite') return reglage?.derniere ?? DERNIERE_PAR_DEFAUT;
	return NOMS_ETAPES_FIXES[etape] ?? reglage?.etapes.find((e) => e.id === etape)?.nom ?? 'Étape retirée';
}
// Le réglage lu en SQL brut (colonne JSON).
const lireReglage = (brut: string | null): ReglageDemandes | null => (brut ? (JSON.parse(brut) as ReglageDemandes) : null);

// Les titulaires en cours du rôle et les chefs (chef de centre, adjoint), qui ont accès. `role` : un identifiant, ou une sous-requête.
// À placer dans un batch.
export function lectureGestionnaires(base: Base, role: number | SQL) {
	return base
		.select({ id: attribution.personneId, roleId: attribution.responsabiliteId, type: attribution.perimetreType, systeme: responsabilite.systeme, debut: attribution.debut, fin: attribution.fin })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.innerJoin(personne, eq(personne.id, attribution.personneId))
		.where(and(inArray(personne.statut, [...STATUTS_AVEC_ACCES]), isNull(responsabilite.archiveeLe), eq(attribution.perimetreType, 'centre'), or(eq(attribution.responsabiliteId, role as number), inArray(responsabilite.systeme, [...CHEFS]))));
}
type LigneGestionnaire = { id: number; roleId: number; type: string; systeme: string | null; debut: string; fin: string | null };
export function gestionnairesDe(lignes: LigneGestionnaire[], aujourdhui: string) {
	const valides = lignes.filter((l) => l.type === 'centre' && enCours(l.debut, l.fin, aujourdhui));
	return { titulaires: [...new Set(valides.filter((l) => l.systeme === null).map((l) => l.id))], chefs: [...new Set(valides.filter((l) => l.systeme !== null).map((l) => l.id))] };
}

// Qui reçoit une nouvelle demande : les titulaires, sinon le chef et l'adjoint ; jamais son auteur.
function destinataires(g: { titulaires: number[]; chefs: number[] }, auteur: number): number[] {
	const titulaires = g.titulaires.filter((id) => id !== auteur);
	return titulaires.length ? titulaires : g.chefs.filter((id) => id !== auteur);
}

// Écritures à placer dans un batch : la ligne de la cloche et l'envoi au téléphone (lieu « demandes » : seul « tout » le coupe).
function avis(base: Base, ids: number[], a: { titre: string; texte: string; url: string }, maintenant: string, si?: SQL) {
	if (ids.length === 0) return [];
	return [
		base.insert(avisDemandeReferent).select(
			base
				.select({
					id: sql<number | null>`null`.as('id'),
					personneId: personne.id,
					titre: sql<string>`${a.titre}`.as('titre'),
					texte: sql<string>`${a.texte}`.as('texte'),
					url: sql<string>`${a.url}`.as('url'),
					creeLe: sql<string>`${maintenant}`.as('cree_le'),
					lueLe: sql<string | null>`null`.as('lue_le')
				})
				.from(personne)
				.where(and(inArray(personne.id, parmi(ids)), si))
		),
		mettreEnFile(base, ids, 'demandes', { ...a, tag: `demande:${a.url}` }, maintenant, si, 'demande')
	] as const;
}

// Les rôles qui reçoivent des demandes, par nom. Une requête.
export async function rolesQuiRecoivent(base: Base) {
	return base
		.select({ id: responsabilite.id, nom: responsabilite.nom, icone: responsabilite.icone, modele: responsabilite.modele, typePerimetre: responsabilite.typePerimetre, systeme: responsabilite.systeme })
		.from(responsabilite)
		.where(and(isNotNull(responsabilite.demandes), isNull(responsabilite.archiveeLe)))
		.orderBy(asc(responsabilite.nom));
}

// Une demande : un seul texte libre, à un rôle qui en reçoit. Ses titulaires sont prévenus (sinon le chef et l'adjoint).
// Deux requêtes, plus les droits.
export async function demanderAuReferent(base: Base, acteur: Acteur, roleId: number, texte: string, maintenant: string): Promise<number> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (!(await peutDemander(base, acteur)) || acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux agents du centre');
	const t = propre(texte);
	if (!t) throw new DonneeInvalide('Demande vide');
	if (t.length > LIMITE_DEMANDE) throw new DonneeInvalide('Demande trop longue');
	const recoit = and(eq(responsabilite.id, Number.isInteger(roleId) ? roleId : 0), isNotNull(responsabilite.demandes), isNull(responsabilite.archiveeLe));
	const [cree, [role], [auteur], lignes] = await base.batch([
		base
			.insert(demandeReferent)
			.select(
				base
					.select({
						id: sql<number | null>`null`.as('id'),
						responsabiliteId: responsabilite.id,
						demandeurId: sql<number>`${acteur.id}`.as('demandeur_id'),
						texte: sql<string>`${t}`.as('texte'),
						etape: sql<string>`'demandee'`.as('etape'),
						question: sql<null>`null`.as('question'),
						prisePar: sql<null>`null`.as('prise_par'),
						mot: sql<null>`null`.as('mot'),
						creeLe: sql<string>`${maintenant}`.as('cree_le'),
						majLe: sql<string>`${maintenant}`.as('maj_le'),
						finLe: sql<null>`null`.as('fin_le')
					})
					.from(responsabilite)
					.where(recoit)
			)
			.returning({ id: demandeReferent.id }),
		base.select({ nom: responsabilite.nom }).from(responsabilite).where(recoit),
		base.select({ prenom: personne.prenom, nom: personne.nom }).from(personne).where(eq(personne.id, acteur.id)),
		lectureGestionnaires(base, roleId)
	]);
	const id = cree[0]?.id;
	if (id === undefined || !role) throw new DonneeInvalide('Ce rôle ne reçoit pas de demandes');
	const ids = destinataires(gestionnairesDe(lignes, aujourdhui), acteur.id);
	const ecritures = avis(base, ids, { titre: `Nouvelle demande ${de(nomDe(auteur))}`, texte: `${extraitDemandeReferent(t)} (${role.nom})`, url: lienDemande(id) }, maintenant);
	// La cloche après coup : un échec n'annule pas la demande.
	if (ecritures.length) await base.batch([ecritures[0]!, ecritures[1]!]).catch(() => {});
	return id;
}

export type GesteDemande =
	| { quoi: 'prendre' }
	| { quoi: 'reprendre' }
	| { quoi: 'question'; texte: string }
	| { quoi: 'repondre'; texte: string }
	| { quoi: 'avancer'; vers: string; texte: string }
	| { quoi: 'refuser'; texte: string }
	| { quoi: 'annuler' };
export type QuoiGesteDemande = GesteDemande['quoi'];
export type EtatDemandeReferent = { etape: string; question: QuestionDemande | null; demandeur: number; prisePar: number | null };

// Le rang d'une étape dans l'ordre du moment : Demandée, Prise en compte, les intermédiaires, la dernière.
function rang(etape: string, ordre: string[]): number {
	if (etape === 'demandee') return 0;
	if (etape === 'faite') return ordre.length + 2;
	const i = ordre.indexOf(etape);
	return i < 0 ? 1 : i + 2;
}

// Les gestes permis, et les étapes où la demande peut aller (jamais en arrière, selon l'ordre du moment ; sauter est permis).
// L'agent : répondre ou préciser tant qu'elle n'est pas finie, l'annuler tant qu'elle n'a pas dépassé « Prise en compte ».
// Qui gère : la prendre en compte (ou, d'emblée, questionner, avancer, refuser), la reprendre à un collègue ; celui qui la suit :
// poser une question (une à la fois), l'avancer, la refuser.
export function gestesDemande(d: EtatDemandeReferent, ordre: string[], qui: { moi: number | null; gere: boolean }): { gestes: QuoiGesteDemande[]; vers: string[] } {
	if (qui.moi === null || FINIES_DEMANDE.includes(d.etape)) return { gestes: [], vers: [] };
	const gestes: QuoiGesteDemande[] = [];
	let avance = false;
	if (qui.gere) {
		if (d.etape === 'demandee') gestes.push('prendre', 'question', 'avancer', 'refuser');
		else if (d.prisePar !== qui.moi) gestes.push('reprendre');
		else gestes.push(...(d.question === 'posee' ? [] : (['question'] as const)), 'avancer', 'refuser');
		avance = gestes.includes('avancer');
	}
	if (d.demandeur === qui.moi) {
		gestes.push('repondre');
		if (d.etape === 'demandee' || d.etape === 'prise') gestes.push('annuler');
	}
	const vers = avance ? [...ordre.filter((e) => rang(e, ordre) > rang(d.etape, ordre)), 'faite'] : [];
	return { gestes, vers };
}

// Un geste, d'un bloc : la ligne du fil, la demande, la cloche (jamais l'auteur du geste) et le journal. Gardé par l'état relu :
// si un collègue a agi entre-temps, rien n'est écrit et le geste est refusé. Deux requêtes.
export async function gesteDemande(base: Base, acteur: Acteur, id: number, geste: GesteDemande, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	if (acteur.type !== 'personne') throw new DonneeInvalide('Réservé aux agents');
	const moi = acteur.id;
	const [[d], [compte], [moiMeme], lignes] = await base.batch([
		base
			.select({ demande: demandeReferent, prenom: personne.prenom, nom: personne.nom, statut: personne.statut, role: sql<string>`${responsabilite.nom}`.as('role_nom'), reglage: sql<string | null>`${responsabilite.demandes}`.as('reglage') })
			.from(demandeReferent)
			.innerJoin(personne, eq(personne.id, demandeReferent.demandeurId))
			.innerJoin(responsabilite, eq(responsabilite.id, demandeReferent.responsabiliteId))
			.where(eq(demandeReferent.id, id)),
		base.select({ n: sql<number>`count(*)` }).from(filDemandeReferent).where(eq(filDemandeReferent.demandeId, id)),
		base.select({ prenom: personne.prenom, nom: personne.nom }).from(personne).where(eq(personne.id, moi)),
		lectureGestionnaires(base, sql`(SELECT ${demandeReferent.responsabiliteId} FROM ${demandeReferent} WHERE ${demandeReferent.id} = ${id})`)
	]);
	const g = gestionnairesDe(lignes, aujourdhui);
	// Un titulaire ne traite pas sa propre demande : les autres titulaires, ou le chef et l'adjoint, s'en chargent.
	const gere = g.chefs.includes(moi) || (g.titulaires.includes(moi) && d?.demande.demandeurId !== moi);
	if (!d || (d.demande.demandeurId !== moi && !gere)) throw new DonneeInvalide('Demande inconnue');
	const a = d.demande;
	const reglage = lireReglage(d.reglage);
	const ordre = reglage?.etapes.map((e) => e.id) ?? [];
	const permis = gestesDemande({ etape: a.etape, question: a.question, demandeur: a.demandeurId, prisePar: a.prisePar }, ordre, { moi, gere });
	if (!permis.gestes.includes(geste.quoi)) throw new DonneeInvalide('Geste impossible');
	if (geste.quoi === 'avancer' && !permis.vers.includes(geste.vers)) throw new DonneeInvalide('Étape impossible');
	const texte = 'texte' in geste ? propre(geste.texte) : '';
	if (texte.length > LIMITE_DEMANDE) throw new DonneeInvalide('Texte trop long');
	if ((geste.quoi === 'question' || geste.quoi === 'repondre') && !texte) throw new DonneeInvalide('Message vide');
	if (geste.quoi === 'refuser' && !texte) throw new DonneeInvalide('Refus sans explication');

	const preneur = a.prisePar ?? moi;
	const fin = { finLe: maintenant, question: null };
	const vers = geste.quoi === 'avancer' ? geste.vers : null;
	const [quoi, changement]: [FilDemande, Partial<typeof demandeReferent.$inferInsert>] =
		geste.quoi === 'prendre' ? ['prise', { etape: 'prise', prisePar: moi }]
		: geste.quoi === 'reprendre' ? ['reprise', { prisePar: moi }]
		: geste.quoi === 'question' ? ['question', { etape: a.etape === 'demandee' ? 'prise' : a.etape, question: 'posee', prisePar: preneur }]
		: geste.quoi === 'repondre' ? (a.question === 'posee' ? ['reponse', { question: 'repondue' }] : ['precision', {}])
		: geste.quoi === 'avancer' ? (vers === 'faite' ? ['fin', { etape: 'faite', mot: texte || null, prisePar: preneur, ...fin }] : ['etape', { etape: vers!, prisePar: preneur, question: a.question === 'posee' ? 'posee' : null }])
		: geste.quoi === 'refuser' ? ['refus', { etape: 'refusee', mot: texte, prisePar: preneur, ...fin }]
		: ['annulation', { etape: 'annulee', ...fin }];
	const etapeAtteinte = quoi === 'etape' || quoi === 'fin' ? vers! : null;
	const nomAtteinte = etapeAtteinte ? nomEtape(etapeAtteinte, reglage) : null;

	// Avant : l'état relu, inchangé ; après : la dernière ligne du fil porte notre jeton, propre à cet envoi.
	const jeton = crypto.randomUUID();
	const avant = sql`${demandeReferent.id} = ${id} AND ${demandeReferent.etape} = ${a.etape} AND coalesce(${demandeReferent.question}, '') = ${a.question ?? ''} AND coalesce(${demandeReferent.prisePar}, 0) = ${a.prisePar ?? 0}
		AND (SELECT count(*) FROM ${filDemandeReferent} WHERE ${filDemandeReferent.demandeId} = ${id}) = ${compte?.n ?? 0}`;
	const fait = sql`(SELECT ${filDemandeReferent.jeton} FROM ${filDemandeReferent} WHERE ${filDemandeReferent.demandeId} = ${id} ORDER BY ${filDemandeReferent.id} DESC LIMIT 1) = ${jeton}`;

	const ex = extraitDemandeReferent(a.texte);
	const nom = nomDe(moiMeme);
	const AVIS: Record<FilDemande, { titre: string; texte: string }> = {
		prise: { titre: `Demande prise en compte par ${nom}`, texte: ex },
		reprise: { titre: `Demande reprise par ${nom}`, texte: ex },
		question: { titre: `Question ${de(nom)}`, texte },
		reponse: { titre: `Réponse ${de(nom)}`, texte },
		precision: { titre: `Précision ${de(nom)}`, texte },
		etape: { titre: `Demande passée à l’étape ${nomAtteinte}`, texte: texte ? `${ex} (${texte})` : ex },
		fin: { titre: `Demande ${(nomAtteinte ?? '').toLocaleLowerCase('fr')}`, texte: texte ? `${ex} (${texte})` : ex },
		refus: { titre: `Demande refusée par ${nom}`, texte },
		annulation: { titre: `Demande annulée par ${nom}`, texte: ex }
	};
	// Les décisions de qui gère vont au journal, donc au suivi du centre.
	const JOURNAL: Record<FilDemande, string | null> = { prise: 'prendre_demande', reprise: 'reprendre_demande', question: 'questionner_demande', reponse: null, precision: null, etape: 'avancer_demande', fin: 'finir_demande', refus: 'refuser_demande', annulation: 'annuler_demande' };
	// L'agent apprend chaque étape et chaque question ; l'ancien suiveur, la reprise. Les réponses, précisions et annulations de l'agent
	// vont à qui la suit ; tant que personne ne la suit, ses précisions vont aux titulaires (jamais au chef).
	const deLAgent = quoi === 'reponse' || quoi === 'precision' || quoi === 'annulation';
	const pourQui = quoi === 'reprise' ? (a.prisePar !== null ? [a.prisePar] : []) : !deLAgent ? [a.demandeurId] : a.prisePar !== null ? [a.prisePar] : quoi === 'annulation' ? [] : destinataires(g, a.demandeurId);
	// Un agent parti (ou effacé) n'est plus prévenu.
	const prevenus = [...new Set(pourQui)].filter((x) => x !== moi && !(x === a.demandeurId && d.statut === 'parti'));

	const resultats = await base.batch([
		instruction(base, sql`INSERT INTO ${filDemandeReferent} (demande_id, quoi, etape, nom_etape, texte, par, le, jeton) SELECT ${id}, ${quoi}, ${etapeAtteinte}, ${nomAtteinte}, ${texte || null}, ${moi}, ${maintenant}, ${jeton} FROM ${demandeReferent} WHERE ${avant}`),
		base
			.update(demandeReferent)
			.set({ ...changement, majLe: maintenant })
			.where(and(eq(demandeReferent.id, id), fait)),
		...avis(base, prevenus, { ...AVIS[quoi], url: lienDemande(id) }, maintenant, fait),
		...(JOURNAL[quoi] ? [ligneJournalSi(base, { acteur: `personne:${moi}`, action: JOURNAL[quoi]!, cibleType: 'demande_referent', cibleId: id }, maintenant, fait)] : []),
		base.select({ ok: sql<number>`${fait}` }).from(demandeReferent).where(eq(demandeReferent.id, id))
	]);
	const [verif] = resultats.at(-1) as { ok: number }[];
	if (!verif?.ok) throw new DonneeInvalide('Demande changée entre-temps');
}

export type DemandeReferentListee = { id: number; texte: string; roleId: number; role: string; etape: string; nomEtape: string; question: QuestionDemande | null; demandeur: string; prisePar: string | null; creeLe: string; majLe: string; finLe: string | null };
export type LigneFilDemandeReferent = { quoi: FilDemande; etape: string | null; texte: string | null; par: string; le: string; deLAgent: boolean };
export type VueDemandeReferent = DemandeReferentListee & {
	icone: string | null;
	mot: string | null;
	sienne: boolean;
	fil: LigneFilDemandeReferent[];
	gestes: QuoiGesteDemande[];
	vers: { id: string; nom: string }[];
	// Les étapes du suivi, dans l'ordre du moment : Demandée, Prise en compte, les intermédiaires, la dernière.
	etapes: { id: string; nom: string }[];
	// Le rang de la dernière étape franchie d'après le fil.
	franchie: number;
};

const colonnes = {
	id: demandeReferent.id,
	texte: demandeReferent.texte,
	roleId: demandeReferent.responsabiliteId,
	etape: demandeReferent.etape,
	question: demandeReferent.question,
	creeLe: demandeReferent.creeLe,
	majLe: demandeReferent.majLe,
	finLe: demandeReferent.finLe,
	demandeurPrenom: personne.prenom,
	demandeurNom: personne.nom,
	role: sql<string>`${responsabilite.nom}`.as('role_nom'),
	reglage: sql<string | null>`${responsabilite.demandes}`.as('reglage'),
	prisePar: sql<string | null>`(SELECT p.prenom || ' ' || p.nom FROM ${personne} p WHERE p.id = ${demandeReferent.prisePar})`.as('prise_par_nom')
};
type LigneListe = { id: number; texte: string; roleId: number; role: string; etape: string; question: QuestionDemande | null; creeLe: string; majLe: string; finLe: string | null; demandeurPrenom: string; demandeurNom: string; reglage: string | null; prisePar: string | null };
const vue = ({ demandeurPrenom, demandeurNom, reglage, ...l }: LigneListe): DemandeReferentListee => ({ ...l, nomEtape: nomEtape(l.etape, lireReglage(reglage)), demandeur: `${demandeurPrenom} ${demandeurNom}` });
const lecture = (base: Base) => base.select(colonnes).from(demandeReferent).innerJoin(personne, eq(personne.id, demandeReferent.demandeurId)).innerJoin(responsabilite, eq(responsabilite.id, demandeReferent.responsabiliteId));
const enCoursSql = isNull(demandeReferent.finLe);
// En cours : les nouvelles d'abord, puis les réponses arrivées, puis les plus récemment changées.
const urgence = (d: DemandeReferentListee) => (d.etape === 'demandee' ? 2 : d.question === 'repondue' ? 1 : 0);
const parUrgence = (a: DemandeReferentListee, b: DemandeReferentListee) => urgence(b) - urgence(a) || b.majLe.localeCompare(a.majLe) || b.id - a.id;

// Mes demandes : en cours, puis les dernières terminées. À placer dans un batch.
function lecturesMiennes(base: Base, moi: number) {
	return [
		lecture(base).where(and(eq(demandeReferent.demandeurId, moi), enCoursSql)).orderBy(desc(demandeReferent.majLe), desc(demandeReferent.id)),
		lecture(base).where(and(eq(demandeReferent.demandeurId, moi), isNotNull(demandeReferent.finLe))).orderBy(desc(demandeReferent.finLe), desc(demandeReferent.id)).limit(TERMINEES_MAX)
	] as const;
}

export async function mesDemandesReferents(base: Base, acteur: Acteur): Promise<{ enCours: DemandeReferentListee[]; terminees: DemandeReferentListee[] }> {
	if (acteur.type !== 'personne') return { enCours: [], terminees: [] };
	const [enCours, terminees] = await base.batch(lecturesMiennes(base, acteur.id));
	return { enCours: enCours.map(vue), terminees: terminees.map(vue) };
}

export type RoleRecu = { id: number; nom: string; icone: string | null; modele: string | null; enCours: number };
// La page « Faire une demande » : les rôles à qui demander, ceux dont on traite les demandes (titulaire, ou chef et adjoint : tous),
// avec leur nombre en cours, et mes demandes. Une requête.
export async function pageDesDemandes(base: Base, acteur: Acteur, aujourdhui: string) {
	exigerDate(aujourdhui);
	const moi = acteur.type === 'personne' ? acteur.id : 0;
	const [roles, comptes, tenues, miennes, finies] = await base.batch([
		base.select({ id: responsabilite.id, nom: responsabilite.nom, icone: responsabilite.icone, modele: responsabilite.modele }).from(responsabilite).where(and(isNotNull(responsabilite.demandes), isNull(responsabilite.archiveeLe))).orderBy(asc(responsabilite.nom)),
		base.select({ roleId: demandeReferent.responsabiliteId, n: sql<number>`count(*)` }).from(demandeReferent).where(enCoursSql).groupBy(demandeReferent.responsabiliteId),
		base
			.select({ roleId: attribution.responsabiliteId, type: attribution.perimetreType, systeme: responsabilite.systeme, debut: attribution.debut, fin: attribution.fin })
			.from(attribution)
			.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
			.where(and(eq(attribution.personneId, moi), eq(attribution.perimetreType, 'centre'))),
		...lecturesMiennes(base, moi)
	]);
	const valides = tenues.filter((t) => enCours(t.debut, t.fin, aujourdhui));
	const chef = acteur.type === 'super' || valides.some((t) => (CHEFS as readonly (string | null)[]).includes(t.systeme));
	const recus: RoleRecu[] = roles.filter((r) => chef || valides.some((t) => t.roleId === r.id)).map((r) => ({ ...r, enCours: comptes.find((c) => c.roleId === r.id)?.n ?? 0 }));
	return { roles, recus, enCours: miennes.map(vue), terminees: finies.map(vue) };
}

// Les demandes d'un rôle, pour ses titulaires, le chef et l'adjoint (et le super administrateur, en lecture) : en cours (les nouvelles
// d'abord), puis les dernières terminées. Une requête.
export async function demandesDuRole(base: Base, acteur: Acteur, roleId: number, aujourdhui: string) {
	exigerDate(aujourdhui);
	const duRole = eq(demandeReferent.responsabiliteId, roleId);
	const [[role], lignes, enCoursL, terminees] = await base.batch([
		base.select({ id: responsabilite.id, nom: responsabilite.nom, icone: responsabilite.icone, modele: responsabilite.modele, typePerimetre: responsabilite.typePerimetre, systeme: responsabilite.systeme, demandes: responsabilite.demandes, archiveeLe: responsabilite.archiveeLe }).from(responsabilite).where(eq(responsabilite.id, roleId)),
		lectureGestionnaires(base, roleId),
		lecture(base).where(and(duRole, enCoursSql)),
		lecture(base).where(and(duRole, isNotNull(demandeReferent.finLe))).orderBy(desc(demandeReferent.finLe), desc(demandeReferent.id)).limit(TERMINEES_MAX)
	]);
	const g = gestionnairesDe(lignes, aujourdhui);
	const gere = acteur.type === 'super' || g.titulaires.includes(acteur.id) || g.chefs.includes(acteur.id);
	if (!role || !gere || (role.demandes === null && enCoursL.length === 0 && terminees.length === 0)) throw new RefusDroit('GERER_LISTES', { type: 'centre' }, 'Réservé aux titulaires du rôle, au chef de centre et à son adjoint');
	return { role, titulaire: acteur.type === 'personne' && g.titulaires.includes(acteur.id), sansTitulaire: g.titulaires.length === 0, enCours: enCoursL.map(vue).sort(parUrgence), terminees: terminees.map(vue) };
}

// Une demande, son fil et les gestes permis : pour son auteur, les titulaires du rôle, le chef et l'adjoint ; inconnue pour les autres.
// L'ouvrir marque lus ses avis (seulement les siens : rien n'est écrit pour un curieux). Une requête.
export async function lireDemandeReferent(base: Base, acteur: Acteur, id: number, maintenant: string): Promise<VueDemandeReferent> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const moi = acteur.type === 'personne' ? acteur.id : null;
	const [[l], fil, lignes] = await base.batch([
		base
			.select({ ...colonnes, demandeurId: demandeReferent.demandeurId, priseParId: demandeReferent.prisePar, mot: demandeReferent.mot, icone: responsabilite.icone })
			.from(demandeReferent)
			.innerJoin(personne, eq(personne.id, demandeReferent.demandeurId))
			.innerJoin(responsabilite, eq(responsabilite.id, demandeReferent.responsabiliteId))
			.where(eq(demandeReferent.id, id)),
		base
			.select({ quoi: filDemandeReferent.quoi, etape: filDemandeReferent.etape, nomEtape: filDemandeReferent.nomEtape, texte: filDemandeReferent.texte, le: filDemandeReferent.le, par: filDemandeReferent.par, prenom: personne.prenom, nom: personne.nom })
			.from(filDemandeReferent)
			.innerJoin(personne, eq(personne.id, filDemandeReferent.par))
			.where(eq(filDemandeReferent.demandeId, id))
			.orderBy(asc(filDemandeReferent.id)),
		lectureGestionnaires(base, sql`(SELECT ${demandeReferent.responsabiliteId} FROM ${demandeReferent} WHERE ${demandeReferent.id} = ${id})`),
		base
			.update(avisDemandeReferent)
			.set({ lueLe: maintenant })
			.where(and(eq(avisDemandeReferent.personneId, moi ?? 0), eq(avisDemandeReferent.url, lienDemande(id)), isNull(avisDemandeReferent.lueLe)))
	]);
	const g = gestionnairesDe(lignes, aujourdhui);
	const gere = moi !== null && (g.chefs.includes(moi) || (g.titulaires.includes(moi) && l?.demandeurId !== moi));
	if (!l || (l.demandeurId !== moi && !gere && acteur.type !== 'super')) throw new DonneeInvalide('Demande inconnue');
	const { demandeurId, priseParId, mot, icone, ...liste } = l;
	const reglage = lireReglage(liste.reglage);
	const ordre = reglage?.etapes ?? [];
	const etapes = [{ id: 'demandee', nom: 'Demandée' }, { id: 'prise', nom: 'Prise en compte' }, ...ordre, { id: 'faite', nom: nomEtape('faite', reglage) }];
	// La dernière étape franchie, d'après le fil (pour une demande refusée ou annulée) : 0 pour Demandée.
	const franchie = Math.max(0, ...fil.map((f) => (f.quoi === 'etape' ? etapes.findIndex((e) => e.id === f.etape) : ['prise', 'reprise', 'question'].includes(f.quoi) ? 1 : 0)));
	const permis = gestesDemande({ etape: l.etape, question: l.question, demandeur: demandeurId, prisePar: priseParId }, ordre.map((e) => e.id), { moi, gere });
	return {
		...vue(liste),
		icone,
		mot,
		sienne: demandeurId === moi,
		fil: fil.map((f) => ({ quoi: f.quoi, etape: f.nomEtape, texte: f.texte, le: f.le, par: nomDe(f), deLAgent: f.par === demandeurId })),
		gestes: permis.gestes,
		vers: permis.vers.map((v) => ({ id: v, nom: nomEtape(v, reglage) })),
		etapes,
		franchie
	};
}

// Un agent qui part ou passe à un profil extérieur : ses demandes qui n'ont pas dépassé « Prise en compte » sont annulées, au nom
// de qui fait le geste (`par`, une personne ; sinon l'agent lui-même). Qui les suivait est prévenu (cloche). Écritures à placer
// dans un batch, dans cet ordre.
export function annulerDemandesAuPassage(base: Base, personneId: number, par: number | null, agent: { prenom: string; nom: string }, maintenant: string) {
	const annulables = and(eq(demandeReferent.demandeurId, personneId), inArray(demandeReferent.etape, ['demandee', 'prise']));
	const signataire = par ?? personneId;
	return [
		base.insert(avisDemandeReferent).select(
			base
				.select({
					id: sql<number | null>`null`.as('id'),
					personneId: sql<number>`${demandeReferent.prisePar}`.as('personne_id'),
					titre: sql<string>`${`Demande ${de(nomDe(agent))} annulée`}`.as('titre'),
					texte: sql<string>`${demandeReferent.texte}`.as('texte'),
					url: sql<string>`'/demandes/' || ${demandeReferent.id}`.as('url'),
					creeLe: sql<string>`${maintenant}`.as('cree_le'),
					lueLe: sql<string | null>`null`.as('lue_le')
				})
				.from(demandeReferent)
				.where(and(annulables, isNotNull(demandeReferent.prisePar), ne(demandeReferent.prisePar, signataire)))
		),
		base.insert(filDemandeReferent).select(
			base
				.select({ id: sql<null>`null`.as('id'), demandeId: demandeReferent.id, quoi: sql<string>`'annulation'`.as('quoi'), etape: sql<null>`null`.as('etape'), nomEtape: sql<null>`null`.as('nom_etape'), texte: sql<null>`null`.as('texte'), par: sql<number>`${signataire}`.as('par'), le: sql<string>`${maintenant}`.as('le'), jeton: sql<null>`null`.as('jeton') })
				.from(demandeReferent)
				.where(annulables)
		),
		base.update(demandeReferent).set({ etape: 'annulee', question: null, finLe: maintenant, majLe: maintenant }).where(annulables)
	] as const;
}

// L'effacement d'un agent parti (partis.ts) : ses demandes et leur fil ; il ne suit plus celles des autres. Ses lignes au fil
// des autres demandes restent, sous « Ancien agent ». Écritures à placer dans un batch.
export function effacerDemandesDe(base: Base, personneId: number) {
	const siennes = base.select({ id: demandeReferent.id }).from(demandeReferent).where(eq(demandeReferent.demandeurId, personneId));
	return [
		base.delete(avisDemandeReferent).where(inArray(avisDemandeReferent.url, base.select({ url: sql<string>`'/demandes/' || ${demandeReferent.id}` }).from(demandeReferent).where(eq(demandeReferent.demandeurId, personneId)))),
		base.delete(filDemandeReferent).where(inArray(filDemandeReferent.demandeId, siennes)),
		base.delete(demandeReferent).where(eq(demandeReferent.demandeurId, personneId)),
		base.update(demandeReferent).set({ prisePar: null }).where(eq(demandeReferent.prisePar, personneId))
	] as const;
}

// Conservation (tâche de nuit) : les demandes finies avant `avant` (AAAA-MM-JJ), avec leur fil. Une requête.
export async function effacerVieillesDemandesReferents(base: Base, avant: string): Promise<void> {
	exigerDate(avant);
	const vieilles = base.select({ id: demandeReferent.id }).from(demandeReferent).where(lt(demandeReferent.finLe, avant));
	await base.batch([base.delete(filDemandeReferent).where(inArray(filDemandeReferent.demandeId, vieilles)), base.delete(demandeReferent).where(lt(demandeReferent.finLe, avant))]);
}

// L'accueil -------------------------------------------------------------------------------------------------------------------------

// Ce que `moi` a à décider, lu dans le batch de l'accueil (aucune requête de plus) : les demandes à prendre en compte de ses rôles,
// ou, s'il est chef de centre ou adjoint, celles des rôles sans titulaire ; et celles qu'il suit, prises sans suite ou dont la réponse
// est arrivée. Pour qui n'a rien de cela, la lecture ne rend rien.
export function lectureDemandesADecider(base: Base, moi: number, aujourdhui: string) {
	const enCoursA = sql`a.debut <= ${aujourdhui} and (a.fin is null or a.fin >= ${aujourdhui})`;
	const statuts = sql.raw(STATUTS_AVEC_ACCES.map((s) => `'${s}'`).join(', '));
	const mesRoles = sql`(select a.responsabilite_id from attribution a where a.personne_id = ${moi} and a.perimetre_type = 'centre' and ${enCoursA})`;
	const chef = sql`exists (select 1 from attribution a join responsabilite r on r.id = a.responsabilite_id where a.personne_id = ${moi} and a.perimetre_type = 'centre' and r.systeme in ('chef_centre', 'chef_centre_adjoint') and ${enCoursA})`;
	const sansTitulaire = sql<number>`not exists (select 1 from attribution a join personne p on p.id = a.personne_id where a.responsabilite_id = ${demandeReferent.responsabiliteId} and a.perimetre_type = 'centre' and p.statut in (${statuts}) and ${enCoursA})`;
	return base
		.select({ id: demandeReferent.id, texte: demandeReferent.texte, roleId: demandeReferent.responsabiliteId, etape: demandeReferent.etape, question: demandeReferent.question, prisePar: demandeReferent.prisePar, prenom: personne.prenom, nom: personne.nom, role: sql<string>`${responsabilite.nom}`.as('role_nom') })
		.from(demandeReferent)
		.innerJoin(personne, eq(personne.id, demandeReferent.demandeurId))
		.innerJoin(responsabilite, eq(responsabilite.id, demandeReferent.responsabiliteId))
		.where(
			and(
				isNull(demandeReferent.finLe),
				or(
					and(eq(demandeReferent.etape, 'demandee'), or(and(inArray(demandeReferent.responsabiliteId, mesRoles), ne(demandeReferent.demandeurId, moi)), and(chef, sansTitulaire))),
					and(eq(demandeReferent.prisePar, moi), eq(demandeReferent.question, 'repondue'))
				)
			)
		)
		.orderBy(asc(demandeReferent.id));
}
type ADeciderLu = { id: number; texte: string; roleId: number; etape: string; question: QuestionDemande | null; prisePar: number | null; prenom: string; nom: string; role: string };

// Rangées par casquette : `role:<id>` pour un rôle tenu (`roles`), sinon « centre ». Les nouvelles d'abord, groupées par rôle.
export function demandesADecider(lignes: ADeciderLu[], roles: Set<number>): Map<string, { texte: string; lien: string }[]> {
	const parCasquette = new Map<string, { texte: string; lien: string }[]>();
	const ajouter = (cle: string, item: { texte: string; lien: string }) => parCasquette.set(cle, [...(parCasquette.get(cle) ?? []), item]);
	const cleDe = (roleId: number) => (roles.has(roleId) ? `role:${roleId}` : 'centre');
	const nouvelles = lignes.filter((l) => l.etape === 'demandee');
	for (const roleId of [...new Set(nouvelles.map((l) => l.roleId))]) {
		const n = nouvelles.filter((l) => l.roleId === roleId);
		const cle = cleDe(roleId);
		const precision = cle === 'centre' ? ` (${n[0]!.role})` : '';
		if (n.length === 1) ajouter(cle, { texte: `Demande ${de(nomDe(n[0]))} à prendre en compte${precision}`, lien: lienDemande(n[0]!.id) });
		else ajouter(cle, { texte: `${n.length} demandes à prendre en compte${precision}`, lien: `/demandes/role/${roleId}` });
	}
	for (const l of lignes.filter((x) => x.etape !== 'demandee')) ajouter(cleDe(l.roleId), { texte: `Réponse ${de(nomDe(l))} à lire (${extraitDemandeReferent(l.texte, 60)})`, lien: lienDemande(l.id) });
	return parCasquette;
}

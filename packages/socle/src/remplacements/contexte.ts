import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { ajouterJours, exigerDateHeure, existeAParis, instantDeParis } from '../dates.ts';
import { DonneeInvalide } from '../erreurs.ts';
import { STATUTS_AVEC_ACCES } from '../listes.ts';
import { lecturesAgents } from '../murs.ts';
import { appliquerFetes, reglagesDe, type FeteCentre, type Periode, type Reglage, type SemaineCalculee } from '../planning/calendrier.ts';
import { equipeLe, semainesCalculees } from '../planning/annee.ts';
import { validesLe } from '../aptitudes.ts';
import { affectationEquipe, anneePlanning, aptitude, aptitudeAgent, attribution, demandeRemplacement, equipe, personne, responsabilite, semaineChangee, vacancesAgent } from '../schema.ts';
import { enVacances, heuresDe, lirePlage, requeteFetes, requetePlagesPubliees } from '../planning/plages.ts';
import { chevauche, heure, jourEnLettres, reunir, tranchesDe } from './tranches.ts';
import { dureesDe, requeteDureesCourt } from './court.ts';

// Ce qu'il faut savoir pour décider d'une demande, lu d'un seul bloc : les semaines publiées, les équipes de chacun,
// les demandes en cours, les agents, les aptitudes et les chefs. Le reste est calculé ici, sans requête.

export type LigneDemande = typeof demandeRemplacement.$inferSelect;
export const EN_COURS = ['attente', 'a_valider', 'conclue', 'refusee'] as const;
const SEMAINES_PROPOSEES = 12;

export const periodesDe = (json: string | null): Periode[] => (json ? (JSON.parse(json) as Periode[]) : []);

// `court` : avec les durées du remplacement court du centre (dans le même batch).
export async function lireContexte(base: Base, maintenant: string, reglage: Reglage, court = false) {
	const aujourdhui = maintenant.slice(0, 10);
	const [annees, changees, affectations, demandes, agents, aptitudes, chefs, equipes, plages, vacances, fetes, lignesCourt = []] = await base.batch([
		base.select().from(anneePlanning),
		base.select().from(semaineChangee),
		base.select({ personneId: affectationEquipe.personneId, equipeId: affectationEquipe.equipeId, debut: affectationEquipe.debut, fin: affectationEquipe.fin }).from(affectationEquipe),
		// Une demande porte sur une semaine au plus : celles commencées depuis huit jours peuvent encore courir.
		base
			.select()
			.from(demandeRemplacement)
			.where(and(inArray(demandeRemplacement.etat, [...EN_COURS]), gte(demandeRemplacement.debut, ajouterJours(aujourdhui, -8)))),
		lecturesAgents(base, aujourdhui)[0],
		base
			.select({ personneId: aptitudeAgent.personneId, aptitudeId: aptitudeAgent.aptitudeId, obtenueLe: aptitudeAgent.obtenueLe, expireLe: aptitudeAgent.expireLe, nom: aptitude.nom, controlee: aptitude.controlee, ordre: aptitude.ordre })
			.from(aptitudeAgent)
			.innerJoin(aptitude, eq(aptitude.id, aptitudeAgent.aptitudeId))
			.where(isNull(aptitude.retireeLe)),
		requeteChefs(base, aujourdhui),
		base.select({ id: equipe.id, nom: equipe.nom, couleur: equipe.couleur }).from(equipe),
		// L'été publié et les vacances des agents.
		requetePlagesPubliees(base, ajouterJours(aujourdhui, -8), '9999-12-31'),
		base.select({ personneId: vacancesAgent.personneId, debut: vacancesAgent.debut, fin: vacancesAgent.fin }).from(vacancesAgent).where(gte(vacancesAgent.fin, ajouterJours(aujourdhui, -8))),
		// Les fêtes du centre de la fenêtre des remplacements (quelques lignes).
		requeteFetes(base, ajouterJours(aujourdhui, -15), ajouterJours(aujourdhui, SEMAINES_PROPOSEES * 7 + 8)),
		...(court ? [requeteDureesCourt(base)] : ([] as unknown as [ReturnType<typeof requeteDureesCourt>]))
	]);
	// Les semaines publiées utiles, calculées seulement si on s'en sert (l'échange de manœuvre ou la liste des demandes, non) :
	// celles qui commencent dans la fenêtre des remplacements, de deux semaines avant aujourd'hui à la fin des douze semaines proposées.
	// Une semaine finit au plus 8 jours après sa relève, et une demande ne porte que sur des tranches de cette fenêtre (décision 0021).
	const du = ajouterJours(aujourdhui, -15);
	const au = ajouterJours(aujourdhui, SEMAINES_PROPOSEES * 7 + 7);
	let semaines: SemaineCalculee[] | null = null;
	// Seules ces semaines-là sont calculées, pas les années entières : une quinzaine au lieu de 52 à 104. Les autres années ne sont pas lues.
	const utiles = annees.filter((a) => a.publieeLe !== null && a.annee >= Number(du.slice(0, 4)) && a.annee <= Number(au.slice(0, 4))).sort((a, b) => a.annee - b.annee);
	const fenetre = { debut: du, fin: ajouterJours(au, 1) };
	// Le réglage de chaque année, ses horaires compris.
	const reglages = reglagesDe(reglage, annees);
	return {
		maintenant: maintenant.slice(0, 16),
		reglages,
		durees: dureesDe(lignesCourt),
		// Les fêtes, appliquées au calcul des semaines (à changer avant le premier calcul pour voir l'effet d'une fête : fetes.ts).
		fetes: fetes as FeteCentre[],
		get semaines(): SemaineCalculee[] {
			semaines ??= appliquerFetes(utiles.flatMap((a) => semainesCalculees(a.annee, a.ordre, changees, reglages, fenetre)), this.fetes);
			return semaines;
		},
		affectations,
		demandes,
		engages: engagesDe(demandes),
		agents,
		aptitudes,
		chefs,
		equipes,
		plages: plages.map(lirePlage),
		vacances,
		astreintes: new Map<number, SemaineCalculee[]>(),
		heures: new Map<number, { debuts: string[]; finsMax: string[] }>()
	};
}

export type Contexte = Awaited<ReturnType<typeof lireContexte>>;

// Les chefs en fonction (chefs de garde, chef de centre et adjoint) : ceux qui valident.
export function requeteChefs(base: Base, aujourdhui: string) {
	return base
		.select({ personneId: attribution.personneId, systeme: responsabilite.systeme, equipeId: attribution.perimetreId })
		.from(attribution)
		.innerJoin(responsabilite, eq(responsabilite.id, attribution.responsabiliteId))
		.innerJoin(personne, eq(personne.id, attribution.personneId))
		.where(
			and(
				inArray(responsabilite.systeme, ['chef_equipe', 'chef_centre', 'chef_centre_adjoint']),
				sql`${attribution.perimetreType} = ${responsabilite.typePerimetre}`,
				isNull(responsabilite.archiveeLe),
				inArray(personne.statut, [...STATUTS_AVEC_ACCES]),
				lte(attribution.debut, aujourdhui),
				or(isNull(attribution.fin), gte(attribution.fin, aujourdhui))
			)
		);
}
export type Chef = { personneId: number; systeme: string | null; equipeId: number | null };

const affectationsDe = (ctx: Contexte, id: number) => ctx.affectations.filter((a) => a.personneId === id);

// Les semaines d'astreinte de la personne : son équipe à la relève ; en été publié, ses plages (renfort compris).
// `periodes` : ses heures à elle. Calculées une fois par personne et par requête : un échange compare chaque collègue
// à chaque tranche, et refaire l'année à chaque fois dépassait le temps de calcul de Cloudflare (décision 0021).
export function astreintesDe(ctx: Contexte, id: number): SemaineCalculee[] {
	const deja = ctx.astreintes.get(id);
	if (deja) return deja;
	const siennes = affectationsDe(ctx, id);
	const calculees = ctx.semaines.map((s) => ({ ...s, periodes: heuresDe(s, equipeLe(siennes, s.debut), id, ctx.plages) })).filter((s) => s.periodes.length > 0);
	ctx.astreintes.set(id, calculees);
	return calculees;
}

// D'astreinte sur une période : ses heures, à plat et triées par début, avec la fin la plus tardive atteinte à chaque rang.
// Une recherche par moitiés trouve les heures qui commencent avant la fin de la période : l'une la chevauche si la plus tardive
// finit après son début. Sans parcourir toute l'année à chaque tranche vérifiée (décision 0021).
export function dAstreinte(ctx: Contexte, id: number, p: Periode): boolean {
	let heures = ctx.heures.get(id);
	if (!heures) {
		const periodes = astreintesDe(ctx, id)
			.flatMap((s) => s.periodes)
			.sort((a, b) => (a.debut < b.debut ? -1 : a.debut > b.debut ? 1 : 0));
		let plusTard = '';
		heures = { debuts: periodes.map((x) => x.debut), finsMax: periodes.map((x) => (plusTard = x.fin > plusTard ? x.fin : plusTard)) };
		ctx.heures.set(id, heures);
	}
	let avant = 0;
	for (let apres = heures.debuts.length; avant < apres; ) {
		const milieu = (avant + apres) >> 1;
		if (heures.debuts[milieu]! < p.fin) avant = milieu + 1;
		else apres = milieu;
	}
	return avant > 0 && heures.finsMax[avant - 1]! > p.debut;
}

// Qui cède et qui prend quoi dans une demande : le demandeur cède dès qu'il demande ; le remplaçant prend une fois qu'il a accepté.
// Échange : le collègue cède les siennes et le demandeur les prend, une fois accepté.
export function engagements(d: LigneDemande): { personneId: number; periode: Periode; prend: boolean }[] {
	const liste = periodesDe(d.periodes).map((periode) => ({ personneId: d.demandeurId, periode, prend: false }));
	if (d.remplacantId === null || d.etat === 'attente' || d.etat === 'refusee') return liste;
	liste.push(...periodesDe(d.periodes).map((periode) => ({ personneId: d.remplacantId!, periode, prend: true })));
	for (const periode of periodesDe(d.periodesCible)) liste.push({ personneId: d.remplacantId, periode, prend: false }, { personneId: d.demandeurId, periode, prend: true });
	return liste;
}

// Les périodes où chacun est engagé, par personne : lues une fois par requête, et non à chaque tranche vérifiée (décision 0021).
function engagesDe(demandes: LigneDemande[]) {
	const parPersonne = new Map<number, { demandeId: number; periode: Periode }[]>();
	for (const d of demandes)
		for (const e of engagements(d)) {
			const liste = parPersonne.get(e.personneId) ?? [];
			liste.push({ demandeId: d.id, periode: e.periode });
			parPersonne.set(e.personneId, liste);
		}
	return parPersonne;
}

// Ni engagé dans une autre demande sur ces périodes (`sauf` : celle qu'on traite).
export const sansEngagement = (ctx: Contexte, id: number, periodes: Periode[], sauf: number | null = null) =>
	!(ctx.engages.get(id) ?? []).some((e) => e.demandeId !== sauf && periodes.some((p) => chevauche(p, e.periode)));

// Seul un opérationnel prend la place d'un collègue. Un stagiaire (les JSP compris) ou un inapte temporaire n'est ni disponible,
// ni destinataire, ni remplaçant, ni dans un échange ; il peut toujours demander à être remplacé sur son astreinte.
export const peutRemplacer = (ctx: Contexte, id: number) => ctx.agents.some((a) => a.id === id && a.statut === 'operationnel');
// Refuse le geste si l'un de ces agents a accès sans être opérationnel.
export function exigerRemplacants(ctx: Contexte, ...ids: number[]) {
	for (const id of ids) {
		const statut = ctx.agents.find((a) => a.id === id)?.statut;
		if (statut !== undefined && statut !== 'operationnel') throw new DonneeInvalide(`Un ${statut === 'stagiaire' ? 'stagiaire' : 'inapte temporaire'} ne prend pas la place d’un collègue`);
	}
}

// Les périodes d'une demande, pour savoir qui est libre. Un créneau est coupé à ses tranches : les vacances se voient au jour
// de chacune, comme pour une garde entière (un créneau du vendredi 21 h au samedi 7 h touche aussi le samedi).
export const morceaux = (ctx: Contexte, periodes: Periode[]) => periodes.flatMap((p) => tranchesDe([p], ctx.reglages(Number(p.debut.slice(0, 4)))));
export const aCouvrir = (ctx: Contexte, d: { periodes: string; creneau: number | null }) => (d.creneau === 1 ? morceaux(ctx, periodesDe(d.periodes)) : periodesDe(d.periodes));

// Disponible : un opérationnel, ni d'astreinte ni en vacances sur l'une des périodes, ni engagé dans une demande qui les touche.
export const disponible = (ctx: Contexte, id: number, periodes: Periode[], sauf: number | null = null) =>
	peutRemplacer(ctx, id) && !periodes.some((p) => dAstreinte(ctx, id, p) || enVacances(ctx.vacances, id, p)) && sansEngagement(ctx, id, periodes, sauf);

const controleesValides = (ctx: Contexte, id: number, date: string) => {
	const siennes = ctx.aptitudes.filter((a) => a.personneId === id && a.controlee === 1);
	const valides = validesLe(siennes, date);
	return siennes.filter((a) => valides.has(a.aptitudeId)).sort((a, b) => a.ordre - b.ordre);
};

// Les aptitudes contrôlées du titulaire, valables à la date, que le remplaçant n'a pas.
export function manque(ctx: Contexte, titulaireId: number, remplacantId: number, date: string): string[] {
	const siennes = new Set(controleesValides(ctx, remplacantId, date).map((a) => a.aptitudeId));
	return controleesValides(ctx, titulaireId, date)
		.filter((a) => !siennes.has(a.aptitudeId))
		.map((a) => a.nom);
}

// Les disponibles, ceux qui ont les aptitudes contrôlées du demandeur d'abord, puis par nom.
export function disponibles(ctx: Contexte, demandeurId: number, periodes: Periode[], sauf: number | null = null) {
	const date = periodes[0]?.debut.slice(0, 10) ?? ctx.maintenant.slice(0, 10);
	return ctx.agents
		.filter((a) => a.id !== demandeurId && disponible(ctx, a.id, periodes, sauf))
		.map((a) => ({ id: a.id, prenom: a.prenom, nom: a.nom, aptitudes: manque(ctx, demandeurId, a.id, date).length === 0 }))
		.sort((a, b) => Number(b.aptitudes) - Number(a.aptitudes) || a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));
}

// Qui valide : les chefs de l'équipe, ni demandeur ni remplaçant ; à défaut, le chef de centre et son adjoint.
export function valideurs(chefs: Chef[], equipeId: number | null, demandeurId: number, remplacantId: number | null = null): number[] {
	const ids = (garde: (c: Chef) => boolean) => [...new Set(chefs.filter((c) => garde(c) && c.personneId !== demandeurId && c.personneId !== remplacantId).map((c) => c.personneId))];
	const deLEquipe = ids((c) => c.systeme === 'chef_equipe' && c.equipeId === equipeId);
	return deLEquipe.length > 0 ? deLEquipe : ids((c) => c.systeme === 'chef_centre' || c.systeme === 'chef_centre_adjoint');
}

// Les tranches d'astreinte de la personne dans les douze semaines à venir, par semaine ; `prise` : déjà dans une demande en cours.
export function mesTranches(ctx: Contexte, id: number): { semaine: string; equipeId: number; tranches: (Periode & { prise: boolean })[] }[] {
	const limite = `${ajouterJours(ctx.maintenant.slice(0, 10), SEMAINES_PROPOSEES * 7)}T00:00`;
	return astreintesDe(ctx, id)
		.filter((s) => s.periodes.at(-1)!.fin > ctx.maintenant && s.periodes[0]!.debut < limite)
		.map((s) => ({
			semaine: s.debut,
			equipeId: s.equipeId,
			tranches: tranchesDe(s.periodes, ctx.reglages(Number(s.debut.slice(0, 4))))
				.filter((t) => t.debut > ctx.maintenant)
				.map((t) => ({ ...t, prise: !sansEngagement(ctx, id, [t]) }))
		}))
		.filter((s) => s.tranches.length > 0);
}

// Les tranches d'astreinte du jour : commencées ou non, qui commencent aujourd'hui ou ne sont pas finies. Pour un remplacement court.
export function tranchesDuJour(ctx: Contexte, id: number): Periode[] {
	const demain = `${ajouterJours(ctx.maintenant.slice(0, 10), 1)}T00:00`;
	return astreintesDe(ctx, id)
		.filter((s) => s.periodes.at(-1)!.fin > ctx.maintenant && s.periodes[0]!.debut < demain)
		.flatMap((s) => tranchesDe(s.periodes, ctx.reglages(Number(s.debut.slice(0, 4)))))
		.filter((t) => t.fin > ctx.maintenant && t.debut < demain);
}

const QUART = 15 * 60_000;
const decaler = (moment: string, ms: number) => new Date(Date.parse(`${moment}:00Z`) + ms).toISOString().slice(0, 16);

// Les débuts possibles d'un remplacement court, au quart d'heure : à venir, dans une tranche du jour, libres de toute demande.
// `durees` : celles du centre qui y tiennent et sont libres (le contexte lu avec `court`).
export function debutsCourts(ctx: Contexte, id: number): { debut: string; durees: number[] }[] {
	const libre = (debut: string, heures: number) => sansEngagement(ctx, id, [{ debut, fin: decaler(debut, heures * 3_600_000) }]);
	// Le premier quart d'heure qui suit maintenant.
	const premier = new Date(Math.floor(Date.parse(`${ctx.maintenant}:00Z`) / QUART) * QUART + QUART).toISOString().slice(0, 16);
	const plusCourte = Math.min(...ctx.durees);
	const debuts: { debut: string; durees: number[] }[] = [];
	for (const t of tranchesDuJour(ctx, id)) {
		const depart = new Date(Math.ceil(Date.parse(`${t.debut}:00Z`) / QUART) * QUART).toISOString().slice(0, 16);
		for (let d = depart > premier ? depart : premier; decaler(d, plusCourte * 3_600_000) <= t.fin; d = decaler(d, QUART)) {
			if (!existeAParis(d)) continue;
			const durees = ctx.durees.filter((h) => decaler(d, h * 3_600_000) <= t.fin && libre(d, h));
			if (durees.length) debuts.push({ debut: d, durees });
		}
	}
	return debuts;
}

export type EtatTranche = 'libre' | 'prise' | 'passee' | 'occupe';

// Le parcours guidé : ses semaines d'astreinte des douze prochaines semaines, avec toutes leurs tranches, même passées ou
// déjà demandées (l'écran les montre inactives, avec la raison). `pour` : qui les prendrait (échange) ; « occupe » s'il n'est pas libre.
export function bandesDe(ctx: Contexte, id: number, pour: number | null = null): { semaine: string; equipeId: number; tranches: (Periode & { etat: EtatTranche })[] }[] {
	const limite = `${ajouterJours(ctx.maintenant.slice(0, 10), SEMAINES_PROPOSEES * 7)}T00:00`;
	const etat = (t: Periode): EtatTranche => (t.debut <= ctx.maintenant ? 'passee' : !sansEngagement(ctx, id, [t]) ? 'prise' : pour !== null && !disponible(ctx, pour, [t]) ? 'occupe' : 'libre');
	return astreintesDe(ctx, id)
		.filter((s) => s.periodes.at(-1)!.fin > ctx.maintenant && s.periodes[0]!.debut < limite)
		.map((s) => ({ semaine: s.debut, equipeId: s.equipeId, tranches: tranchesDe(s.periodes, ctx.reglages(Number(s.debut.slice(0, 4)))).map((t) => ({ ...t, etat: etat(t) })) }))
		.filter((s) => s.tranches.some((t) => t.etat !== 'passee'));
}

// Les collègues libres sur ces périodes : leur équipe du jour, leurs aptitudes valables, et les aptitudes contrôlées du demandeur qui leur manquent.
// Ceux à qui rien ne manque d'abord, puis par nom.
export function candidats(ctx: Contexte, demandeurId: number, periodes: Periode[]) {
	if (periodes.length === 0) return [];
	const date = periodes[0]!.debut.slice(0, 10);
	const aujourdhui = ctx.maintenant.slice(0, 10);
	return ctx.agents
		.filter((a) => a.id !== demandeurId && disponible(ctx, a.id, periodes))
		.map((a) => {
			const siennes = ctx.aptitudes.filter((x) => x.personneId === a.id).sort((x, y) => x.ordre - y.ordre);
			const valides = validesLe(siennes, date);
			const equipeId = equipeLe(affectationsDe(ctx, a.id), aujourdhui);
			return {
				id: a.id,
				prenom: a.prenom,
				nom: a.nom,
				equipe: ctx.equipes.find((e) => e.id === equipeId) ?? null,
				aptitudes: siennes.filter((x) => valides.has(x.aptitudeId)).map((x) => x.nom),
				manque: manque(ctx, demandeurId, a.id, date)
			};
		})
		.sort((a, b) => Number(a.manque.length > 0) - Number(b.manque.length > 0) || a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));
}

// En heure réelle : un créneau qui passe le changement d'heure dure une heure de plus ou de moins qu'à l'horloge.
const minutes = (de: string, a: string) => (instantDeParis(a) - instantDeParis(de)) / 60_000;
// Une date et une heure qui existent (ni 31 novembre ni 24 h), à la minute.
function valide(m: unknown): m is string {
	try {
		exigerDateHeure(m, 'Moment');
		return (m as string).length === 16;
	} catch {
		return false;
	}
}

// Un créneau : dans ses astreintes (deux qui se suivent, jamais un trou), de 1 h à une semaine, demandé au moins 1 h avant,
// dans les douze semaines à venir, sur des heures libres de toute autre demande.
export function exigerCreneau(ctx: Contexte, id: number, p: { debut: unknown; fin: unknown }): Periode {
	const { debut, fin } = p;
	if (!valide(debut) || !valide(fin)) throw new DonneeInvalide('Indiquez le début et la fin du créneau');
	if (!existeAParis(debut) || !existeAParis(fin)) throw new DonneeInvalide('Cette heure n’existe pas cette nuit-là (passage à l’heure d’été)');
	if (fin <= debut) throw new DonneeInvalide('La fin doit venir après le début');
	if (minutes(debut, fin) < 60) throw new DonneeInvalide('Un créneau dure au moins 1 h');
	if (minutes(debut, fin) > 7 * 24 * 60) throw new DonneeInvalide('Un créneau dure une semaine au plus');
	if (minutes(ctx.maintenant, debut) < 60) throw new DonneeInvalide('Un créneau se demande au moins 1 h avant son début');
	if (debut >= `${ajouterJours(ctx.maintenant.slice(0, 10), SEMAINES_PROPOSEES * 7)}T00:00`) throw new DonneeInvalide('Un créneau se demande dans les douze semaines à venir');
	const astreinte = reunir(astreintesDe(ctx, id).flatMap((s) => s.periodes)).find((b) => b.debut <= debut && debut < b.fin);
	if (!astreinte) throw new DonneeInvalide('Le créneau doit commencer pendant votre astreinte');
	if (fin > astreinte.fin) throw new DonneeInvalide(`Le créneau doit finir ${jourEnLettres(astreinte.fin)} à ${heure(astreinte.fin)} au plus tard`);
	if (!sansEngagement(ctx, id, [{ debut, fin }])) throw new DonneeInvalide('Période déjà dans une demande');
	return { debut, fin };
}

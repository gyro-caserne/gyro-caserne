import { and, asc, eq, gte, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import { regleDAttributionLue } from './actions/attributions.ts';
import type { Base } from './base.ts';
import { tenuesValides } from './casquettes.ts';
import { exigerDate } from './dates.ts';
import { accorde, droitsDe, type Acteur } from './droits.ts';
import { RefusDroit } from './erreurs.ts';
import { iconeDuComite, iconeDuRole, NOMS_ICONES, type NomIcone } from './icones.ts';
import { agentsDuJour, lecturesAgents } from './murs.ts';
import { STATUTS_AVEC_ACCES } from './listes.ts';
import { aLaMessagerie } from './messagerie.ts';
import { attribution, comite, equipe, grade, personne, profil, responsabilite, ressource } from './schema.ts';

// `ecrire` : l'acteur peut lui écrire par la messagerie (tous deux l'ont, et ce n'est pas lui-même).
// `grade` : le libellé de son grade, pour l'insigne à côté du nom (null sans grade).
// `mandat` : seulement pour qui peut nommer sur ce poste (option `gestes`) : l'attribution, pour la remplacer ou la finir.
export type Mandat = { id: number; debut: string; fin: string | null };
export type Titulaire = { id: number; nom: string; grade: string | null; ecrire: boolean; mandat?: Mandat };
// Sur un poste que l'acteur peut nommer : `aPourvoir`, une fonction que personne ne tient ni ne tiendra.
export type Nommer = { aPourvoir: boolean };
type Nature = 'fonction' | 'mission';
// `demandes` : le rôle reçoit des demandes ; on peut lui en faire une depuis sa ligne.
export type RoleTenu = { id: number; nom: string; icone: NomIcone; titulaires: Titulaire[]; demandes: boolean; nommer?: Nommer };
// Un rôle de comité dans un comité, pour qui peut y nommer : son nom court (« Rapporteur »).
export type PosteDeComite = { id: number; nom: string; nature: Nature; titulaires: Titulaire[]; nommer: Nommer };
export type QuiFaitQuoi = {
	comites: { id: number; nom: string; icone: NomIcone; mur: boolean; membres: (Titulaire & { roles: string[] })[]; ressources: { id: number; nom: string; icone: NomIcone }[]; postes?: PosteDeComite[] }[];
	commandement: RoleTenu[];
	equipes: { id: number; nom: string; systeme: string | null; nature: Nature; parEquipe: { equipeId: number; equipe: string; titulaires: Titulaire[]; nommer?: Nommer }[] }[];
	fonctions: RoleTenu[];
	missions: RoleTenu[];
	// L'acteur peut faire une demande (un agent, pas le super administrateur).
	peutDemander: boolean;
	// Avec l'option `gestes`, pour qui peut nommer au moins un poste : les agents qu'on peut nommer (nom, équipe). Sinon null.
	gestes: { agents: { id: number; nom: string; equipeId: number | null; equipe: string | null; exterieur: boolean }[] } | null;
};

// « Rapporteur de comité » se lit « Rapporteur » sous le nom du comité.
export const roleCourt = (nom: string) => nom.replace(/\s+(de|du) comité$/i, '') || nom;

// Caserne → Qui fait quoi : qui tient quoi aujourd'hui, sans les droits. Pour les agents qui ont accès et le super administrateur.
// Les titulaires sont les agents qui ont accès (ni partis, ni suspendus, ni extérieurs), comme les membres des murs. Un batch, plus les droits de l'acteur (déjà lus par le layout).
// `gestes` (qui peut nommer, d'après le layout) : dans le même batch, les mandats en cours et à venir, pour nommer, remplacer et finir sur la page.
export async function quiFaitQuoi(base: Base, acteur: Acteur, aujourdhui: string, { gestes = false }: { gestes?: boolean } = {}): Promise<QuiFaitQuoi> {
	exigerDate(aujourdhui);
	const lectures = [
		...lecturesAgents(base, aujourdhui),
		base.select({ id: comite.id, nom: comite.nom, theme: comite.theme, icone: comite.icone }).from(comite).where(isNull(comite.dissousLe)).orderBy(asc(comite.nom)),
		base
			.select({
				id: responsabilite.id,
				nom: responsabilite.nom,
				portee: responsabilite.typePerimetre,
				nature: responsabilite.nature,
				systeme: responsabilite.systeme,
				comiteAttributeurId: responsabilite.comiteAttributeurId,
				icone: responsabilite.icone,
				modele: responsabilite.modele,
				demandes: sql<number>`${responsabilite.demandes} is not null`.as('demandes')
			})
			.from(responsabilite)
			.where(isNull(responsabilite.archiveeLe))
			.orderBy(asc(responsabilite.nom)),
		base.select({ id: equipe.id, nom: equipe.nom }).from(equipe).where(eq(equipe.active, 1)).orderBy(asc(equipe.ordreRotation)),
		base
			.select({ id: ressource.id, nom: ressource.nom, icone: ressource.icone, comiteId: ressource.gereeParComiteId })
			.from(ressource)
			.where(and(isNull(ressource.retireeLe), isNotNull(ressource.gereeParComiteId)))
			.orderBy(asc(ressource.nom)),
		base.select({ id: personne.id }).from(personne).where(aLaMessagerie(personne.id, aujourdhui)),
		base.select({ id: personne.id, grade: grade.libelle }).from(personne).innerJoin(grade, eq(grade.id, personne.gradeId))
	] as const;
	// Les mandats en cours et à venir : seulement pour qui nomme, toujours dans le même envoi.
	const lectureMandats = base
		.select({ id: attribution.id, personneId: attribution.personneId, responsabiliteId: attribution.responsabiliteId, type: attribution.perimetreType, perimetreId: attribution.perimetreId, debut: attribution.debut, fin: attribution.fin })
		.from(attribution)
		.where(or(isNull(attribution.fin), gte(attribution.fin, aujourdhui)))
		.orderBy(asc(attribution.debut), asc(attribution.id));
	// Et tous ceux qu'on peut nommer : les suspendus et les extérieurs aussi, comme le socle (seul un parti est refusé).
	const lectureNommables = base
		.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, type: profil.typePersonne })
		.from(personne)
		.leftJoin(profil, eq(profil.id, personne.profilId))
		.where(ne(personne.statut, 'parti'));
	type Mandats = Awaited<typeof lectureMandats>;
	type Nommables = Awaited<typeof lectureNommables>;
	const lus = gestes ? await base.batch([...lectures, lectureMandats, lectureNommables]) : await base.batch(lectures);
	const [personnes, affectations, tenues, comites, roles, equipes, materiel, messagerie, grades] = lus;
	const mandats = gestes ? ((lus as unknown as unknown[])[lectures.length] as Mandats) : null;
	const nommables = gestes ? ((lus as unknown as unknown[])[lectures.length + 1] as Nommables) : [];
	const agents = agentsDuJour([personnes, affectations, tenues], aujourdhui);
	const moi = acteur.type === 'super' ? null : agents.find((a) => a.id === acteur.id);
	if (moi === undefined) throw new RefusDroit('VOIR_ANNUAIRE', { type: 'centre' }, 'Réservé aux agents du centre');
	// Mêmes règles que les murs (mursDe) : le chef, l'adjoint et le super administrateur lisent tous les comités, un agent les siens.
	const tous = moi === null || moi.a.tous;
	const droits = await droitsDe(base, acteur, aujourdhui);

	const nomDe = new Map(agents.map((a) => [a.id, `${a.prenom} ${a.nom}`]));
	const avecMessagerie = new Set(messagerie.map((p) => p.id));
	const ecrire = (id: number) => moi !== null && id !== moi.id && avecMessagerie.has(moi.id) && avecMessagerie.has(id);
	const gradeDe = new Map(grades.map((g) => [g.id, g.grade]));
	const titulaire = (id: number): Titulaire => ({ id, nom: nomDe.get(id)!, grade: gradeDe.get(id) ?? null, ecrire: ecrire(id) });
	const ordre = new Map([...agents].sort((x, y) => x.nom.localeCompare(y.nom, 'fr') || x.prenom.localeCompare(y.prenom, 'fr')).map((a, i) => [a.id, i]));
	const valides = tenuesValides(tenues).filter((t) => nomDe.has(t.personneId));
	const titulaires = (garde: (t: (typeof valides)[number]) => boolean) =>
		[...new Set(valides.filter(garde).map((t) => t.personneId))].sort((x, y) => ordre.get(x)! - ordre.get(y)!).map(titulaire);

	// Les gestes : la règle de nomination sur les droits déjà lus ; chef de centre d'après ses rôles du jour, déjà lus aussi.
	type Role = (typeof roles)[number];
	const estChef = moi !== null && tenues.some((t) => t.personneId === moi.id && t.systeme === 'chef_centre');
	const peut = regleDAttributionLue(acteur, droits, estChef);
	const parRole = new Map(roles.map((r) => [r.id, r]));
	// Sur un poste nommable, chaque mandat se voit, même tenu par un suspendu ou un extérieur : on peut le remplacer ou le finir.
	const nomNommable = new Map(nommables.map((p) => [p.id, `${p.prenom} ${p.nom}`]));
	const mandatsValides = (mandats ?? []).filter((m) => nomNommable.has(m.personneId) && m.type === parRole.get(m.responsabiliteId)?.portee);
	const titulaireNommable = (id: number): Titulaire => ({ id, nom: nomNommable.get(id)!, grade: gradeDe.get(id) ?? null, ecrire: nomDe.has(id) && ecrire(id) });
	// Sur un poste que l'acteur peut nommer : un titulaire par mandat (en cours ou à venir), et ce qu'il y a à pourvoir.
	const poste = (r: Role, perimetreId: number | null) => {
		const perimetre = r.portee === 'centre' || perimetreId === null ? ({ type: 'centre' } as const) : { type: r.portee, id: perimetreId };
		if (mandats === null || !peut(r, perimetre)) return null;
		const tenus = mandatsValides
			.filter((m) => m.responsabiliteId === r.id && (r.portee === 'centre' || m.perimetreId === perimetreId))
			.map((m) => ({ ...titulaireNommable(m.personneId), mandat: { id: m.id, debut: m.debut, fin: m.fin } }));
		return { titulaires: tenus, nommer: { aPourvoir: r.nature === 'fonction' && tenus.length === 0 } };
	};
	const roleTenu = (r: Role): RoleTenu => {
		const tenu: RoleTenu = { id: r.id, nom: r.nom, icone: iconeDuRole(r), titulaires: titulaires((t) => t.responsabiliteId === r.id), demandes: Boolean(r.demandes) };
		const p = poste(r, null);
		return p ? { ...tenu, ...p } : tenu;
	};
	// Dans un comité, les rôles tenus qui nomment (le rapporteur) d'abord, puis par nom.
	const nommeurs = new Set(tenues.filter((t) => t.nomme !== null).map((t) => t.responsabiliteId));
	const rolesDeComite = roles.filter((r) => r.portee === 'comite').sort((x, y) => Number(nommeurs.has(y.id)) - Number(nommeurs.has(x.id)));

	const vue: QuiFaitQuoi = {
		comites: comites.map((c) => {
			const lignes = valides.filter((t) => t.type === 'comite' && t.perimetreId === c.id);
			const ids = [...new Set(lignes.map((t) => t.personneId))];
			// Le rapporteur (un rôle qui nomme) d'abord, puis par nom.
			const nomme = (id: number) => (lignes.some((t) => t.personneId === id && t.nomme !== null) ? 0 : 1);
			const membres = ids
				.sort((x, y) => nomme(x) - nomme(y) || ordre.get(x)! - ordre.get(y)!)
				.map((id) => ({ ...titulaire(id), roles: [...new Set(lignes.filter((t) => t.personneId === id).map((t) => roleCourt(t.nom)))] }));
			const membre = moi?.a.membreComite.has(c.id) ?? false;
			const carte: QuiFaitQuoi['comites'][number] = {
				id: c.id,
				nom: c.nom,
				icone: iconeDuComite(c),
				mur: tous || membre,
				membres,
				// Le matériel que l'acteur voit dans Réservations (reservations.ts) : il le gère (membre du comité, super administrateur) ou peut le réserver.
				ressources: materiel
					.filter((r) => r.comiteId === c.id && (acteur.type === 'super' || membre || accorde(droits, 'RESERVER', { type: 'ressource', id: r.id })))
					.map((r) => ({ id: r.id, nom: r.nom, icone: ((NOMS_ICONES as readonly string[]).includes(r.icone) ? r.icone : 'outil') as NomIcone }))
			};
			if (mandats === null) return carte;
			const postes = rolesDeComite.flatMap((r) => {
				const p = poste(r, c.id);
				return p ? [{ id: r.id, nom: roleCourt(r.nom), nature: r.nature, ...p }] : [];
			});
			return { ...carte, postes };
		}),
		commandement: roles.filter((r) => r.systeme === 'chef_centre' || r.systeme === 'chef_centre_adjoint').map(roleTenu),
		equipes: roles
			.filter((r) => r.portee === 'equipe')
			.map((r) => ({
				id: r.id,
				nom: r.nom,
				systeme: r.systeme,
				nature: r.nature,
				parEquipe: equipes.map((e) => {
					const ligne = { equipeId: e.id, equipe: e.nom, titulaires: titulaires((t) => t.responsabiliteId === r.id && t.perimetreId === e.id) };
					const p = poste(r, e.id);
					return p ? { ...ligne, ...p } : ligne;
				})
			})),
		// Les autres rôles du centre, rangés selon leur nature.
		fonctions: roles.filter((r) => r.portee === 'centre' && r.systeme === null && r.nature === 'fonction').map(roleTenu),
		missions: roles.filter((r) => r.portee === 'centre' && r.systeme === null && r.nature === 'mission').map(roleTenu),
		peutDemander: moi !== null && moi.typePersonne !== 'exterieur',
		gestes: null
	};
	if (mandats === null) return vue;
	const nommeQuelqueChose = [...vue.commandement, ...vue.fonctions, ...vue.missions].some((r) => r.nommer) || vue.equipes.some((r) => r.parEquipe.some((l) => l.nommer)) || vue.comites.some((c) => (c.postes ?? []).length > 0);
	if (!nommeQuelqueChose) return vue;
	// L'équipe du jour de chaque agent : les siens passent d'abord quand on nomme dans une équipe.
	const nomEquipe = new Map(equipes.map((e) => [e.id, e.nom]));
	const equipeDe = new Map(affectations.filter((a) => nomEquipe.has(a.equipeId)).map((a) => [a.personneId, a.equipeId]));
	const parNom = (x: { nom: string; prenom: string }, y: { nom: string; prenom: string }) => x.nom.localeCompare(y.nom, 'fr') || x.prenom.localeCompare(y.prenom, 'fr');
	const aNommer = [...nommables]
		.sort(parNom)
		.map((p) => ({ id: p.id, nom: nomNommable.get(p.id)!, equipeId: equipeDe.get(p.id) ?? null, equipe: nomEquipe.get(equipeDe.get(p.id) ?? -1) ?? null, exterieur: p.type === 'exterieur' }));
	return { ...vue, gestes: { agents: aNommer } };
}

// Le lien de Caserne : la même règle d'entrée que quiFaitQuoi, en une requête.
export async function ouvreQuiFaitQuoi(base: Base, acteur: Acteur): Promise<boolean> {
	if (acteur.type === 'super') return true;
	const [fiche] = await base.select({ statut: personne.statut, type: profil.typePersonne }).from(personne).leftJoin(profil, eq(profil.id, personne.profilId)).where(eq(personne.id, acteur.id));
	return !!fiche && (STATUTS_AVEC_ACCES as readonly string[]).includes(fiche.statut) && fiche.type !== 'exterieur';
}

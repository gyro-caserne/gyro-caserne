import { alias } from 'drizzle-orm/sqlite-core';
import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { nomActeur } from './actions/personnes.ts';
import type { Base } from './base.ts';
import { ajouterJours, debutMinimumEvenement, exigerDate, exigerDateHeure, joursFetes, momentEvenement } from './dates.ts';
import type { Acteur } from './droits.ts';
import { STATUTS_AVEC_ACCES, type ReponseEvenement } from './listes.ts';
import { estConvoque, estMembre, mursEtAppartenances, type CleMur, type Mur } from './murs.ts';
import { requetePourMoi } from './remplacements/lectures.ts';
import { texteDemande } from './remplacements/tranches.ts';
import { PALIERS_PAR_DEFAUT } from './anciennete-calcul.ts';
import { avisAnciennete, personne, priseConnaissance, profil, publication, reglageAnciennete, reponseEvenement, souhaitAnniversaire, visiteMur, voteSondage } from './schema.ts';

export type ItemANePasManquer = { id: number; cle: CleMur; nomMur: string; titre: string };
export type ANePasManquer = {
	annonces: ItemANePasManquer[];
	// `enCours` : commencé, pas fini (à sa fin, ou 3 h après le début) ; on ne peut plus y répondre.
	evenements: (ItemANePasManquer & { debut: string; demain: boolean; enCours: boolean; reponse: ReponseEvenement | null })[];
	sondages: ItemANePasManquer[];
	epinglees: ItemANePasManquer[];
	nouveautes: { cle: CleMur; nom: string; nombre: number }[];
	// Les demandes de remplacement reçues qui attendent une réponse.
	remplacements: { id: number; titre: string; sous: string; debut: string }[];
};

const RECENT = 30;
const ANNONCES = 90;
const SANS_VISITE = 14;

// Le début du texte, sur une ligne, 80 caractères au plus.
function titre(texte: string): string {
	const ligne = texte.replace(/\s+/g, ' ').trim();
	return ligne.length <= 80 ? ligne : `${ligne.slice(0, 79)}…`;
}

// Deux requêtes : les murs de l'acteur, puis un bloc de lectures filtrées ici selon ses murs.
// Annonces (90 derniers jours), événements et sondages : seulement les murs dont il est membre (pas ceux qu'il supervise), hors lecture seule.
export async function aNePasManquer(base: Base, acteur: Acteur, aujourdhui: string, maintenant: string): Promise<ANePasManquer> {
	exigerDate(aujourdhui);
	exigerDateHeure(maintenant, 'Date');
	const { murs, appartenances } = await mursEtAppartenances(base, acteur, aujourdhui);
	if (murs.length === 0) return { annonces: [], evenements: [], sondages: [], epinglees: [], nouveautes: [], remplacements: [] };

	// Le super administrateur n'a pas de fiche : 0 ne désigne personne.
	const moi = acteur.type === 'personne' ? acteur.id : 0;
	const pasDeMoi = ne(publication.auteur, nomActeur(acteur));
	const recent = gte(publication.creeLe, ajouterJours(aujourdhui, -RECENT));
	// Même règle qu'etatSondage : sans ses deux dates, un sondage est toujours ouvert.
	const m = maintenant.slice(0, 16);
	const ouvert = or(isNull(publication.sondageOuverture), isNull(publication.sondageCloture), and(lte(publication.sondageOuverture, m), gt(publication.sondageCloture, m)));
	// Le début du texte suffit au titre.
	const champs = { id: publication.id, mur: publication.mur, texte: sql<string>`substr(${publication.texte}, 1, 200)`.as('debut_texte') };
	// Murs où l'acteur a quelque chose à faire : membre, et mur ouvert. Quelques clés seulement (centre, vie, son équipe, ses comités).
	const aTraiter = murs.filter((m) => !m.lectureSeule && estMembre(appartenances, m.cle)).map((m) => m.cle);
	const surSesMurs = inArray(publication.mur, aTraiter);

	const [annonces, evenements, sondages, epinglees, nouveautes, remplacements] = await base.batch([
		base
			.select(champs)
			.from(publication)
			.leftJoin(priseConnaissance, and(eq(priseConnaissance.publicationId, publication.id), eq(priseConnaissance.personneId, moi)))
			.where(and(surSesMurs, eq(publication.type, 'annonce'), eq(publication.priseDeConnaissance, 1), pasDeMoi, gte(publication.creeLe, ajouterJours(aujourdhui, -ANNONCES)), isNull(priseConnaissance.publicationId)))
			.orderBy(desc(publication.creeLe), desc(publication.id)),
		base
			.select({ ...champs, auteur: publication.auteur, debut: publication.debut, fin: publication.fin, convoques: publication.convoques, reponse: reponseEvenement.reponse })
			.from(publication)
			.leftJoin(reponseEvenement, and(eq(reponseEvenement.publicationId, publication.id), eq(reponseEvenement.personneId, moi)))
			.where(and(surSesMurs, or(gt(publication.debut, debutMinimumEvenement(maintenant)), gt(publication.fin, m)), isNull(publication.annuleeLe)))
			.orderBy(asc(publication.debut), asc(publication.id)),
		base
			.select({ ...champs, auteur: publication.auteur, debut: publication.debut, convoques: publication.convoques })
			.from(publication)
			.leftJoin(voteSondage, and(eq(voteSondage.publicationId, publication.id), eq(voteSondage.personneId, moi)))
			.where(and(surSesMurs, sql`${publication.sondageQuestion} is not null`, ouvert, recent, isNull(voteSondage.publicationId), isNull(publication.annuleeLe)))
			.orderBy(desc(publication.creeLe), desc(publication.id)),
		base
			.select(champs)
			.from(publication)
			.where(and(eq(publication.epinglee, 1), recent))
			.orderBy(desc(publication.creeLe), desc(publication.id)),
		// Sans visite, les 14 derniers jours. Ses propres publications ne comptent pas.
		base
			.select({ mur: publication.mur, nombre: count() })
			.from(publication)
			.leftJoin(visiteMur, and(eq(visiteMur.personneId, moi), eq(visiteMur.mur, publication.mur)))
			.where(and(pasDeMoi, sql`${publication.creeLe} > coalesce(${visiteMur.vueLe}, ${ajouterJours(aujourdhui, -SANS_VISITE)})`))
			.groupBy(publication.mur),
		requetePourMoi(base, moi, maintenant)
	]);

	const parCle = new Map<string, Mur>(murs.map((m) => [m.cle, m]));
	const item = (p: { id: number; mur: string; texte: string }): ItemANePasManquer => ({ id: p.id, cle: p.mur as CleMur, nomMur: parCle.get(p.mur)!.nom, titre: titre(p.texte) });
	const demain = ajouterJours(aujourdhui, 1);

	return {
		annonces: annonces.map(item),
		evenements: evenements
			// La requête ramène aussi une manœuvre courte déjà finie (moins de 3 h) : écartée ici.
			.filter((p) => estConvoque(appartenances, p.mur, JSON.parse(p.convoques ?? '"tous"'), moi, p.auteur) && momentEvenement(p.debut!, maintenant, p.fin) !== 'passe')
			.map((p) => {
				const enCours = momentEvenement(p.debut!, maintenant, p.fin) === 'enCours';
				return { ...item(p), debut: p.debut!, demain: !enCours && p.debut!.slice(0, 10) === demain, enCours, reponse: p.reponse };
			}),
		// Le sondage d'un événement n'attend que ses convoqués.
		// Pas de sondage là où l'on ne peut pas voter (mur ouvert en lecture seulement).
		sondages: sondages.filter((p) => parCle.get(p.mur)?.peutReagir && (p.debut === null || estConvoque(appartenances, p.mur, JSON.parse(p.convoques ?? '"tous"'), moi, p.auteur))).map(item),
		epinglees: epinglees.filter((p) => parCle.has(p.mur)).map(item),
		remplacements: remplacements.map((r) => ({
			id: r.id,
			titre: r.genre === 'remplacement' ? `${r.prenom} ${r.nom} cherche un remplaçant` : `${r.prenom} ${r.nom} propose un échange`,
			sous: r.genre === 'manoeuvre' ? 'Échange de manœuvre' : texteDemande(JSON.parse(r.periodes)),
			debut: r.debut
		})),
		nouveautes: murs.flatMap((m) => {
			const nombre = nouveautes.find((n) => n.mur === m.cle)?.nombre ?? 0;
			return nombre > 0 ? [{ cle: m.cle, nom: m.nom, nombre }] : [];
		})
	};
}

// Date de naissance inscrite et affichage activé. Né un 29 février : fêté le 28 février les années non bissextiles.
const sonJour = (aujourdhui: string) => and(inArray(sql`substr(${personne.naissance}, 6, 5)`, joursFetes(aujourdhui)), eq(personne.anniversaireVisible, 1));
// Agents ni partis, ni suspendus, ni extérieurs (requête jointe à `profil`).
const presents = () => and(inArray(personne.statut, [...STATUTS_AVEC_ACCES]), or(isNull(profil.typePersonne), ne(profil.typePersonne, 'exterieur')));
// Qui le centre fête aujourd'hui (requête jointe à `profil`).
export const fetesDuJour = (aujourdhui: string) => and(sonJour(aujourdhui), presents());

// L'ancienneté (décision 0047) : les années de service atteintes à la date `jour`, comptées sur l'année de l'engagement SPV.
export const anneesDeService = (jour: string) => sql<number>`(cast(substr(${jour}, 1, 4) as integer) - cast(substr(${personne.engagementSpv}, 1, 4) as integer))`;
// Les paliers du centre, lus dans la même requête ; sans réglage, ceux par défaut.
const paliersDuCentre = sql`(select value from json_each(coalesce((select ${reglageAnciennete.paliers} from ${reglageAnciennete} where ${reglageAnciennete.id} = 1), ${JSON.stringify(PALIERS_PAR_DEFAUT)})))`;
// Le jour anniversaire de l'engagement tombe sur un palier (engagé un 29 février : le 28 les années non bissextiles). Requête jointe à `profil`.
export const palierDuJour = (jour: string) => and(inArray(sql`substr(${personne.engagementSpv}, 6, 5)`, joursFetes(jour)), sql`${anneesDeService(jour)} in ${paliersDuCentre}`, presents());

// `geste` : ce que la personne peut faire pour chacun ; rien pour elle-même ni pour le super administrateur (décision 0033). Jamais l'âge.
export type AnniversaireDuJour = { id: number; prenom: string; nom: string; geste: 'souhaiter' | 'souhaite' | null };
// Un palier d'ancienneté du jour, et le geste « Féliciter » (décision 0047).
export type PalierDuJour = { id: number; prenom: string; nom: string; annees: number; geste: 'feliciter' | 'felicite' | null };
export type FetesDuJour = { anniversaires: AnniversaireDuJour[]; paliers: PalierDuJour[] };

// Les anniversaires et les paliers du jour, en une requête : une ligne par personne fêtée.
export async function fetesDuJourAuCentre(base: Base, acteur: Acteur, aujourdhui: string): Promise<FetesDuJour> {
	const moi = acteur.type === 'personne' ? acteur.id : null;
	const souhaite = sql<number>`exists (select 1 from ${souhaitAnniversaire} where ${souhaitAnniversaire.personneId} = ${personne.id} and ${souhaitAnniversaire.jour} = ${aujourdhui} and ${souhaitAnniversaire.auteurId} = ${moi ?? 0})`;
	const felicite = sql<number>`exists (select 1 from ${avisAnciennete} where ${avisAnciennete.personneId} = ${personne.id} and ${avisAnciennete.jour} = ${aujourdhui} and ${avisAnciennete.auteurId} = ${moi ?? 0})`;
	const lignes = await base
		.select({
			id: personne.id,
			prenom: personne.prenom,
			nom: personne.nom,
			anniversaire: sql<number>`case when ${fetesDuJour(aujourdhui)} then 1 else 0 end`.as('anniversaire'),
			annees: sql<number | null>`case when ${palierDuJour(aujourdhui)} then ${anneesDeService(aujourdhui)} end`.as('annees'),
			souhaite: souhaite.as('souhaite'),
			felicite: felicite.as('felicite')
		})
		.from(personne)
		.leftJoin(profil, eq(profil.id, personne.profilId))
		.where(or(fetesDuJour(aujourdhui), palierDuJour(aujourdhui)))
		.orderBy(asc(personne.nom), asc(personne.prenom));
	const pourAutrui = (id: number) => moi !== null && id !== moi;
	return {
		anniversaires: lignes.filter((l) => l.anniversaire === 1).map(({ id, prenom, nom, souhaite }) => ({ id, prenom, nom, geste: pourAutrui(id) ? (souhaite ? 'souhaite' : 'souhaiter') : null })),
		paliers: lignes.flatMap(({ id, prenom, nom, annees, felicite }) => (annees === null ? [] : [{ id, prenom, nom, annees, geste: pourAutrui(id) ? (felicite ? 'felicite' : 'feliciter') : null }]))
	};
}

export async function anniversairesDuJour(base: Base, acteur: Acteur, aujourdhui: string): Promise<AnniversaireDuJour[]> {
	return (await fetesDuJourAuCentre(base, acteur, aujourdhui)).anniversaires;
}

export type FetesPourMoi = {
	// Son anniversaire, et qui le lui a souhaité.
	anniversaire: { souhaitePar: { prenom: string; nom: string }[] } | null;
	// Son palier d'ancienneté du jour, et qui l'a félicité.
	monPalier: { annees: number; feliciteePar: { prenom: string; nom: string }[] } | null;
	// Les paliers des collègues, à féliciter.
	paliers: PalierDuJour[];
};

// L'accueil : l'anniversaire de l'agent connecté (date inscrite et affichage activé), son palier, et ceux de ses collègues. Une requête (un batch).
export async function fetesPourMoi(base: Base, acteur: Acteur, aujourdhui: string): Promise<FetesPourMoi> {
	exigerDate(aujourdhui);
	if (acteur.type !== 'personne') return { anniversaire: null, monPalier: null, paliers: [] };
	const auteur = alias(personne, 'auteur');
	const felicite = sql<number>`exists (select 1 from ${avisAnciennete} where ${avisAnciennete.personneId} = ${personne.id} and ${avisAnciennete.jour} = ${aujourdhui} and ${avisAnciennete.auteurId} = ${acteur.id})`;
	const [fete, souhaits, paliers, felicitations] = await base.batch([
		base
			.select({ id: personne.id })
			.from(personne)
			.where(and(eq(personne.id, acteur.id), sonJour(aujourdhui))),
		base
			.select({ prenom: auteur.prenom, nom: auteur.nom })
			.from(souhaitAnniversaire)
			.innerJoin(auteur, eq(auteur.id, souhaitAnniversaire.auteurId))
			.where(and(eq(souhaitAnniversaire.personneId, acteur.id), eq(souhaitAnniversaire.jour, aujourdhui)))
			.orderBy(asc(souhaitAnniversaire.creeLe), asc(souhaitAnniversaire.id)),
		base
			.select({ id: personne.id, prenom: personne.prenom, nom: personne.nom, annees: anneesDeService(aujourdhui).as('annees'), felicite: felicite.as('felicite') })
			.from(personne)
			.leftJoin(profil, eq(profil.id, personne.profilId))
			.where(palierDuJour(aujourdhui))
			.orderBy(asc(personne.nom), asc(personne.prenom)),
		base
			.select({ prenom: auteur.prenom, nom: auteur.nom })
			.from(avisAnciennete)
			.innerJoin(auteur, eq(auteur.id, avisAnciennete.auteurId))
			.where(and(eq(avisAnciennete.personneId, acteur.id), eq(avisAnciennete.agentId, acteur.id), eq(avisAnciennete.jour, aujourdhui)))
			.orderBy(asc(avisAnciennete.creeLe), asc(avisAnciennete.id))
	]);
	const mien = paliers.find((p) => p.id === acteur.id);
	return {
		anniversaire: fete.length === 0 ? null : { souhaitePar: souhaits },
		monPalier: mien ? { annees: mien.annees, feliciteePar: felicitations } : null,
		paliers: paliers.filter((p) => p.id !== acteur.id).map(({ felicite, ...p }) => ({ ...p, geste: felicite ? 'felicite' : 'feliciter' }))
	};
}

// L'agent connecté fête-t-il son anniversaire aujourd'hui ? Si oui, les collègues qui le lui ont souhaité. Une requête.
export async function monAnniversaire(base: Base, acteur: Acteur, aujourdhui: string): Promise<{ souhaitePar: { prenom: string; nom: string }[] } | null> {
	return (await fetesPourMoi(base, acteur, aujourdhui)).anniversaire;
}

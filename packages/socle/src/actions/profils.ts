import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { texte } from '../commun.ts';
import { exigerDate } from '../dates.ts';
import type { Acteur } from '../droits.ts';
import { DonneeInvalide, RefusDroit } from '../erreurs.ts';
import { ligneJournal } from '../journal.ts';
import { estDroitPouvoir, TYPES_PERSONNE, type Droit, type TypePersonne } from '../listes.ts';
import { estCleOuvrable, lireMursOuverts, NIVEAUX_OUVERTS, type NiveauOuvert } from '../murs.ts';
import { comite, personne, profil, profilDroit } from '../schema.ts';
import { nomActeur } from './personnes.ts';
import { exigerDroits, geresLePouvoir } from './responsabilites.ts';

// Les droits d'un profil, comme ceux du pouvoir, sont l'affaire du chef de centre, de l'adjoint et du super administrateur.
async function exiger(base: Base, acteur: Acteur, aujourdhui: string) {
	exigerDate(aujourdhui);
	if (!(await geresLePouvoir(base, acteur, aujourdhui))) throw new RefusDroit('GERER_ACCES', { type: 'centre' });
}

// Seuls les droits sur le centre : les autres périmètres (salon…) ne se règlent pas ici.
const surLeCentre = (id: number) => and(eq(profilDroit.profilId, id), eq(profilDroit.perimetreType, 'centre'));

export async function listerProfils(base: Base, acteur: Acteur, aujourdhui: string) {
	await exiger(base, acteur, aujourdhui);
	// Le nombre de personnes qui ont chaque profil, dans la même lecture.
	const profils = await base
		.select({ id: profil.id, nom: profil.nom, typePersonne: profil.typePersonne, mursOuverts: profil.mursOuverts, personnes: sql<number>`(select count(*) from personne p where p.profil_id = "profil"."id")` })
		.from(profil)
		.orderBy(profil.id);
	const droits = await base.select({ profilId: profilDroit.profilId, droit: profilDroit.droit }).from(profilDroit).where(eq(profilDroit.perimetreType, 'centre'));
	const depart = profils.find((p) => p.typePersonne === 'agent')?.id;
	return profils.map((p) => ({
		id: p.id,
		nom: p.nom,
		typePersonne: p.typePersonne,
		personnes: p.personnes,
		// Le premier profil des agents, celui de départ, ne se supprime jamais.
		depart: p.id === depart,
		mursOuverts: p.typePersonne === 'exterieur' ? lireMursOuverts(p.mursOuverts) : {},
		droits: [...new Set(droits.filter((d) => d.profilId === p.id).map((d) => d.droit))].sort()
	}));
}

export async function modifierDroitsProfil(base: Base, acteur: Acteur, profilId: number, droits: Droit[], aujourdhui: string): Promise<void> {
	await exiger(base, acteur, aujourdhui);
	const apres = exigerDroits(droits);
	if (apres.some(estDroitPouvoir)) throw new DonneeInvalide('Un profil ne donne pas de droit de pouvoir');
	const [ligne] = await base.select({ id: profil.id }).from(profil).where(eq(profil.id, profilId));
	if (!ligne) throw new DonneeInvalide('Profil inconnu');

	const avant = [...new Set((await base.select({ droit: profilDroit.droit }).from(profilDroit).where(surLeCentre(profilId))).map((l) => l.droit))];
	const ajoutes = apres.filter((d) => !avant.includes(d));
	const retires = avant.filter((d) => !apres.includes(d));
	if (ajoutes.length === 0 && retires.length === 0) return;

	await base.batch([
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'modifier_droits_profil', cibleType: 'profil', cibleId: profilId, details: { droits: { avant: [...avant].sort(), apres: [...apres].sort() } } }, aujourdhui),
		...(retires.length > 0 ? [base.delete(profilDroit).where(and(surLeCentre(profilId), inArray(profilDroit.droit, retires)))] : []),
		...(ajoutes.length > 0 ? [base.insert(profilDroit).values(ajoutes.map((droit) => ({ profilId, droit, perimetreType: 'centre' as const, perimetreId: null })))] : [])
	]);
}

async function exigerNomLibre(base: Base, nom: string, sauf?: number) {
	const autres = await base.select({ id: profil.id, nom: profil.nom }).from(profil);
	if (autres.some((p) => p.id !== sauf && p.nom.trim().toLowerCase() === nom.toLowerCase())) throw new DonneeInvalide('Nom déjà utilisé');
}

async function profilConnu(base: Base, id: number) {
	const [ligne] = await base.select().from(profil).where(eq(profil.id, id));
	if (!ligne) throw new DonneeInvalide('Profil inconnu');
	return ligne;
}

// Un profil vide : ses droits et, pour un extérieur, ses murs ouverts se règlent ensuite.
export async function creerProfil(base: Base, acteur: Acteur, donnees: { nom: string; typePersonne: TypePersonne }, aujourdhui: string): Promise<number> {
	await exiger(base, acteur, aujourdhui);
	const nom = texte(donnees.nom, 'Nom', 60);
	if (!(TYPES_PERSONNE as readonly string[]).includes(donnees.typePersonne)) throw new DonneeInvalide('Type inconnu');
	await exigerNomLibre(base, nom);
	const [lignes] = await base.batch([
		base.insert(profil).values({ nom, typePersonne: donnees.typePersonne }).returning({ id: profil.id }),
		// Juste après l'insertion, last_insert_rowid() est l'id du profil.
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'creer_profil', cibleType: 'profil', cibleId: sql`last_insert_rowid()`, details: { nom, typePersonne: donnees.typePersonne } }, aujourdhui)
	]);
	return lignes[0]!.id;
}

export async function renommerProfil(base: Base, acteur: Acteur, id: number, nouveau: string, aujourdhui: string): Promise<void> {
	await exiger(base, acteur, aujourdhui);
	const ligne = await profilConnu(base, id);
	const nom = texte(nouveau, 'Nom', 60);
	await exigerNomLibre(base, nom, id);
	if (nom === ligne.nom) return;
	await base.batch([
		base.update(profil).set({ nom }).where(eq(profil.id, id)),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'renommer_profil', cibleType: 'profil', cibleId: id, details: { nom: { avant: ligne.nom, apres: nom } } }, aujourdhui)
	]);
}

// Seulement si personne ne l'a. Le premier profil des agents, celui de départ, reste toujours.
export async function supprimerProfil(base: Base, acteur: Acteur, id: number, aujourdhui: string): Promise<void> {
	await exiger(base, acteur, aujourdhui);
	const ligne = await profilConnu(base, id);
	const [[depart], [porteurs]] = await base.batch([
		base.select({ id: profil.id }).from(profil).where(eq(profil.typePersonne, 'agent')).orderBy(asc(profil.id)).limit(1),
		base.select({ n: count() }).from(personne).where(eq(personne.profilId, id))
	]);
	if (depart?.id === id) throw new DonneeInvalide('Le profil des agents ne se supprime pas');
	if ((porteurs?.n ?? 0) > 0) throw new DonneeInvalide('Ce profil est encore attribué');
	await base.batch([
		base.delete(profilDroit).where(eq(profilDroit.profilId, id)),
		base.delete(profil).where(eq(profil.id, id)),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'supprimer_profil', cibleType: 'profil', cibleId: id, details: { nom: ligne.nom } }, aujourdhui)
	]);
}

// Les murs ouverts à un profil extérieur : Le centre, Vie du centre, des comités en cours ; chacun en lecture ou en écriture.
// Un mur absent n'est pas ouvert.
export async function modifierMursOuverts(base: Base, acteur: Acteur, id: number, ouverts: Record<string, NiveauOuvert>, aujourdhui: string): Promise<void> {
	await exiger(base, acteur, aujourdhui);
	const ligne = await profilConnu(base, id);
	if (ligne.typePersonne !== 'exterieur') throw new DonneeInvalide('Seul un profil extérieur reçoit des murs ouverts');
	const enCours = new Set((await base.select({ id: comite.id }).from(comite).where(isNull(comite.dissousLe))).map((c) => `comite:${c.id}`));
	const apres: Record<string, NiveauOuvert> = {};
	for (const [cle, niveau] of Object.entries(ouverts)) {
		if (!estCleOuvrable(cle) || (cle.startsWith('comite:') && !enCours.has(cle))) throw new DonneeInvalide('Mur inconnu');
		if (!(NIVEAUX_OUVERTS as readonly string[]).includes(niveau)) throw new DonneeInvalide('Niveau inconnu');
		apres[cle] = niveau;
	}
	const avant = lireMursOuverts(ligne.mursOuverts);
	const pareil = (a: Record<string, string>, b: Record<string, string>) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);
	if (pareil(avant, apres)) return;
	await base.batch([
		base.update(profil).set({ mursOuverts: JSON.stringify(apres) }).where(eq(profil.id, id)),
		ligneJournal(base, { acteur: nomActeur(acteur), action: 'modifier_murs_ouverts', cibleType: 'profil', cibleId: id, details: { murs: { avant, apres } } }, aujourdhui)
	]);
}

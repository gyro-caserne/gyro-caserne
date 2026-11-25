import { readdirSync, readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { dissoudreComite } from '../src/actions/comites.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { appartenances, audiences, estConvoque, estMembre, exigerMur, lireMursOuverts, mursDe, type Mur } from '../src/murs.ts';
import { affectationEquipe, attribution, comite, equipe, personne, photoPublication, profil, publication, responsabilite } from '../src/schema.ts';
import { photo as photoOctets } from '../src/schema-photos.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-28';
const hier = '2026-10-27';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const acteur = (id: number): Acteur => ({ type: 'personne', id });

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = await base.select().from(profil);
	const responsabilites = await base.select().from(responsabilite);
	const role = (nom: string) => responsabilites.find((r) => r.nom === nom)!.id;
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
	const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);

	const nouvelle = async (prenom: string, options: { exterieur?: boolean; sansProfil?: boolean; statut?: 'parti' | 'suspendu' } = {}) => {
		const [p] = await base
			.insert(personne)
			.values({
				email: `${prenom.toLowerCase()}@exemple.fr`,
				prenom,
				nom: 'Test',
				profilId: options.sansProfil ? null : profils.find((x) => x.typePersonne === (options.exterieur ? 'exterieur' : 'agent'))!.id,
				statut: options.statut ?? 'operationnel'
			})
			.returning();
		return p!.id;
	};
	const nommer = async (personneId: number, nom: string, perimetre: { type: 'centre' | 'equipe' | 'comite'; id?: number }, fin: string | null = null) => {
		await base.insert(attribution).values({
			personneId,
			responsabiliteId: role(nom),
			perimetreType: perimetre.type,
			perimetreId: perimetre.id ?? null,
			debut: '2026-01-01',
			fin,
			saisiePar: 'super:a@b.fr',
			saisieLe: '2026-01-01'
		});
	};
	const affecter = async (personneId: number, equipeId: number, fin: string | null = null, debut = '2026-01-01') => {
		await base.insert(affectationEquipe).values({ personneId, equipeId, debut, fin });
	};
	return { base, nouvelle, nommer, affecter, amicale: amicale!, e1: equipes[0]!, e2: equipes[1]! };
}

const resume = (murs: Mur[]) => murs.map((m) => `${m.cle} ${m.peutPublier ? 'P' : '-'}${m.peutModerer ? 'M' : '-'}${m.lectureSeule ? 'L' : '-'}`);

describe('les murs, lus une fois par requête', () => {
	it('relus sans requête dans la même requête ; une écriture les fait relire', async () => {
		const { base, nouvelle, affecter, e1, e2 } = await jeu();
		const id = await nouvelle('Alice');
		await affecter(id, e1.id);
		const alice: Acteur = { type: 'personne', id };
		const avant = base.requetes;
		const premiers = await mursDe(base, alice, '2026-10-28');
		await mursDe(base, alice, '2026-10-28');
		await exigerMur(base, alice, `equipe:${e1.id}`, '2026-10-28', 'lire');
		expect(base.requetes - avant).toBe(1);
		// Un autre jour, une autre personne : relus.
		await mursDe(base, alice, '2026-10-29');
		expect(base.requetes - avant).toBe(2);
		await affecter(id, e2.id);
		expect(resume(await mursDe(base, alice, '2026-10-28'))).not.toEqual(resume(premiers));
	});
});

describe('mursDe', () => {
	it('agent sans équipe ni comité : lit « Le centre », lit et publie dans « Vie du centre »', async () => {
		const { base, nouvelle } = await jeu();
		const id = await nouvelle('David');
		const murs = await mursDe(base, acteur(id), aujourdhui);
		expect(murs).toEqual([
			{ cle: 'centre', nom: 'Le centre', type: 'centre', peutPublier: false, peutReagir: true, peutModerer: false, lectureSeule: false },
			{ cle: 'vie', nom: 'Vie du centre', type: 'vie', peutPublier: true, peutReagir: true, peutModerer: false, lectureSeule: false }
		]);
	});

	it('membre d’une équipe : son mur d’équipe, publier sans modérer', async () => {
		const { base, nouvelle, affecter, e1 } = await jeu();
		const id = await nouvelle('David');
		await affecter(id, e1.id);
		const murs = await mursDe(base, acteur(id), aujourdhui);
		expect(murs[2]).toEqual({ cle: `equipe:${e1.id}`, nom: e1.nom, type: 'equipe', peutPublier: true, peutReagir: true, peutModerer: false, lectureSeule: false });
		expect(murs).toHaveLength(3);
	});

	it('affectation terminée hier : plus d’accès au mur de l’équipe', async () => {
		const { base, nouvelle, affecter, e1 } = await jeu();
		const id = await nouvelle('David');
		await affecter(id, e1.id, hier);
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--']);
		await expect(exigerMur(base, acteur(id), `equipe:${e1.id}`, aujourdhui, 'lire')).rejects.toBeInstanceOf(RefusDroit);
	});

	it('chef de garde : lit, publie et modère le mur de son équipe, même sans y être affecté', async () => {
		const { base, nouvelle, nommer, e2 } = await jeu();
		const id = await nouvelle('Alice');
		await nommer(id, 'Chef de garde', { type: 'equipe', id: e2.id });
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--', `equipe:${e2.id} PM-`]);
	});

	it('membre et rapporteur de comité : publier pour le membre, modérer pour le rapporteur', async () => {
		const { base, nouvelle, nommer, amicale } = await jeu();
		const membre = await nouvelle('Bruno');
		const rapporteur = await nouvelle('Chloé');
		await nommer(membre, 'Membre de comité', { type: 'comite', id: amicale.id });
		await nommer(rapporteur, 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		expect((await mursDe(base, acteur(membre), aujourdhui))[2]).toEqual({ cle: `comite:${amicale.id}`, nom: 'Amicale', type: 'comite', peutPublier: true, peutReagir: true, peutModerer: false, lectureSeule: false });
		expect(resume(await mursDe(base, acteur(rapporteur), aujourdhui))[2]).toBe(`comite:${amicale.id} PM-`);
	});

	it('attribution de comité terminée hier : plus d’accès', async () => {
		const { base, nouvelle, nommer, amicale } = await jeu();
		const id = await nouvelle('Bruno');
		await nommer(id, 'Membre de comité', { type: 'comite', id: amicale.id }, hier);
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--']);
	});

	it('chef de centre et adjoint : tous les murs, publier et modérer partout', async () => {
		const { base, nouvelle, nommer } = await jeu();
		const chef = await nouvelle('Claire');
		const adjoint = await nouvelle('Hugo');
		await nommer(chef, 'Chef de centre', { type: 'centre' });
		await nommer(adjoint, 'Chef de centre adjoint', { type: 'centre' });
		const equipes = await base.select().from(equipe).orderBy(equipe.ordreRotation);
		const comites = await base.select().from(comite).orderBy(comite.nom);
		const attendu = ['centre PM-', 'vie PM-', ...equipes.map((e) => `equipe:${e.id} PM-`), ...comites.map((c) => `comite:${c.id} PM-`)];
		for (const id of [chef, adjoint]) expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(attendu);
	});

	it('super administrateur : tous les murs ; équipe inactive et comité dissous en lecture seule, à la fin', async () => {
		const { base, amicale, e1 } = await jeu();
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		await dissoudreComite(base, superAdmin, amicale.id, aujourdhui);
		const murs = resume(await mursDe(base, superAdmin, aujourdhui));
		expect(murs.slice(0, 2)).toEqual(['centre PM-', 'vie PM-']);
		expect(murs.filter((m) => m.endsWith('L'))).toEqual([`equipe:${e1.id} -ML`, `comite:${amicale.id} -ML`]);
		const derniereEquipeActive = murs.findLastIndex((m) => m.startsWith('equipe:') && !m.endsWith('L'));
		expect(murs.indexOf(`equipe:${e1.id} -ML`)).toBeGreaterThan(derniereEquipeActive);
		expect(murs.at(-1)).toBe(`comite:${amicale.id} -ML`);
	});

	it('membre d’une équipe inactive : lecture seule, publier refusé', async () => {
		const { base, nouvelle, affecter, e1 } = await jeu();
		const id = await nouvelle('David');
		await affecter(id, e1.id);
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--', `equipe:${e1.id} --L`]);
		expect((await exigerMur(base, acteur(id), `equipe:${e1.id}`, aujourdhui, 'lire')).nom).toBe(e1.nom);
		await expect(exigerMur(base, acteur(id), `equipe:${e1.id}`, aujourdhui, 'publier')).rejects.toBeInstanceOf(RefusDroit);
	});

	it('chef d’une équipe inactive : lit et modère, ne publie pas', async () => {
		const { base, nouvelle, nommer, e1 } = await jeu();
		const id = await nouvelle('Alice');
		await nommer(id, 'Chef de garde', { type: 'equipe', id: e1.id });
		await base.update(equipe).set({ active: 0 }).where(eq(equipe.id, e1.id));
		expect(resume(await mursDe(base, acteur(id), aujourdhui))[2]).toBe(`equipe:${e1.id} -ML`);
		expect((await exigerMur(base, acteur(id), `equipe:${e1.id}`, aujourdhui, 'moderer')).peutModerer).toBe(true);
		await expect(exigerMur(base, acteur(id), `equipe:${e1.id}`, aujourdhui, 'publier')).rejects.toBeInstanceOf(RefusDroit);
	});

	it('comité dissous : archive en lecture seule pour le chef, l’adjoint et le super ; les anciens membres et rapporteur n’y ont plus accès', async () => {
		const { base, nouvelle, nommer, amicale } = await jeu();
		const membre = await nouvelle('Bruno');
		const rapporteur = await nouvelle('Chloé');
		const chef = await nouvelle('Claire');
		const adjoint = await nouvelle('Hugo');
		await nommer(membre, 'Membre de comité', { type: 'comite', id: amicale.id });
		await nommer(rapporteur, 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		await nommer(chef, 'Chef de centre', { type: 'centre' });
		await nommer(adjoint, 'Chef de centre adjoint', { type: 'centre' });
		await dissoudreComite(base, superAdmin, amicale.id, aujourdhui);
		const cle = `comite:${amicale.id}`;
		for (const id of [membre, rapporteur]) {
			expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--']);
			await expect(exigerMur(base, acteur(id), cle, aujourdhui, 'lire')).rejects.toBeInstanceOf(RefusDroit);
		}
		for (const qui of [acteur(chef), acteur(adjoint), superAdmin]) {
			expect(await exigerMur(base, qui, cle, aujourdhui, 'moderer')).toMatchObject({ lectureSeule: true, peutPublier: false, peutModerer: true });
			await expect(exigerMur(base, qui, cle, aujourdhui, 'publier')).rejects.toBeInstanceOf(RefusDroit);
		}
	});

	it('comité dissous, attribution restée ouverte : pas d’accès pour le membre', async () => {
		const { base, nouvelle, nommer, amicale } = await jeu();
		const id = await nouvelle('Bruno');
		await nommer(id, 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		await base.update(comite).set({ dissousLe: '2026-10-01' }).where(eq(comite.id, amicale.id));
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--']);
	});

	it('bornes : affectation finie aujourd’hui garde l’accès, affectation qui commence demain n’en donne pas', async () => {
		const { base, nouvelle, affecter, e1, e2 } = await jeu();
		const id = await nouvelle('David');
		await affecter(id, e1.id, aujourdhui);
		await affecter(id, e2.id, null, '2026-10-29');
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--', `equipe:${e1.id} P--`]);
	});

	it('personne sans profil : comptée comme agent', async () => {
		const { base, nouvelle } = await jeu();
		const id = await nouvelle('Nina', { sansProfil: true });
		expect(resume(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre ---', 'vie P--']);
	});

	it('extérieur, parti, suspendu : aucun mur', async () => {
		const { base, nouvelle, nommer, affecter, amicale, e1 } = await jeu();
		const exterieur = await nouvelle('Eva', { exterieur: true });
		const parti = await nouvelle('Paul', { statut: 'parti' });
		const suspendu = await nouvelle('Sam', { statut: 'suspendu' });
		for (const id of [exterieur, parti, suspendu]) {
			await affecter(id, e1.id);
			await nommer(id, 'Membre de comité', { type: 'comite', id: amicale.id });
		}
		await nommer(suspendu, 'Chef de centre', { type: 'centre' });
		for (const id of [exterieur, parti, suspendu]) {
			expect(await mursDe(base, acteur(id), aujourdhui)).toEqual([]);
			await expect(exigerMur(base, acteur(id), 'centre', aujourdhui, 'lire')).rejects.toBeInstanceOf(RefusDroit);
		}
	});

	it('chef de centre : au plus 10 requêtes', async () => {
		const { base, nouvelle, nommer } = await jeu();
		const chef = await nouvelle('Claire');
		await nommer(chef, 'Chef de centre', { type: 'centre' });
		base.requetes = 0;
		await mursDe(base, acteur(chef), aujourdhui);
		expect(base.requetes).toBeLessThanOrEqual(10);
	});
});

describe('membres naturels et convoqués (règle partagée avec le suivi)', () => {
	const tenue = (type: string, perimetreId: number | null, systeme: string | null = null, nomme: string | null = null) => ({ type, portee: type, perimetreId, systeme, nomme });
	it('centre et vie : tout agent ; équipe : membres en cours et chef ; comité : membres ; jamais le chef de centre qui supervise', () => {
		const membre = appartenances([{ equipeId: 1, debut: '2026-01-01', fin: null }, { equipeId: 2, debut: '2026-01-01', fin: hier }], [tenue('comite', 7)], aujourdhui);
		expect(['centre', 'vie', 'equipe:1', 'equipe:2', 'comite:7', 'comite:8'].map((c) => estMembre(membre, c))).toEqual([true, true, true, false, true, false]);
		const chefEquipe = appartenances([], [tenue('equipe', 2, 'chef_equipe')], aujourdhui);
		expect(estMembre(chefEquipe, 'equipe:2')).toBe(true);
		expect(estConvoque(chefEquipe, 'centre', [2], 5, 'personne:1')).toBe(true);
		expect(estConvoque(chefEquipe, 'centre', [1], 5, 'personne:1')).toBe(false);
		// Échange de manœuvre : retiré de son équipe, ou ajouté à une autre.
		expect(estConvoque(chefEquipe, 'centre', { equipes: [2], ajoutes: [], retires: [5] }, 5, 'personne:1')).toBe(false);
		expect(estConvoque(chefEquipe, 'centre', { equipes: [1], ajoutes: [5], retires: [] }, 5, 'personne:1')).toBe(true);
		const chef = appartenances([], [tenue('centre', null, 'chef_centre')], aujourdhui);
		expect(chef.tous).toBe(true);
		expect(['centre', 'equipe:1', 'comite:7'].map((c) => estMembre(chef, c))).toEqual([true, false, false]);
		expect(estConvoque(chef, 'comite:7', 'tous', 6, 'personne:1')).toBe(false);
		// Une tenue hors de la portée de sa responsabilité ne compte pas.
		expect(estMembre(appartenances([], [{ ...tenue('comite', 7), portee: 'centre' }], aujourdhui), 'comite:7')).toBe(false);
	});
});

describe('audiences', () => {
	it('compte les membres naturels de chaque mur demandé, en une requête', async () => {
		const { base, nouvelle, nommer, affecter, amicale, e1, e2 } = await jeu();
		const alice = await nouvelle('Alice');
		const bruno = await nouvelle('Bruno');
		const chef = await nouvelle('Claire');
		await nouvelle('Paul', { statut: 'parti' });
		await nouvelle('Ext', { exterieur: true });
		await affecter(alice, e1.id);
		await affecter(bruno, e1.id, hier);
		await nommer(bruno, 'Chef de garde', { type: 'equipe', id: e2.id });
		await nommer(alice, 'Membre de comité', { type: 'comite', id: amicale.id });
		await nommer(chef, 'Chef de centre', { type: 'centre' });
		base.requetes = 0;
		const n = await audiences(base, ['centre', 'vie', `equipe:${e1.id}`, `equipe:${e2.id}`, `comite:${amicale.id}`], aujourdhui);
		expect(base.requetes).toBe(1);
		expect([...n]).toEqual([
			['centre', 3],
			['vie', 3],
			[`equipe:${e1.id}`, 1],
			[`equipe:${e2.id}`, 1],
			[`comite:${amicale.id}`, 1]
		]);
	});
});

describe('exigerMur', () => {
	it('rend le mur selon le besoin, refuse sinon', async () => {
		const { base, nouvelle } = await jeu();
		const id = await nouvelle('David');
		expect((await exigerMur(base, acteur(id), 'centre', aujourdhui, 'lire')).nom).toBe('Le centre');
		await expect(exigerMur(base, acteur(id), 'centre', aujourdhui, 'publier')).rejects.toBeInstanceOf(RefusDroit);
		expect((await exigerMur(base, acteur(id), 'vie', aujourdhui, 'publier')).cle).toBe('vie');
		await expect(exigerMur(base, acteur(id), 'vie', aujourdhui, 'moderer')).rejects.toBeInstanceOf(RefusDroit);
		expect((await exigerMur(base, superAdmin, 'vie', aujourdhui, 'moderer')).peutModerer).toBe(true);
	});

	it('clé mal formée : « Mur inconnu »', async () => {
		const { base } = await jeu();
		for (const cle of ['equipe:abc', 'equipe:', 'salon', 'comite:01', 'equipe:1:2', 'equipe:007', 'equipe:1.5', 'comite:-1']) {
			await expect(exigerMur(base, superAdmin, cle, aujourdhui, 'lire')).rejects.toThrow(new DonneeInvalide('Mur inconnu'));
		}
	});

	it('équipe qui n’existe pas : refusé', async () => {
		const { base } = await jeu();
		await expect(exigerMur(base, superAdmin, 'equipe:999', aujourdhui, 'lire')).rejects.toBeInstanceOf(RefusDroit);
	});
});

describe('tables des murs', () => {
	it('supprimer une publication supprime ses références de photos ; une photo se relit en Uint8Array', async () => {
		const { base } = await jeu();
		const [p] = await base.insert(publication).values({ mur: 'centre', auteur: 'super:a@b.fr', type: 'message', texte: 'Bonjour', creeLe: '2026-10-28T08:00:00Z' }).returning();
		const [octets] = await base.photos.insert(photoOctets).values({ type: 'image/jpeg', donnees: new Uint8Array([1, 2, 3]), taille: 3, creeLe: '2026-10-28T08:00:00Z' }).returning();
		expect(octets!.donnees).toBeInstanceOf(Uint8Array);
		expect([...octets!.donnees]).toEqual([1, 2, 3]);
		await base.insert(photoPublication).values({ publicationId: p!.id, ordre: 1, type: 'image/jpeg', photoId: octets!.id });
		await base.delete(publication).where(eq(publication.id, p!.id));
		expect(await base.select().from(photoPublication)).toEqual([]);
	});

	it('migration des murs : seulement des CREATE TABLE et CREATE INDEX', () => {
		const dossier = new URL('../migrations/', import.meta.url);
		const fichier = readdirSync(dossier).find((f) => f.startsWith('0003_') && f.endsWith('.sql'));
		expect(fichier).toBeDefined();
		const instructions = readFileSync(new URL(fichier!, dossier), 'utf8')
			.split('--> statement-breakpoint')
			.map((i) => i.replace(/^\s*--.*$/gm, '').trim())
			.filter(Boolean);
		expect(instructions.length).toBeGreaterThan(0);
		expect(instructions.every((i) => /^CREATE (UNIQUE )?(TABLE|INDEX) /.test(i))).toBe(true);
	});
});

describe('murs ouverts à un profil', () => {
	// P : publier, R : réagir (commenter, aimer, voter, répondre), M : modérer, L : lecture seule.
	const etat = (murs: Mur[]) => murs.map((m) => `${m.cle} ${m.peutPublier ? 'P' : '-'}${m.peutReagir ? 'R' : '-'}${m.peutModerer ? 'M' : '-'}${m.lectureSeule ? 'L' : '-'}`);

	type Jeu = Awaited<ReturnType<typeof jeu>>;
	async function avecRetraite(choix: Record<string, string> | string | ((j: Jeu) => Record<string, string>), statut?: 'parti' | 'suspendu') {
		const j = await jeu();
		const ouverts = typeof choix === 'function' ? choix(j) : choix;
		const [retraite] = await j.base
			.insert(profil)
			.values({ nom: 'Retraité', typePersonne: 'exterieur', mursOuverts: typeof ouverts === 'string' ? ouverts : JSON.stringify(ouverts) })
			.returning();
		const [p] = await j.base.insert(personne).values({ email: 'rene@exemple.fr', prenom: 'René', nom: 'Ancien', profilId: retraite!.id, statut: statut ?? 'operationnel' }).returning();
		return { ...j, retraite: retraite!, rene: p!.id };
	}

	it('lireMursOuverts : tolérant, seules les clés centre, vie et comite:<id> avec un niveau connu', () => {
		expect(lireMursOuverts(null)).toEqual({});
		expect(lireMursOuverts('pas du json')).toEqual({});
		expect(lireMursOuverts('[1,2]')).toEqual({});
		expect(lireMursOuverts('{"vie":"lecture","comite:4":"ecriture","centre":"ecriture","equipe:1":"ecriture","comite:x":"lecture","salon":"lecture","comite:5":"tout"}')).toEqual({ vie: 'lecture', 'comite:4': 'ecriture', centre: 'ecriture' });
	});

	it('lecture et écriture sur Vie du centre et un comité', async () => {
		const { base, rene } = await avecRetraite({ vie: 'lecture' });
		expect(etat(await mursDe(base, acteur(rene), aujourdhui))).toEqual(['vie ----']);
		const autre = await avecRetraite(({ amicale }) => ({ vie: 'ecriture', [`comite:${amicale.id}`]: 'ecriture' }));
		expect(etat(await mursDe(autre.base, acteur(autre.rene), aujourdhui))).toEqual(['vie PR--', `comite:${autre.amicale.id} PR--`]);
		const lecteur = await avecRetraite(({ amicale }) => ({ [`comite:${amicale.id}`]: 'lecture' }));
		expect(etat(await mursDe(lecteur.base, acteur(lecteur.rene), aujourdhui))).toEqual([`comite:${lecteur.amicale.id} ----`]);
		await expect(exigerMur(lecteur.base, acteur(lecteur.rene), `comite:${lecteur.amicale.id}`, aujourdhui, 'publier')).rejects.toBeInstanceOf(RefusDroit);
	});

	it('Le centre en écriture : réagir, jamais publier', async () => {
		const { base, rene } = await avecRetraite({ centre: 'ecriture' });
		expect(etat(await mursDe(base, acteur(rene), aujourdhui))).toEqual(['centre -R--']);
		await expect(exigerMur(base, acteur(rene), 'centre', aujourdhui, 'publier')).rejects.toBeInstanceOf(RefusDroit);
	});

	it('comité dissous ou inconnu : ignoré, sans erreur', async () => {
		const { base, rene, amicale } = await avecRetraite({ vie: 'lecture' });
		await base.update(comite).set({ dissousLe: '2026-10-01' }).where(eq(comite.id, amicale.id));
		await base.update(profil).set({ mursOuverts: JSON.stringify({ 'comite:999': 'ecriture', [`comite:${amicale.id}`]: 'ecriture', vie: 'lecture' }) }).where(eq(profil.nom, 'Retraité'));
		expect(etat(await mursDe(base, acteur(rene), aujourdhui))).toEqual(['vie ----']);
		await expect(exigerMur(base, acteur(rene), `comite:${amicale.id}`, aujourdhui, 'lire')).rejects.toBeInstanceOf(RefusDroit);
	});

	it('parti ou suspendu : aucun mur', async () => {
		for (const statut of ['parti', 'suspendu'] as const) {
			const { base, rene } = await avecRetraite({ vie: 'ecriture', centre: 'lecture' }, statut);
			expect(await mursDe(base, acteur(rene), aujourdhui)).toEqual([]);
		}
	});

	it('les équipes ne s’ouvrent jamais, même écrites à la main ; JSON invalide : aucun mur', async () => {
		const { base, rene, e1 } = await avecRetraite(({ e1 }) => ({ [`equipe:${e1.id}`]: 'ecriture' }));
		expect(await mursDe(base, acteur(rene), aujourdhui)).toEqual([]);
		const casse = await avecRetraite('{oups');
		expect(await mursDe(casse.base, acteur(casse.rene), aujourdhui)).toEqual([]);
	});

	it('jamais de modération ni d’équipe, même avec un rôle de comité ou une affectation déjà en base', async () => {
		const { base, rene, amicale, nommer, affecter, e1 } = await avecRetraite(({ amicale }) => ({ [`comite:${amicale.id}`]: 'ecriture' }));
		await nommer(rene, 'Rapporteur de comité', { type: 'comite', id: amicale.id });
		await nommer(rene, 'Chef de centre', { type: 'centre' });
		await affecter(rene, e1.id);
		expect(etat(await mursDe(base, acteur(rene), aujourdhui))).toEqual([`comite:${amicale.id} PR--`]);
		await expect(exigerMur(base, acteur(rene), `comite:${amicale.id}`, aujourdhui, 'moderer')).rejects.toBeInstanceOf(RefusDroit);
	});

	it('un agent reste inchangé, et réagit partout où il lit, sauf en lecture seule', async () => {
		const { base, nouvelle, retraite } = await avecRetraite({ vie: 'ecriture' });
		const id = await nouvelle('David');
		expect(etat(await mursDe(base, acteur(id), aujourdhui))).toEqual(['centre -R--', 'vie PR--']);
		expect(retraite.typePersonne).toBe('exterieur');
	});

	it('membre et convoqué : lecture membre seulement, écriture convoqué aux événements « tous »', () => {
		const lecteur = appartenances([], [], aujourdhui, { vie: 'lecture', 'comite:7': 'lecture' });
		const ecrivain = appartenances([], [], aujourdhui, { vie: 'ecriture', 'comite:7': 'ecriture' });
		expect(['centre', 'vie', 'comite:7', 'comite:8', 'equipe:1'].map((c) => estMembre(lecteur, c))).toEqual([false, true, true, false, false]);
		expect(estConvoque(lecteur, 'vie', 'tous', 9, 'personne:1')).toBe(false);
		expect(estConvoque(ecrivain, 'vie', 'tous', 9, 'personne:1')).toBe(true);
		expect(estConvoque(ecrivain, 'comite:7', [1], 9, 'personne:1')).toBe(false);
		expect(estConvoque(ecrivain, 'comite:7', { equipes: [1], ajoutes: [9], retires: [] }, 9, 'personne:1')).toBe(false);
		// Un rôle tenu ne compte pas pour un profil ouvert.
		const avecRole = appartenances([{ equipeId: 1, debut: '2026-01-01', fin: null }], [{ type: 'centre', portee: 'centre', perimetreId: null, systeme: 'chef_centre', nomme: null }], aujourdhui, { vie: 'lecture' });
		expect(avecRole.tous).toBe(false);
		expect(estMembre(avecRole, 'equipe:1')).toBe(false);
	});

	it('audiences : comptent les personnes au mur ouvert, en une requête', async () => {
		const { base, nouvelle, amicale } = await avecRetraite(({ amicale }) => ({ vie: 'lecture', [`comite:${amicale.id}`]: 'ecriture' }));
		await nouvelle('David');
		base.requetes = 0;
		const n = await audiences(base, ['centre', 'vie', `comite:${amicale.id}`], aujourdhui);
		expect(base.requetes).toBe(1);
		expect([...n]).toEqual([
			['centre', 1],
			['vie', 2],
			[`comite:${amicale.id}`, 1]
		]);
	});
});

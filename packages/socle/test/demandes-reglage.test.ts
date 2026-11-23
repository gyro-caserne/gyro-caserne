import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { archiverResponsabilite, creerResponsabilite, modifierResponsabilite } from '../src/actions/responsabilites.ts';
import type { Acteur } from '../src/droits.ts';
import { reglerDemandes } from '../src/demandes.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { attribution, demandeReferent, journal, personne, profil, responsabilite, responsabiliteDroit } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const QUAND = '2026-11-23T10:00';
const AUJOURDHUI = '2026-11-23';

// Le jeu de départ, Alice (agente), Paul (référent pharmacie), Claire (cheffe de centre), Tom (référent technique) et le super administrateur.
async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const nouvelle = async (prenom: string) => (await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Fictif', profilId: agent!.id }).returning())[0]!.id;
	const role = async (nom: string) => (await base.select().from(responsabilite).where(eq(responsabilite.nom, nom)))[0]!;
	const nommer = async (personneId: number, nom: string, fin: string | null = null) =>
		base.insert(attribution).values({ personneId, responsabiliteId: (await role(nom)).id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', fin, saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const qui = (id: number): Acteur => ({ type: 'personne', id });
	const ids = { alice: await nouvelle('Alice'), paul: await nouvelle('Paul'), claire: await nouvelle('Claire'), tom: await nouvelle('Tom') };
	await nommer(ids.paul, 'Référent pharmacie');
	await nommer(ids.claire, 'Chef de centre');
	await nommer(ids.tom, 'Référent technique');
	const pharmacie = (await role('Référent pharmacie')).id;
	const lire = async (id = pharmacie) => (await base.select().from(responsabilite).where(eq(responsabilite.id, id)))[0]!.demandes;
	return { base, ids, qui, role, nommer, pharmacie, lire, alice: qui(ids.alice), paul: qui(ids.paul), claire: qui(ids.claire), tom: qui(ids.tom), superAdmin: { type: 'super', email: 'a@b.fr' } as Acteur };
}

describe('régler les demandes d’un rôle', () => {
	it('la cheffe coche « Reçoit des demandes » : des identifiants stables sont donnés aux étapes, la dernière garde son nom ; au journal', async () => {
		const j = await jeu();
		await reglerDemandes(j.base, j.claire, j.pharmacie, { etapes: [{ nom: ' Commandée ' }, { nom: 'Reçue' }], derniere: 'Livrée' }, QUAND);
		const r = await j.lire();
		expect(r).toMatchObject({ etapes: [{ nom: 'Commandée' }, { nom: 'Reçue' }], derniere: 'Livrée' });
		expect(r!.etapes.map((e) => e.id)).toEqual([expect.stringMatching(/^e[0-9a-f]{8}$/), expect.stringMatching(/^e[0-9a-f]{8}$/)]);
		expect(new Set(r!.etapes.map((e) => e.id)).size).toBe(2);
		const [ligne] = await j.base.select().from(journal).where(eq(journal.action, 'regler_demandes'));
		expect(ligne).toMatchObject({ acteur: `personne:${j.ids.claire}`, cibleType: 'responsabilite', cibleId: j.pharmacie });
		expect(JSON.parse(ligne!.details)).toEqual({ recoit: true, etapes: ['Commandée', 'Reçue'], derniere: 'Livrée' });
	});

	it('renommer et déplacer gardent les identifiants ; une étape inconnue est refusée', async () => {
		const j = await jeu();
		await reglerDemandes(j.base, j.claire, j.pharmacie, { etapes: [{ nom: 'Commandée' }, { nom: 'Reçue' }], derniere: 'Faite' }, QUAND);
		const [a, b] = (await j.lire())!.etapes;
		await reglerDemandes(j.base, j.claire, j.pharmacie, { etapes: [{ id: b!.id, nom: 'Arrivée' }, { id: a!.id, nom: 'Commandée au SDIS' }], derniere: 'Faite' }, QUAND);
		expect((await j.lire())!.etapes).toEqual([{ id: b!.id, nom: 'Arrivée' }, { id: a!.id, nom: 'Commandée au SDIS' }]);
		await expect(reglerDemandes(j.base, j.claire, j.pharmacie, { etapes: [{ id: 'e00000000', nom: 'X' }], derniere: 'Faite' }, QUAND)).rejects.toThrow('Étape inconnue');
	});

	it('0 à 6 étapes de 30 caractères au plus, une dernière étape nommée, sans nom en double ni nom d’étape fixe', async () => {
		const j = await jeu();
		const regler = (etapes: string[], derniere = 'Faite') => reglerDemandes(j.base, j.claire, j.pharmacie, { etapes: etapes.map((nom) => ({ nom })), derniere }, QUAND);
		await regler([]);
		expect(await j.lire()).toEqual({ etapes: [], derniere: 'Faite' });
		await expect(regler(['1', '2', '3', '4', '5', '6', '7'])).rejects.toThrow('Trop d’étapes');
		await expect(regler(['x'.repeat(31)])).rejects.toThrow('Nom d’étape trop long');
		await expect(regler(['  '])).rejects.toThrow('Nom d’étape vide');
		await expect(regler([], ' ')).rejects.toThrow('Nom d’étape vide');
		await expect(regler(['Commandée', 'commandée'])).rejects.toThrow('Nom d’étape en double');
		await expect(regler(['Faite'])).rejects.toThrow('Nom d’étape en double');
		await expect(regler(['Prise en compte'])).rejects.toThrow('Nom d’étape en double');
	});

	it('jamais un rôle système, ni le rôle de l’habillement, ni un rôle d’équipe ou de comité, ni un rôle archivé', async () => {
		const j = await jeu();
		const regler = async (nom: string) => reglerDemandes(j.base, j.claire, (await j.role(nom)).id, { etapes: [], derniere: 'Faite' }, QUAND);
		await expect(regler('Chef de centre')).rejects.toThrow('Ce rôle ne reçoit pas de demandes');
		await expect(regler('Chef de garde')).rejects.toThrow('Ce rôle ne reçoit pas de demandes');
		await expect(regler('Référent habillement')).rejects.toThrow('Ce rôle ne reçoit pas de demandes');
		await expect(regler('Membre de comité')).rejects.toThrow('Ce rôle ne reçoit pas de demandes');
		const engins = (await j.role('Référent engins')).id;
		await archiverResponsabilite(j.base, j.claire, engins, AUJOURDHUI);
		await expect(reglerDemandes(j.base, j.claire, engins, { etapes: [], derniere: 'Faite' }, QUAND)).rejects.toThrow('Ce rôle ne reçoit pas de demandes');
	});

	it('qui règle : la gestion des rôles (cheffe, référent technique, super administrateur) ; un titulaire en cours, seulement les étapes et la dernière', async () => {
		const j = await jeu();
		const reglage = { etapes: [{ nom: 'Commandée' }], derniere: 'Faite' };
		// Décoché (le jeu de départ le coche) : le titulaire ne le coche pas lui-même.
		await reglerDemandes(j.base, j.claire, j.pharmacie, null, QUAND);
		await expect(reglerDemandes(j.base, j.paul, j.pharmacie, reglage, QUAND)).rejects.toThrow('Réservé');
		await expect(reglerDemandes(j.base, j.alice, j.pharmacie, reglage, QUAND)).rejects.toThrow('Réservé');
		await reglerDemandes(j.base, j.tom, j.pharmacie, reglage, QUAND);
		await reglerDemandes(j.base, j.superAdmin, j.pharmacie, reglage, QUAND);
		// Le titulaire règle ses étapes, mais ne décoche pas.
		await reglerDemandes(j.base, j.paul, j.pharmacie, { etapes: [], derniere: 'Livrée' }, QUAND);
		expect(await j.lire()).toEqual({ etapes: [], derniere: 'Livrée' });
		await expect(reglerDemandes(j.base, j.paul, j.pharmacie, null, QUAND)).rejects.toThrow('Réservé');
		// Un titulaire dont le rôle a pris fin ne règle plus rien.
		const ancien = (await j.base.insert(personne).values({ email: 'ancien@exemple.fr', prenom: 'Ancien', nom: 'Fictif', profilId: (await j.base.select().from(profil))[0]!.id }).returning())[0]!.id;
		await j.nommer(ancien, 'Référent pharmacie', '2026-10-31');
		await expect(reglerDemandes(j.base, j.qui(ancien), j.pharmacie, { etapes: [], derniere: 'Faite' }, QUAND)).rejects.toThrow('Réservé');
	});

	it('retirer une étape, décocher ou archiver : refusé tant qu’une demande en cours s’y trouve (renommer reste permis)', async () => {
		const j = await jeu();
		await reglerDemandes(j.base, j.claire, j.pharmacie, { etapes: [{ nom: 'Commandée' }, { nom: 'Reçue' }], derniere: 'Faite' }, QUAND);
		const [a, b] = (await j.lire())!.etapes;
		const [d] = await j.base.insert(demandeReferent).values({ responsabiliteId: j.pharmacie, demandeurId: j.ids.alice, texte: 'Compresses', etape: a!.id, prisePar: j.ids.paul, creeLe: QUAND, majLe: QUAND }).returning();
		await expect(reglerDemandes(j.base, j.claire, j.pharmacie, { etapes: [{ id: b!.id, nom: 'Reçue' }], derniere: 'Faite' }, QUAND)).rejects.toThrow('Étape occupée');
		await reglerDemandes(j.base, j.claire, j.pharmacie, { etapes: [{ id: a!.id, nom: 'Commandée chez le fournisseur' }], derniere: 'Faite' }, QUAND);
		await expect(reglerDemandes(j.base, j.claire, j.pharmacie, null, QUAND)).rejects.toThrow('Demandes en cours');
		await expect(archiverResponsabilite(j.base, j.claire, j.pharmacie, AUJOURDHUI)).rejects.toThrow('Demandes en cours');
		// Finie, la demande ne retient plus rien.
		await j.base.update(demandeReferent).set({ etape: 'faite', finLe: QUAND }).where(eq(demandeReferent.id, d!.id));
		await reglerDemandes(j.base, j.claire, j.pharmacie, null, QUAND);
		expect(await j.lire()).toBeNull();
		expect(JSON.parse((await j.base.select().from(journal).where(eq(journal.action, 'regler_demandes'))).at(-1)!.details)).toEqual({ recoit: false });
	});

	it('un rôle qui reçoit des demandes ne prend ni le droit de l’habillement ni une autre portée', async () => {
		const j = await jeu();
		await reglerDemandes(j.base, j.claire, j.pharmacie, { etapes: [], derniere: 'Faite' }, QUAND);
		await expect(modifierResponsabilite(j.base, j.claire, j.pharmacie, { droits: ['GERER_STOCK', 'GERER_HABILLEMENT'] }, AUJOURDHUI)).rejects.toThrow('Ce rôle reçoit des demandes');
		await j.base.delete(attribution).where(eq(attribution.personneId, j.ids.paul));
		await expect(modifierResponsabilite(j.base, j.claire, j.pharmacie, { portee: 'equipe', droits: [] }, AUJOURDHUI)).rejects.toThrow('Ce rôle reçoit des demandes');
		// Le reste se modifie comme avant.
		await modifierResponsabilite(j.base, j.claire, j.pharmacie, { nom: 'Pharmacie' }, AUJOURDHUI);
	});

	it('créé à partir du modèle pharmacie ou matériel, un rôle reçoit des demandes, sans étape intermédiaire', async () => {
		const j = await jeu();
		const id = await creerResponsabilite(j.base, j.claire, { nom: 'Pharmacie 2', nature: 'mission', portee: 'centre', attributeur: { type: 'chef_centre' }, droits: ['GERER_STOCK'], modele: 'referent_pharmacie' }, AUJOURDHUI);
		expect(await j.lire(id)).toEqual({ etapes: [], derniere: 'Faite' });
		const autre = await creerResponsabilite(j.base, j.claire, { nom: 'Sport', nature: 'mission', portee: 'centre', attributeur: { type: 'chef_centre' }, droits: [], modele: 'vierge' }, AUJOURDHUI);
		expect(await j.lire(autre)).toBeNull();
	});
});

describe('corrections de la relecture', () => {
	it('la cheffe règle les étapes même sans le droit de gérer les rôles', async () => {
		const j = await jeu();
		const chef = (await j.role('Chef de centre')).id;
		await j.base.delete(responsabiliteDroit).where(and(eq(responsabiliteDroit.responsabiliteId, chef), eq(responsabiliteDroit.droit, 'GERER_LISTES')));
		await reglerDemandes(j.base, j.claire, j.pharmacie, null, QUAND);
		await reglerDemandes(j.base, j.claire, j.pharmacie, { etapes: [{ nom: 'Commandée' }], derniere: 'Faite' }, QUAND);
		expect((await j.lire())!.etapes.map((e) => e.nom)).toEqual(['Commandée']);
	});

	it('décocher garde le réglage, recocher le reprend avec ses identifiants', async () => {
		const j = await jeu();
		await reglerDemandes(j.base, j.claire, j.pharmacie, { etapes: [{ nom: 'Commandée' }], derniere: 'Livrée' }, QUAND);
		const avant = await j.lire();
		await reglerDemandes(j.base, j.claire, j.pharmacie, null, QUAND);
		expect(await j.lire()).toBeNull();
		const [r] = await j.base.select().from(responsabilite).where(eq(responsabilite.id, j.pharmacie));
		expect(r!.demandesGardees).toEqual(avant);
		await reglerDemandes(j.base, j.claire, j.pharmacie, r!.demandesGardees, QUAND);
		expect(await j.lire()).toEqual(avant);
	});

	it('deux réglages en même temps : un seul s’écrit, l’autre est refusé sans rien écrire', async () => {
		const j = await jeu();
		const resultats = await Promise.allSettled([
			reglerDemandes(j.base, j.claire, j.pharmacie, { etapes: [{ nom: 'Commandée' }], derniere: 'Faite' }, QUAND),
			reglerDemandes(j.base, j.tom, j.pharmacie, { etapes: [{ nom: 'Reçue' }], derniere: 'Faite' }, QUAND)
		]);
		expect(resultats.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
		expect(String((resultats.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason)).toContain('Demande changée entre-temps');
		expect((await j.lire())!.etapes).toHaveLength(1);
		expect(await j.base.select().from(journal).where(eq(journal.action, 'regler_demandes'))).toHaveLength(1);
	});
});

describe('le jeu de départ d’un nouveau centre', () => {
	it('le référent pharmacie et le référent engins (matériel) reçoivent des demandes ; les autres rôles non', async () => {
		const j = await jeu();
		const roles = await j.base.select({ nom: responsabilite.nom, demandes: responsabilite.demandes }).from(responsabilite);
		expect(roles.filter((r) => r.demandes !== null).map((r) => r.nom).sort()).toEqual(['Référent engins', 'Référent pharmacie']);
		expect(roles.find((r) => r.nom === 'Référent pharmacie')!.demandes).toEqual({ etapes: [], derniere: 'Faite' });
	});
});

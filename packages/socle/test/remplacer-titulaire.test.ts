import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { attribuer, remplacerTitulaire } from '../src/actions/attributions.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { attribution, avisNomination, comite, equipe, journal, personne, profil, responsabilite, responsabiliteDroit } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-11-24';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

async function jeu() {
	const base = await baseDeTest();
	const [a] = await base.insert(equipe).values({ nom: 'A', couleur: 'rouge', ordreRotation: 1 }).returning();
	const [amicale] = await base.insert(comite).values({ nom: 'Amicale', theme: 'vie' }).returning();
	const [agent] = await base.insert(profil).values({ nom: 'Agent', typePersonne: 'agent' }).returning();
	const [reserve] = await base.insert(profil).values({ nom: 'Réserve', typePersonne: 'exterieur' }).returning();
	const [chefGarde] = await base.insert(responsabilite).values({ nom: 'Chef de garde', nature: 'fonction', typePerimetre: 'equipe', systeme: 'chef_equipe' }).returning();
	const [rapporteur] = await base.insert(responsabilite).values({ nom: 'Rapporteur', nature: 'mission', typePerimetre: 'comite' }).returning();
	await base.insert(responsabiliteDroit).values({ responsabiliteId: rapporteur!.id, droit: 'ATTRIBUER_RESPONSABILITE' });
	const nouvelle = async (email: string, profilId = agent!.id) => (await base.insert(personne).values({ email, prenom: email.split('@')[0]!, nom: 'Test', profilId }).returning())[0]!.id;
	const ancien = await nouvelle('ancien@exemple.fr');
	const mandat = await attribuer(base, superAdmin, { personneId: ancien, responsabiliteId: chefGarde!.id, perimetre: { type: 'equipe', id: a!.id }, debut: '2026-01-01' }, aujourdhui, { prevenir: false });
	return { base, equipeA: a!, amicale: amicale!, chefGarde: chefGarde!, rapporteur: rapporteur!, reserve: reserve!, nouvelle, ancien, mandat };
}

describe('remplacerTitulaire', () => {
	it('finit l’ancien mandat la veille et ouvre le nouveau, en une seule écriture', async () => {
		const { base, chefGarde, equipeA, nouvelle, ancien, mandat } = await jeu();
		const nouveau = await nouvelle('nouveau@exemple.fr');
		const avant = base.requetes;
		const id = await remplacerTitulaire(base, superAdmin, { attributionId: mandat, personneId: nouveau, debut: '2026-12-01' }, aujourdhui);
		const lignes = await base.select().from(attribution).where(eq(attribution.responsabiliteId, chefGarde.id));
		expect(lignes.find((l) => l.id === mandat)).toMatchObject({ personneId: ancien, fin: '2026-11-30' });
		expect(lignes.find((l) => l.id === id)).toMatchObject({ personneId: nouveau, perimetreType: 'equipe', perimetreId: equipeA.id, debut: '2026-12-01', fin: null });
		// Les lectures, puis un seul batch d'écriture : l'ancien et le nouveau changent ensemble.
		expect(base.requetes - avant).toBeLessThanOrEqual(8);
		const actions = (await base.select().from(journal)).map((l) => l.action);
		expect(actions).toEqual(expect.arrayContaining(['finir_attribution', 'attribuer']));
		const [ligneNouveau] = (await base.select().from(journal)).filter((l) => l.action === 'attribuer' && l.cibleId === id);
		expect(ligneNouveau).toBeDefined();
		// Le nouveau titulaire l'apprend, comme pour une nomination.
		expect(await base.select().from(avisNomination).where(eq(avisNomination.personneId, nouveau))).toHaveLength(1);
	});

	it('suit la même règle de droit que nommer', async () => {
		const { base, amicale, rapporteur, nouvelle, mandat } = await jeu();
		const rapp = await nouvelle('rapp@exemple.fr');
		await attribuer(base, superAdmin, { personneId: rapp, responsabiliteId: rapporteur.id, perimetre: { type: 'comite', id: amicale.id }, debut: '2026-01-01' }, aujourdhui);
		const nouveau = await nouvelle('nouveau@exemple.fr');
		// Un rapporteur de comité ne nomme pas de chef de garde : il ne le remplace pas non plus, et rien n'est écrit.
		await expect(remplacerTitulaire(base, { type: 'personne', id: rapp }, { attributionId: mandat, personneId: nouveau, debut: aujourdhui }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		const [ligne] = await base.select().from(attribution).where(eq(attribution.id, mandat));
		expect(ligne!.fin).toBeNull();
	});

	it('remplace un rapporteur dans son comité, mais pas par une personne extérieure', async () => {
		const { base, amicale, rapporteur, reserve, nouvelle } = await jeu();
		const rapp = await nouvelle('rapp@exemple.fr');
		const mandatRapp = await attribuer(base, superAdmin, { personneId: rapp, responsabiliteId: rapporteur.id, perimetre: { type: 'comite', id: amicale.id }, debut: '2026-01-01' }, aujourdhui);
		const exterieur = await nouvelle('ext@exemple.fr', reserve.id);
		await expect(remplacerTitulaire(base, superAdmin, { attributionId: mandatRapp, personneId: exterieur, debut: aujourdhui }, aujourdhui)).rejects.toThrow('Une personne extérieure ne tient pas de rôle de comité');
		const autre = await nouvelle('autre@exemple.fr');
		await remplacerTitulaire(base, superAdmin, { attributionId: mandatRapp, personneId: autre, debut: aujourdhui }, aujourdhui);
		const [fini] = await base.select().from(attribution).where(eq(attribution.id, mandatRapp));
		expect(fini!.fin).toBe('2026-11-23');
	});

	it('refuse une date qui ne suit pas le début du mandat, un mandat fini, un inconnu, la même personne', async () => {
		const { base, nouvelle, ancien, mandat } = await jeu();
		const nouveau = await nouvelle('nouveau@exemple.fr');
		await expect(remplacerTitulaire(base, superAdmin, { attributionId: mandat, personneId: nouveau, debut: '2026-01-01' }, aujourdhui)).rejects.toThrow('Choisissez une date après le début du mandat');
		await expect(remplacerTitulaire(base, superAdmin, { attributionId: 9999, personneId: nouveau, debut: aujourdhui }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await expect(remplacerTitulaire(base, superAdmin, { attributionId: mandat, personneId: ancien, debut: aujourdhui }, aujourdhui)).rejects.toThrow('Cette personne tient déjà ce rôle sur cette période');
		await expect(remplacerTitulaire(base, superAdmin, { attributionId: mandat, personneId: nouveau, debut: '2026-13-01' }, aujourdhui)).rejects.toBeInstanceOf(DonneeInvalide);
		await base.update(attribution).set({ fin: '2026-06-30' }).where(eq(attribution.id, mandat));
		await expect(remplacerTitulaire(base, superAdmin, { attributionId: mandat, personneId: nouveau, debut: aujourdhui }, aujourdhui)).rejects.toThrow('Ce mandat est déjà fini');
	});

	it('garde la fin d’une mission d’une durée fixée ; refuse une date après cette fin, et un mandat qui n’a pas commencé', async () => {
		const { base, chefGarde, nouvelle, mandat } = await jeu();
		await base.update(attribution).set({ fin: '2027-06-30' }).where(eq(attribution.id, mandat));
		const nouveau = await nouvelle('nouveau@exemple.fr');
		await expect(remplacerTitulaire(base, superAdmin, { attributionId: mandat, personneId: nouveau, debut: '2027-08-01' }, aujourdhui)).rejects.toThrow('Ce mandat finit avant cette date');
		const id = await remplacerTitulaire(base, superAdmin, { attributionId: mandat, personneId: nouveau, debut: '2026-12-01' }, aujourdhui);
		const [repris] = await base.select().from(attribution).where(eq(attribution.id, id));
		expect(repris).toMatchObject({ debut: '2026-12-01', fin: '2027-06-30' });
		const autre = await nouvelle('autre@exemple.fr');
		await expect(remplacerTitulaire(base, superAdmin, { attributionId: id, personneId: autre, debut: '2026-12-15' }, aujourdhui)).rejects.toThrow('Ce mandat n’a pas commencé');
		void chefGarde;
	});

	it('refuse sans rien dire du mandat à qui n’a pas le droit', async () => {
		const { base, nouvelle, mandat } = await jeu();
		const simple = await nouvelle('simple@exemple.fr');
		await base.update(attribution).set({ fin: '2026-01-31' }).where(eq(attribution.id, mandat));
		await expect(remplacerTitulaire(base, { type: 'personne', id: simple }, { attributionId: mandat, personneId: simple, debut: aujourdhui }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('l’adjoint : seul le chef de centre le remplace', async () => {
		const { base, nouvelle } = await jeu();
		const [chefCentre] = await base.insert(responsabilite).values({ nom: 'Chef de centre', nature: 'fonction', typePerimetre: 'centre', systeme: 'chef_centre' }).returning();
		const [adjoint] = await base.insert(responsabilite).values({ nom: 'Chef de centre adjoint', nature: 'fonction', typePerimetre: 'centre', systeme: 'chef_centre_adjoint' }).returning();
		await base.insert(responsabiliteDroit).values({ responsabiliteId: adjoint!.id, droit: 'ATTRIBUER_RESPONSABILITE' });
		const chef = await nouvelle('chef@exemple.fr');
		await attribuer(base, superAdmin, { personneId: chef, responsabiliteId: chefCentre!.id, perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhui);
		const vieil = await nouvelle('vieil@exemple.fr');
		const mandat = await attribuer(base, superAdmin, { personneId: vieil, responsabiliteId: adjoint!.id, perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhui);
		const nouveau = await nouvelle('nouvel@exemple.fr');
		// L'adjoint, qui nomme sur le centre, ne se remplace pas lui-même par un autre.
		await expect(remplacerTitulaire(base, { type: 'personne', id: vieil }, { attributionId: mandat, personneId: nouveau, debut: aujourdhui }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(remplacerTitulaire(base, { type: 'personne', id: chef }, { attributionId: mandat, personneId: nouveau, debut: aujourdhui }, aujourdhui)).resolves.toBeTypeOf('number');
	});
});

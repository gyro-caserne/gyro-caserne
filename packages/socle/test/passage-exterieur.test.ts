import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { attribuer } from '../src/actions/attributions.ts';
import { modifierFiche } from '../src/actions/personnes.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { creerGroupe, envoyer } from '../src/messagerie.ts';
import { effacerAgentsPartis } from '../src/partis.ts';
import {
	affectationEquipe,
	attribution,
	comite,
	conversation,
	demandeReferent,
	filDemandeReferent,
	demandeRemplacement,
	equipe,
	membreConversation,
	notification,
	personne,
	profil,
	publication,
	reservation,
	ressource,
	responsabilite
} from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-25';
const maintenant = `${aujourdhui}T12:00`;
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };
const acteur = (id: number): Acteur => ({ type: 'personne', id });

// Le chef de centre, Paul (équipe 1, membre de l'Amicale) qui prend sa retraite, et Marc, un collègue.
async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const [retraite] = await base.insert(profil).values({ nom: 'Retraité', typePersonne: 'exterieur', mursOuverts: '{"vie":"ecriture"}' }).returning();
	const [e1] = await base.select().from(equipe).orderBy(equipe.ordreRotation);
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
	const role = async (nom: string) => (await base.select().from(responsabilite).where(eq(responsabilite.nom, nom)))[0]!.id;
	const nouvelle = async (prenom: string) => (await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning())[0]!.id;
	const chef = await nouvelle('Chef');
	await attribuer(base, superAdmin, { personneId: chef, responsabiliteId: await role('Chef de centre'), perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhui);
	const adjoint = await nouvelle('Adjoint');
	await attribuer(base, superAdmin, { personneId: adjoint, responsabiliteId: await role('Chef de centre adjoint'), perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhui);
	const paul = await nouvelle('Paul');
	const marc = await nouvelle('Marc');
	await base.insert(affectationEquipe).values({ personneId: paul, equipeId: e1!.id, debut: '2020-01-01' });
	await attribuer(base, superAdmin, { personneId: paul, responsabiliteId: await role('Membre de comité'), perimetre: { type: 'comite', id: amicale!.id }, debut: '2026-01-01' }, aujourdhui);
	const passer = (qui: Acteur, id: number, profilId: number) => modifierFiche(base, qui, id, { profilId }, aujourdhui, [], { basePhotos: base.photos, maintenant });
	return { base, chef: acteur(chef), chefId: chef, adjoint, paul, marc, agent: agent!, retraite: retraite!, e1: e1!, amicale: amicale!, passer };
}

describe('passage d’un agent à un profil extérieur', () => {
	it('équipe et rôles finis la veille, fiche et notifications gardées, jamais effacé', async () => {
		const { base, chef, paul, retraite, passer } = await jeu();
		const [pub] = await base.insert(publication).values({ mur: 'vie', auteur: 'super:a@b.fr', type: 'message', texte: 'Bonjour', creeLe: '2026-10-20T10:00' }).returning();
		await base.insert(notification).values({ personneId: paul, publicationId: pub!.id, creeLe: '2026-10-20T10:00' });
		await passer(chef, paul, retraite.id);
		const [fiche] = await base.select().from(personne).where(eq(personne.id, paul));
		expect(fiche).toMatchObject({ profilId: retraite.id, statut: 'operationnel', partiLe: null, prenom: 'Paul' });
		expect((await base.select().from(affectationEquipe).where(eq(affectationEquipe.personneId, paul))).map((a) => a.fin)).toEqual(['2026-10-24']);
		expect((await base.select().from(attribution).where(eq(attribution.personneId, paul))).map((a) => a.fin)).toEqual(['2026-10-24']);
		expect(await base.select().from(notification).where(eq(notification.personneId, paul))).toHaveLength(1);
		await effacerAgentsPartis(base, '2028-01-01', '2028-01-01', []);
		expect((await base.select().from(personne).where(eq(personne.id, paul)))[0]!.effaceLe).toBeNull();
	});

	it('remplacements, réservations et demandes aux référents en cours annulés', async () => {
		const { base, chef, chefId, paul, retraite, e1, passer } = await jeu();
		const [d] = await base.insert(demandeRemplacement).values({ genre: 'remplacement', demandeurId: paul, equipeId: e1.id, debut: '2026-11-02T20:00', etat: 'attente', creeLe: '2026-10-20T10:00' }).returning();
		const [vl] = await base.select().from(ressource);
		const [r] = await base.insert(reservation).values({ ressourceId: vl!.id, personneId: paul, debut: '2026-11-03T09:00', fin: '2026-11-03T12:00', quantite: 1, etat: 'acceptee', creeLe: '2026-10-20T10:00' }).returning();
		// Une demande à un référent : annulée tant qu'elle n'a pas dépassé « Prise en compte » ; plus loin, le référent la finit.
		const [pharmacie] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Référent pharmacie'));
		const [dr] = await base.insert(demandeReferent).values({ responsabiliteId: pharmacie!.id, demandeurId: paul, texte: 'Compresses', etape: 'prise', creeLe: '2026-10-20T10:00', majLe: '2026-10-20T10:00' }).returning();
		const [loin] = await base.insert(demandeReferent).values({ responsabiliteId: pharmacie!.id, demandeurId: paul, texte: 'Sérum', etape: 'e12345678', creeLe: '2026-10-20T10:00', majLe: '2026-10-20T10:00' }).returning();
		await passer(chef, paul, retraite.id);
		expect((await base.select().from(demandeReferent).where(eq(demandeReferent.id, dr!.id)))[0]).toMatchObject({ etape: 'annulee', finLe: maintenant });
		expect((await base.select().from(filDemandeReferent).where(eq(filDemandeReferent.demandeId, dr!.id)))[0]).toMatchObject({ quoi: 'annulation', par: chefId });
		expect((await base.select().from(demandeReferent).where(eq(demandeReferent.id, loin!.id)))[0]).toMatchObject({ etape: 'e12345678', finLe: null });
		expect((await base.select().from(demandeRemplacement).where(eq(demandeRemplacement.id, d!.id)))[0]!.etat).toBe('annulee');
		expect((await base.select().from(reservation).where(eq(reservation.id, r!.id)))[0]!.etat).toBe('annulee');
	});

	it('retiré des groupes d’agents ; ses conversations à deux restent', async () => {
		const { base, chefId, chef, paul, marc, retraite, passer } = await jeu();
		const groupe = await creerGroupe(base, chef, { nom: 'Équipe', membres: [paul, marc] }, maintenant);
		const { conversation: aDeux } = await envoyer(base, base.photos, acteur(marc), { personne: paul }, { texte: 'Bonne retraite' }, maintenant);
		await passer(chef, paul, retraite.id);
		expect(await base.select().from(membreConversation).where(and(eq(membreConversation.conversationId, groupe), eq(membreConversation.personneId, paul)))).toEqual([]);
		expect(await base.select().from(membreConversation).where(and(eq(membreConversation.conversationId, aDeux), eq(membreConversation.personneId, paul)))).toHaveLength(1);
		expect(await base.select().from(conversation).where(eq(conversation.id, aDeux))).toHaveLength(1);
		expect(chefId).toBeGreaterThan(0);
	});

	it('refusé pour le chef de centre et l’adjoint, même par le super administrateur', async () => {
		const { base, chefId, adjoint, retraite, passer } = await jeu();
		for (const id of [chefId, adjoint]) await expect(passer(superAdmin, id, retraite.id)).rejects.toThrow(new DonneeInvalide('Le chef de centre et son adjoint restent agents'));
	});

	it('sans les suites (fichier de l’effectif) : refusé ; retour d’un extérieur vers Agent : simple changement de profil', async () => {
		const { base, chef, paul, marc, agent, retraite, passer } = await jeu();
		await expect(modifierFiche(base, chef, marc, { profilId: retraite.id }, aujourdhui, [])).rejects.toThrow(new DonneeInvalide('Le passage à un profil extérieur se fait depuis la fiche'));
		await passer(chef, paul, retraite.id);
		await modifierFiche(base, chef, paul, { profilId: agent.id }, aujourdhui, []);
		expect((await base.select().from(personne).where(eq(personne.id, paul)))[0]!.profilId).toBe(agent.id);
	});
});

describe('pas de rôle de comité pour une personne extérieure', () => {
	it('nommer un extérieur dans un comité : refusé ; un agent, oui', async () => {
		const { base, chef, marc, retraite, amicale } = await jeu();
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Membre de comité'));
		const [ext] = await base.insert(personne).values({ email: 'rene@exemple.fr', prenom: 'René', nom: 'Ancien', profilId: retraite.id }).returning();
		await expect(attribuer(base, chef, { personneId: ext!.id, responsabiliteId: r!.id, perimetre: { type: 'comite', id: amicale.id }, debut: aujourdhui }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Une personne extérieure ne tient pas de rôle de comité'));
		expect(await attribuer(base, chef, { personneId: marc, responsabiliteId: r!.id, perimetre: { type: 'comite', id: amicale.id }, debut: aujourdhui }, aujourdhui)).toBeGreaterThan(0);
	});
});

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { lireMur, publier } from '../src/actions/publications.ts';
import { ajouterMembres, annuaire, peutEcrireAPersonne, creerGroupe, envoyer, exigerMessagerie, lireConversation, membresPourGroupe, nonLusTotal, pourVous } from '../src/messagerie.ts';
import { attribution, comite, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const maintenant = '2026-10-29T10:00';
const aujourdhui = '2026-10-29';
const acteur = (id: number): Acteur => ({ type: 'personne', id });

// Comité Retraités : Paul l'anime (rôle de comité), René et Rita y sont ouverts en écriture, Rose seulement en lecture.
// Le chef de centre, l'adjointe, et Manon, agente sans lien avec les retraités.
async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const responsabilites = await base.select().from(responsabilite);
	const [retraites] = await base.insert(comite).values({ nom: 'Retraités', theme: 'Vie du centre' }).returning();
	const cle = `comite:${retraites!.id}`;
	const [retraite] = await base.insert(profil).values({ nom: 'Retraité', typePersonne: 'exterieur', mursOuverts: JSON.stringify({ [cle]: 'ecriture', vie: 'ecriture' }) }).returning();
	const [lectrice] = await base.insert(profil).values({ nom: 'Amie', typePersonne: 'exterieur', mursOuverts: JSON.stringify({ [cle]: 'lecture', vie: 'ecriture' }) }).returning();
	const nouvelle = async (prenom: string, profilId: number, statut: 'operationnel' | 'parti' = 'operationnel') => (await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId, statut }).returning())[0]!.id;
	const nommer = async (personneId: number, nom: string, perimetre: { type: 'centre' | 'comite'; id?: number }, fin: string | null = null) => {
		await base.insert(attribution).values({ personneId, responsabiliteId: responsabilites.find((r) => r.nom === nom)!.id, perimetreType: perimetre.type, perimetreId: perimetre.id ?? null, debut: '2026-01-01', fin, saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	};
	const chef = await nouvelle('Chef', agent!.id);
	await nommer(chef, 'Chef de centre', { type: 'centre' });
	const adjointe = await nouvelle('Adjointe', agent!.id);
	await nommer(adjointe, 'Chef de centre adjoint', { type: 'centre' });
	const paul = await nouvelle('Paul', agent!.id);
	await nommer(paul, 'Membre de comité', { type: 'comite', id: retraites!.id });
	const manon = await nouvelle('Manon', agent!.id);
	const rene = await nouvelle('René', retraite!.id);
	const rita = await nouvelle('Rita', retraite!.id);
	const rose = await nouvelle('Rose', lectrice!.id);
	return { base, nommer, nouvelle, retraites: retraites!, retraite: retraite!, chef, adjointe, paul, manon, rene, rita, rose };
}

const ids = (liste: { id: number }[]) => liste.map((p) => p.id).sort((a, b) => a - b);
const tri = (...x: number[]) => x.sort((a, b) => a - b);

describe('messagerie d’un profil ouvert', () => {
	it('un comité ouvert en écriture donne la messagerie, sans droit à cocher ; en lecture seulement, non', async () => {
		const { base, rene, rose } = await jeu();
		expect(await exigerMessagerie(base, acteur(rene), aujourdhui)).toBe(rene);
		await expect(exigerMessagerie(base, acteur(rose), aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('comité dissous, JSON invalide, ou personne partie : pas de messagerie', async () => {
		const { base, rene, rita, retraites, retraite } = await jeu();
		await base.update(personne).set({ statut: 'parti' }).where(eq(personne.id, rita));
		await expect(exigerMessagerie(base, acteur(rita), aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await base.update(profil).set({ mursOuverts: '{oups' }).where(eq(profil.id, retraite.id));
		await expect(exigerMessagerie(base, acteur(rene), aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await base.update(profil).set({ mursOuverts: JSON.stringify({ [`comite:${retraites.id}`]: 'ecriture' }) }).where(eq(profil.id, retraite.id));
		await base.update(comite).set({ dissousLe: '2026-10-01' }).where(eq(comite.id, retraites.id));
		await expect(exigerMessagerie(base, acteur(rene), aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('son annuaire : les membres de ses comités (rôle ou écriture), le chef et l’adjointe ; pas les autres agents', async () => {
		const { base, chef, adjointe, paul, rene, rita } = await jeu();
		expect(ids(await annuaire(base, acteur(rene), aujourdhui))).toEqual(tri(chef, adjointe, paul, rita));
	});

	it('l’annuaire des agents : René pour les membres du comité et les chefs, pas pour Manon', async () => {
		const { base, chef, paul, manon, rene, rita } = await jeu();
		for (const qui of [chef, paul]) expect(ids(await annuaire(base, acteur(qui), aujourdhui))).toEqual(expect.arrayContaining([rene, rita]));
		const deManon = ids(await annuaire(base, acteur(manon), aujourdhui));
		expect(deManon).not.toContain(rene);
		expect(deManon).toContain(paul);
	});

	it('peutEcrireAPersonne : la même réponse que l’annuaire, pour chaque paire, en une requête', async () => {
		const { base } = await jeu();
		const tous = (await base.select({ id: personne.id }).from(personne)).map((p) => p.id);
		for (const moi of tous) {
			const lus = await annuaire(base, acteur(moi), aujourdhui).then((a) => ids(a)).catch(() => [] as number[]);
			for (const autre of tous) {
				const avant = base.requetes;
				expect(await peutEcrireAPersonne(base, acteur(moi), autre, aujourdhui), `${moi} vers ${autre}`).toBe(lus.includes(autre));
				expect(base.requetes - avant).toBe(moi === autre ? 0 : 1);
			}
		}
		expect(await peutEcrireAPersonne(base, { type: 'super', email: 'a@b.fr' }, tous[0]!, aujourdhui)).toBe(false);
	});

	it('écrire à deux, dans les deux sens ; refusé hors de ses liens', async () => {
		const { base, chef, paul, manon, rene } = await jeu();
		const { conversation } = await envoyer(base, base.photos, acteur(rene), { personne: paul }, { texte: 'Bonjour Paul' }, maintenant);
		await envoyer(base, base.photos, acteur(paul), { conversation }, { texte: 'Bonjour René' }, maintenant);
		await envoyer(base, base.photos, acteur(chef), { personne: rene }, { texte: 'Bienvenue' }, maintenant);
		await expect(envoyer(base, base.photos, acteur(rene), { personne: manon }, { texte: 'Salut' }, maintenant)).rejects.toThrow(new DonneeInvalide('Cette personne n’est pas dans l’annuaire'));
		await expect(envoyer(base, base.photos, acteur(manon), { personne: rene }, { texte: 'Salut' }, maintenant)).rejects.toThrow(DonneeInvalide);
		expect(await nonLusTotal(base, acteur(rene), aujourdhui)).toBe(2);
	});

	it('plus joignable (Paul quitte le comité) : la conversation reste lisible, en lecture seule, et refuse l’envoi', async () => {
		const { base, paul, rene } = await jeu();
		const { conversation } = await envoyer(base, base.photos, acteur(rene), { personne: paul }, { texte: 'Bonjour Paul' }, maintenant);
		await base.update(attribution).set({ fin: '2026-10-28' }).where(eq(attribution.personneId, paul));
		const vue = await lireConversation(base, acteur(rene), conversation, {}, maintenant);
		expect(vue.lectureSeule).toBe(true);
		expect(vue.messages).toHaveLength(1);
		await expect(envoyer(base, base.photos, acteur(rene), { conversation }, { texte: 'Encore là ?' }, maintenant)).rejects.toThrow(new DonneeInvalide('Conversation en lecture seule'));
		expect((await lireConversation(base, acteur(paul), conversation, {}, maintenant)).lectureSeule).toBe(true);
	});

	it('pas de groupe : il n’en crée pas et n’y est pas ajouté ; ses raccourcis sont vides', async () => {
		const { base, chef, paul, rene, rita } = await jeu();
		await expect(creerGroupe(base, acteur(rene), { nom: 'Anciens', membres: [rita, paul] }, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		await expect(creerGroupe(base, acteur(chef), { nom: 'Retraités', membres: [paul, rene] }, maintenant)).rejects.toThrow(new DonneeInvalide('Une personne n’est pas dans l’annuaire'));
		const groupe = await creerGroupe(base, acteur(chef), { nom: 'Comité', membres: [paul] }, maintenant);
		await expect(ajouterMembres(base, acteur(chef), groupe, [rene], maintenant)).rejects.toThrow(DonneeInvalide);
		expect(await pourVous(base, acteur(rene), aujourdhui)).toEqual({ groupes: false, chefs: [], equipes: [], comites: [] });
		// Les membres d'une équipe ou d'un comité, pour un groupe : refusé.
		await expect(membresPourGroupe(base, acteur(rene), { equipe: 1 }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});

	it('« Répondre en privé » sur un mur : proposé entre personnes liées seulement', async () => {
		const { base, paul, manon, rene } = await jeu();
		await publier(base, base.photos, acteur(rene), 'vie', { type: 'message', texte: 'Bonjour de René' }, maintenant);
		const pour = async (qui: number) => (await lireMur(base, acteur(qui), 'vie', {}, maintenant)).publications[0]!.auteur.ecrireA;
		expect(await pour(paul)).toBe(rene);
		expect(await pour(manon)).toBeNull();
	});
});

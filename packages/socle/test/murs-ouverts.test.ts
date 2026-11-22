import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { aNePasManquer } from '../src/a-ne-pas-manquer.ts';
import { aimer, commenter, prendreConnaissance, repondreEvenement, suiviPublication, voter } from '../src/actions/interactions.ts';
import { lireMur, publier } from '../src/actions/publications.ts';
import { RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { notifierConvoques, notifierPublication } from '../src/notifications.ts';
import { attribution, comite, notification, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const maintenant = '2026-10-28T14:30';
const aujourdhui = '2026-10-28';
const acteur = (id: number): Acteur => ({ type: 'personne', id });
const sondage = { question: 'Qui vient ?', reponses: ['Oui', 'Non'], ouverture: maintenant, cloture: '2026-11-04T14:30' };

// Le chef de centre, un agent, René (Retraités en écriture, Vie du centre en lecture) et Rose (Amicale en lecture).
async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const [retraites] = await base.insert(comite).values({ nom: 'Retraités', theme: 'Vie du centre' }).returning();
	const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
	const cleR = `comite:${retraites!.id}`;
	const cleA = `comite:${amicale!.id}`;
	const [retraite] = await base.insert(profil).values({ nom: 'Retraité', typePersonne: 'exterieur', mursOuverts: JSON.stringify({ [cleR]: 'ecriture', vie: 'lecture', centre: 'ecriture' }) }).returning();
	const [lectrice] = await base.insert(profil).values({ nom: 'Amie', typePersonne: 'exterieur', mursOuverts: JSON.stringify({ [cleA]: 'lecture' }) }).returning();
	const nouvelle = async (prenom: string, profilId: number) => (await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId }).returning())[0]!.id;
	const chef = await nouvelle('Chef', agent!.id);
	const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await base.insert(attribution).values({ personneId: chef, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const david = await nouvelle('David', agent!.id);
	const rene = await nouvelle('René', retraite!.id);
	const rose = await nouvelle('Rose', lectrice!.id);
	const fil = async () => (await base.select({ personneId: notification.personneId }).from(notification)).map((n) => n.personneId).sort((a, b) => a - b);
	return { base, chef, david, rene, rose, cleR, cleA, fil };
}

describe('murs ouverts : gestes', () => {
	it('écriture sur un comité : publier, commenter, aimer, voter, répondre à un événement « tous »', async () => {
		const { base, chef, rene, cleR } = await jeu();
		const id = await publier(base, base.photos, acteur(rene), cleR, { type: 'message', texte: 'Bonjour à tous', sondage }, maintenant);
		await commenter(base, acteur(rene), id, 'Merci', maintenant);
		await aimer(base, acteur(rene), id, true, aujourdhui);
		await voter(base, acteur(rene), id, 0, maintenant);
		const ev = await publier(base, base.photos, acteur(chef), cleR, { type: 'evenement', texte: 'Repas', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		await repondreEvenement(base, acteur(rene), ev, 'present', maintenant);
	});

	it('Le centre en écriture : réagir sans publier', async () => {
		const { base, chef, rene } = await jeu();
		await expect(publier(base, base.photos, acteur(rene), 'centre', { type: 'message', texte: 'Coucou' }, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		const id = await publier(base, base.photos, acteur(chef), 'centre', { type: 'message', texte: 'Note', sondage }, maintenant);
		await commenter(base, acteur(rene), id, 'Vu', maintenant);
		await voter(base, acteur(rene), id, 1, maintenant);
	});

	it('lecture : lire et prendre connaissance, mais ni publier, ni commenter, ni aimer, ni voter, ni répondre', async () => {
		const { base, chef, rene } = await jeu();
		await expect(publier(base, base.photos, acteur(rene), 'vie', { type: 'message', texte: 'Coucou' }, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		const id = await publier(base, base.photos, acteur(chef), 'vie', { type: 'annonce', texte: 'Note', priseDeConnaissance: true, sondage }, maintenant);
		const ev = await publier(base, base.photos, acteur(chef), 'vie', { type: 'evenement', texte: 'Repas', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		expect((await lireMur(base, acteur(rene), 'vie', {}, maintenant)).publications).toHaveLength(2);
		await prendreConnaissance(base, acteur(rene), id, maintenant);
		await expect(commenter(base, acteur(rene), id, 'Vu', maintenant)).rejects.toBeInstanceOf(RefusDroit);
		await expect(aimer(base, acteur(rene), id, true, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(voter(base, acteur(rene), id, 0, maintenant)).rejects.toBeInstanceOf(RefusDroit);
		await expect(repondreEvenement(base, acteur(rene), ev, 'present', maintenant)).rejects.toBeInstanceOf(RefusDroit);
	});
});

describe('murs ouverts : suivis et notifications', () => {
	it('annonce : « qui a lu » attend les personnes au mur ouvert, en lecture comme en écriture', async () => {
		const { base, chef, david, rene, rose, cleA } = await jeu();
		const id = await publier(base, base.photos, acteur(chef), 'vie', { type: 'annonce', texte: 'Note', priseDeConnaissance: true }, maintenant);
		expect((await suiviPublication(base, acteur(chef), id, aujourdhui)).priseDeConnaissance!.manquante.map((p) => p.id).sort()).toEqual([david, rene].sort());
		const surAmicale = await publier(base, base.photos, acteur(chef), cleA, { type: 'annonce', texte: 'Note', priseDeConnaissance: true }, maintenant);
		expect((await suiviPublication(base, acteur(chef), surAmicale, aujourdhui)).priseDeConnaissance!.manquante.map((p) => p.id)).toEqual([rose]);
		const vue = (await lireMur(base, acteur(chef), 'vie', {}, maintenant)).publications[0]!;
		expect(vue.priseDeConnaissance).toMatchObject({ faites: 0, attendues: 2 });
	});

	it('événement « tous » : convoqués en écriture seulement ; une liste d’équipes ne les convoque pas', async () => {
		const { base, chef, rene, rose, cleR, cleA } = await jeu();
		const ev = await publier(base, base.photos, acteur(chef), cleR, { type: 'evenement', texte: 'Repas', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		expect((await suiviPublication(base, acteur(chef), ev, aujourdhui)).evenement!.sans_reponse.map((p) => p.id)).toEqual([rene]);
		const lu = await publier(base, base.photos, acteur(chef), cleA, { type: 'evenement', texte: 'Repas', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		expect((await suiviPublication(base, acteur(chef), lu, aujourdhui)).evenement!.sans_reponse.map((p) => p.id)).not.toContain(rose);
	});

	it('notifications : une publication sonne chez les personnes au mur ouvert ; un rappel de convoqués, chez celles en écriture', async () => {
		const { base, chef, david, rene, rose, cleR, cleA, fil } = await jeu();
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), 'vie', { type: 'message', texte: 'Vie' }, maintenant), maintenant);
		expect(await fil()).toEqual([david, rene].sort((a, b) => a - b));
		await base.delete(notification);
		await notifierPublication(base, await publier(base, base.photos, acteur(chef), cleA, { type: 'message', texte: 'Amicale' }, maintenant), maintenant);
		expect(await fil()).toEqual([rose]);
		await base.delete(notification);
		const ev = await publier(base, base.photos, acteur(chef), cleR, { type: 'evenement', texte: 'Repas', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		await notifierConvoques(base, ev, maintenant, { titre: 'Rappel', texte: 'Repas', seulementSansReponse: true });
		expect(await fil()).toEqual([rene]);
	});

	it('à ne pas manquer : les publications de ses murs ouverts ; un sondage seulement là où il peut voter', async () => {
		const { base, chef, rene, cleR } = await jeu();
		const a = await publier(base, base.photos, acteur(chef), 'vie', { type: 'annonce', texte: 'Note de vie', priseDeConnaissance: true }, maintenant);
		const s = await publier(base, base.photos, acteur(chef), 'vie', { type: 'message', texte: 'Sondage de vie', sondage }, maintenant);
		const sR = await publier(base, base.photos, acteur(chef), cleR, { type: 'message', texte: 'Sondage des retraités', sondage }, maintenant);
		const ev = await publier(base, base.photos, acteur(chef), cleR, { type: 'evenement', texte: 'Repas', evenement: { debut: '2026-11-02T19:00', lieu: 'Caserne', convoques: 'tous' } }, maintenant);
		const vu = await aNePasManquer(base, acteur(rene), aujourdhui, maintenant);
		expect(vu.annonces.map((x) => x.id)).toEqual([a]);
		expect(vu.sondages.map((x) => x.id)).toEqual([sR]);
		expect(vu.sondages.map((x) => x.id)).not.toContain(s);
		expect(vu.evenements.map((x) => x.id)).toEqual([ev]);
	});
});

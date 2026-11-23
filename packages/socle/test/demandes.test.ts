import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import {
	demanderAuReferent,
	demandesDuRole,
	effacerVieillesDemandesReferents,
	gesteDemande,
	gestesDemande,
	lireDemandeReferent,
	mesDemandesReferents,
	pageDesDemandes,
	reglerDemandes,
	rolesQuiRecoivent,
	type EtatDemandeReferent
} from '../src/demandes.ts';
import { accueilDe } from '../src/casquettes.ts';
import { courrielsDeDemande } from '../src/courriels.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { changerStatut } from '../src/actions/personnes.ts';
import { effacerAgentsPartis } from '../src/partis.ts';
import { couper, enTeteDe, filDeNotifications, marquerLue, toutMarquerLu } from '../src/notifications.ts';
import { abonnementPush, attribution, avisDemandeReferent, demandeReferent, envoiPush, filDemandeReferent, journal, personne, profil, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const QUAND = '2026-11-23T10:00';
const PLUS_TARD = '2026-11-23T11:00';

// Le jeu de départ ; Alice et Bob (agents), Paul et Pia (référents pharmacie), Claire (cheffe de centre), Adam (adjoint),
// un extérieur et le super administrateur. La pharmacie a deux étapes, « Commandée » puis « Reçue », et finit sur « Livrée ».
async function jeu({ titulaires = true } = {}) {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const profils = Object.fromEntries((await base.select().from(profil)).map((p) => [p.nom, p.id]));
	const nouvelle = async (prenom: string, nomProfil = 'Agent') => (await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Fictif', profilId: profils[nomProfil]! }).returning())[0]!.id;
	const role = async (nom: string) => (await base.select().from(responsabilite).where(eq(responsabilite.nom, nom)))[0]!.id;
	const nommer = async (personneId: number, nom: string, fin: string | null = null) =>
		base.insert(attribution).values({ personneId, responsabiliteId: await role(nom), perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', fin, saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const qui = (id: number): Acteur => ({ type: 'personne', id });
	const ids = { alice: await nouvelle('Alice'), bob: await nouvelle('Bob'), paul: await nouvelle('Paul'), pia: await nouvelle('Pia'), claire: await nouvelle('Claire'), adam: await nouvelle('Adam'), exterieur: await nouvelle('Estelle', 'Réserve citoyenne') };
	if (titulaires) {
		await nommer(ids.paul, 'Référent pharmacie');
		await nommer(ids.pia, 'Référent pharmacie');
	}
	await nommer(ids.claire, 'Chef de centre');
	await nommer(ids.adam, 'Chef de centre adjoint');
	const pharmacie = await role('Référent pharmacie');
	await reglerDemandes(base, qui(ids.claire), pharmacie, { etapes: [{ nom: 'Commandée' }, { nom: 'Reçue' }], derniere: 'Livrée' }, QUAND);
	const etapes = (await base.select().from(responsabilite).where(eq(responsabilite.id, pharmacie)))[0]!.demandes!.etapes;
	const [commandee, recue] = etapes.map((e) => e.id) as [string, string];
	const avis = async (id: number) => base.select().from(avisDemandeReferent).where(eq(avisDemandeReferent.personneId, id)).orderBy(avisDemandeReferent.id);
	const demande = async (id: number) => (await base.select().from(demandeReferent).where(eq(demandeReferent.id, id)))[0]!;
	const demander = (acteur: number, texte = 'Compresses stériles', roleId = pharmacie) => demanderAuReferent(base, qui(acteur), roleId, texte, QUAND);
	const geste = (acteur: number, id: number, g: Parameters<typeof gesteDemande>[3], quand = PLUS_TARD) => gesteDemande(base, qui(acteur), id, g, quand);
	return { base, ids, qui, nommer, role, pharmacie, commandee, recue, avis, demande, demander, geste, superAdmin: { type: 'super', email: 'a@b.fr' } as Acteur };
}

describe('faire une demande', () => {
	it('un texte libre à un rôle qui en reçoit ; ses titulaires sont prévenus (cloche et téléphone), ni le chef ni l’auteur', async () => {
		const j = await jeu();
		await j.base.insert(abonnementPush).values({ personneId: j.ids.paul, endpoint: 'https://fcm.googleapis.com/x', p256dh: 'p', auth: 'a', appareil: 'Téléphone', creeLe: QUAND });
		const id = await j.demander(j.ids.alice, '  Compresses   stériles, la boîte est vide ');
		expect(await j.demande(id)).toMatchObject({ responsabiliteId: j.pharmacie, demandeurId: j.ids.alice, texte: 'Compresses stériles, la boîte est vide', etape: 'demandee', question: null, prisePar: null, creeLe: QUAND, finLe: null });
		const attendu = { titre: 'Nouvelle demande d’Alice Fictif', texte: 'Compresses stériles, la boîte est vide (Référent pharmacie)', url: `/demandes/${id}`, lueLe: null };
		expect(await j.avis(j.ids.paul)).toMatchObject([attendu]);
		expect(await j.avis(j.ids.pia)).toMatchObject([attendu]);
		expect(await j.avis(j.ids.claire)).toEqual([]);
		expect(await j.avis(j.ids.alice)).toEqual([]);
		const [envoi] = await j.base.select().from(envoiPush);
		expect(JSON.parse(envoi!.donnees)).toMatchObject({ url: `/demandes/${id}`, lue: { genre: 'demande' } });
	});

	it('rôle sans titulaire (ou le sien terminé) : la cheffe et l’adjoint la reçoivent', async () => {
		const j = await jeu({ titulaires: false });
		await j.nommer(j.ids.paul, 'Référent pharmacie', '2026-10-31');
		await j.demander(j.ids.alice);
		expect(await j.avis(j.ids.claire)).toHaveLength(1);
		expect(await j.avis(j.ids.adam)).toHaveLength(1);
		expect(await j.avis(j.ids.paul)).toEqual([]);
	});

	it('le seul titulaire qui demande pour lui-même : la cheffe et l’adjoint sont prévenus à sa place', async () => {
		const j = await jeu({ titulaires: false });
		await j.nommer(j.ids.paul, 'Référent pharmacie');
		await j.demander(j.ids.paul);
		expect(await j.avis(j.ids.claire)).toHaveLength(1);
		expect(await j.avis(j.ids.paul)).toEqual([]);
	});

	it('refusée : vide, trop longue, pour un extérieur ou le super administrateur, ou à un rôle qui n’en reçoit pas', async () => {
		const j = await jeu();
		await expect(j.demander(j.ids.alice, '   ')).rejects.toThrow('Demande vide');
		await expect(j.demander(j.ids.alice, 'x'.repeat(501))).rejects.toThrow('Demande trop longue');
		await expect(j.demander(j.ids.exterieur)).rejects.toThrow('Réservé aux agents du centre');
		await expect(demanderAuReferent(j.base, j.superAdmin, j.pharmacie, 'Compresses', QUAND)).rejects.toThrow('Réservé aux agents du centre');
		await expect(j.demander(j.ids.alice, 'Veste', await j.role('Référent habillement'))).rejects.toThrow('Ce rôle ne reçoit pas de demandes');
		await expect(j.demander(j.ids.alice, 'Veste', 999)).rejects.toThrow('Ce rôle ne reçoit pas de demandes');
		expect(await j.base.select().from(demandeReferent)).toEqual([]);
	});

	it('plusieurs demandes en cours pour un même agent ; les rôles qui en reçoivent, à choisir', async () => {
		const j = await jeu();
		await j.demander(j.ids.alice, 'Compresses');
		await j.demander(j.ids.alice, 'Lampe frontale', await j.role('Référent engins'));
		expect((await mesDemandesReferents(j.base, j.qui(j.ids.alice))).enCours.map((d) => [d.texte, d.role]).sort()).toEqual([['Compresses', 'Référent pharmacie'], ['Lampe frontale', 'Référent engins']]);
		expect((await rolesQuiRecoivent(j.base)).map((r) => r.nom)).toEqual(['Référent engins', 'Référent pharmacie']);
	});
});

describe('l’e-mail d’une nouvelle demande', () => {
	it('à ceux qui la reçoivent en notification, sauf s’ils l’ont coupé ; pas pour la suite', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.alice, 'Compresses');
		const titre = 'Nouvelle demande d’Alice Fictif';
		expect(await courrielsDeDemande(j.base, { genre: 'demande', id })).toEqual([
			{ a: 'paul@exemple.fr', titre, texte: 'Compresses (Référent pharmacie)', url: `/demandes/${id}` },
			{ a: 'pia@exemple.fr', titre, texte: 'Compresses (Référent pharmacie)', url: `/demandes/${id}` }
		]);
		await couper(j.base, j.qui(j.ids.pia), 'courriel', true, QUAND);
		await j.geste(j.ids.paul, id, { quoi: 'question', texte: 'Taille ?' });
		expect((await courrielsDeDemande(j.base, { genre: 'demande', id })).map((c) => c.a)).toEqual(['paul@exemple.fr']);
	});
});

describe('gestes permis (sans base)', () => {
	const ordre = ['ea', 'eb'];
	const d = (etape: string, prisePar: number | null = null, question: EtatDemandeReferent['question'] = null): EtatDemandeReferent => ({ etape, question, demandeur: 1, prisePar });
	const agent = { moi: 1, gere: false };
	const referent = { moi: 2, gere: true };
	const collegue = { moi: 3, gere: true };

	it('demandée : le référent la prend, pose une question, l’avance ou la refuse ; l’agent précise ou annule', () => {
		expect(gestesDemande(d('demandee'), ordre, referent)).toEqual({ gestes: ['prendre', 'question', 'avancer', 'refuser'], vers: ['ea', 'eb', 'faite'] });
		expect(gestesDemande(d('demandee'), ordre, agent)).toEqual({ gestes: ['repondre', 'annuler'], vers: [] });
		expect(gestesDemande(d('demandee'), ordre, { moi: 4, gere: false })).toEqual({ gestes: [], vers: [] });
	});

	it('prise : celui qui la suit questionne, avance ou refuse ; un collègue la reprend ; une question posée attend sa réponse', () => {
		expect(gestesDemande(d('prise', 2), ordre, referent).gestes).toEqual(['question', 'avancer', 'refuser']);
		expect(gestesDemande(d('prise', 2), ordre, collegue).gestes).toEqual(['reprendre']);
		expect(gestesDemande(d('prise', 2, 'posee'), ordre, referent).gestes).toEqual(['avancer', 'refuser']);
		expect(gestesDemande(d('prise', 2, 'posee'), ordre, agent).gestes).toEqual(['repondre', 'annuler']);
	});

	it('à une étape intermédiaire : seulement vers une étape placée après, selon l’ordre du moment ; plus d’annulation', () => {
		expect(gestesDemande(d('ea', 2), ordre, referent)).toEqual({ gestes: ['question', 'avancer', 'refuser'], vers: ['eb', 'faite'] });
		expect(gestesDemande(d('eb', 2), ordre, referent).vers).toEqual(['faite']);
		// Déplacée depuis : l'ordre du moment compte.
		expect(gestesDemande(d('ea', 2), ['eb', 'ea'], referent).vers).toEqual(['faite']);
		expect(gestesDemande(d('ea', 2), ordre, agent).gestes).toEqual(['repondre']);
	});

	it('finie : plus aucun geste', () => {
		for (const etape of ['faite', 'refusee', 'annulee']) {
			expect(gestesDemande(d(etape, 2), ordre, referent)).toEqual({ gestes: [], vers: [] });
			expect(gestesDemande(d(etape, 2), ordre, agent)).toEqual({ gestes: [], vers: [] });
		}
	});
});

describe('le suivi d’une demande', () => {
	it('prise, question, réponse, Commandée, Livrée : l’agent apprend chaque étape, le référent chaque réponse ; tout est dans le fil', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.alice, 'Compresses');
		await j.geste(j.ids.paul, id, { quoi: 'prendre' });
		expect(await j.demande(id)).toMatchObject({ etape: 'prise', prisePar: j.ids.paul, majLe: PLUS_TARD });
		await j.geste(j.ids.paul, id, { quoi: 'question', texte: 'Quelle taille ?' });
		expect(await j.demande(id)).toMatchObject({ etape: 'prise', question: 'posee' });
		await j.geste(j.ids.alice, id, { quoi: 'repondre', texte: '10 x 10' });
		expect((await j.demande(id)).question).toBe('repondue');
		await j.geste(j.ids.alice, id, { quoi: 'repondre', texte: 'Une boîte suffit' });
		await j.geste(j.ids.paul, id, { quoi: 'avancer', vers: j.commandee, texte: '' });
		expect(await j.demande(id)).toMatchObject({ etape: j.commandee, question: null, finLe: null });
		await j.geste(j.ids.paul, id, { quoi: 'avancer', vers: 'faite', texte: 'Dans votre casier' });
		expect(await j.demande(id)).toMatchObject({ etape: 'faite', mot: 'Dans votre casier', finLe: PLUS_TARD });

		expect((await j.avis(j.ids.alice)).map((a) => [a.titre, a.texte])).toEqual([
			['Demande prise en compte par Paul Fictif', 'Compresses'],
			['Question de Paul Fictif', 'Quelle taille ?'],
			['Demande passée à l’étape Commandée', 'Compresses'],
			['Demande livrée', 'Compresses (Dans votre casier)']
		]);
		expect((await j.avis(j.ids.paul)).map((a) => a.titre)).toEqual(['Nouvelle demande d’Alice Fictif', 'Réponse d’Alice Fictif', 'Précision d’Alice Fictif']);
		expect((await j.avis(j.ids.pia)).map((a) => a.titre)).toEqual(['Nouvelle demande d’Alice Fictif']);
		const vue = await lireDemandeReferent(j.base, j.qui(j.ids.alice), id, PLUS_TARD);
		expect(vue.fil.map((f) => [f.quoi, f.etape, f.texte, f.deLAgent])).toEqual([
			['prise', null, null, false],
			['question', null, 'Quelle taille ?', false],
			['reponse', null, '10 x 10', true],
			['precision', null, 'Une boîte suffit', true],
			['etape', 'Commandée', null, false],
			['fin', 'Livrée', 'Dans votre casier', false]
		]);
		expect(vue).toMatchObject({ etape: 'faite', nomEtape: 'Livrée', prisePar: 'Paul Fictif', demandeur: 'Alice Fictif', role: 'Référent pharmacie', sienne: true, gestes: [], vers: [] });
		expect(vue.etapes.map((e) => e.nom)).toEqual(['Demandée', 'Prise en compte', 'Commandée', 'Reçue', 'Livrée']);
	});

	it('sauter des étapes, jamais en arrière ; une étape retirée ou inconnue est refusée', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.alice);
		// D'emblée, depuis « Demandée » : prise du même coup.
		await j.geste(j.ids.paul, id, { quoi: 'avancer', vers: j.recue, texte: '' });
		expect(await j.demande(id)).toMatchObject({ etape: j.recue, prisePar: j.ids.paul });
		await expect(j.geste(j.ids.paul, id, { quoi: 'avancer', vers: j.commandee, texte: '' })).rejects.toThrow('Étape impossible');
		await expect(j.geste(j.ids.paul, id, { quoi: 'avancer', vers: 'e12345678', texte: '' })).rejects.toThrow('Étape impossible');
		await expect(j.geste(j.ids.paul, id, { quoi: 'avancer', vers: 'prise', texte: '' })).rejects.toThrow('Étape impossible');
		// Les étapes changent de place : l'ordre du moment compte.
		const autre = await j.demander(j.ids.bob);
		await j.geste(j.ids.paul, autre, { quoi: 'avancer', vers: j.commandee, texte: '' });
		await reglerDemandes(j.base, j.qui(j.ids.claire), j.pharmacie, { etapes: [{ id: j.recue, nom: 'Reçue' }, { id: j.commandee, nom: 'Commandée' }], derniere: 'Livrée' }, QUAND);
		await expect(j.geste(j.ids.paul, autre, { quoi: 'avancer', vers: j.recue, texte: '' })).rejects.toThrow('Étape impossible');
		await j.geste(j.ids.paul, autre, { quoi: 'avancer', vers: 'faite', texte: '' });
		// Une étape retirée n'est plus atteignable.
		await reglerDemandes(j.base, j.qui(j.ids.claire), j.pharmacie, { etapes: [{ id: j.recue, nom: 'Reçue' }], derniere: 'Livrée' }, QUAND);
		const troisieme = await j.demander(j.ids.bob);
		await expect(j.geste(j.ids.paul, troisieme, { quoi: 'avancer', vers: j.commandee, texte: '' })).rejects.toThrow('Étape impossible');
	});

	it('renommer une étape : la demande et son fil suivent le nouveau nom ; une étape retirée garde son ancien nom dans le fil', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.alice);
		await j.geste(j.ids.paul, id, { quoi: 'avancer', vers: j.commandee, texte: '' });
		await reglerDemandes(j.base, j.qui(j.ids.claire), j.pharmacie, { etapes: [{ id: j.commandee, nom: 'Commandée au SDIS' }, { id: j.recue, nom: 'Reçue' }], derniere: 'Livrée' }, QUAND);
		const vue = await lireDemandeReferent(j.base, j.qui(j.ids.alice), id, PLUS_TARD);
		expect(vue.nomEtape).toBe('Commandée au SDIS');
		expect(vue.fil.at(-1)!.etape).toBe('Commandée au SDIS');
		await j.geste(j.ids.paul, id, { quoi: 'avancer', vers: j.recue, texte: '' });
		await reglerDemandes(j.base, j.qui(j.ids.claire), j.pharmacie, { etapes: [{ id: j.recue, nom: 'Reçue' }], derniere: 'Livrée' }, QUAND);
		expect((await lireDemandeReferent(j.base, j.qui(j.ids.alice), id, PLUS_TARD)).fil.map((f) => f.etape)).toEqual(['Commandée au SDIS', 'Reçue']);
	});

	it('refus avec un mot obligatoire ; une question exige un texte ; la dernière étape, un mot facultatif', async () => {
		const j = await jeu();
		const a = await j.demander(j.ids.alice);
		await expect(j.geste(j.ids.paul, a, { quoi: 'question', texte: '' })).rejects.toThrow('Message vide');
		await expect(j.geste(j.ids.paul, a, { quoi: 'refuser', texte: ' ' })).rejects.toThrow('Refus sans explication');
		await j.geste(j.ids.paul, a, { quoi: 'refuser', texte: 'Il en reste au centre.' });
		expect(await j.demande(a)).toMatchObject({ etape: 'refusee', mot: 'Il en reste au centre.', finLe: PLUS_TARD });
		expect((await j.avis(j.ids.alice)).at(-1)).toMatchObject({ titre: 'Demande refusée par Paul Fictif', texte: 'Il en reste au centre.' });
		await expect(j.geste(j.ids.alice, a, { quoi: 'repondre', texte: 'Dommage' })).rejects.toThrow('Geste impossible');
		const b = await j.demander(j.ids.alice);
		await j.geste(j.ids.paul, b, { quoi: 'avancer', vers: 'faite', texte: '' });
		expect(await j.demande(b)).toMatchObject({ etape: 'faite', mot: null });
	});

	it('l’agent annule tant que la demande n’a pas dépassé « Prise en compte » ; qui la suit est prévenu', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.alice);
		await j.geste(j.ids.paul, id, { quoi: 'prendre' });
		await j.geste(j.ids.alice, id, { quoi: 'annuler' });
		expect(await j.demande(id)).toMatchObject({ etape: 'annulee', finLe: PLUS_TARD });
		expect((await j.avis(j.ids.paul)).at(-1)).toMatchObject({ titre: 'Demande annulée par Alice Fictif', texte: 'Compresses stériles' });
		const autre = await j.demander(j.ids.alice);
		await j.geste(j.ids.paul, autre, { quoi: 'avancer', vers: j.commandee, texte: '' });
		await expect(j.geste(j.ids.alice, autre, { quoi: 'annuler' })).rejects.toThrow('Geste impossible');
	});

	it('une précision avant toute prise en compte va aux titulaires ; une annulation à personne ; jamais au chef', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.alice);
		await j.geste(j.ids.alice, id, { quoi: 'repondre', texte: 'Taille 10' });
		expect((await j.avis(j.ids.paul)).map((a) => a.titre)).toEqual(['Nouvelle demande d’Alice Fictif', 'Précision d’Alice Fictif']);
		await j.geste(j.ids.alice, id, { quoi: 'annuler' });
		expect(await j.avis(j.ids.paul)).toHaveLength(2);
		expect(await j.avis(j.ids.claire)).toEqual([]);
	});

	it('je la reprends : un autre titulaire, la cheffe ou l’adjoint ; c’est dans le fil, et le collègue est prévenu', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.alice);
		await j.geste(j.ids.paul, id, { quoi: 'prendre' });
		await j.geste(j.ids.pia, id, { quoi: 'reprendre' });
		expect((await j.demande(id)).prisePar).toBe(j.ids.pia);
		expect((await j.avis(j.ids.paul)).at(-1)).toMatchObject({ titre: 'Demande reprise par Pia Fictif', texte: 'Compresses stériles' });
		await j.geste(j.ids.adam, id, { quoi: 'reprendre' });
		expect((await j.demande(id)).prisePar).toBe(j.ids.adam);
		expect((await lireDemandeReferent(j.base, j.qui(j.ids.alice), id, PLUS_TARD)).fil.map((f) => f.quoi)).toEqual(['prise', 'reprise', 'reprise']);
		await expect(j.geste(j.ids.bob, id, { quoi: 'reprendre' })).rejects.toThrow('Demande inconnue');
	});

	it('deux titulaires prennent en compte la même demande en même temps : un seul gagne, l’autre est refusé clairement', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.alice);
		const resultats = await Promise.allSettled([j.geste(j.ids.paul, id, { quoi: 'prendre' }), j.geste(j.ids.pia, id, { quoi: 'prendre' })]);
		expect(resultats.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		const refus = resultats.find((r) => r.status === 'rejected') as PromiseRejectedResult;
		expect(String(refus.reason)).toMatch(/Demande changée entre-temps|Geste impossible/);
		expect(await j.base.select().from(filDemandeReferent)).toHaveLength(1);
		expect((await j.avis(j.ids.alice))).toHaveLength(1);
	});

	it('au journal : prise, reprise, question, étape, fin, refus, annulation ; pas les réponses ni les précisions', async () => {
		const j = await jeu();
		await j.base.delete(journal);
		const a = await j.demander(j.ids.alice);
		await j.geste(j.ids.paul, a, { quoi: 'prendre' });
		await j.geste(j.ids.paul, a, { quoi: 'question', texte: 'Taille ?' });
		await j.geste(j.ids.alice, a, { quoi: 'repondre', texte: '10' });
		await j.geste(j.ids.paul, a, { quoi: 'avancer', vers: j.commandee, texte: '' });
		await j.geste(j.ids.paul, a, { quoi: 'avancer', vers: 'faite', texte: '' });
		const b = await j.demander(j.ids.alice);
		await j.geste(j.ids.paul, b, { quoi: 'refuser', texte: 'Non.' });
		const c = await j.demander(j.ids.alice);
		await j.geste(j.ids.alice, c, { quoi: 'annuler' });
		const lignes = await j.base.select().from(journal).orderBy(journal.id);
		expect(lignes.map((l) => [l.action, l.cibleType, l.cibleId])).toEqual([
			['prendre_demande', 'demande_referent', a],
			['questionner_demande', 'demande_referent', a],
			['avancer_demande', 'demande_referent', a],
			['finir_demande', 'demande_referent', a],
			['refuser_demande', 'demande_referent', b],
			['annuler_demande', 'demande_referent', c]
		]);
	});
});

describe('qui voit, qui agit', () => {
	it('voir : l’auteur, les titulaires, la cheffe et l’adjoint ; inconnue pour un autre agent', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.alice);
		for (const qui of [j.ids.alice, j.ids.paul, j.ids.pia, j.ids.claire, j.ids.adam]) await lireDemandeReferent(j.base, j.qui(qui), id, PLUS_TARD);
		await expect(lireDemandeReferent(j.base, j.qui(j.ids.bob), id, PLUS_TARD)).rejects.toThrow('Demande inconnue');
		await expect(j.geste(j.ids.bob, id, { quoi: 'prendre' })).rejects.toThrow('Demande inconnue');
		expect((await lireDemandeReferent(j.base, j.qui(j.ids.claire), id, PLUS_TARD)).gestes).toEqual(['prendre', 'question', 'avancer', 'refuser']);
	});

	it('un titulaire dont le rôle a pris fin ne voit plus ni n’agit plus', async () => {
		const j = await jeu({ titulaires: false });
		await j.nommer(j.ids.paul, 'Référent pharmacie', '2026-11-22');
		const id = await j.demander(j.ids.alice);
		await expect(lireDemandeReferent(j.base, j.qui(j.ids.paul), id, PLUS_TARD)).rejects.toThrow('Demande inconnue');
		await expect(j.geste(j.ids.paul, id, { quoi: 'prendre' })).rejects.toThrow('Demande inconnue');
		await expect(demandesDuRole(j.base, j.qui(j.ids.paul), j.pharmacie, '2026-11-23')).rejects.toThrow();
	});

	it('la liste du rôle : en cours (les nouvelles d’abord), puis terminées ; pour ses titulaires, la cheffe et l’adjoint', async () => {
		const j = await jeu();
		const a = await j.demander(j.ids.alice, 'Compresses');
		const b = await j.demander(j.ids.bob, 'Sérum');
		await j.geste(j.ids.paul, a, { quoi: 'prendre' });
		const c = await j.demander(j.ids.bob, 'Gants');
		await j.geste(j.ids.paul, c, { quoi: 'refuser', texte: 'Non.' });
		const liste = await demandesDuRole(j.base, j.qui(j.ids.pia), j.pharmacie, '2026-11-23');
		expect(liste.role).toMatchObject({ id: j.pharmacie, nom: 'Référent pharmacie' });
		expect(liste.enCours.map((d) => d.id)).toEqual([b, a]);
		expect(liste.terminees.map((d) => [d.id, d.nomEtape])).toEqual([[c, 'Refusée']]);
		await demandesDuRole(j.base, j.qui(j.ids.adam), j.pharmacie, '2026-11-23');
		await expect(demandesDuRole(j.base, j.qui(j.ids.alice), j.pharmacie, '2026-11-23')).rejects.toThrow();
	});

	it('ouvrir sa demande marque ses avis lus ; rien n’est écrit pour un curieux', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.alice);
		await j.geste(j.ids.paul, id, { quoi: 'prendre' });
		await lireDemandeReferent(j.base, j.qui(j.ids.alice), id, PLUS_TARD);
		expect((await j.avis(j.ids.alice)).map((a) => a.lueLe)).toEqual([PLUS_TARD]);
		expect((await j.avis(j.ids.pia)).map((a) => a.lueLe)).toEqual([null]);
	});
});

describe('la page des demandes', () => {
	it('à qui demander, ce qu’on reçoit (titulaire : son rôle ; cheffe : tous), avec le nombre en cours, et mes demandes', async () => {
		const j = await jeu();
		await j.demander(j.ids.alice);
		const page = async (qui: number) => pageDesDemandes(j.base, j.qui(qui), '2026-11-23');
		const alice = await page(j.ids.alice);
		expect(alice.roles.map((r) => r.nom)).toEqual(['Référent engins', 'Référent pharmacie']);
		expect(alice.recus).toEqual([]);
		expect(alice.enCours.map((d) => d.texte)).toEqual(['Compresses stériles']);
		expect((await page(j.ids.paul)).recus).toMatchObject([{ id: j.pharmacie, nom: 'Référent pharmacie', enCours: 1 }]);
		expect((await page(j.ids.claire)).recus.map((r) => [r.nom, r.enCours])).toEqual([['Référent engins', 0], ['Référent pharmacie', 1]]);
	});
});

describe('l’accueil', () => {
	const reglage = centreExemple.astreinte;
	const accueil = (j: Awaited<ReturnType<typeof jeu>>, qui: number, casquette: string | null = null) => accueilDe(j.base, j.qui(qui), casquette, '2026-11-23', PLUS_TARD, reglage);

	it('la casquette du rôle : les demandes à prendre en compte et celles qu’on suit dont la réponse est arrivée, et le lien vers toutes', async () => {
		const j = await jeu();
		const a = await j.demander(j.ids.alice, 'Compresses');
		const cle = `role:${j.pharmacie}`;
		let paul = await accueil(j, j.ids.paul, cle);
		expect(paul.contenu).toMatchObject({ type: 'role', aDecider: [{ texte: 'Demande d’Alice Fictif à prendre en compte', lien: `/demandes/${a}` }], liens: [{ texte: 'Toutes les demandes', lien: `/demandes/role/${j.pharmacie}` }] });
		expect(paul.casquettes.find((c) => c.id === cle)!.compte).toBe(1);
		await j.demander(j.ids.bob, 'Sérum');
		expect((await accueil(j, j.ids.paul, cle)).contenu).toMatchObject({ aDecider: [{ texte: '2 demandes à prendre en compte', lien: `/demandes/role/${j.pharmacie}` }] });
		// Prise par Paul : elle sort de chez Pia, reste chez Paul à traiter ; la question posée l'en retire jusqu'à la réponse.
		await j.geste(j.ids.paul, a, { quoi: 'prendre' });
		expect((await accueil(j, j.ids.pia, cle)).contenu).toMatchObject({ aDecider: [{ texte: 'Demande de Bob Fictif à prendre en compte' }] });
		// Prise sans question : plus rien à décider, elle attend dans la liste du rôle.
		paul = await accueil(j, j.ids.paul, cle);
		expect(paul.contenu).toMatchObject({ aDecider: [{ texte: 'Demande de Bob Fictif à prendre en compte' }] });
		await j.geste(j.ids.paul, a, { quoi: 'avancer', vers: j.commandee, texte: '' });
		await j.geste(j.ids.paul, a, { quoi: 'question', texte: 'Quelle taille ?' });
		expect((await accueil(j, j.ids.paul, cle)).contenu).toMatchObject({ aDecider: [{ texte: 'Demande de Bob Fictif à prendre en compte' }] });
		await j.geste(j.ids.alice, a, { quoi: 'repondre', texte: '10 x 10' });
		expect((await accueil(j, j.ids.paul, cle)).contenu).toMatchObject({ aDecider: [{}, { texte: 'Réponse d’Alice Fictif à lire (Compresses)', lien: `/demandes/${a}` }] });
		// La cheffe n'en voit rien : le rôle a ses titulaires.
		const claire = await accueil(j, j.ids.claire, 'centre');
		expect(JSON.stringify(claire.contenu)).not.toContain('/demandes/');
	});

	it('rôle sans titulaire : dans « Le centre » de la cheffe et de l’adjoint ; et ce qu’ils suivent eux-mêmes', async () => {
		const j = await jeu({ titulaires: false });
		const a = await j.demander(j.ids.alice, 'Compresses');
		for (const qui of [j.ids.claire, j.ids.adam]) expect((await accueil(j, qui, 'centre')).contenu).toMatchObject({ type: 'centre', aDecider: expect.arrayContaining([{ texte: 'Demande d’Alice Fictif à prendre en compte (Référent pharmacie)', lien: `/demandes/${a}` }]) });
		await j.geste(j.ids.claire, a, { quoi: 'prendre' });
		await j.geste(j.ids.claire, a, { quoi: 'question', texte: 'Quelle taille ?' });
		await j.geste(j.ids.alice, a, { quoi: 'repondre', texte: '10' });
		const claire = (await accueil(j, j.ids.claire, 'centre')).contenu as { aDecider: { texte: string }[] };
		expect(claire.aDecider.map((x) => x.texte)).toContain('Réponse d’Alice Fictif à lire (Compresses)');
		expect(((await accueil(j, j.ids.adam, 'centre')).contenu as { aDecider: { texte: string }[] }).aDecider.map((x) => x.texte).join()).not.toContain('Alice');
	});

	it('un agent sans casquette de demandes : rien de plus, et pas une requête de plus', async () => {
		const j = await jeu();
		await j.demander(j.ids.alice);
		const avant = j.base.requetes;
		const bob = await accueil(j, j.ids.bob);
		expect(JSON.stringify(bob)).not.toContain('/demandes');
		const lues = j.base.requetes - avant;
		// Le même accueil sans aucune demande en base : autant de requêtes.
		await j.base.delete(avisDemandeReferent);
		await j.base.delete(demandeReferent);
		const ensuite = j.base.requetes;
		await accueil(j, j.ids.bob);
		expect(j.base.requetes - ensuite).toBe(lues);
	});
});

describe('la cloche', () => {
	it('les avis d’une demande comptent dans la cloche et son fil ; marqués lus un à un ou tous ensemble', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.alice);
		const [a] = await j.avis(j.ids.paul);
		expect((await enTeteDe(j.base, j.qui(j.ids.paul), '2026-11-23', PLUS_TARD)).nonLues).toBe(1);
		const fil = await filDeNotifications(j.base, j.qui(j.ids.paul), PLUS_TARD);
		expect(fil.lignes).toMatchObject([{ id: a!.id, type: 'demande', titre: 'Nouvelle demande d’Alice Fictif', url: `/demandes/${id}`, lue: false }]);
		await marquerLue(j.base, j.qui(j.ids.paul), 'demande', a!.id, PLUS_TARD);
		expect((await enTeteDe(j.base, j.qui(j.ids.paul), '2026-11-23', PLUS_TARD)).nonLues).toBe(0);
		await toutMarquerLu(j.base, j.qui(j.ids.pia), PLUS_TARD);
		expect((await j.avis(j.ids.pia))[0]!.lueLe).toBe(PLUS_TARD);
	});
});

describe('corrections de la relecture', () => {
	it('sans titulaire, une précision avant toute prise en compte va à la cheffe et à l’adjoint', async () => {
		const j = await jeu({ titulaires: false });
		const id = await j.demander(j.ids.alice);
		await j.geste(j.ids.alice, id, { quoi: 'repondre', texte: 'Taille 10' });
		expect((await j.avis(j.ids.claire)).map((a) => a.titre)).toEqual(['Nouvelle demande d’Alice Fictif', 'Précision d’Alice Fictif']);
	});

	it('un titulaire ne traite pas sa propre demande : elle va aux autres titulaires (seul, au chef et à l’adjoint)', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.paul, 'Gants');
		expect((await lireDemandeReferent(j.base, j.qui(j.ids.paul), id, PLUS_TARD)).gestes).toEqual(['repondre', 'annuler']);
		await expect(j.geste(j.ids.paul, id, { quoi: 'prendre' })).rejects.toThrow('Geste impossible');
		expect((await accueilDe(j.base, j.qui(j.ids.paul), `role:${j.pharmacie}`, '2026-11-23', PLUS_TARD, centreExemple.astreinte)).contenu).toMatchObject({ aDecider: [] });
		expect((await accueilDe(j.base, j.qui(j.ids.pia), `role:${j.pharmacie}`, '2026-11-23', PLUS_TARD, centreExemple.astreinte)).contenu).toMatchObject({ aDecider: [{ texte: 'Demande de Paul Fictif à prendre en compte' }] });
		await j.geste(j.ids.pia, id, { quoi: 'prendre' });
	});

	it('refusée après une étape : le suivi sait jusqu’où elle est allée', async () => {
		const j = await jeu();
		const id = await j.demander(j.ids.alice);
		await j.geste(j.ids.paul, id, { quoi: 'avancer', vers: j.commandee, texte: '' });
		await j.geste(j.ids.paul, id, { quoi: 'refuser', texte: 'Rupture.' });
		expect((await lireDemandeReferent(j.base, j.qui(j.ids.alice), id, PLUS_TARD)).franchie).toBe(2);
		const b = await j.demander(j.ids.alice);
		await j.geste(j.ids.alice, b, { quoi: 'annuler' });
		expect((await lireDemandeReferent(j.base, j.qui(j.ids.alice), b, PLUS_TARD)).franchie).toBe(0);
	});

	it('au départ d’un agent, ses demandes pas encore avancées sont annulées au nom de qui fait le geste ; le suiveur est prévenu', async () => {
		const j = await jeu();
		const a = await j.demander(j.ids.alice, 'Compresses');
		await j.geste(j.ids.paul, a, { quoi: 'prendre' });
		const b = await j.demander(j.ids.alice, 'Sérum');
		await j.geste(j.ids.paul, b, { quoi: 'avancer', vers: j.commandee, texte: '' });
		await changerStatut(j.base, j.base.photos, j.qui(j.ids.claire), j.ids.alice, 'parti', PLUS_TARD);
		expect(await j.demande(a)).toMatchObject({ etape: 'annulee', finLe: PLUS_TARD });
		expect((await j.demande(b)).etape).toBe(j.commandee);
		expect((await j.base.select().from(filDemandeReferent).where(eq(filDemandeReferent.demandeId, a))).at(-1)).toMatchObject({ quoi: 'annulation', par: j.ids.claire });
		expect((await j.avis(j.ids.paul)).at(-1)).toMatchObject({ titre: 'Demande d’Alice Fictif annulée', texte: 'Compresses', url: `/demandes/${a}` });
	});

	it('effacer un agent parti qui a demandé et écrit dans un fil : ses demandes partent, il ne suit plus celles des autres', async () => {
		const j = await jeu();
		const a = await j.demander(j.ids.paul, 'Gants');
		await j.geste(j.ids.paul, a, { quoi: 'repondre', texte: 'Taille M' });
		const b = await j.demander(j.ids.alice, 'Compresses');
		await j.geste(j.ids.paul, b, { quoi: 'question', texte: 'Combien ?' });
		await j.base.update(personne).set({ statut: 'parti', partiLe: '2025-01-01' }).where(eq(personne.id, j.ids.paul));
		expect(await effacerAgentsPartis(j.base, '2025-11-23', '2026-11-23', [])).toBe(1);
		expect((await j.base.select().from(demandeReferent)).map((d) => [d.id, d.prisePar])).toEqual([[b, null]]);
		expect((await j.base.select().from(filDemandeReferent)).map((f) => [f.demandeId, f.quoi])).toEqual([[b, 'question']]);
	});
});

describe('conservation', () => {
	it('une demande finie est effacée avec son fil 24 mois après sa fin ; une demande en cours reste', async () => {
		const j = await jeu();
		const a = await j.demander(j.ids.alice);
		await j.geste(j.ids.paul, a, { quoi: 'refuser', texte: 'Non.' });
		await j.base.update(demandeReferent).set({ finLe: '2024-10-01T10:00' }).where(eq(demandeReferent.id, a));
		const b = await j.demander(j.ids.alice);
		await effacerVieillesDemandesReferents(j.base, '2024-11-23');
		expect((await j.base.select().from(demandeReferent)).map((d) => d.id)).toEqual([b]);
		expect(await j.base.select().from(filDemandeReferent)).toEqual([]);
	});
});

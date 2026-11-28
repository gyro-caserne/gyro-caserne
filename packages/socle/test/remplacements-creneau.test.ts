import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { planningDe, publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import { astreinteDe } from '../src/planning/astreinte.ts';
import { agendaDe, monLienAgenda } from '../src/planning/agenda.ts';
import { filDeNotifications } from '../src/notifications.ts';
import { changerStatut } from '../src/actions/personnes.ts';
import { aNePasManquer } from '../src/a-ne-pas-manquer.ts';
import { remplacementsDuMoment } from '../src/remplacements/moment.ts';
import { bandesDe, disponibles, lireContexte, morceaux } from '../src/remplacements/contexte.ts';
import { demandeVue, pourDemanderCreneau, remplacementsAValider, remplacementsDe } from '../src/remplacements/lectures.ts';
import { accepterDemande, annulerDemande, demanderCreneau, demanderRemplacement, demanderRemplacementCourt, desister, ouvrirATous, proposerEchange, refuserDemande, refuserValidation, valider } from '../src/remplacements/demandes.ts';
import { abonnementPush, affectationEquipe, aptitude, aptitudeAgent, attribution, avisRemplacement, demandeRemplacement, destinataireRemplacement, envoiPush, equipe, personne, profil, responsabilite, vacancesAgent } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const reglage = centreExemple.astreinte;
const maintenant = '2026-11-01T10:00';
// Semaine du vendredi 6 novembre : équipe 1 (vendredi 18 h au lundi 6 h d'un seul tenant, puis les nuits) ; du 13 : équipe 2.
const nuitLundi9 = { debut: '2026-11-09T18:00', fin: '2026-11-10T06:00' };
const lundiSoir = { debut: '2026-11-09T20:10', fin: '2026-11-09T22:40' };

// Chef de centre (sans équipe) ; équipe 1 : Alice (CA1), David, Élodie (chef de garde) ; Bruno (équipe 2) ; Chloé (équipe 3, CA1).
async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const ids = (await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id);
	const roles = await base.select().from(responsabilite);
	const role = (systeme: string) => roles.find((r) => r.systeme === systeme)!.id;
	const nouvelle = async (prenom: string, equipeNo: number | null) => {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning();
		if (equipeNo) await base.insert(affectationEquipe).values({ personneId: p!.id, equipeId: ids[equipeNo - 1]!, debut: '2026-01-01' });
		await base.insert(abonnementPush).values({ personneId: p!.id, endpoint: `https://fcm.googleapis.com/${prenom}`, p256dh: 'a', auth: 'b', creeLe: maintenant });
		return p!.id;
	};
	const nommer = (personneId: number, systeme: string, equipeId: number | null) =>
		base.insert(attribution).values({ personneId, responsabiliteId: role(systeme), perimetreType: equipeId === null ? 'centre' : 'equipe', perimetreId: equipeId, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const chef = await nouvelle('Chef', null);
	await nommer(chef, 'chef_centre', null);
	const alice = await nouvelle('Alice', 1);
	const david = await nouvelle('David', 1);
	const elodie = await nouvelle('Elodie', 1);
	await nommer(elodie, 'chef_equipe', ids[0]!);
	const bruno = await nouvelle('Bruno', 2);
	const chloe = await nouvelle('Chloe', 3);
	const [ca1] = await base.select().from(aptitude).where(eq(aptitude.nom, 'CA1'));
	for (const p of [alice, chloe]) await base.insert(aptitudeAgent).values({ personneId: p, aptitudeId: ca1!.id, obtenueLe: '2020-01-01' });
	const qui = { type: 'super', email: 'a@b.fr' } as const;
	await reglerRoulement(base, qui, 2026, ids, maintenant);
	await publierAnnee(base, qui, 2026, maintenant);
	const a = (id: number): Acteur => ({ type: 'personne', id });
	const avisDe = async (id: number) => (await base.select().from(avisRemplacement).where(eq(avisRemplacement.personneId, id))).map((x) => x.quoi);
	// Les textes envoyés au téléphone de la personne.
	const textesDe = async (id: number) =>
		(await base.select({ donnees: envoiPush.donnees }).from(envoiPush).innerJoin(abonnementPush, eq(abonnementPush.id, envoiPush.abonnementId)).where(eq(abonnementPush.personneId, id))).map((e) => (JSON.parse(e.donnees) as { texte: string }).texte);
	const demande = async (id: number) => (await base.select().from(demandeRemplacement).where(eq(demandeRemplacement.id, id)))[0]!;
	const destinataires = async (id: number) => (await base.select().from(destinataireRemplacement).where(eq(destinataireRemplacement.demandeId, id))).map((x) => x.personneId).sort();
	return { base, chef: a(chef), alice: a(alice), david: a(david), elodie: a(elodie), bruno: a(bruno), chloe: a(chloe), n: { chef, alice, david, elodie, bruno, chloe }, textesDe, avisDe, demande, destinataires };
}

const creneau = (p: { debut: string; fin: string }, cibleId: number | null = null) => ({ ...p, cibleId });

describe('créneau : les règles', () => {
	it('refuse chaque cas avec un message qui dit pourquoi', async () => {
		const { base, alice, bruno } = await jeu();
		const refus = (p: { debut: string; fin: string }, message: string, qui = alice, quand = maintenant) => expect(demanderCreneau(base, qui, creneau(p), quand, reglage)).rejects.toThrow(new DonneeInvalide(message));
		await refus({ debut: 'mardi', fin: '2026-11-09T22:00' }, 'Indiquez le début et la fin du créneau');
		await refus({ debut: '2026-11-09T22:00', fin: '2026-11-09T21:00' }, 'La fin doit venir après le début');
		await refus({ debut: '2026-11-09T20:00', fin: '2026-11-09T20:59' }, 'Un créneau dure au moins 1 h');
		await refus({ debut: '2026-11-06T20:00', fin: '2026-11-14T20:00' }, 'Un créneau dure une semaine au plus');
		await refus({ debut: '2026-11-09T20:00', fin: '2026-11-09T22:00' }, 'Un créneau se demande au moins 1 h avant son début', alice, '2026-11-09T19:01');
		await refus({ debut: '2027-02-05T20:00', fin: '2027-02-05T22:00' }, 'Un créneau se demande dans les douze semaines à venir');
		// Hors de son astreinte, ou au-delà de sa fin : le message dit l'heure.
		await refus({ debut: '2026-11-09T10:00', fin: '2026-11-09T20:00' }, 'Le créneau doit commencer pendant votre astreinte');
		await refus({ debut: '2026-11-09T20:00', fin: '2026-11-09T20:00' }, 'La fin doit venir après le début');
		await refus({ debut: '2026-11-09T20:00', fin: '2026-11-10T08:00' }, 'Le créneau doit finir mardi 10 novembre à 6 h au plus tard');
		// Un trou entre deux astreintes : jamais.
		await refus({ debut: '2026-11-09T20:00', fin: '2026-11-10T20:00' }, 'Le créneau doit finir mardi 10 novembre à 6 h au plus tard');
		await refus({ debut: '2026-11-09T20:00', fin: '2026-11-09T22:00' }, 'Le créneau doit commencer pendant votre astreinte', bruno);
		// Une heure qui n'existe pas (passage à l'heure d'été, 28 mars 2027).
		await refus({ debut: '2027-03-28T02:30', fin: '2027-03-28T05:00' }, 'Cette heure n’existe pas cette nuit-là (passage à l’heure d’été)', alice, '2027-03-01T10:00');
	});

	it('une date ou une heure qui n’existe pas : refusée', async () => {
		const { base, alice } = await jeu();
		const refus = new DonneeInvalide('Indiquez le début et la fin du créneau');
		await expect(demanderCreneau(base, alice, creneau({ debut: '2026-11-31T20:00', fin: '2026-11-31T22:00' }), maintenant, reglage)).rejects.toThrow(refus);
		await expect(demanderCreneau(base, alice, creneau({ debut: '2026-11-09T22:00', fin: '2026-11-09T24:00' }), maintenant, reglage)).rejects.toThrow(refus);
		await expect(demanderCreneau(base, alice, creneau({ debut: '2026-11-09T20:60', fin: '2026-11-09T22:00' }), maintenant, reglage)).rejects.toThrow(refus);
	});

	it('changement d’heure : la durée et le « 1 h avant » en heure réelle', async () => {
		const { base, alice } = await jeu();
		const refus = (p: { debut: string; fin: string }, quand: string) => demanderCreneau(base, alice, creneau(p), quand, reglage);
		const horsAstreinte = new DonneeInvalide('Le créneau doit commencer pendant votre astreinte');
		// Heure d'été, 28 mars 2027 : de 1 h 30 à 3 h 15, 45 min réelles.
		await expect(refus({ debut: '2027-03-28T01:30', fin: '2027-03-28T03:15' }, '2027-03-01T10:00')).rejects.toThrow(new DonneeInvalide('Un créneau dure au moins 1 h'));
		await expect(refus({ debut: '2027-03-28T01:30', fin: '2027-03-28T03:30' }, '2027-03-01T10:00')).rejects.toThrow(horsAstreinte);
		await expect(refus({ debut: '2027-03-28T03:15', fin: '2027-03-28T05:00' }, '2027-03-28T01:30')).rejects.toThrow(new DonneeInvalide('Un créneau se demande au moins 1 h avant son début'));
		// Une semaine d'horloge qui passe l'heure d'été : 167 h réelles, admise.
		await expect(refus({ debut: '2027-03-21T03:00', fin: '2027-03-28T03:00' }, '2027-03-01T10:00')).rejects.toThrow(horsAstreinte);
		// Heure d'hiver, 25 octobre 2026 : une semaine d'horloge fait 169 h réelles.
		await expect(refus({ debut: '2026-10-18T03:00', fin: '2026-10-25T03:00' }, '2026-10-01T10:00')).rejects.toThrow(new DonneeInvalide('Un créneau dure une semaine au plus'));
		// De 1 h 30 à 3 h, la nuit de l'heure d'hiver : 2 h 30 réelles, demandé à 0 h 15.
		await expect(refus({ debut: '2026-10-25T01:30', fin: '2026-10-25T03:00' }, '2026-10-25T00:15')).rejects.toThrow(horsAstreinte);
	});

	it('au moins 1 h, 1 h avant ; deux astreintes qui se suivent (la nuit du vendredi et la garde du samedi)', async () => {
		const { base, alice, demande } = await jeu();
		const id = await demanderCreneau(base, alice, creneau({ debut: '2026-11-06T21:00', fin: '2026-11-07T10:00' }), maintenant, reglage);
		expect(await demande(id)).toMatchObject({ genre: 'remplacement', creneau: 1, court: null, cibleId: null, periodes: JSON.stringify([{ debut: '2026-11-06T21:00', fin: '2026-11-07T10:00' }]), debut: '2026-11-06T21:00', etat: 'attente' });
		// Juste 1 h, juste 1 h avant.
		await demanderCreneau(base, alice, creneau({ debut: '2026-11-09T20:00', fin: '2026-11-09T21:00' }), '2026-11-09T19:00', reglage);
	});

	it('ni deux fois les mêmes heures, ni par-dessus une garde entière, un court ou un échange', async () => {
		const { base, alice, bruno, n } = await jeu();
		const deja = new DonneeInvalide('Période déjà dans une demande');
		await demanderCreneau(base, alice, creneau(lundiSoir), maintenant, reglage);
		await expect(demanderCreneau(base, alice, creneau({ debut: '2026-11-09T22:00', fin: '2026-11-09T23:30' }), maintenant, reglage)).rejects.toThrow(deja);
		await expect(demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage)).rejects.toThrow(deja);
		await expect(demanderRemplacementCourt(base, alice, { debut: '2026-11-09T21:00', duree: 2 }, '2026-11-09T18:30', reglage)).rejects.toThrow(deja);
		// La nuit qui le porte paraît « déjà demandée » dans le parcours des gardes et ne s'échange plus.
		const ctx = await lireContexte(base, maintenant, reglage);
		expect(bandesDe(ctx, n.alice)[0]!.tranches.find((t) => t.debut === nuitLundi9.debut)!.etat).toBe('prise');
		await expect(proposerEchange(base, alice, { periodes: [nuitLundi9], cibleId: n.bruno, periodesCible: [{ debut: '2026-11-16T18:00', fin: '2026-11-17T06:00' }] }, maintenant, reglage)).rejects.toThrow(deja);
		// Le reste de la nuit, après le créneau : possible.
		await demanderCreneau(base, alice, creneau({ debut: '2026-11-09T22:40', fin: '2026-11-10T01:00' }), maintenant, reglage);
		// Et l'inverse : une garde demandée ferme ses heures à un créneau.
		await demanderRemplacement(base, alice, { periodes: [{ debut: '2026-11-10T18:00', fin: '2026-11-11T06:00' }], cibleId: null }, maintenant, reglage);
		await expect(demanderCreneau(base, alice, creneau({ debut: '2026-11-10T20:00', fin: '2026-11-10T22:00' }), maintenant, reglage)).rejects.toThrow(deja);
		void bruno;
	});
});

describe('créneau : le circuit de la garde entière', () => {
	it('ouverte : les disponibles sur le créneau la reçoivent ; le texte dit ses heures', async () => {
		const { base, alice, n, textesDe, destinataires } = await jeu();
		const id = await demanderCreneau(base, alice, creneau({ debut: '2026-11-06T21:00', fin: '2026-11-07T07:00' }), maintenant, reglage);
		// David et Élodie sont d'astreinte avec elle : pas disponibles.
		expect(await destinataires(id)).toEqual([n.chef, n.bruno, n.chloe].sort());
		expect(await textesDe(n.bruno)).toEqual(['Alice Test, du vendredi 6 novembre, 21 h au samedi 7 novembre, 7 h']);
	});

	it('disponibles : pas un collègue en vacances le second jour du créneau', async () => {
		const { base, alice, n, destinataires } = await jeu();
		await base.insert(vacancesAgent).values({ personneId: n.bruno, annee: 2026, debut: '2026-11-07', fin: '2026-11-08' });
		const p = { debut: '2026-11-06T21:00', fin: '2026-11-07T10:00' };
		const ctx = await lireContexte(base, maintenant, reglage);
		expect(morceaux(ctx, [p])).toEqual([{ debut: '2026-11-06T21:00', fin: '2026-11-07T06:00' }, { debut: '2026-11-07T06:00', fin: '2026-11-07T10:00' }]);
		expect(disponibles(ctx, n.alice, morceaux(ctx, [p])).map((x) => x.id)).not.toContain(n.bruno);
		const id = await demanderCreneau(base, alice, creneau(p), maintenant, reglage);
		expect(await destinataires(id)).toEqual([n.chef, n.chloe].sort());
		// Une nuit entière, comme avant : vue au seul jour de son début.
		expect(disponibles(await lireContexte(base, maintenant, reglage), n.alice, [{ debut: '2026-11-06T18:00', fin: '2026-11-07T06:00' }]).map((x) => x.id)).toContain(n.bruno);
	});

	it('aptitude contrôlée manquante : le chef valide avant ; puis conclue', async () => {
		const { base, alice, bruno, elodie, n, demande, avisDe } = await jeu();
		const id = await demanderCreneau(base, alice, creneau(lundiSoir), maintenant, reglage);
		expect(await accepterDemande(base, bruno, id, maintenant, reglage)).toBe('a_valider');
		expect(await demande(id)).toMatchObject({ etat: 'a_valider', manque: '["CA1"]' });
		expect(await avisDe(n.elodie)).toEqual(['a_valider']);
		expect((await remplacementsAValider(base, elodie, maintenant)).map((x) => x.texte)).toEqual(['Remplacement à valider, Alice Test, lundi 9 novembre, de 20 h 10 à 22 h 40']);
		await valider(base, elodie, id, maintenant, reglage);
		expect((await demande(id)).etat).toBe('conclue');
		expect(await avisDe(n.alice)).toEqual(['acceptee', 'validee']);
	});

	it('ciblée : un collègue libre sur le créneau ; refusée, « Ouvrir à tous »', async () => {
		const { base, alice, bruno, chloe, n, demande, destinataires } = await jeu();
		await expect(demanderCreneau(base, alice, creneau(lundiSoir, n.david), maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Collègue indisponible sur ce créneau'));
		await expect(demanderCreneau(base, alice, creneau(lundiSoir, n.alice), maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Collègue indisponible sur ce créneau'));
		const id = await demanderCreneau(base, alice, creneau(lundiSoir, n.bruno), maintenant, reglage);
		expect(await destinataires(id)).toEqual([n.bruno]);
		await refuserDemande(base, bruno, id, maintenant, reglage);
		expect((await demande(id)).etat).toBe('refusee');
		await ouvrirATous(base, alice, id, maintenant, reglage);
		expect(await destinataires(id)).toEqual([n.chef, n.bruno, n.chloe].sort());
		expect(await accepterDemande(base, chloe, id, maintenant, reglage)).toBe('conclue');
	});

	it('annulée tant que personne n’a accepté ; après, le remplaçant se désiste', async () => {
		const { base, alice, chloe, demande } = await jeu();
		const id = await demanderCreneau(base, alice, creneau(lundiSoir), maintenant, reglage);
		await annulerDemande(base, alice, id, maintenant, reglage);
		expect((await demande(id)).etat).toBe('annulee');
		const autre = await demanderCreneau(base, alice, creneau(lundiSoir), maintenant, reglage);
		await accepterDemande(base, chloe, autre, maintenant, reglage);
		await expect(annulerDemande(base, alice, autre, maintenant, reglage)).rejects.toThrow(new DonneeInvalide('Déjà acceptée. Demandez au remplaçant de se désister'));
		await desister(base, chloe, autre, maintenant, reglage);
		expect((await demande(autre)).etat).toBe('attente');
	});

	it('refus du chef, puis désistement : la demande repart vers les autres disponibles, dite par ses heures', async () => {
		const { base, alice, bruno, chloe, elodie, n, textesDe, destinataires } = await jeu();
		const id = await demanderCreneau(base, alice, creneau(lundiSoir), maintenant, reglage);
		await accepterDemande(base, bruno, id, maintenant, reglage);
		await refuserValidation(base, elodie, id, null, maintenant, reglage);
		const repart = 'Alice Test est de nouveau sans remplaçant, lundi 9 novembre, de 20 h 10 à 22 h 40';
		expect((await textesDe(n.chloe)).filter((t) => t === repart)).toHaveLength(1);
		expect(await textesDe(n.bruno)).not.toContain(repart);
		await accepterDemande(base, chloe, id, maintenant, reglage);
		await desister(base, chloe, id, maintenant, reglage);
		// Ni Bruno, écarté par le chef, ni Chloé, qui se désiste.
		expect((await textesDe(n.chef)).filter((t) => t === repart)).toHaveLength(2);
		expect((await textesDe(n.chloe)).filter((t) => t === repart)).toHaveLength(1);
		expect(await textesDe(n.bruno)).not.toContain(repart);
		expect(await destinataires(id)).toEqual([n.chef, n.bruno, n.chloe].sort());
	});

	it('départ du remplaçant : le titulaire est prévenu, créneau dit par ses heures', async () => {
		const { base, alice, chloe, chef, n, textesDe, demande } = await jeu();
		const id = await demanderCreneau(base, alice, creneau(lundiSoir), maintenant, reglage);
		await accepterDemande(base, chloe, id, maintenant, reglage);
		await changerStatut(base, base.photos, chef, n.chloe, 'parti', maintenant);
		expect(await demande(id)).toMatchObject({ etat: 'attente', remplacantId: null });
		expect(await textesDe(n.alice)).toContain('Départ de votre remplaçant, lundi 9 novembre, de 20 h 10 à 22 h 40. Vous redevenez responsable.');
	});

	it('relancée la veille à 8 h, expirée à son début', async () => {
		const { base, alice, n, textesDe } = await jeu();
		await demanderCreneau(base, alice, creneau(lundiSoir), maintenant, reglage);
		expect(await remplacementsDuMoment(base, '2026-11-08T08:00')).toEqual({ expirees: 0, relances: 1 });
		expect(await textesDe(n.alice)).toEqual(['Personne n’a encore accepté votre demande, lundi 9 novembre, de 20 h 10 à 22 h 40']);
		expect(await remplacementsDuMoment(base, '2026-11-09T20:10')).toEqual({ expirees: 1, relances: 0 });
	});

	it('les écrans la disent par ses heures : liste, détail, À ne pas manquer, cloche', async () => {
		const { base, alice, chloe, n } = await jeu();
		const p = { debut: '2026-11-06T21:00', fin: '2026-11-07T07:00' };
		const id = await demanderCreneau(base, alice, creneau(p), maintenant, reglage);
		const texte = 'du vendredi 6 novembre, 21 h au samedi 7 novembre, 7 h';
		expect((await remplacementsDe(base, alice, maintenant, reglage)).miennes[0]).toMatchObject({ texte, creneau: true, court: false });
		const vue = await demandeVue(base, alice, id, maintenant, reglage);
		expect(vue.demande).toMatchObject({ texte, creneau: true });
		expect(vue.disponibles!.map((x) => x.id).sort()).toEqual([n.chef, n.chloe, n.bruno].sort());
		expect((await aNePasManquer(base, chloe, maintenant.slice(0, 10), maintenant)).remplacements.map((r) => r.sous)).toEqual([texte]);
		expect((await filDeNotifications(base, chloe, maintenant)).lignes.map((l) => ('texte' in l ? l.texte : ''))).toContain(`Alice Test, ${texte}`);
	});
});

describe('créneau conclu : planning, plaque, agenda', () => {
	it('planning : le remplaçant sur le seul créneau ; agenda : le créneau passe du titulaire au remplaçant', async () => {
		const { base, alice, chloe } = await jeu();
		const id = await demanderCreneau(base, alice, creneau(lundiSoir), maintenant, reglage);
		await accepterDemande(base, chloe, id, maintenant, reglage);
		const vu = (p: Awaited<ReturnType<typeof planningDe>>) => (p.publiee ? p.remplacements : []);
		expect(vu(await planningDe(base, alice, 2026, maintenant, reglage))).toEqual([{ ...lundiSoir, titulaire: 'Alice Test', remplacant: 'Chloe Test', moi: 'cede', creneau: true }]);
		const agenda = async (qui: Acteur) => (await agendaDe(base, await monLienAgenda(base, qui, maintenant), maintenant, reglage))!;
		// Alice : sa nuit du lundi coupée autour du créneau (20 h 10 à 22 h 40 à Paris, 19 h 10 à 21 h 40 en UTC).
		const deAlice = await agenda(alice);
		expect(deAlice).toContain('DTSTART:20261109T170000Z');
		expect(deAlice).toContain('DTEND:20261109T191000Z');
		expect(deAlice).toContain('DTSTART:20261109T214000Z');
		const deChloe = await agenda(chloe);
		expect(deChloe).toContain('SUMMARY:Remplacement de Alice Test');
		expect(deChloe).toContain('DTSTART:20261109T191000Z');
		expect(deChloe).toContain('DTEND:20261109T214000Z');
	});

	it('plaque de l’accueil : le créneau en cours ou à venir du jour, même long ; pas une garde entière', async () => {
		const { base, alice, chloe } = await jeu();
		const long = { debut: '2026-11-06T21:00', fin: '2026-11-07T10:00' };
		const id = await demanderCreneau(base, alice, creneau(long), maintenant, reglage);
		await accepterDemande(base, chloe, id, maintenant, reglage);
		const garde = await demanderRemplacement(base, alice, { periodes: [nuitLundi9], cibleId: null }, maintenant, reglage);
		await accepterDemande(base, chloe, garde, maintenant, reglage);
		expect((await astreinteDe(base, alice, '2026-11-06T15:00', reglage))!.courtsCedes).toEqual([{ ...long, remplacant: 'Chloe Test', creneau: true }]);
		// Commencé la veille : il court encore le samedi matin.
		expect((await astreinteDe(base, alice, '2026-11-07T08:00', reglage))!.courtsCedes).toEqual([{ ...long, remplacant: 'Chloe Test', creneau: true }]);
		expect((await astreinteDe(base, alice, '2026-11-07T10:00', reglage))!.courtsCedes).toEqual([]);
		expect((await astreinteDe(base, alice, '2026-11-09T15:00', reglage))!.courtsCedes).toEqual([]);
	});
});

describe('le parcours', () => {
	it('sans créneau : rien à vérifier ; avec : les collègues libres, ou le refus', async () => {
		const { base, alice, n } = await jeu();
		expect(await pourDemanderCreneau(base, alice, maintenant, reglage, null)).toEqual({ creneau: null, erreur: null, candidats: [] });
		const ok = await pourDemanderCreneau(base, alice, maintenant, reglage, lundiSoir);
		expect(ok.creneau).toEqual(lundiSoir);
		expect(ok.erreur).toBeNull();
		expect(ok.candidats.map((c) => c.id)).toEqual([n.chloe, n.bruno, n.chef]);
		expect(ok.candidats[1]).toMatchObject({ prenom: 'Bruno', manque: ['CA1'] });
		expect(await pourDemanderCreneau(base, alice, maintenant, reglage, { debut: '2026-11-09T20:00', fin: '2026-11-09T20:30' })).toEqual({ creneau: null, erreur: 'Un créneau dure au moins 1 h', candidats: [] });
	});
});

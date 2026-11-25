import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { fetesDuJourAuCentre, fetesPourMoi } from '../src/a-ne-pas-manquer.ts';
import { changerStatut } from '../src/actions/personnes.ts';
import { ancienneteDe, ancienneteDuMatin, feliciter, lirePaliers, reglerPaliers } from '../src/anciennete.ts';
import type { Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { abonner, couper, effacerVieillesNotifications, enTeteDe, filDeNotifications, marquerLue, toutMarquerLu } from '../src/notifications.ts';
import { attribution, avisAnciennete, envoiPush, journal, personne, profil, responsabilite } from '../src/schema.ts';
import { effacerSouhaitsPasses } from '../src/souhaits.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-12-12';
const maintenant = '2026-12-12T09:15:00';
const acteur = (id: number): Acteur => ({ type: 'personne', id });
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

// Thomas fête ses 10 ans de service aujourd'hui ; Claire est cheffe de centre, Paul adjoint, Marc un collègue. Chacun a un téléphone abonné.
async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const nouvelle = async (prenom: string, champs: Partial<typeof personne.$inferInsert> = {}) => {
		const [p] = await base.insert(personne).values({ email: `${prenom.toLowerCase()}@exemple.fr`, prenom, nom: 'Fictif', profilId: agent!.id, ...champs }).returning();
		await abonner(base, acteur(p!.id), { endpoint: `https://fcm.googleapis.com/fcm/send/${prenom}`, p256dh: 'BCle', auth: 'secret', appareil: 'Téléphone' }, maintenant);
		return p!.id;
	};
	const nommer = async (id: number, systeme: 'chef_centre' | 'chef_centre_adjoint') => {
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, systeme));
		await base.insert(attribution).values({ personneId: id, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	};
	const thomas = await nouvelle('Thomas', { nom: 'Agent', engagementSpv: '2016-12-12', entreeCentre: '2018-01-01' });
	const claire = await nouvelle('Claire', { nom: 'Martin', engagementSpv: '2001-03-04' });
	const paul = await nouvelle('Paul', { nom: 'Petit' });
	const marc = await nouvelle('Marc', { nom: 'Durand', engagementSpv: '2020-05-05' });
	await nommer(claire, 'chef_centre');
	await nommer(paul, 'chef_centre_adjoint');
	const envois = async (tag: string) => (await base.select({ donnees: envoiPush.donnees }).from(envoiPush)).map((e) => JSON.parse(e.donnees)).filter((d) => d.tag === tag);
	return { base, nouvelle, thomas, claire, paul, marc, envois };
}

describe('les paliers du centre', () => {
	it('par défaut, tous les 5 ans ; réglés par qui gère les listes, rangés, sans doublon, avec leur ligne au journal', async () => {
		const { base, claire } = await jeu();
		expect((await lirePaliers(base)).slice(0, 3)).toEqual([5, 10, 15]);
		await reglerPaliers(base, acteur(claire), [40, 10, 25, 20, 30, 10], maintenant);
		expect(await lirePaliers(base)).toEqual([10, 20, 25, 30, 40]);
		expect(await base.select({ action: journal.action, details: journal.details }).from(journal).where(eq(journal.action, 'regler_anciennete'))).toEqual([{ action: 'regler_anciennete', details: JSON.stringify({ paliers: [10, 20, 25, 30, 40] }) }]);
	});

	it('l’ancienneté d’un agent, pour Moi, en une requête, selon les paliers du centre', async () => {
		const { base, thomas, claire, paul } = await jeu();
		base.requetes = 0;
		expect(await ancienneteDe(base, thomas, '2026-11-24')).toMatchObject({ annees: 9, auCentre: 8, echelon: null, prochain: { annees: 10, jour: '2026-12-12' } });
		expect(base.requetes).toBe(1);
		await reglerPaliers(base, acteur(claire), [10, 20, 25, 30, 40], maintenant);
		expect(await ancienneteDe(base, claire, '2026-11-24')).toMatchObject({ annees: 25, echelon: 'vermeil', prochain: { annees: 30, jour: '2031-03-04' } });
		expect(await ancienneteDe(base, paul, '2026-11-24')).toEqual({ annees: null, auCentre: null, echelon: null, prochain: null });
	});

	it('refusés : sans le droit, hors de 1 à 60 ans, liste vide', async () => {
		const { base, claire, marc } = await jeu();
		await expect(reglerPaliers(base, acteur(marc), [10], maintenant)).rejects.toBeInstanceOf(RefusDroit);
		for (const mauvais of [[0], [1], [61], [2.5], []]) await expect(reglerPaliers(base, acteur(claire), mauvais, maintenant)).rejects.toBeInstanceOf(DonneeInvalide);
		expect((await lirePaliers(base))[0]).toBe(5);
	});
});

describe('le jour J', () => {
	it('le palier du jour se lit avec les anniversaires, en une requête ; rien pour soi-même ni pour le super administrateur', async () => {
		const { base, thomas, marc } = await jeu();
		await base.update(personne).set({ naissance: '1990-12-12' }).where(eq(personne.id, marc));
		base.requetes = 0;
		const fetes = await fetesDuJourAuCentre(base, acteur(marc), aujourdhui);
		expect(base.requetes).toBe(1);
		expect(fetes.paliers).toEqual([{ id: thomas, prenom: 'Thomas', nom: 'Agent', annees: 10, geste: 'feliciter' }]);
		expect(fetes.anniversaires.map((a) => a.prenom)).toEqual(['Marc']);
		expect((await fetesDuJourAuCentre(base, acteur(thomas), aujourdhui)).paliers[0]!.geste).toBeNull();
		expect((await fetesDuJourAuCentre(base, superAdmin, aujourdhui)).paliers[0]!.geste).toBeNull();
		// Le lendemain, plus rien.
		expect((await fetesDuJourAuCentre(base, acteur(marc), '2026-12-13')).paliers).toEqual([]);
	});

	it('selon les paliers du centre ; engagé un 29 février, fêté le 28 ; ni parti, ni extérieur, ni sans date', async () => {
		const { base, nouvelle, claire, marc } = await jeu();
		const [exterieur] = await base.select().from(profil).where(eq(profil.typePersonne, 'exterieur'));
		await nouvelle('Parti', { engagementSpv: '2016-12-12', statut: 'parti' });
		await nouvelle('Retraite', { engagementSpv: '2016-12-12', profilId: exterieur!.id });
		await nouvelle('Sansdate');
		await nouvelle('Douze', { engagementSpv: '2014-12-12' });
		expect((await fetesDuJourAuCentre(base, acteur(marc), aujourdhui)).paliers.map((p) => [p.prenom, p.annees])).toEqual([['Thomas', 10]]);
		await reglerPaliers(base, acteur(claire), [10, 12], maintenant);
		expect((await fetesDuJourAuCentre(base, acteur(marc), aujourdhui)).paliers.map((p) => [p.prenom, p.annees])).toEqual([['Thomas', 10], ['Douze', 12]]);
		await reglerPaliers(base, acteur(claire), [20], maintenant);
		expect((await fetesDuJourAuCentre(base, acteur(marc), aujourdhui)).paliers).toEqual([]);
		await reglerPaliers(base, acteur(claire), [10], maintenant);
		await nouvelle('Bissextile', { engagementSpv: '2016-02-29' });
		expect((await fetesDuJourAuCentre(base, acteur(marc), '2026-02-28')).paliers.map((p) => p.prenom)).toEqual(['Bissextile']);
		expect((await fetesDuJourAuCentre(base, acteur(marc), '2026-03-01')).paliers).toEqual([]);
	});

	it('« Féliciter » : une ligne, l’agent prévenu par sa cloche et son téléphone, une fois par collègue et par palier', async () => {
		const { base, thomas, claire, envois } = await jeu();
		base.requetes = 0;
		await feliciter(base, acteur(claire), thomas, maintenant);
		expect(base.requetes).toBe(2);
		await feliciter(base, acteur(claire), thomas, '2026-12-12T10:00:00');
		await Promise.all([feliciter(base, acteur(claire), thomas, maintenant), feliciter(base, acteur(claire), thomas, maintenant)]);
		const lignes = await base.select().from(avisAnciennete);
		expect(lignes).toMatchObject([{ personneId: thomas, agentId: thomas, auteurId: claire, annees: 10, jour: aujourdhui, titre: '10\u00a0ans de service', texte: 'Claire Martin vous félicite pour vos 10\u00a0ans de service.', url: '/', lueLe: null }]);
		expect(await envois(`anciennete:${claire}`)).toEqual([{ titre: '10\u00a0ans de service', texte: 'Claire Martin vous félicite pour vos 10\u00a0ans de service.', url: '/', tag: `anciennete:${claire}`, lue: { genre: 'anciennete', id: lignes[0]!.id } }]);
		expect((await fetesDuJourAuCentre(base, acteur(claire), aujourdhui)).paliers[0]!.geste).toBe('felicite');
		// La cloche de Thomas : comptée, montrée, lue.
		expect((await enTeteDe(base, acteur(thomas), aujourdhui)).nonLues).toBe(1);
		const fil = await filDeNotifications(base, acteur(thomas), maintenant);
		expect(fil.lignes).toEqual([{ id: lignes[0]!.id, type: 'anciennete', titre: '10\u00a0ans de service', texte: 'Claire Martin vous félicite pour vos 10\u00a0ans de service.', url: '/', creeLe: maintenant, lue: false }]);
		await marquerLue(base, acteur(thomas), 'anciennete', lignes[0]!.id, maintenant);
		expect((await enTeteDe(base, acteur(thomas), aujourdhui)).nonLues).toBe(0);
	});

	it('refusé : soi-même, sans palier aujourd’hui, agent parti, super administrateur ; « tout » coupe le téléphone', async () => {
		const { base, thomas, claire, marc, envois } = await jeu();
		await expect(feliciter(base, acteur(thomas), thomas, maintenant)).rejects.toThrow('On ne se félicite pas soi-même');
		for (const id of [marc, 9999]) await expect(feliciter(base, acteur(thomas), id, maintenant)).rejects.toThrow('Pas de palier à fêter aujourd’hui');
		await expect(feliciter(base, superAdmin, thomas, maintenant)).rejects.toBeInstanceOf(DonneeInvalide);
		await couper(base, acteur(thomas), 'tout', true, maintenant);
		await feliciter(base, acteur(marc), thomas, maintenant);
		expect(await envois(`anciennete:${marc}`)).toEqual([]);
		expect(await base.select().from(avisAnciennete)).toHaveLength(1);
		await changerStatut(base, base.photos, superAdmin, thomas, 'parti', maintenant.slice(0, 16));
		await expect(feliciter(base, acteur(claire), thomas, maintenant)).rejects.toThrow('Pas de palier à fêter aujourd’hui');
		// Le départ efface ses lignes.
		expect(await base.select().from(avisAnciennete)).toEqual([]);
	});

	it('l’accueil : mon palier et qui m’a félicité, les paliers des collègues ; dans le batch de l’anniversaire', async () => {
		const { base, thomas, claire, marc } = await jeu();
		await feliciter(base, acteur(claire), thomas, maintenant);
		await feliciter(base, acteur(marc), thomas, '2026-12-12T10:00:00');
		base.requetes = 0;
		const moi = await fetesPourMoi(base, acteur(thomas), aujourdhui);
		expect(base.requetes).toBe(1);
		expect(moi).toEqual({ anniversaire: null, monPalier: { annees: 10, feliciteePar: [{ prenom: 'Claire', nom: 'Martin' }, { prenom: 'Marc', nom: 'Durand' }] }, paliers: [] });
		expect(await fetesPourMoi(base, acteur(claire), aujourdhui)).toEqual({ anniversaire: null, monPalier: null, paliers: [{ id: thomas, prenom: 'Thomas', nom: 'Agent', annees: 10, geste: 'felicite' }] });
		expect((await fetesPourMoi(base, acteur(thomas), '2026-12-13')).monPalier).toBeNull();
	});

	it('le ménage de la nuit efface les félicitations des jours passés', async () => {
		const { base, thomas, claire } = await jeu();
		await feliciter(base, acteur(claire), thomas, maintenant);
		await effacerSouhaitsPasses(base, aujourdhui);
		expect(await base.select().from(avisAnciennete)).toHaveLength(1);
		await effacerSouhaitsPasses(base, '2026-12-13');
		expect(await base.select().from(avisAnciennete)).toEqual([]);
	});
});

describe('30 jours avant, au réveil', () => {
	const huit = '2026-11-12T08:00';

	it('une ligne de cloche par agent au chef et à l’adjoint, et un e-mail chacun qui les liste ; jamais deux fois', async () => {
		const { base, nouvelle, thomas, claire, paul, envois } = await jeu();
		const julie = await nouvelle('Julie', { nom: 'Bernard', engagementSpv: '2006-12-12' });
		base.requetes = 0;
		const courriels = await ancienneteDuMatin(base, huit);
		expect(base.requetes).toBe(2);
		const texte = 'Dans 30 jours, le 12 décembre, Thomas Agent atteint 10\u00a0ans de service.\nDans 30 jours, le 12 décembre, Julie Bernard atteint 20\u00a0ans de service.';
		expect(courriels).toEqual([
			{ a: 'claire@exemple.fr', titre: 'Paliers d’ancienneté dans 30 jours', texte, url: '/agents' },
			{ a: 'paul@exemple.fr', titre: 'Paliers d’ancienneté dans 30 jours', texte, url: '/agents' }
		]);
		const lignes = await base.select({ personneId: avisAnciennete.personneId, agentId: avisAnciennete.agentId, texte: avisAnciennete.texte, url: avisAnciennete.url }).from(avisAnciennete);
		expect(lignes).toHaveLength(4);
		expect(lignes).toContainEqual({ personneId: claire, agentId: thomas, texte: 'Dans 30 jours, le 12 décembre, Thomas Agent atteint 10\u00a0ans de service.', url: `/agents/${thomas}` });
		expect(lignes).toContainEqual({ personneId: paul, agentId: julie, texte: 'Dans 30 jours, le 12 décembre, Julie Bernard atteint 20\u00a0ans de service.', url: `/agents/${julie}` });
		expect((await filDeNotifications(base, acteur(claire), `${huit}:00`)).lignes.map((l) => l.type)).toEqual(['anciennete', 'anciennete']);
		// Pas d'envoi au téléphone : la cloche et l'e-mail suffisent.
		expect((await envois('anciennete')).length).toBe(0);
		// Le passage de 8 h 10 ne refait rien.
		expect(await ancienneteDuMatin(base, '2026-11-12T08:10')).toEqual([]);
		expect(await base.select().from(avisAnciennete)).toHaveLength(4);
	});

	it('un seul agent : l’e-mail mène à sa fiche ; « courriel » coupé, pas d’e-mail mais la cloche ; rien sans palier', async () => {
		const { base, thomas, claire, paul } = await jeu();
		await couper(base, acteur(paul), 'courriel', true, huit);
		expect(await ancienneteDuMatin(base, huit)).toEqual([{ a: 'claire@exemple.fr', titre: 'Palier d’ancienneté dans 30 jours', texte: 'Dans 30 jours, le 12 décembre, Thomas Agent atteint 10\u00a0ans de service.', url: `/agents/${thomas}` }]);
		expect((await base.select({ personneId: avisAnciennete.personneId }).from(avisAnciennete)).map((l) => l.personneId).sort()).toEqual([claire, paul].sort());
		expect(await ancienneteDuMatin(base, '2026-11-13T08:00')).toEqual([]);
		await toutMarquerLu(base, acteur(claire), maintenant);
		expect((await enTeteDe(base, acteur(claire), aujourdhui)).nonLues).toBe(0);
		// Les lignes des chefs suivent la conservation des notifications.
		await effacerSouhaitsPasses(base, '2026-12-20');
		expect(await base.select().from(avisAnciennete)).toHaveLength(2);
		await effacerVieillesNotifications(base, '2026-11-13');
		expect(await base.select().from(avisAnciennete)).toEqual([]);
	});

	it('deux réveils qui se croisent : chaque ligne et chaque e-mail une seule fois ; le chef n’est pas prévenu de son propre palier', async () => {
		const { base, claire, paul } = await jeu();
		await base.update(personne).set({ engagementSpv: '2006-12-12' }).where(eq(personne.id, claire));
		const [a, b] = await Promise.all([ancienneteDuMatin(base, huit), ancienneteDuMatin(base, '2026-11-12T08:10')]);
		const courriels = [...a, ...b];
		expect(courriels.map((c) => c.a).sort()).toEqual(['claire@exemple.fr', 'paul@exemple.fr']);
		expect(courriels.find((c) => c.a === 'claire@exemple.fr')!.texte).toBe('Dans 30 jours, le 12 décembre, Thomas Agent atteint 10\u00a0ans de service.');
		expect(courriels.find((c) => c.a === 'paul@exemple.fr')!.texte).toContain('Claire Martin atteint 20\u00a0ans de service.');
		const lignes = await base.select({ personneId: avisAnciennete.personneId, agentId: avisAnciennete.agentId }).from(avisAnciennete);
		expect(lignes).toHaveLength(3);
		expect(lignes).not.toContainEqual({ personneId: claire, agentId: claire });
		expect(lignes.filter((l) => l.personneId === paul)).toHaveLength(2);
	});

	it('engagé un 29 février : annoncé 30 jours avant le 28 février d’une année non bissextile', async () => {
		const { base, nouvelle } = await jeu();
		await nouvelle('Leon', { nom: 'Bissextile', engagementSpv: '2016-02-29' });
		// 30 jours avant le 28 février 2026 : le 29 janvier.
		expect((await ancienneteDuMatin(base, '2026-01-29T08:00')).map((c) => c.texte)).toEqual(['Dans 30 jours, le 28 février, Leon Bissextile atteint 10\u00a0ans de service.', 'Dans 30 jours, le 28 février, Leon Bissextile atteint 10\u00a0ans de service.']);
	});
});

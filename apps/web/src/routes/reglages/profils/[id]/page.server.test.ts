import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { comite, journal, personne, profil } from '@gyro-caserne/socle';
import { charger, envoyer, locaux, preparer, super_ } from '../../de-test.ts';
import { actions, load } from './+page.server';

const AGENT = ['DECLARER_DISPONIBILITE', 'DEMANDER_REMPLACEMENT', 'FAIRE_PRISE_DE_GARDE', 'PRENDRE_EN_CHARGE_ANOMALIE', 'RESERVER', 'SIGNALER_ANOMALIE', 'SIGNALER_BESOIN_STOCK', 'UTILISER_MESSAGERIE', 'VOIR_ANNUAIRE', 'VOIR_ANOMALIES', 'VOIR_ENGINS', 'VOIR_PLANNING'];

describe('page d’un profil', () => {
	it('réservée au chef de centre, à l’adjoint et au super administrateur', async () => {
		const { base, referent, ordinaire, profilAgent } = await preparer();
		for (const acteur of [referent, ordinaire]) {
			await expect(charger(load, locaux(base, acteur), { id: String(profilAgent.id) })).rejects.toMatchObject({ status: 403 });
			await expect(envoyer(actions, 'enregistrer', locaux(base, acteur), [['niveau-stock', '1']], { id: String(profilAgent.id) })).rejects.toMatchObject({ status: 403 });
		}
		await expect(charger(load, locaux(base, super_), { id: '999' })).rejects.toMatchObject({ status: 404 });
		await expect(envoyer(actions, 'enregistrer', locaux(base, super_), [['niveau-stock', '1']], { id: '999' })).rejects.toMatchObject({ status: 404 });
	});

	it('montre le profil et ses droits', async () => {
		const { base, chef, profilAgent } = await preparer();
		const data = await charger(load, locaux(base, chef), { id: String(profilAgent.id) });
		expect(data.profil).toMatchObject({ nom: 'Agent', droits: AGENT });
	});

	it('enregistre un niveau sans toucher aux droits de base ni aux autres domaines', async () => {
		const { base, chef, profilAgent, droitsProfil } = await preparer();
		const r = await envoyer(actions, 'enregistrer', locaux(base, chef), [['niveau-planning', '1'], ['niveau-reservations', '1'], ['niveau-stock', 'sur_mesure']], { id: String(profilAgent.id) });
		expect(r).toMatchObject({ succes: expect.stringContaining('Agent') });
		expect(await droitsProfil(profilAgent.id)).toEqual([...AGENT, 'VALIDER_REMPLACEMENT'].sort());
	});

	it('Réserve citoyenne : réserve d’office, et rien d’autre', async () => {
		const { base, chef, droitsProfil } = await preparer();
		const [reserve] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
		await envoyer(actions, 'enregistrer', locaux(base, chef), [['niveau-reservations', '1']], { id: String(reserve!.id) });
		expect(await droitsProfil(reserve!.id)).toEqual(['RESERVER']);
	});

	it('un seul « Enregistrer » : droits et murs ouverts ensemble, chacun au journal ; « Aucun accès » ferme le mur', async () => {
		const { base, chef, droitsProfil } = await preparer();
		const [reserve] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		const params = { id: String(reserve!.id) };
		const r = await envoyer(actions, 'enregistrer', locaux(base, chef), [['niveau-reservations', '1'], ['niveau-planning', '1'], ['mur-centre', '0'], ['mur-vie', '1'], [`mur-comite:${amicale!.id}`, '2']], params);
		expect(r).toMatchObject({ cible: 'profil', succes: 'Le profil « Réserve citoyenne » est enregistré.' });
		expect((await charger(load, locaux(base, chef), params)).profil.mursOuverts).toEqual({ vie: 'lecture', [`comite:${amicale!.id}`]: 'ecriture' });
		expect(await droitsProfil(reserve!.id)).toContain('VALIDER_REMPLACEMENT');
		const actions_ = (await base.select().from(journal)).map((l) => l.action);
		expect(actions_).toContain('modifier_murs_ouverts');
		expect(actions_).toContain('modifier_droits_profil');
		expect(await envoyer(actions, 'enregistrer', locaux(base, chef), [['niveau-reservations', '1'], ['mur-equipe:1', '1']], params)).toMatchObject({ status: 400 });
	});

	it('enregistrer reste léger : droits lus une fois, une lecture groupée, une écriture groupée (coupure en préprod le 23/11)', async () => {
		const { base, chef } = await preparer();
		const [reserve] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		const avant = base.requetes;
		const r = await envoyer(actions, 'enregistrer', locaux(base, chef), [['niveau-reservations', '1'], ['niveau-planning', '1'], ['mur-vie', '1'], [`mur-comite:${amicale!.id}`, '2']], { id: String(reserve!.id) });
		expect(r).toMatchObject({ succes: expect.any(String) });
		expect(base.requetes - avant).toBeLessThanOrEqual(5);
	});

	it('profil agent : les murs envoyés ne sont pas lus, les droits s’enregistrent', async () => {
		const { base, chef, profilAgent } = await preparer();
		expect(await envoyer(actions, 'enregistrer', locaux(base, chef), [['niveau-reservations', '1'], ['mur-vie', '1']], { id: String(profilAgent.id) })).toMatchObject({ succes: expect.any(String) });
	});

	it('renommer, puis supprimer avec confirmation ; refusé tant que quelqu’un l’a', async () => {
		const { base, chef, profilAgent } = await preparer();
		const [reserve] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
		const params = { id: String(reserve!.id) };
		expect(await envoyer(actions, 'renommer', locaux(base, chef), [['nom', 'Réservistes']], params)).toMatchObject({ cible: 'renommer', succes: 'Le profil s’appelle désormais « Réservistes ».' });
		expect(await envoyer(actions, 'supprimer', locaux(base, chef), [], params)).toMatchObject({ status: 400, data: { message: 'Cochez « Je confirme » pour continuer.' } });
		const [p] = await base.insert(personne).values({ email: 'r@exemple.fr', prenom: 'R', nom: 'S', profilId: reserve!.id }).returning();
		expect(await envoyer(actions, 'supprimer', locaux(base, chef), [['confirmation', 'oui']], params)).toMatchObject({ status: 400, data: { message: 'Ce profil est encore attribué. Changez d’abord le profil des personnes qui l’ont.' } });
		await base.delete(personne).where(eq(personne.id, p!.id));
		await expect(envoyer(actions, 'supprimer', locaux(base, chef), [['confirmation', 'oui']], params)).rejects.toMatchObject({ status: 303, location: '/reglages' });
		expect(await base.select().from(journal).where(eq(journal.action, 'supprimer_profil'))).toHaveLength(1);
		expect(await envoyer(actions, 'supprimer', locaux(base, chef), [['confirmation', 'oui']], { id: String(profilAgent.id) })).toMatchObject({ status: 400 });
	});
});

import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { journal, profil } from '@gyro-caserne/socle';
import { charger, envoyer, locaux, preparer } from '../../de-test.ts';
import { actions, load } from './+page.server';

describe('nouveau profil', () => {
	it('réservé au chef de centre, à l’adjoint et au super administrateur', async () => {
		const { base, referent } = await preparer();
		await expect(charger(load, locaux(base, referent))).rejects.toMatchObject({ status: 403 });
		await expect(envoyer(actions, 'default', locaux(base, referent), [['nom', 'Retraité'], ['type', 'exterieur']])).rejects.toMatchObject({ status: 403 });
	});

	it('crée le profil puis ouvre sa page ; au journal', async () => {
		const { base, chef } = await preparer();
		const fin = await envoyer(actions, 'default', locaux(base, chef), [['nom', 'Retraité'], ['type', 'exterieur']]).catch((r: { status: number; location: string }) => r);
		const [cree] = await base.select().from(profil).where(eq(profil.nom, 'Retraité'));
		expect(cree).toMatchObject({ typePersonne: 'exterieur' });
		expect(fin).toMatchObject({ status: 303, location: `/reglages/profils/${cree!.id}` });
		expect(await base.select().from(journal).where(eq(journal.action, 'creer_profil'))).toHaveLength(1);
	});

	it('nom déjà pris ou type manquant : le message, la saisie gardée', async () => {
		const { base, chef } = await preparer();
		const pris = await envoyer(actions, 'default', locaux(base, chef), [['nom', 'agent'], ['type', 'agent']]);
		expect(pris).toMatchObject({ status: 400, data: { erreurs: { nom: expect.stringContaining('déjà utilisé') }, valeurs: { nom: 'agent', type: 'agent' } } });
		const sansType = await envoyer(actions, 'default', locaux(base, chef), [['nom', 'Retraité']]);
		expect(sansType).toMatchObject({ status: 400, data: { erreurs: { type: 'Choisissez le type du profil.' } } });
	});
});

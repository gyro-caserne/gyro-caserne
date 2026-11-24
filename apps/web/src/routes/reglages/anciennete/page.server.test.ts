import { describe, expect, it } from 'vitest';
import { lirePaliers } from '@gyro-caserne/socle';
import { charger, envoyer, locaux, preparer } from '../de-test.ts';
import { actions, load } from './+page.server';

describe('réglages : paliers d’ancienneté', () => {
	it('réservé à qui gère les listes du centre, à la lecture comme à l’envoi', async () => {
		const { base, ordinaire } = await preparer();
		await expect(charger(load, locaux(base, ordinaire))).rejects.toMatchObject({ status: 403 });
		await expect(envoyer(actions, 'enregistrer', locaux(base, ordinaire), [['palier', '10']])).rejects.toMatchObject({ status: 403 });
	});

	it('par défaut tous les 5 ans ; puis ceux cochés ; aucun coché ou une valeur fabriquée est refusé', async () => {
		const { base, referent } = await preparer();
		const l = locaux(base, referent);
		expect((await charger(load, l)).paliers.slice(0, 4)).toEqual([5, 10, 15, 20]);
		expect(await envoyer(actions, 'enregistrer', l, [['palier', '40'], ['palier', '10'], ['palier', '20'], ['palier', '25'], ['palier', '30']])).toEqual({ cible: 'anciennete', succes: 'Paliers d’ancienneté enregistrés.' });
		expect(await lirePaliers(base)).toEqual([10, 20, 25, 30, 40]);
		expect(await envoyer(actions, 'enregistrer', l, [])).toMatchObject({ status: 400, data: { message: 'Cochez au moins un palier.' } });
		expect(await envoyer(actions, 'enregistrer', l, [['palier', 'abc']])).toMatchObject({ status: 400, data: { message: 'Un palier va de 1 à 60 ans.' } });
		expect(await lirePaliers(base)).toEqual([10, 20, 25, 30, 40]);
	});
});

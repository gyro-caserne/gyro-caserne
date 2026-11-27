import { describe, expect, it } from 'vitest';
import { lireDureesCourt } from '@gyro-caserne/socle';
import { charger, envoyer, locaux, preparer } from '../de-test.ts';
import { actions, load } from './+page.server';

describe('réglages : remplacement court', () => {
	it('réservé à qui gère les listes du centre, à la lecture comme à l’envoi', async () => {
		const { base, ordinaire } = await preparer();
		await expect(charger(load, locaux(base, ordinaire))).rejects.toMatchObject({ status: 403 });
		await expect(envoyer(actions, 'enregistrer', locaux(base, ordinaire), [['duree', '2']])).rejects.toMatchObject({ status: 403 });
	});

	it('par défaut 2 et 3 h ; puis celles cochées ; aucune cochée ou une valeur fabriquée est refusé', async () => {
		const { base, referent } = await preparer();
		const l = locaux(base, referent);
		expect((await charger(load, l)).durees).toEqual([2, 3]);
		expect(await envoyer(actions, 'enregistrer', l, [['duree', '4'], ['duree', '1']])).toEqual({ cible: 'court', succes: 'Durées enregistrées. Les nouvelles demandes les suivent.' });
		expect(await lireDureesCourt(base)).toEqual([1, 4]);
		expect(await envoyer(actions, 'enregistrer', l, [])).toMatchObject({ status: 400, data: { message: 'Cochez au moins une durée.' } });
		expect(await envoyer(actions, 'enregistrer', l, [['duree', '9']])).toMatchObject({ status: 400, data: { message: 'Une durée va de 1 à 4 h.' } });
		expect(await lireDureesCourt(base)).toEqual([1, 4]);
	});
});

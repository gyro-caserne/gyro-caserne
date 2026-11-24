import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { attribution, responsabilite } from '@gyro-caserne/socle';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { preparer, requeteFormulaire } from '../echanges/de-test.ts';
import { actions, load } from './+page.server';

/* eslint-disable @typescript-eslint/no-explicit-any */
const geste = async (nom: string, locals: unknown, corps: Record<string, string>) => (actions[nom] as any)({ locals, request: await requeteFormulaire(Object.entries(corps)) });

async function jeu() {
	const c = await preparer();
	const [chefGarde] = await c.base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_equipe'));
	const locals = (acteur: unknown) => ({ base: c.base, basePhotos: c.base.photos, acteur });
	const mandatsDe = (personneId: number) => c.base.select().from(attribution).where(and(eq(attribution.personneId, personneId), eq(attribution.responsabiliteId, chefGarde!.id)));
	return { ...c, chefGarde: chefGarde!, locals, mandatsDe };
}

describe('/comites, les gestes', () => {
	it('un agent ne lit que la page ; le chef y trouve ses gestes', async () => {
		const { alice, chef, locals } = await jeu();
		const agent = await (load as any)({ locals: locals(alice), parent: async () => ({ peutNominations: false }) });
		expect(agent.gestes).toBeNull();
		const duChef = await (load as any)({ locals: locals(chef), parent: async () => ({ peutNominations: true }) });
		expect(duChef.gestes.agents.length).toBeGreaterThan(0);
		expect(duChef.fiches).toBe(true);
	});

	it('nommer sur un poste à pourvoir, remplacer, puis finir le mandat', async () => {
		const { base, alice, bruno, chef, e1, chefGarde, locals, mandatsDe } = await jeu();
		const aujourdhui = aujourdhuiParis();
		const poste = `${chefGarde.id}-${e1.id}`;
		expect(await geste('nommer', locals(chef), { poste, responsabiliteId: String(chefGarde.id), perimetre: String(e1.id), personneId: String(alice.id), debut: '2026-01-02' })).toEqual({ cible: `nommer-${poste}`, succes: 'Nomination enregistrée.' });
		const [mandat] = await mandatsDe(alice.id);
		expect(mandat).toMatchObject({ debut: '2026-01-02', fin: null, perimetreId: e1.id });

		expect(await geste('remplacer', locals(chef), { attributionId: String(mandat!.id), personneId: String(bruno.id), debut: aujourdhui })).toEqual({ cible: `mandat-${mandat!.id}`, succes: 'Remplacement enregistré.' });
		const [nouveau] = await mandatsDe(bruno.id);
		expect(nouveau).toMatchObject({ debut: aujourdhui, fin: null });
		expect((await mandatsDe(alice.id))[0]!.fin).not.toBeNull();

		// Finir : grave, toujours confirmé.
		const sans = await geste('finir', locals(chef), { attributionId: String(nouveau!.id), fin: aujourdhui });
		expect(sans).toMatchObject({ status: 400, data: { cible: `mandat-${nouveau!.id}`, erreurs: { confirmation: expect.any(String) } } });
		expect(await geste('finir', locals(chef), { attributionId: String(nouveau!.id), fin: aujourdhui, confirmation: 'oui' })).toEqual({ cible: `mandat-${nouveau!.id}`, succes: 'Fin du mandat enregistrée.' });
		expect((await mandatsDe(bruno.id))[0]!.fin).toBe(aujourdhui);
		void base;
	});

	it('un refus garde la saisie et vise son volet ; le droit est celui du socle', async () => {
		const { alice, bruno, chef, e1, chefGarde, locals, mandatsDe } = await jeu();
		const poste = `${chefGarde.id}-${e1.id}`;
		const vide = await geste('nommer', locals(chef), { poste, responsabiliteId: String(chefGarde.id), perimetre: String(e1.id), personneId: '', debut: '2026-01-02' });
		expect(vide).toMatchObject({ status: 400, data: { cible: `nommer-${poste}`, erreurs: { personneId: 'Choisissez un agent.' } } });
		// Un agent sans droit de nommer est refusé par le socle.
		const refus = await geste('nommer', locals(alice), { poste, responsabiliteId: String(chefGarde.id), perimetre: String(e1.id), personneId: String(bruno.id), debut: '2026-01-02' });
		expect(refus).toMatchObject({ status: 403 });
		expect(await mandatsDe(bruno.id)).toEqual([]);
		// Un remplaçant qui commencerait avant le mandat : l'erreur va sur la date.
		await geste('nommer', locals(chef), { poste, responsabiliteId: String(chefGarde.id), perimetre: String(e1.id), personneId: String(alice.id), debut: '2026-03-01' });
		const [mandat] = await mandatsDe(alice.id);
		const tot = await geste('remplacer', locals(chef), { attributionId: String(mandat!.id), personneId: String(bruno.id), debut: '2026-02-01' });
		expect(tot).toMatchObject({ status: 400, data: { cible: `mandat-${mandat!.id}`, erreurs: { debut: 'Choisissez une date après le début du mandat' }, valeurs: { debut: '2026-02-01' } } });
	});

	it('annuler une nomination à venir, confirmée', async () => {
		const { alice, chef, e1, chefGarde, locals, mandatsDe } = await jeu();
		await geste('nommer', locals(chef), { poste: 'x', responsabiliteId: String(chefGarde.id), perimetre: String(e1.id), personneId: String(alice.id), debut: '2099-01-01' });
		const [mandat] = await mandatsDe(alice.id);
		expect(await geste('terminer', locals(chef), { attributionId: String(mandat!.id) })).toMatchObject({ status: 400 });
		expect(await geste('terminer', locals(chef), { attributionId: String(mandat!.id), confirmation: 'oui' })).toEqual({ cible: `mandat-${mandat!.id}`, succes: 'Nomination annulée.' });
		expect(await mandatsDe(alice.id)).toEqual([]);
	});
});

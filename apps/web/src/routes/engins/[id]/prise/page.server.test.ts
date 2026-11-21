import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { anomalie, attribution, avisAnomalie, journal, lireFiche, priseGarde, responsabilite } from '@gyro-caserne/socle';
import { jpeg, requeteFormulaire } from '../../../echanges/de-test.ts';
import { locaux, preparer } from '../../de-test.ts';
import { actions, load } from './+page.server';
import { load as chargerFaite } from '../prises/[prise]/+page.server';
import { GET as photo } from '../../photo/[id]/+server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const charger = (locals: unknown, id: number) => (load as any)({ locals, params: { id: String(id) } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const agir = async (nom: string, locals: unknown, id: number, corps: [string, string | File][]) => (actions as any)[nom]({ locals, params: { id: String(id) }, request: await requeteFormulaire(corps) });

describe('/engins/[id]/prise', () => {
	it('commencer, signaler un écart avec photo, voir chaque zone, valider : l’écart devient une anomalie', async () => {
		const { base, alice, chef, vsav, types } = await preparer();
		const moi = locaux(base, alice);
		expect((await charger(moi, vsav)).prise).toBeNull();
		expect(await agir('commencer', moi, vsav, [])).toMatchObject({ succes: 'Prise commencée.' });
		const page = await charger(locaux(base, chef), vsav);
		const id = String(page.prise.id);
		const fiche = await lireFiche(base, types.VSAV);
		const gilets = fiche.zones[0]!.elements.find((e) => e.quantite !== null)!;
		const ecart = await agir('geste', moi, vsav, [['prise', id], ['quoi', 'ecart'], ['element', String(gilets.ref)], ['zone', String(fiche.zones[0]!.ref)], ['genre', 'manquant'], ['manque', '1'], ['note', 'Sous le siège'], ['photo', jpeg()]]);
		expect(ecart).toMatchObject({ succes: 'Écart enregistré.', zone: fiche.zones[0]!.ref });
		expect(await agir('valider', moi, vsav, [['prise', id]])).toMatchObject({ status: 400, data: { message: expect.stringMatching(/zones à voir/) } });
		// « Tout est complet » : la page passe à la zone suivante à voir et propose d'annuler.
		for (const z of fiche.zones) expect(await agir('geste', moi, vsav, [['prise', id], ['quoi', 'zone'], ['zone', String(z.ref)], ['vue', '1']])).toMatchObject({ zone: null, zoneFaite: z.ref, succes: 'Zone complète.' });
		// Une zone marquée complète accepte encore un écart.
		const radio = fiche.zones[0]!.elements.find((e) => e.quantite === null)!;
		expect(await agir('geste', moi, vsav, [['prise', id], ['quoi', 'ecart'], ['element', String(radio.ref)], ['zone', String(fiche.zones[0]!.ref)], ['genre', 'abime']])).toMatchObject({ succes: 'Écart enregistré.' });
		expect((await charger(moi, vsav)).moi).toBe((alice as { id: number }).id);
		await expect(agir('valider', moi, vsav, [['prise', id]])).rejects.toMatchObject({ status: 303, location: `/engins/${vsav}/prise?validee` });
		const [a] = await base.select().from(anomalie).where(eq(anomalie.ref, gilets.ref));
		expect(a).toMatchObject({ ref: gilets.ref, manque: 1, note: 'Sous le siège' });
		// La photo, servie à qui voit les engins.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const reponse: Response = await (photo as any)({ locals: moi, params: { id: String(a!.photoId) } });
		expect(reponse.headers.get('content-type')).toBe('image/jpeg');
		// La prise faite, lisible.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const faite = await (chargerFaite as any)({ locals: moi, params: { id: String(vsav), prise: id } });
		expect(faite.prise.signalees).toHaveLength(2);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect((chargerFaite as any)({ locals: moi, params: { id: '999', prise: id } })).rejects.toMatchObject({ status: 404 });
	});

	it('sans le droit : refus dit sur la page ; abandonner efface le brouillon', async () => {
		const { base, alice, sans, vsav } = await preparer();
		await expect(agir('commencer', locaux(base, sans), vsav, [])).rejects.toMatchObject({ status: 403 });
		await agir('commencer', locaux(base, alice), vsav, []);
		const [p] = await base.select().from(priseGarde);
		await expect(agir('abandonner', locaux(base, alice), vsav, [['prise', String(p!.id)]])).rejects.toMatchObject({ status: 303, location: `/engins/${vsav}/prise` });
		expect(await base.select().from(priseGarde)).toHaveLength(0);
	});

	it('lire ne crée rien ; le premier « Tout est complet » commence la prise', async () => {
		const { base, alice, vsav, types } = await preparer();
		const moi = locaux(base, alice);
		const vue = await charger(moi, vsav);
		expect(vue.prise).toBeNull();
		expect(vue.zones.length).toBeGreaterThan(0);
		expect(await base.select().from(priseGarde)).toHaveLength(0);
		const zone = (await lireFiche(base, types.VSAV)).zones[0]!;
		expect(await agir('geste', moi, vsav, [['prise', ''], ['quoi', 'zone'], ['zone', String(zone.ref)], ['vue', '1'], ['cible', `zone:${zone.ref}`]])).toMatchObject({ zone: null, zoneFaite: zone.ref, succes: 'Zone complète.' });
		const apres = await charger(moi, vsav);
		expect(apres.prise.saisie.zones).toEqual([zone.ref]);
		expect(apres.prise.commenceePar).toBe('Alice Test');
		// Annuler garde la zone à l'écran et le brouillon.
		expect(await agir('geste', moi, vsav, [['prise', String(apres.prise.id)], ['quoi', 'zone'], ['zone', String(zone.ref)], ['vue', '0']])).toMatchObject({ zone: zone.ref, succes: 'Zone enregistrée.' });
		expect((await charger(moi, vsav)).prise.saisie.zones).toEqual([]);
	});

	it('premier geste sans le droit, ou sur un engin parti : refus dit sur la page, aucun brouillon ; sans droit, peutFaire est faux', async () => {
		const { base, sans, alice, vsav, parti, types } = await preparer();
		const zone = String((await lireFiche(base, types.VSAV)).zones[0]!.ref);
		const corps: [string, string][] = [['prise', ''], ['quoi', 'zone'], ['zone', zone], ['vue', '1'], ['cible', `zone:${zone}`]];
		expect((await charger(locaux(base, alice), parti)).peutFaire).toBe(false);
		expect(await agir('geste', locaux(base, alice), parti, corps)).toMatchObject({ status: 400 });
		expect(await base.select().from(priseGarde)).toHaveLength(0);
		await expect(agir('geste', locaux(base, sans), vsav, corps)).rejects.toMatchObject({ status: 403 });
		expect(await base.select().from(priseGarde)).toHaveLength(0);
	});

	it('un identifiant de prise mal écrit ne commence rien', async () => {
		const { base, alice, vsav, types } = await preparer();
		const zone = String((await lireFiche(base, types.VSAV)).zones[0]!.ref);
		expect(await agir('geste', locaux(base, alice), vsav, [['prise', 'abc'], ['quoi', 'zone'], ['zone', zone], ['vue', '1']])).toMatchObject({ status: 400 });
		expect(await base.select().from(priseGarde)).toHaveLength(0);
	});

	it('validée : modifier les participants, demander la réouverture, rouvrir (confirmé, avec un motif)', async () => {
		const { base, alice, chef, sans, vsav, types } = await preparer();
		// Chloé est aussi cheffe de centre : sans planning publié, c'est elle qui rouvre.
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
		await base.insert(attribution).values({ personneId: (chef as { id: number }).id, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		const moi = locaux(base, alice);
		await agir('commencer', moi, vsav, []);
		const id = String((await charger(moi, vsav)).prise.id);
		for (const z of (await lireFiche(base, types.VSAV)).zones) await agir('geste', moi, vsav, [['prise', id], ['quoi', 'zone'], ['zone', String(z.ref)], ['vue', '1']]);
		await agir('valider', moi, vsav, [['prise', id]]).catch(() => undefined);
		expect((await charger(moi, vsav)).gestes).toEqual({ participants: true, rouvrir: false, demander: true });

		const chloe = String((chef as { id: number }).id);
		expect(await agir('participants', moi, vsav, [['prise', id], ['participant', String((alice as { id: number }).id)], ['participant', chloe]])).toMatchObject({ succes: 'Participants enregistrés.' });
		expect((await charger(moi, vsav)).prise.traces.participants).toMatchObject({ par: 'Alice Test' });
		expect(await agir('participants', moi, vsav, [['prise', id]])).toMatchObject({ status: 400, data: { cible: 'participants', message: 'Cochez au moins un participant.' } });
		await expect(agir('participants', locaux(base, sans), vsav, [['prise', id], ['participant', chloe]])).rejects.toMatchObject({ status: 403 });

		expect(await agir('demanderReouverture', moi, vsav, [['prise', id], ['motif', '']])).toMatchObject({ status: 400, data: { cible: 'demander', message: 'Dites en quelques mots pourquoi.' } });
		expect(await agir('demanderReouverture', moi, vsav, [['prise', id], ['motif', 'Radio oubliée']])).toMatchObject({ cible: 'demander', succes: 'Demande envoyée.' });
		expect(await base.select({ texte: avisAnomalie.texte }).from(avisAnomalie)).toContainEqual({ texte: 'Alice Test demande la réouverture : Radio oubliée' });

		// Un agent ne rouvre pas ; le chef confirme et dit pourquoi.
		expect(await agir('rouvrir', moi, vsav, [['prise', id], ['motif', 'Radio'], ['confirmation', 'oui']])).toMatchObject({ status: 403, data: { message: 'Seuls le chef de garde de l’équipe d’astreinte, le chef de centre et l’adjoint rouvrent une prise.' } });
		expect(await agir('rouvrir', locaux(base, chef), vsav, [['prise', id], ['motif', 'Radio']])).toMatchObject({ status: 400, data: { cible: 'rouvrir', motif: 'Radio', message: 'Cochez « Je confirme » pour rouvrir la prise.' } });
		await expect(agir('rouvrir', locaux(base, chef), vsav, [['prise', id], ['motif', 'Radio'], ['confirmation', 'oui']])).rejects.toMatchObject({ status: 303, location: `/engins/${vsav}/prise?rouverte` });
		const rouverte = await charger(moi, vsav);
		expect(rouverte.prise).toMatchObject({ etat: 'en_cours', traces: { rouverte: { par: 'Chloe Test', motif: 'Radio' }, demande: null } });
		expect((await base.select({ action: journal.action }).from(journal)).map((l) => l.action)).toEqual(expect.arrayContaining(['modifier_participants_prise', 'rouvrir_prise']));
		// Rouverte : elle ne s'abandonne pas.
		expect(await agir('abandonner', moi, vsav, [['prise', id]])).toMatchObject({ status: 400 });
	});

	it('un geste inconnu ou une photo trop lourde : refusés avec un message', async () => {
		const { base, alice, vsav } = await preparer();
		await agir('commencer', locaux(base, alice), vsav, []);
		const [p] = await base.select().from(priseGarde);
		expect(await agir('geste', locaux(base, alice), vsav, [['prise', String(p!.id)], ['quoi', 'nimporte']])).toMatchObject({ status: 400 });
		expect(await agir('geste', locaux(base, alice), vsav, [['prise', String(p!.id)], ['quoi', 'ecart'], ['photo', jpeg(300 * 1024)]])).toMatchObject({ status: 400, data: { message: 'Photo trop lourde : 200 Ko au plus.' } });
	});
});

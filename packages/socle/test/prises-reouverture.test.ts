import { eq, inArray, sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { gesteAnomalie, REGLAGE_ANOMALIES } from '../src/anomalies.ts';
import { enregistrerEngin } from '../src/engins.ts';
import { RefusDroit } from '../src/erreurs.ts';
import { lireFiche } from '../src/fiches.ts';
import { publierAnnee, reglerRoulement } from '../src/planning/annee.ts';
import { abandonnerPrise, commencerPrise, demanderReouverture, gestePrise, historiquePrises, lirePrise, lirePriseFaite, modifierParticipantsPrise, rouvrirPrise, validerPrise } from '../src/prises.ts';
import { suiviDuCentre } from '../src/suivi.ts';
import { affectationEquipe, anomalie, anomalieSuivi, attribution, avisAnomalie, equipe, journal, personne, priseGarde, responsabilite } from '../src/schema.ts';
import { photo as octets } from '../src/schema-photos.ts';
import { jeuEngins } from './de-test-engins.ts';

const reglage = centreExemple.astreinte;
const PENDANT = '2026-10-30T18:10';
const APRES = '2026-10-30T20:00';
// La relève suivante, deux heures d'avance comprises.
const SUIVANTE = '2026-11-06T16:00';
const idDe = (a: unknown) => (a as { id: number }).id;

// Planning publié, le chef de garde (Chloé) sur l'équipe d'astreinte, Alice dans cette équipe, un chef de centre (Claire) ;
// une prise du VSAV validée par Alice, avec un écart sur les gilets.
async function preparer() {
	const j = await jeuEngins();
	const equipes = await j.base.select().from(equipe);
	await reglerRoulement(j.base, j.superAdmin, 2026, equipes.map((e) => e.id), '2026-01-01T10:00');
	await publierAnnee(j.base, j.superAdmin, 2026, '2026-01-01T10:00');
	const vsav = await enregistrerEngin(j.base, j.referent, { nom: 'VSAV 1', immatriculation: '', typeId: j.types.VSAV, situation: 'centre', provenance: '' }, PENDANT);
	const releve = (await lirePrise(j.base, j.alice, vsav, PENDANT, reglage)).releve.equipe!;
	// Le chef de garde passe sur l'équipe d'astreinte ; Alice en fait partie.
	await j.base.update(attribution).set({ perimetreId: releve.id }).where(eq(attribution.personneId, idDe(j.chefDeGarde)));
	await j.base.insert(affectationEquipe).values({ personneId: idDe(j.alice), equipeId: releve.id, debut: '2026-01-01' });
	const [chefCentre] = await j.base.insert(personne).values({ email: 'chef@exemple.fr', prenom: 'Claire', nom: 'Fictif', profilId: (await j.base.select().from(personne).where(eq(personne.id, idDe(j.alice))))[0]!.profilId }).returning();
	const [role] = await j.base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
	await j.base.insert(attribution).values({ personneId: chefCentre!.id, responsabiliteId: role!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
	const fiche = await lireFiche(j.base, j.types.VSAV);
	const cabine = fiche.zones[0]!;
	const gilets = cabine.elements.find((e) => e.libelle.startsWith('Gilets'))!;
	const radio = cabine.elements.find((e) => e.libelle.startsWith('Radio'))!;
	const id = await commencerPrise(j.base, j.base.photos, j.alice, vsav, PENDANT, reglage);
	await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'ecart', element: gilets.ref, genre: 'manquant', manque: 1, note: '' }, PENDANT, reglage);
	for (const z of fiche.zones) await gestePrise(j.base, j.base.photos, j.alice, id, { quoi: 'zone', zone: z.ref, vue: true }, PENDANT, reglage);
	await validerPrise(j.base, j.alice, id, PENDANT, reglage);
	return { ...j, vsav, id, fiche, gilets, radio, equipeAstreinte: releve.id, autreEquipe: equipes.find((e) => e.id !== releve.id)!.id, chefCentre: { type: 'personne' as const, id: chefCentre!.id } };
}

const tracesDe = async (j: Awaited<ReturnType<typeof preparer>>) => JSON.parse((await j.base.select().from(priseGarde).where(eq(priseGarde.id, j.id)))[0]!.traces);

describe('participants modifiés après validation', () => {
	it('par un participant : la prise reste validée, son contenu figé ; la trace et le journal le disent', async () => {
		const j = await preparer();
		const [avant] = await j.base.select().from(priseGarde).where(eq(priseGarde.id, j.id));
		await modifierParticipantsPrise(j.base, j.alice, j.id, [idDe(j.alice), idDe(j.referent)], APRES, reglage, j.vsav);
		const [apres] = await j.base.select().from(priseGarde).where(eq(priseGarde.id, j.id));
		expect(apres).toMatchObject({ etat: 'validee', valideeLe: avant!.valideeLe, modifieePar: avant!.modifieePar });
		const saisie = JSON.parse(apres!.saisie);
		expect(saisie.participants).toEqual([idDe(j.alice), idDe(j.referent)]);
		expect(saisie.ecarts).toEqual(JSON.parse(avant!.saisie).ecarts);
		expect(await tracesDe(j)).toEqual({ participants: { par: idDe(j.alice), le: APRES } });
		const vue = await lirePrise(j.base, j.alice, j.vsav, APRES, reglage);
		expect(vue.prise!.traces.participants).toEqual({ par: 'Alice Fictif', le: APRES });
		expect((await lirePriseFaite(j.base, j.alice, j.id)).participants).toEqual(['Alice Fictif', 'Rémi Fictif']);
		const lignes = await j.base.select().from(journal).where(eq(journal.action, 'modifier_participants_prise'));
		expect(lignes).toMatchObject([{ acteur: `personne:${idDe(j.alice)}`, cibleType: 'engin', cibleId: j.vsav }]);
		expect((await suiviDuCentre(j.base, j.chefCentre, '2026-10-30')).lignes[0]).toMatchObject({ qui: 'Alice Fictif', phrase: 'a modifié les participants de la prise de garde : VSAV 1' });
	});

	it('par le chef de garde de l’équipe d’astreinte ou le chef de centre ; pas par un autre agent', async () => {
		const j = await preparer();
		await modifierParticipantsPrise(j.base, j.chefDeGarde, j.id, [idDe(j.alice), idDe(j.chefDeGarde)], APRES, reglage);
		await modifierParticipantsPrise(j.base, j.chefCentre, j.id, [idDe(j.alice)], APRES, reglage);
		await expect(modifierParticipantsPrise(j.base, j.referent, j.id, [idDe(j.referent)], APRES, reglage)).rejects.toThrow(RefusDroit);
		await expect(modifierParticipantsPrise(j.base, j.superAdmin, j.id, [idDe(j.alice)], APRES, reglage)).rejects.toThrow('Réservé aux agents');
	});

	it('jamais vide, jamais un inconnu, jamais après la relève suivante, ni sur un brouillon', async () => {
		const j = await preparer();
		await expect(modifierParticipantsPrise(j.base, j.alice, j.id, [], APRES, reglage)).rejects.toThrow('Participants manquants');
		await expect(modifierParticipantsPrise(j.base, j.alice, j.id, [idDe(j.sansProfil)], APRES, reglage)).rejects.toThrow('Participant inconnu');
		await expect(modifierParticipantsPrise(j.base, j.alice, j.id, [idDe(j.alice)], SUIVANTE, reglage)).rejects.toThrow('Relève passée');
		await expect(modifierParticipantsPrise(j.base, j.alice, j.id, [idDe(j.alice)], APRES, reglage, j.vsav + 1)).rejects.toThrow('Prise inconnue');
		await rouvrirPrise(j.base, j.chefDeGarde, j.id, 'Oubli', APRES, reglage);
		await expect(modifierParticipantsPrise(j.base, j.alice, j.id, [idDe(j.alice)], APRES, reglage)).rejects.toThrow('Prise pas encore validée');
	});
});

describe('réouverture', () => {
	it('par le chef de garde, avec un motif : la prise redevient en cours, zones vues gardées ; trace et journal', async () => {
		const j = await preparer();
		await rouvrirPrise(j.base, j.chefDeGarde, j.id, '  Écart oublié  sur la radio ', APRES, reglage, j.vsav);
		const [p] = await j.base.select().from(priseGarde).where(eq(priseGarde.id, j.id));
		expect(p).toMatchObject({ etat: 'en_cours', valideeLe: null });
		expect(JSON.parse(p!.saisie).zones).toHaveLength(j.fiche.zones.length);
		expect(await tracesDe(j)).toEqual({ rouverte: { par: idDe(j.chefDeGarde), le: APRES, motif: 'Écart oublié sur la radio' } });
		const vue = await lirePrise(j.base, j.alice, j.vsav, APRES, reglage);
		expect(vue.prise!.traces.rouverte).toEqual({ par: 'Chloé Fictif', le: APRES, motif: 'Écart oublié sur la radio' });
		expect((await j.base.select().from(journal).where(eq(journal.action, 'rouvrir_prise')))[0]).toMatchObject({ cibleType: 'engin', cibleId: j.vsav });
		expect((await suiviDuCentre(j.base, j.chefCentre, '2026-10-30')).lignes[0]).toMatchObject({ qui: 'Chloé Fictif', phrase: 'a rouvert la prise de garde : VSAV 1' });
		// Rouverte, elle n'est plus dans l'historique jusqu'à la nouvelle validation ; on ne l'abandonne pas.
		expect(await historiquePrises(j.base, j.vsav)).toEqual([]);
		await expect(abandonnerPrise(j.base, j.base.photos, j.alice, j.id, APRES)).rejects.toThrow('Prise inconnue');
		await expect(rouvrirPrise(j.base, j.chefDeGarde, j.id, 'Encore', APRES, reglage)).rejects.toThrow('Prise pas encore validée');
	});

	it('le chef de centre aussi ; ni un agent, ni le chef de garde d’une autre équipe ; motif obligatoire, court ; avant la relève suivante', async () => {
		const j = await preparer();
		await expect(rouvrirPrise(j.base, j.alice, j.id, 'Oubli', APRES, reglage)).rejects.toThrow(RefusDroit);
		await expect(rouvrirPrise(j.base, j.chefDeGarde, j.id, '  ', APRES, reglage)).rejects.toThrow('Motif manquant');
		await expect(rouvrirPrise(j.base, j.chefDeGarde, j.id, 'x'.repeat(201), APRES, reglage)).rejects.toThrow('Motif trop long');
		await expect(rouvrirPrise(j.base, j.chefDeGarde, j.id, 'Oubli', SUIVANTE, reglage)).rejects.toThrow('Relève passée');
		await j.base.update(attribution).set({ perimetreId: j.autreEquipe }).where(eq(attribution.personneId, idDe(j.chefDeGarde)));
		await expect(rouvrirPrise(j.base, j.chefDeGarde, j.id, 'Oubli', APRES, reglage)).rejects.toThrow(RefusDroit);
		await rouvrirPrise(j.base, j.chefCentre, j.id, 'Oubli', APRES, reglage);
	});

	it('écarts modifiables puis nouvelle validation : sans doublon, l’anomalie suit l’écart modifié, un nouvel écart crée la sienne', async () => {
		const j = await preparer();
		const [premiere] = await j.base.select().from(anomalie);
		await rouvrirPrise(j.base, j.chefDeGarde, j.id, 'Oubli', APRES, reglage);
		// L'écart de la première validation n'est pas « déjà signalé » : il est à la prise.
		const vue = await lirePrise(j.base, j.alice, j.vsav, APRES, reglage);
		expect(vue.ouvertes).toEqual([]);
		expect(vue.propres).toEqual([{ id: premiere!.id, ref: j.gilets.ref, suiviePar: null, suivie: false }]);
		await gestePrise(j.base, j.base.photos, j.alice, j.id, { quoi: 'ecart', element: j.gilets.ref, genre: 'manquant', manque: 2, note: 'Deux' }, APRES, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, j.id, { quoi: 'ecart', element: j.radio.ref, genre: 'abime', manque: null, note: '' }, APRES, reglage);
		await validerPrise(j.base, j.chefDeGarde, j.id, '2026-10-30T20:10', reglage);
		const lignes = await j.base.select().from(anomalie).orderBy(anomalie.id);
		expect(lignes.map((l) => [l.ref, l.manque, l.note, l.priseId, l.closeLe])).toEqual([
			[j.gilets.ref, 2, 'Deux', j.id, null],
			[j.radio.ref, null, null, j.id, null]
		]);
		expect(await tracesDe(j)).toMatchObject({ rouverte: { motif: 'Oubli' } });
		expect((await lirePriseFaite(j.base, j.alice, j.id)).signalees).toHaveLength(2);
	});

	it('un écart retiré : son anomalie, que personne ne suit, est annulée à la validation ; suivie, elle reste et l’écran le dit', async () => {
		const j = await preparer();
		const [gilets] = await j.base.select().from(anomalie);
		// Une seconde anomalie, sur la radio, prise en charge par le référent.
		await rouvrirPrise(j.base, j.chefDeGarde, j.id, 'Radio', APRES, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, j.id, { quoi: 'ecart', element: j.radio.ref, genre: 'abime', manque: null, note: '' }, APRES, reglage);
		await validerPrise(j.base, j.alice, j.id, APRES, reglage);
		const radio = (await j.base.select().from(anomalie)).find((a) => a.ref === j.radio.ref)!;
		await gesteAnomalie(j.base, j.referent, radio.id, { quoi: 'prendre' }, APRES, REGLAGE_ANOMALIES);
		await rouvrirPrise(j.base, j.chefDeGarde, j.id, 'Tout retrouvé', '2026-10-30T21:00', reglage);
		const vue = await lirePrise(j.base, j.alice, j.vsav, '2026-10-30T21:00', reglage);
		expect(vue.propres.find((p) => p.id === radio.id)).toEqual({ id: radio.id, ref: j.radio.ref, suiviePar: 'Rémi Fictif', suivie: true });
		for (const element of [j.gilets.ref, j.radio.ref]) await gestePrise(j.base, j.base.photos, j.alice, j.id, { quoi: 'retirer_ecart', element }, '2026-10-30T21:00', reglage);
		await validerPrise(j.base, j.alice, j.id, '2026-10-30T21:05', reglage);
		const lignes = await j.base.select().from(anomalie).orderBy(anomalie.id);
		expect(lignes.find((l) => l.id === gilets!.id)).toMatchObject({ closeLe: '2026-10-30T21:05', closePar: idDe(j.alice), priseId: null });
		expect(lignes.find((l) => l.id === radio.id)).toMatchObject({ closeLe: null, priseId: j.id });
		expect(await j.base.select({ quoi: anomalieSuivi.quoi, texte: anomalieSuivi.texte }).from(anomalieSuivi).where(eq(anomalieSuivi.anomalieId, gilets!.id))).toEqual([{ quoi: 'close', texte: 'Annulée : l’écart a été retiré de la prise de garde' }]);
		expect((await historiquePrises(j.base, j.vsav))[0]).toMatchObject({ id: j.id, signalees: 1 });
	});
});

describe('demande de réouverture', () => {
	it('par un participant, avec un motif : au chef de garde, avec un lien vers la prise ; la trace le dit', async () => {
		const j = await preparer();
		await demanderReouverture(j.base, j.alice, j.id, 'J’ai oublié la radio', APRES, reglage, j.vsav);
		const avis = await j.base.select().from(avisAnomalie).where(eq(avisAnomalie.url, `/engins/${j.vsav}/prise`));
		expect(avis).toMatchObject([{ personneId: idDe(j.chefDeGarde), titre: 'Prise de garde : VSAV 1', texte: 'Alice Fictif demande la réouverture : J’ai oublié la radio', url: `/engins/${j.vsav}/prise` }]);
		expect(await tracesDe(j)).toEqual({ demande: { par: idDe(j.alice), le: APRES, motif: 'J’ai oublié la radio' } });
		// La réouverture efface la demande et garde sa propre trace.
		await rouvrirPrise(j.base, j.chefDeGarde, j.id, 'Radio', APRES, reglage);
		expect(await tracesDe(j)).toEqual({ rouverte: { par: idDe(j.chefDeGarde), le: APRES, motif: 'Radio' } });
	});

	it('sans chef de garde en fonction : au chef de centre et à l’adjoint ; refusée à qui n’est ni participant ni d’astreinte', async () => {
		const j = await preparer();
		await j.base.delete(attribution).where(eq(attribution.personneId, idDe(j.chefDeGarde)));
		await expect(demanderReouverture(j.base, j.referent, j.id, 'Oubli', APRES, reglage)).rejects.toThrow(RefusDroit);
		await expect(demanderReouverture(j.base, j.alice, j.id, ' ', APRES, reglage)).rejects.toThrow('Motif manquant');
		await expect(demanderReouverture(j.base, j.alice, j.id, 'Oubli', SUIVANTE, reglage)).rejects.toThrow('Relève passée');
		await demanderReouverture(j.base, j.alice, j.id, 'Oubli', APRES, reglage);
		expect((await j.base.select().from(avisAnomalie).where(eq(avisAnomalie.url, `/engins/${j.vsav}/prise`))).map((a) => a.personneId)).toEqual([j.chefCentre.id]);
	});
});

describe('garde-fous', () => {
	it('un collègue écrit entre la lecture et l’écriture : refusé, ni cloche ni journal', async () => {
		const j = await preparer();
		// Après les deux lectures de la demande, un collègue modifie la prise.
		const batch = j.base.batch.bind(j.base);
		const espion = vi.spyOn(j.base, 'batch');
		espion.mockImplementationOnce(batch as never).mockImplementationOnce((async (q: Parameters<typeof batch>[0]) => {
			const r = await batch(q);
			await j.base.update(priseGarde).set({ compteur: sql`${priseGarde.compteur} + 1` }).where(eq(priseGarde.id, j.id));
			return r;
		}) as never);
		await expect(demanderReouverture(j.base, j.alice, j.id, 'Oubli', APRES, reglage)).rejects.toThrow('Prise changée entre-temps');
		espion.mockRestore();
		expect(await j.base.select().from(avisAnomalie).where(eq(avisAnomalie.url, `/engins/${j.vsav}/prise`))).toEqual([]);
	});

	it('une demande sans aucun chef à prévenir : refusée', async () => {
		const j = await preparer();
		await j.base.delete(attribution).where(inArray(attribution.personneId, [idDe(j.chefDeGarde), j.chefCentre.id]));
		await expect(demanderReouverture(j.base, j.alice, j.id, 'Oubli', APRES, reglage)).rejects.toThrow('Aucun chef à prévenir');
	});

	it('rouverte, ses photos restent (celles de ses anomalies) ; elle n’est pas effacée comme un brouillon passé', async () => {
		const j = await preparer();
		const jpeg = { type: 'image/jpeg' as const, donnees: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) };
		await rouvrirPrise(j.base, j.chefDeGarde, j.id, 'Photo', APRES, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, j.id, { quoi: 'ecart', element: j.radio.ref, genre: 'abime', manque: null, note: '', photo: jpeg }, APRES, reglage);
		await gestePrise(j.base, j.base.photos, j.alice, j.id, { quoi: 'retirer_ecart', element: j.radio.ref }, APRES, reglage);
		expect(await j.base.photos.select().from(octets)).toHaveLength(1);
		await commencerPrise(j.base, j.base.photos, j.alice, j.vsav, '2026-11-06T18:10', reglage);
		expect((await j.base.select().from(priseGarde).where(eq(priseGarde.id, j.id)))[0]).toMatchObject({ etat: 'en_cours' });
	});

	it('l’adjoint du chef de centre rouvre aussi', async () => {
		const j = await preparer();
		const [adjoint] = await j.base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre_adjoint'));
		await j.base.update(attribution).set({ responsabiliteId: adjoint!.id }).where(eq(attribution.personneId, j.chefCentre.id));
		await rouvrirPrise(j.base, j.chefCentre, j.id, 'Oubli', APRES, reglage);
	});
});

describe('les gestes permis, lus avec la page', () => {
	it('participant : modifier et demander ; chef de garde : modifier et rouvrir ; un autre agent : rien', async () => {
		const j = await preparer();
		const gestes = async (qui: typeof j.alice) => (await lirePrise(j.base, qui, j.vsav, APRES, reglage)).gestes;
		expect(await gestes(j.alice)).toEqual({ participants: true, rouvrir: false, demander: true });
		expect(await gestes(j.chefDeGarde)).toEqual({ participants: true, rouvrir: true, demander: false });
		expect(await gestes(j.chefCentre)).toEqual({ participants: true, rouvrir: true, demander: false });
		expect(await gestes(j.referent)).toEqual({ participants: false, rouvrir: false, demander: false });
		// Un brouillon : aucun de ces gestes.
		await rouvrirPrise(j.base, j.chefDeGarde, j.id, 'Oubli', APRES, reglage);
		expect(await gestes(j.chefDeGarde)).toEqual({ participants: false, rouvrir: false, demander: false });
	});
});

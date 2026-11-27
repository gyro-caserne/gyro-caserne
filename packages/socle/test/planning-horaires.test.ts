import { describe, expect, it } from 'vitest';
import { calculerAnnee, feries, periodesDeLaSemaine, rangDuJour, reglageDeLAnnee, reglagesDe, semainesDe, type Horaires, type Reglage } from '../src/planning/calendrier.ts';
import { exigerHoraires } from '../src/planning/horaires.ts';
import { releveDe } from '../src/prises.ts';
import { tranchesDe } from '../src/remplacements/tranches.ts';

const centre: Reglage = {
	debut: { jour: 'vendredi', heure: '18:00' },
	fin: { jour: 'vendredi', heure: '06:00' },
	reference: { date: '2026-01-02', equipe: 1 },
	semaine: { debut: '18:00', fin: '06:00' }
};
// Relève le lundi à 19 h, semaine de 19 h à 7 h.
const lundi: Horaires = { debut: { jour: 'lundi', heure: '19:00' }, fin: { jour: 'lundi', heure: '07:00' }, semaine: { debut: '19:00', fin: '07:00' } };
// Astreinte continue, sans heures de semaine : relève et fin le lundi à 8 h.
const continue_: Horaires = { debut: { jour: 'lundi', heure: '08:00' }, fin: { jour: 'lundi', heure: '08:00' } };
const fer = (annee: number) => new Set([...feries(annee), ...feries(annee + 1)].map((f) => f.date));
const json = (h: Horaires) => JSON.stringify(h);

describe('le réglage d’une année', () => {
	it('sans horaires : celui du centre, tel quel', () => {
		expect(reglageDeLAnnee(centre, null)).toBe(centre);
		expect(reglageDeLAnnee(centre, undefined)).toBe(centre);
	});

	it('avec horaires : la relève, la fin et la semaine de l’année ; la référence du centre reste', () => {
		expect(reglageDeLAnnee(centre, json(lundi))).toEqual({ ...lundi, reference: centre.reference });
		// Continue : plus d'heures de semaine.
		expect(reglageDeLAnnee(centre, json(continue_))).toEqual({ ...continue_, reference: centre.reference });
		expect('semaine' in reglageDeLAnnee(centre, json(continue_))).toBe(false);
	});

	it('chaque année lue a le sien, une année sans ligne a celui du centre', () => {
		const r = reglagesDe(centre, [
			{ annee: 2026, horaires: null },
			{ annee: 2027, horaires: json(lundi) }
		]);
		expect(r(2026)).toBe(centre);
		expect(r(2027).debut).toEqual({ jour: 'lundi', heure: '19:00' });
		expect(r(2028)).toBe(centre);
		expect(r(2027)).toBe(r(2027));
	});
});

describe('relève le lundi à 19 h, semaine de 19 h à 7 h', () => {
	const r = reglageDeLAnnee(centre, json(lundi));

	it('les jours de relève sont les lundis', () => {
		expect(semainesDe(2027, r)[0]).toEqual({ debut: '2027-01-04', numero: 1 });
		expect(semainesDe(2027, r).at(-1)!.debut).toBe('2027-12-27');
	});

	it('une semaine ordinaire : les nuits de 19 h à 7 h, le week-end d’un seul tenant', () => {
		expect(periodesDeLaSemaine('2027-11-15', r, fer(2027))).toEqual([
			{ debut: '2027-11-15T19:00', fin: '2027-11-16T07:00' },
			{ debut: '2027-11-16T19:00', fin: '2027-11-17T07:00' },
			{ debut: '2027-11-17T19:00', fin: '2027-11-18T07:00' },
			{ debut: '2027-11-18T19:00', fin: '2027-11-19T07:00' },
			{ debut: '2027-11-19T19:00', fin: '2027-11-22T07:00' }
		]);
	});

	it('les tranches se coupent à 7 h', () => {
		expect(tranchesDe([{ debut: '2027-11-19T19:00', fin: '2027-11-22T07:00' }], r)).toEqual([
			{ debut: '2027-11-19T19:00', fin: '2027-11-20T07:00' },
			{ debut: '2027-11-20T07:00', fin: '2027-11-21T07:00' },
			{ debut: '2027-11-21T07:00', fin: '2027-11-22T07:00' }
		]);
	});

	it('la relève de la prise de garde suit : lundi 19 h, deux heures d’avance comprises', () => {
		const annees = reglagesDe(centre, [{ annee: 2027, horaires: json(lundi) }]);
		expect(releveDe('2027-11-17T10:00', annees)).toBe('2027-11-15T19:00');
		expect(releveDe('2027-11-22T17:00', annees)).toBe('2027-11-22T19:00');
		expect(releveDe('2027-11-22T16:59', annees)).toBe('2027-11-15T19:00');
	});
});

describe('astreinte continue, sans heures de semaine', () => {
	const r = reglageDeLAnnee(centre, json(continue_));

	it('une seule période, du lundi 8 h au lundi suivant 8 h', () => {
		expect(periodesDeLaSemaine('2027-11-15', r, fer(2027))).toEqual([{ debut: '2027-11-15T08:00', fin: '2027-11-22T08:00' }]);
	});

	it('des tranches de 24 h, à l’heure de relève', () => {
		expect(tranchesDe([{ debut: '2027-11-15T08:00', fin: '2027-11-17T08:00' }], r)).toEqual([
			{ debut: '2027-11-15T08:00', fin: '2027-11-16T08:00' },
			{ debut: '2027-11-16T08:00', fin: '2027-11-17T08:00' }
		]);
	});
});

describe('le passage d’une année à l’autre', () => {
	const ordre = [1, 2, 3, 4];
	const r2027 = reglageDeLAnnee(centre, json(lundi));

	it('mêmes horaires : la dernière semaine finit comme avant', () => {
		expect(calculerAnnee(2026, centre, ordre, new Map(), undefined, centre)).toEqual(calculerAnnee(2026, centre, ordre, new Map()));
	});

	it('relève plus tard l’année suivante : la dernière semaine court jusqu’à la première relève, sans trou', () => {
		// Dernière relève de 2026 : vendredi 25 décembre ; première de 2027 : lundi 4 janvier à 19 h.
		const derniere = calculerAnnee(2026, centre, ordre, new Map(), undefined, r2027).at(-1)!;
		expect(derniere.debut).toBe('2026-12-25');
		expect(derniere.periodes.at(-1)).toEqual({ debut: '2026-12-31T18:00', fin: '2027-01-04T06:00' });
		const premiere = calculerAnnee(2027, r2027, ordre, new Map(), undefined, r2027)[0]!;
		expect(premiere.periodes[0]!.debut).toBe('2027-01-04T19:00');
	});

	it('relève plus tard l’année suivante : la dernière semaine court jusqu’au matin de la première relève', () => {
		// 2027 au lundi, 2028 au vendredi : dernière relève de 2027 le lundi 27 décembre ; première de 2028 le vendredi 7 janvier à 18 h.
		const derniere = calculerAnnee(2027, r2027, ordre, new Map(), undefined, centre).at(-1)!;
		expect(derniere.debut).toBe('2027-12-27');
		expect(derniere.periodes.at(-1)!.fin).toBe('2028-01-07T07:00');
		expect(calculerAnnee(2028, centre, ordre, new Map())[0]!.periodes[0]!.debut).toBe('2028-01-07T18:00');
	});

	it('relève plus tôt l’année suivante : la dernière semaine s’arrête à la première relève, sans chevauchement', () => {
		// 2028 continue, relève le samedi 1er janvier à 10 h : la semaine du lundi 27 décembre 2027 s'arrête là.
		const samedi = reglageDeLAnnee(centre, json({ debut: { jour: 'samedi', heure: '10:00' }, fin: { jour: 'samedi', heure: '10:00' } }));
		expect(calculerAnnee(2027, r2027, ordre, new Map(), undefined, samedi).at(-1)!.periodes.at(-1)).toEqual({ debut: '2027-12-31T19:00', fin: '2028-01-01T10:00' });
		expect(calculerAnnee(2028, samedi, ordre, new Map())[0]!.periodes[0]!.debut).toBe('2028-01-01T10:00');
	});

	it('continue l’année suivante : la semaine sortante reste jusqu’à la relève', () => {
		const c = reglageDeLAnnee(centre, json(continue_));
		// Première relève de 2027 : lundi 4 janvier à 8 h. Avant, le week-end est continu, puis la nuit du dimanche finit à 6 h.
		expect(calculerAnnee(2026, centre, ordre, new Map(), undefined, c).at(-1)!.periodes.at(-1)!.fin).toBe('2027-01-04T06:00');
		// Dans l'autre sens : 2026 continue, 2027 au vendredi 18 h ; la semaine sortante reste jusqu'à 18 h.
		expect(calculerAnnee(2026, c, ordre, new Map(), undefined, centre).at(-1)!.periodes).toEqual([{ debut: '2026-12-28T08:00', fin: '2027-01-01T18:00' }]);
	});

	it('la relève de la prise de garde, à cheval sur deux années', () => {
		const annees = reglagesDe(centre, [{ annee: 2027, horaires: json(lundi) }]);
		// Le 2 janvier 2027 : encore la dernière semaine de 2026, commencée le vendredi 25 décembre.
		expect(releveDe('2027-01-02T10:00', annees)).toBe('2026-12-25T18:00');
		expect(releveDe('2027-01-04T17:00', annees)).toBe('2027-01-04T19:00');
		// Avec les horaires du centre partout, comme avant : le vendredi 1er janvier 2027.
		expect(releveDe('2027-01-02T10:00', centre)).toBe('2027-01-01T18:00');
	});
});

describe('garde-fous des horaires', () => {
	it('accepte des horaires cohérents', () => {
		expect(exigerHoraires(lundi)).toEqual(lundi);
		expect(exigerHoraires(continue_)).toEqual(continue_);
	});

	it.each([
		[{ ...lundi, debut: { jour: 'lundy', heure: '19:00' } }, 'Jour de relève inconnu'],
		[{ ...lundi, debut: { jour: 'lundi', heure: '25:00' } }, 'Heure de relève invalide'],
		[{ ...lundi, fin: { jour: 'lundi', heure: '7h' } }, 'Heure de fin invalide'],
		[{ ...lundi, fin: { jour: 'lundi', heure: '20:00' } }, 'La fin doit tomber au plus tard à l’heure de la relève suivante'],
		[{ ...lundi, fin: { jour: 'mercredi', heure: '07:00' } }, 'La fin tombe le jour de la relève suivante'],
		[{ ...lundi, semaine: { debut: '19:00', fin: '19:00' } }, 'Les heures de semaine doivent être différentes'],
		[{ ...lundi, semaine: { debut: '19:00', fin: '' } }, 'Heure de semaine invalide'],
		['n’importe quoi', 'Horaires invalides']
	])('refuse %j', (h, message) => {
		expect(() => exigerHoraires(h)).toThrow(message);
	});
});

describe('régler les horaires d’une année', async () => {
	const { eq } = await import('drizzle-orm');
	const centreExemple = (await import('../../../centres/exemple/centre.ts')).default;
	const { baseDeTest } = await import('./base-de-test.ts');
	const { chargerJeuDeDepart } = await import('../src/jeu-de-depart.ts');
	const { changerSemaines, planningDe, preparerAnnee, publierAnnee, reglerRoulement } = await import('../src/planning/annee.ts');
	const { reglerHoraires } = await import('../src/planning/horaires.ts');
	const { reglerEte } = await import('../src/planning/ete.ts');
	const { astreinteDe } = await import('../src/planning/astreinte.ts');
	const { lireContexte, mesTranches } = await import('../src/remplacements/contexte.ts');
	const { chargerEnginsFictifs } = await import('../src/engins.ts');
	const { commencerPrise, lirePriseFaite, prisesDeLaReleve, prisesEnRetard } = await import('../src/prises.ts');
	const { accepterProposition } = await import('../src/planning/suivante.ts');
	const { engin } = await import('../src/schema.ts');
	const { affectationEquipe, anneePlanning, attribution, equipe, ete, journal, personne, profil, responsabilite, semaineChangee } = await import('../src/schema.ts');
	const reglage = centreExemple.astreinte;
	const m = '2026-11-01T10:00';

	async function jeu() {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
		const ids = (await base.select().from(equipe).orderBy(equipe.ordreRotation)).map((e) => e.id);
		const nouvelle = async (prenom: string) => (await base.insert(personne).values({ email: `${prenom}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning())[0]!.id;
		const chef = await nouvelle('chef');
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.systeme, 'chef_centre'));
		await base.insert(attribution).values({ personneId: chef, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		const alice = await nouvelle('alice');
		await base.insert(affectationEquipe).values({ personneId: alice, equipeId: ids[0]!, debut: '2026-01-01' });
		return { base, ids, chef: { type: 'personne' as const, id: chef }, alice: { type: 'personne' as const, id: alice } };
	}

	it('une année non publiée prend ses horaires ; ses semaines et la préparation les suivent', async () => {
		const { base, ids, chef } = await jeu();
		await reglerHoraires(base, chef, 2027, lundi, m, reglage);
		await reglerRoulement(base, chef, 2027, ids, m);
		const p = await preparerAnnee(base, chef, 2027, m, reglage);
		expect(p.horaires).toMatchObject({ valeur: lundi, propres: true });
		expect(p.semaines[0]!.debut).toBe('2027-01-04');
		expect(p.semaines[0]!.periodes[0]).toEqual({ debut: '2027-01-04T19:00', fin: '2027-01-05T07:00' });
		expect(await base.select().from(journal).where(eq(journal.action, 'regler_horaires'))).toHaveLength(1);
		// Garder les horaires du centre : la colonne redevient vide.
		await reglerHoraires(base, chef, 2027, null, m, reglage);
		expect((await base.select().from(anneePlanning).where(eq(anneePlanning.annee, 2027)))[0]!.horaires).toBeNull();
		expect((await preparerAnnee(base, chef, 2027, m, reglage)).horaires).toMatchObject({ propres: false, valeur: { debut: reglage.debut } });
	});

	it('des horaires égaux à ceux du centre ne sont pas gardés', async () => {
		const { base, chef } = await jeu();
		await reglerHoraires(base, chef, 2027, lundi, m, reglage);
		await reglerHoraires(base, chef, 2027, { debut: reglage.debut, fin: reglage.fin, semaine: reglage.semaine }, m, reglage);
		expect((await base.select().from(anneePlanning).where(eq(anneePlanning.annee, 2027)))[0]!.horaires).toBeNull();
	});

	it('refus : sans le droit, horaires invalides, année publiée', async () => {
		const { base, ids, chef, alice } = await jeu();
		await expect(reglerHoraires(base, alice, 2027, lundi, m, reglage)).rejects.toThrow('GERER_PLANNING');
		await expect(reglerHoraires(base, chef, 2027, { ...lundi, fin: { jour: 'lundi', heure: '20:00' } }, m, reglage)).rejects.toThrow('La fin doit tomber au plus tard');
		await reglerRoulement(base, chef, 2027, ids, m);
		await publierAnnee(base, chef, 2027, m);
		await expect(reglerHoraires(base, chef, 2027, lundi, m, reglage)).rejects.toThrow('Planning 2027 publié. Ses horaires ne changent plus');
		await expect(reglerHoraires(base, chef, 2027, null, m, reglage)).rejects.toThrow('Planning 2027 publié');
	});

	it('refus : semaines changées et autre jour de relève ; été ouvert', async () => {
		const { base, ids, chef } = await jeu();
		await reglerRoulement(base, chef, 2027, ids, m);
		await changerSemaines(base, chef, 2027, { '2027-01-08': ids[2]! }, m, reglage);
		await expect(reglerHoraires(base, chef, 2027, lundi, m, reglage)).rejects.toThrow('Des semaines sont déjà changées');
		// Même jour de relève, autres heures : permis.
		await reglerHoraires(base, chef, 2027, { ...lundi, debut: { jour: 'vendredi', heure: '19:00' }, fin: { jour: 'vendredi', heure: '07:00' } }, m, reglage);
		await reglerEte(base, chef, 2027, { debut: '2027-07-02', fin: '2027-08-27', dateLimite: '2027-05-15' }, m, reglage);
		await expect(reglerHoraires(base, chef, 2027, null, m, reglage)).rejects.toThrow('L’été 2027 est ouvert');
	});

	it('refus : la dernière semaine de l’année d’avant a commencé', async () => {
		const { base, ids, chef } = await jeu();
		// 2026 publiée, sa dernière semaine commencée le vendredi 25 décembre à 18 h.
		await reglerRoulement(base, chef, 2026, ids, m);
		await publierAnnee(base, chef, 2026, m);
		await expect(reglerHoraires(base, chef, 2028, lundi, '2026-12-26T10:00', reglage)).resolves.toBeUndefined();
		await expect(reglerHoraires(base, chef, 2027, lundi, '2026-12-26T10:00', reglage)).rejects.toThrow('La dernière semaine de 2026 a commencé');
	});

	it('publiée, l’année suit ses horaires partout : planning, accueil, tranches, prise de garde', async () => {
		const { base, ids, chef, alice } = await jeu();
		await reglerRoulement(base, chef, 2026, ids, m);
		await publierAnnee(base, chef, 2026, m);
		await reglerHoraires(base, chef, 2027, lundi, m, reglage);
		await reglerRoulement(base, chef, 2027, ids, m);
		await publierAnnee(base, chef, 2027, m);
		const p = await planningDe(base, alice, 2027, m, reglage);
		if (!p.publiee) throw new Error('publiée');
		expect(p.semaines.every((s) => rangDuJour(s.debut) === 0)).toBe(true);
		// La dernière semaine de 2026 court jusqu'au lundi 4 janvier : le 2 janvier, l'accueil la montre en cours.
		const a = await astreinteDe(base, chef, '2027-01-02T10:00', reglage);
		expect(a).toMatchObject({ debut: '2026-12-25T18:00', fin: '2027-01-04T06:00', enCours: true, releve: '2026-12-25T18:00' });
		// Les tranches d'Alice coupées à 7 h.
		const ctx = await lireContexte(base, '2027-11-10T10:00', reglage);
		const tranches = mesTranches(ctx, alice.id).flatMap((s) => s.tranches);
		expect(tranches.length).toBeGreaterThan(0);
		expect(tranches.every((t) => t.fin.endsWith('T07:00') || t.fin.endsWith('T19:00') || t.debut.endsWith('T19:00'))).toBe(true);
		// La prise de garde : la relève du lundi à 19 h, deux heures d'avance comprises.
		await chargerEnginsFictifs(base, m);
		expect((await prisesDeLaReleve(base, chef, '2027-11-22T17:30', reglage)).releve.debut).toBe('2027-11-22T19:00');
		expect((await prisesDeLaReleve(base, chef, '2027-11-22T16:30', reglage)).releve.debut).toBe('2027-11-15T19:00');
	});

	it('avec les horaires du centre, la prise de garde lit une fois ; des horaires qui déplacent la relève, deux', async () => {
		const { base, ids, chef } = await jeu();
		await chargerEnginsFictifs(base, m);
		await reglerRoulement(base, chef, 2027, ids, m);
		await publierAnnee(base, chef, 2027, m);
		const compter = async (quand: string) => {
			const avant = base.requetes;
			await prisesDeLaReleve(base, chef, quand, reglage);
			return base.requetes - avant;
		};
		const centre = await compter('2027-11-22T17:30');
		await base.update(anneePlanning).set({ horaires: json(lundi) });
		expect(await compter('2027-11-22T17:30')).toBe(centre + 1);
		// Même relève que le centre (vendredi 18 h), autres heures de semaine : une fois.
		await base.update(anneePlanning).set({ horaires: json({ ...centre_, semaine: { debut: '19:00', fin: '07:00' } }) });
		expect(await compter('2027-11-26T17:30')).toBe(centre);
	});
	const centre_: Horaires = { debut: reglage.debut, fin: reglage.fin };

	it('partir d’une proposition garde les horaires de l’année et ses jours de relève', async () => {
		const { base, ids, chef } = await jeu();
		await reglerRoulement(base, chef, 2026, ids, m);
		await publierAnnee(base, chef, 2026, m);
		await reglerHoraires(base, chef, 2027, lundi, m, reglage);
		await accepterProposition(base, chef, 2027, m, reglage);
		expect(JSON.parse((await base.select().from(anneePlanning).where(eq(anneePlanning.annee, 2027)))[0]!.horaires!)).toEqual(lundi);
		const p = await preparerAnnee(base, chef, 2027, m, reglage);
		expect(p.semaines.every((x) => rangDuJour(x.debut) === 0)).toBe(true);
		for (const c of await base.select().from(semaineChangee)) expect(rangDuJour(c.debut)).toBe(0);
	});

	it('refus : une autre relève toucherait un remplacement ou une fête de la dernière semaine de l’année d’avant ; d’autres heures de semaine, non', async () => {
		const { base, ids, chef, alice } = await jeu();
		await reglerRoulement(base, chef, 2026, ids, m);
		await publierAnnee(base, chef, 2026, m);
		const { feteCentre } = await import('../src/schema.ts');
		// Une fête du centre le samedi 26 décembre 2026, dans la semaine du vendredi 25.
		await base.insert(feteCentre).values({ nom: 'Sainte-Barbe', debut: '2026-12-26T18:00', fin: '2026-12-26T23:00', equipeId: ids[1]!, creePar: 'Chef Test', creeLe: m });
		await expect(reglerHoraires(base, chef, 2027, lundi, m, reglage)).rejects.toThrow('Des remplacements ou une fête du centre tombent dans la dernière semaine de 2026');
		// Même relève, d'autres heures de semaine : la dernière semaine de 2026 ne bouge pas.
		await reglerHoraires(base, chef, 2027, { debut: reglage.debut, fin: reglage.fin, semaine: { debut: '19:00', fin: '07:00' } }, m, reglage);
		// Un remplacement d'Alice (équipe 1) dans cette semaine bloque aussi.
		await base.delete(feteCentre);
		const p = await planningDe(base, alice, 2026, m, reglage);
		if (!p.publiee) throw new Error('publiée');
		const nuit = p.semaines.at(-1)!.periodes.at(-1)!;
		await base.insert((await import('../src/schema.ts')).demandeRemplacement).values({ genre: 'remplacement', demandeurId: alice.id, periodes: JSON.stringify([nuit]), debut: nuit.debut, etat: 'attente', creeLe: m });
		await expect(reglerHoraires(base, chef, 2027, lundi, m, reglage)).rejects.toThrow('Des remplacements ou une fête du centre');
	});

	it('la prise de garde validée : « en cours » suit la relève de l’année ; l’alerte de retard aussi', async () => {
		const { base, ids, chef } = await jeu();
		await chargerEnginsFictifs(base, m);
		await reglerHoraires(base, chef, 2027, lundi, m, reglage);
		await reglerRoulement(base, chef, 2027, ids, m);
		await publierAnnee(base, chef, 2027, m);
		const [e] = await base.select().from(engin);
		const id = await commencerPrise(base, base.photos, chef, e!.id, '2027-11-22T19:30', reglage);
		await base.update((await import('../src/schema.ts')).priseGarde).set({ etat: 'validee', valideeLe: '2027-11-22T20:00' });
		expect((await lirePriseFaite(base, chef, id, '2027-11-26T19:00', reglage)).courante).toBe(true);
		expect((await lirePriseFaite(base, chef, id, '2027-11-29T18:00', reglage)).courante).toBe(false);
		// Trois heures après la relève du lundi 29 à 19 h : les engins sans prise validée sont en retard.
		expect(await prisesEnRetard(base, '2027-11-29T21:00', reglage)).toBeNull();
		expect((await prisesEnRetard(base, '2027-11-29T22:00', reglage))!.engins.length).toBeGreaterThan(0);
	});

	it('régler l’été suit les jours de relève de l’année', async () => {
		const { base, ids, chef } = await jeu();
		await reglerHoraires(base, chef, 2027, lundi, m, reglage);
		await reglerRoulement(base, chef, 2027, ids, m);
		await expect(reglerEte(base, chef, 2027, { debut: '2027-07-02', fin: '2027-08-27', dateLimite: '2027-05-15' }, m, reglage)).rejects.toThrow('Jour de relève attendu');
		await reglerEte(base, chef, 2027, { debut: '2027-06-28', fin: '2027-08-30', dateLimite: '2027-05-15' }, m, reglage);
		expect(await base.select({ debut: ete.debut }).from(ete)).toEqual([{ debut: '2027-06-28' }]);
	});
});

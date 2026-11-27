import { describe, expect, it } from 'vitest';
import { calculerAnnee, feries, periodesDeLaSemaine, reglageDeLAnnee, reglagesDe, semainesDe, type Horaires, type Reglage } from '../src/planning/calendrier.ts';
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
		[{ ...lundi, semaine: { debut: '19:00', fin: '19:00' } }, 'Les heures de semaine doivent être différentes'],
		[{ ...lundi, semaine: { debut: '19:00', fin: '' } }, 'Heure de semaine invalide'],
		['n’importe quoi', 'Horaires invalides']
	])('refuse %j', (h, message) => {
		expect(() => exigerHoraires(h)).toThrow(message);
	});
});

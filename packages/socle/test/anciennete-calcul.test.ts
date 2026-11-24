import { describe, expect, it } from 'vitest';
import { anciennete, anneesEntre, dateDuPalier, echelonDe, PALIERS_PAR_DEFAUT } from '../src/anciennete-calcul.ts';

describe('ancienneté de service, sans base', () => {
	it('les années pleines, comptées au jour anniversaire de l’engagement', () => {
		expect(anneesEntre('2016-12-12', '2026-12-11')).toBe(9);
		expect(anneesEntre('2016-12-12', '2026-12-12')).toBe(10);
		expect(anneesEntre('2016-12-12', '2027-01-01')).toBe(10);
		// Engagé un 29 février : son palier tombe le 28 février les années non bissextiles.
		expect(anneesEntre('2016-02-29', '2026-02-27')).toBe(9);
		expect(anneesEntre('2016-02-29', '2026-02-28')).toBe(10);
		expect(anneesEntre('2016-02-29', '2028-02-28')).toBe(11);
		expect(anneesEntre('2016-02-29', '2028-02-29')).toBe(12);
		// Une date d'engagement à venir (erreur de saisie) : aucune année.
		expect(anneesEntre('2027-01-01', '2026-11-24')).toBe(0);
	});

	it('la date d’un palier', () => {
		expect(dateDuPalier('2016-12-12', 15)).toBe('2031-12-12');
		expect(dateDuPalier('2016-02-29', 10)).toBe('2026-02-28');
		expect(dateDuPalier('2016-02-29', 12)).toBe('2028-02-29');
	});

	it('l’échelon de la médaille d’honneur, d’après les années', () => {
		expect([4, 9, 10, 15, 19, 20, 24, 25, 29, 30, 39, 40, 45].map(echelonDe)).toEqual([null, null, 'bronze', 'bronze', 'bronze', 'argent', 'argent', 'vermeil', 'vermeil', 'or', 'or', 'grand_or', 'grand_or']);
	});

	it('par défaut, un palier tous les 5 ans', () => {
		expect(PALIERS_PAR_DEFAUT.slice(0, 5)).toEqual([5, 10, 15, 20, 25]);
	});

	it('12 ans : 8 au centre, échelon bronze, prochain palier 15 ans et la part faite depuis le palier de 10 ans', () => {
		const a = anciennete('2014-03-03', '2018-06-01', '2026-11-24', PALIERS_PAR_DEFAUT);
		expect(a).toMatchObject({ annees: 12, auCentre: 8, echelon: 'bronze', prochain: { annees: 15, jour: '2029-03-03' } });
		// Du 3 mars 2024 au 3 mars 2029 : un peu plus de la moitié.
		expect(a.prochain!.part).toBeGreaterThan(0.5);
		expect(a.prochain!.part).toBeLessThan(0.6);
	});

	it('avant le premier palier : pas d’échelon, la part comptée depuis l’engagement', () => {
		const a = anciennete('2024-11-24', null, '2026-11-24', PALIERS_PAR_DEFAUT);
		expect(a).toMatchObject({ annees: 2, auCentre: null, echelon: null, prochain: { annees: 5, jour: '2029-11-24' } });
		expect(a.prochain!.part).toBeCloseTo(0.4, 2);
	});

	it('sur le dernier palier réglé, pas de prochain palier', () => {
		expect(anciennete('1996-01-01', '1996-01-01', '2026-11-24', [10, 20, 25, 30]).prochain).toBeNull();
		expect(anciennete('1996-01-01', '1996-01-01', '2026-11-24', [10, 20, 25, 30, 40]).prochain).toMatchObject({ annees: 40, jour: '2036-01-01' });
	});

	it('sans date d’engagement : seulement les années au centre', () => {
		expect(anciennete(null, '2018-06-01', '2026-11-24', PALIERS_PAR_DEFAUT)).toEqual({ annees: null, auCentre: 8, echelon: null, prochain: null });
		expect(anciennete(null, null, '2026-11-24', PALIERS_PAR_DEFAUT)).toEqual({ annees: null, auCentre: null, echelon: null, prochain: null });
	});
});

import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { feries, periodesDeLaSemaine } from '../src/planning/calendrier.ts';
import { reunir, soustraire, texteCreneau, texteDemande, texteTranche, tranchesDe } from '../src/remplacements/tranches.ts';

const reglage = centreExemple.astreinte;
const f2026 = new Set(feries(2026).map((f) => f.date));
const semaine = (debut: string) => tranchesDe(periodesDeLaSemaine(debut, reglage, f2026), reglage);

describe('tranches', () => {
	it('semaine ordinaire : vendredi soir, deux gardes de 24 h, puis les nuits', () => {
		expect(semaine('2026-11-13')).toEqual([
			{ debut: '2026-11-13T18:00', fin: '2026-11-14T06:00' },
			{ debut: '2026-11-14T06:00', fin: '2026-11-15T06:00' },
			{ debut: '2026-11-15T06:00', fin: '2026-11-16T06:00' },
			{ debut: '2026-11-16T18:00', fin: '2026-11-17T06:00' },
			{ debut: '2026-11-17T18:00', fin: '2026-11-18T06:00' },
			{ debut: '2026-11-18T18:00', fin: '2026-11-19T06:00' },
			{ debut: '2026-11-19T18:00', fin: '2026-11-20T06:00' }
		]);
	});

	it('mercredi 11 novembre férié : nuit du mardi, puis 24 h du mercredi', () => {
		expect(semaine('2026-11-06').slice(3, 6)).toEqual([
			{ debut: '2026-11-09T18:00', fin: '2026-11-10T06:00' },
			{ debut: '2026-11-10T18:00', fin: '2026-11-11T06:00' },
			{ debut: '2026-11-11T06:00', fin: '2026-11-12T06:00' }
		]);
	});

	it('nuit du passage à l’heure d’hiver (25 octobre 2026) : heures de Paris inchangées', () => {
		expect(semaine('2026-10-23').slice(1, 3)).toEqual([
			{ debut: '2026-10-24T06:00', fin: '2026-10-25T06:00' },
			{ debut: '2026-10-25T06:00', fin: '2026-10-26T06:00' }
		]);
	});

	it('astreinte continue : tranches de 24 h à l’heure de relève', () => {
		const continu = { ...reglage, semaine: undefined };
		expect(tranchesDe([{ debut: '2026-11-13T18:00', fin: '2026-11-15T18:00' }], continu)).toEqual([
			{ debut: '2026-11-13T18:00', fin: '2026-11-14T18:00' },
			{ debut: '2026-11-14T18:00', fin: '2026-11-15T18:00' }
		]);
	});

	it('soustraire et réunir', () => {
		const p = [{ debut: '2026-11-13T18:00', fin: '2026-11-16T06:00' }];
		expect(soustraire(p, [{ debut: '2026-11-14T06:00', fin: '2026-11-15T06:00' }])).toEqual([
			{ debut: '2026-11-13T18:00', fin: '2026-11-14T06:00' },
			{ debut: '2026-11-15T06:00', fin: '2026-11-16T06:00' }
		]);
		expect(reunir(semaine('2026-11-13').slice(0, 3))).toEqual(p);
	});

	it('textes', () => {
		expect(texteTranche({ debut: '2026-11-16T18:00', fin: '2026-11-17T06:00' })).toBe('nuit du lundi 16 novembre');
		expect(texteTranche({ debut: '2026-11-14T06:00', fin: '2026-11-15T06:00' })).toBe('24 h du samedi 14 novembre');
		// Une plage courte, le même jour ou à cheval sur minuit.
		expect(texteTranche({ debut: '2026-11-16T20:00', fin: '2026-11-16T22:00' })).toBe('lundi 16 novembre, de 20 h à 22 h');
		// À minuit, ou passé minuit en 3 h ou moins : le jour du début.
		expect(texteTranche({ debut: '2026-11-16T22:00', fin: '2026-11-17T00:00' })).toBe('lundi 16 novembre, de 22 h à minuit');
		expect(texteTranche({ debut: '2026-11-16T23:00', fin: '2026-11-17T01:30' })).toBe('lundi 16 novembre, de 23 h à 1 h 30');
		expect(texteTranche({ debut: '2026-11-16T03:00', fin: '2026-11-16T06:00' })).toBe('lundi 16 novembre, de 3 h à 6 h');
		// Plus de 3 h : les libellés d'avant.
		expect(texteTranche({ debut: '2026-11-16T20:00', fin: '2026-11-17T00:00' })).toBe('nuit du lundi 16 novembre');
		expect(texteTranche({ debut: '2026-11-16T12:00', fin: '2026-11-17T10:00' })).toBe('du lundi 16 novembre, 12 h au mardi 17 novembre, 10 h');
		expect(texteDemande(semaine('2026-11-13').slice(0, 3))).toBe('du vendredi 13 novembre, 18 h au lundi 16 novembre, 6 h');
		expect(texteDemande([semaine('2026-11-13')[3]!, semaine('2026-11-13')[5]!])).toBe('nuit du lundi 16 novembre et nuit du mercredi 18 novembre');
	});

	it('un créneau se dit toujours par ses heures, jamais « nuit du » ni « 24 h du »', () => {
		expect(texteCreneau({ debut: '2026-12-01T20:10', fin: '2026-12-01T22:40' })).toBe('mardi 1er décembre, de 20 h 10 à 22 h 40');
		expect(texteCreneau({ debut: '2026-12-04T21:00', fin: '2026-12-05T07:00' })).toBe('du vendredi 4 décembre, 21 h au samedi 5 décembre, 7 h');
		expect(texteCreneau({ debut: '2026-12-05T10:00', fin: '2026-12-06T10:00' })).toBe('du samedi 5 décembre, 10 h au dimanche 6 décembre, 10 h');
		expect(texteCreneau({ debut: '2026-12-01T20:00', fin: '2026-12-02T00:00' })).toBe('mardi 1er décembre, de 20 h à minuit');
		// Passé minuit : les deux jours, là où une tranche dirait « nuit du lundi ».
		expect(texteCreneau({ debut: '2026-11-09T22:00', fin: '2026-11-10T02:00' })).toBe('du lundi 9 novembre, 22 h au mardi 10 novembre, 2 h');
		expect(texteTranche({ debut: '2026-11-09T22:00', fin: '2026-11-10T02:00' })).toBe('nuit du lundi 9 novembre');
		expect(texteDemande([{ debut: '2026-12-04T21:00', fin: '2026-12-05T07:00' }], true)).toBe('du vendredi 4 décembre, 21 h au samedi 5 décembre, 7 h');
		// Sans la marque, les libellés d'avant.
		expect(texteDemande([{ debut: '2026-12-04T21:00', fin: '2026-12-05T07:00' }])).toBe('nuit du vendredi 4 décembre');
	});
});

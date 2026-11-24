import { describe, expect, it } from 'vitest';
import { phraseFelicitations, textesAnciennete } from './anciennete.ts';

const p = (prenom: string) => ({ prenom, nom: 'Test' });

describe('textes de l’ancienneté', () => {
	it('12 ans, 8 au centre, échelon bronze, prochain palier à 15 ans', () => {
		expect(textesAnciennete({ annees: 12, auCentre: 8, echelon: 'bronze', prochain: { annees: 15, jour: '2029-03-03', part: 0.55 } })).toEqual({
			nombre: '12 ans',
			sous: 'de service, dont 8 au centre',
			echelon: 'Échelon bronze',
			prochain: 'Prochain palier, 15 ans le 3 mars 2029',
			part: 55
		});
	});

	it('les cas simples : une année, moins d’un an, toujours au centre, le 1er du mois, grand or, dernier palier', () => {
		expect(textesAnciennete({ annees: 1, auCentre: 1, echelon: null, prochain: { annees: 5, jour: '2030-04-01', part: 0.2 } })).toMatchObject({ nombre: '1 an', sous: 'de service au centre', echelon: null, prochain: 'Prochain palier, 5 ans le 1er avril 2030' });
		expect(textesAnciennete({ annees: 0, auCentre: 0, echelon: null, prochain: null })).toMatchObject({ nombre: 'Moins d’un an', sous: 'de service au centre' });
		expect(textesAnciennete({ annees: 9, auCentre: 0, echelon: null, prochain: null })).toMatchObject({ sous: 'de service, dont moins d’un an au centre' });
		expect(textesAnciennete({ annees: 41, auCentre: null, echelon: 'grand_or', prochain: null })).toEqual({ nombre: '41 ans', sous: 'de service', echelon: 'Échelon grand or', prochain: null, part: null });
	});

	it('sans date d’engagement : les années au centre seulement, ou rien', () => {
		expect(textesAnciennete({ annees: null, auCentre: 8, echelon: null, prochain: null })).toEqual({ nombre: '8 ans', sous: 'au centre', echelon: null, prochain: null, part: null });
		expect(textesAnciennete({ annees: null, auCentre: null, echelon: null, prochain: null })).toBeNull();
	});

	it('qui a félicité : trois noms, puis le nombre des autres', () => {
		expect(phraseFelicitations([p('Claire')])).toBe('Claire Test vous félicite.');
		expect(phraseFelicitations([p('Claire'), p('Marc')])).toBe('Claire Test et Marc Test vous félicitent.');
		expect(phraseFelicitations([p('Paul'), p('Marc'), p('Luc'), p('Léa')])).toBe('Paul Test, Marc Test et 2 autres collègues vous félicitent.');
	});
});

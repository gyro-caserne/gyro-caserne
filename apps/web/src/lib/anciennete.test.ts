import { describe, expect, it } from 'vitest';
import { ans } from '@gyro-caserne/socle';
import { phraseFelicitations, textesAnciennete } from './anciennete.ts';

const p = (prenom: string) => ({ prenom, nom: 'Test' });

describe('textes de l’ancienneté', () => {
	it('12 ans, 8 au centre, échelon bronze, prochain palier à 15 ans', () => {
		expect(textesAnciennete({ annees: 12, auCentre: 8, echelon: 'bronze', prochain: { annees: 15, jour: '2029-03-03', part: 0.55 } })).toEqual({
			nombre: '12\u00a0ans',
			sous: 'de service, dont 8 au centre',
			echelon: 'Échelon bronze',
			prochain: 'Prochain palier, 15\u00a0ans le 3 mars 2029',
			part: 55
		});
	});

	it('les cas simples : une année, moins d’un an, toujours au centre, le 1er du mois, grand or, dernier palier', () => {
		expect(textesAnciennete({ annees: 1, auCentre: 1, echelon: null, prochain: { annees: 5, jour: '2030-04-01', part: 0.2 } })).toMatchObject({ nombre: '1\u00a0an', sous: 'de service au centre', echelon: null, prochain: 'Prochain palier, 5\u00a0ans le 1er avril 2030' });
		expect(textesAnciennete({ annees: 0, auCentre: 0, echelon: null, prochain: null })).toMatchObject({ nombre: 'Moins d’un an', sous: 'de service au centre' });
		expect(textesAnciennete({ annees: 9, auCentre: 0, echelon: null, prochain: null })).toMatchObject({ sous: 'de service, dont moins d’un an au centre' });
		expect(textesAnciennete({ annees: 41, auCentre: null, echelon: 'grand_or', prochain: null })).toEqual({ nombre: '41\u00a0ans', sous: 'de service', echelon: 'Échelon grand or', prochain: null, part: null });
	});

	it('sans date d’engagement : les années au centre seulement, ou rien', () => {
		expect(textesAnciennete({ annees: null, auCentre: 8, echelon: null, prochain: null })).toEqual({ nombre: '8\u00a0ans', sous: 'au centre', echelon: null, prochain: null, part: null });
		expect(textesAnciennete({ annees: null, auCentre: null, echelon: null, prochain: null })).toBeNull();
	});

	it('le nombre et « ans » ne se séparent jamais en fin de ligne (espace insécable), partout', () => {
		const t = textesAnciennete({ annees: 10, auCentre: 1, echelon: 'bronze', prochain: { annees: 15, jour: '2029-03-03', part: 0.5 } })!;
		for (const texte of [t.nombre, t.sous, t.prochain!]) expect(texte).not.toMatch(/\d (ans?)\b/);
		expect(t.prochain).toContain('15\u00a0ans le 3 mars 2029');
		expect(ans(1)).toBe('1\u00a0an');
		expect(ans(25)).toBe('25\u00a0ans');
	});

	it('qui a félicité : trois noms, puis le nombre des autres', () => {
		expect(phraseFelicitations([p('Claire')])).toBe('Claire Test vous félicite.');
		expect(phraseFelicitations([p('Claire'), p('Marc')])).toBe('Claire Test et Marc Test vous félicitent.');
		expect(phraseFelicitations([p('Paul'), p('Marc'), p('Luc'), p('Léa')])).toBe('Paul Test, Marc Test et 2 autres collègues vous félicitent.');
	});
});

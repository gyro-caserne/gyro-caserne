import { describe, expect, it } from 'vitest';
import { ecrireClasseurFiches, lireClasseurFiches, nomDuFichierFiches } from './classeur.ts';

const donnees = {
	entetes: ['Réf.', 'Zone', 'Élément', 'Quantité', 'Prévenir'],
	feuilles: [
		{ nom: 'VSAV', lignes: [['1', 'Cabine', 'Essai radio', '', ''], ['2', 'Sac PS', 'Attelles', '3', 'Référent pharmacie, Référent engins']] },
		{ nom: 'VTU', lignes: [] }
	]
};

describe('classeur des fiches', () => {
	it('aller-retour : une feuille par type, les cellules relues sont celles écrites', async () => {
		const lu = await lireClasseurFiches(await ecrireClasseurFiches(donnees));
		expect(lu.feuilles).toEqual({
			VSAV: [
				{ numero: 2, cellules: ['1', 'Cabine', 'Essai radio', '', ''] },
				{ numero: 3, cellules: ['2', 'Sac PS', 'Attelles', '3', 'Référent pharmacie, Référent engins'] }
			],
			VTU: []
		});
		expect(lu.entetes?.VSAV).toEqual(['Réf.', 'Zone', 'Élément', 'Quantité', 'Prévenir']);
	});

	it('un ancien fichier, sans Prévenir, ou avec des notes à droite : quatre colonnes lues', async () => {
		const ancien = await lireClasseurFiches(await ecrireClasseurFiches({ entetes: ['Réf.', 'Zone', 'Élément', 'Quantité', 'Notes'], feuilles: [{ nom: 'VSAV', lignes: [['1', 'Cabine', 'Essai radio', '', 'à revoir']] }] }));
		expect(ancien.entetes?.VSAV).toEqual(['Réf.', 'Zone', 'Élément', 'Quantité']);
		expect(ancien.feuilles.VSAV).toEqual([{ numero: 2, cellules: ['1', 'Cabine', 'Essai radio', ''] }]);
	});

	it('nom du fichier daté', () => {
		expect(nomDuFichierFiches('2026-11-02')).toBe('fiches-engins-2026-11-02.xlsx');
	});
});

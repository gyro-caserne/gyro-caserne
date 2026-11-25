import { describe, expect, it } from 'vitest';
import { etapesEnUneLigne, titreDeDemande } from './textes.ts';

describe('le titre d’une demande', () => {
	it('entier s’il est court ; sinon coupé à la fin d’un mot, sans ponctuation pendante, avec « … »', () => {
		expect(titreDeDemande('Gants nitrile taille M.')).toBe('Gants nitrile taille M.');
		expect(titreDeDemande('Compresses stériles 10 x 10, la boîte du VSAV est presque vide.')).toBe('Compresses stériles 10 x 10, la boîte du VSAV est presque…');
		expect(titreDeDemande('Compresses stériles 10 x 10, la boîte du VSAV est presque vide.', 30)).toBe('Compresses stériles 10 x 10…');
		expect(titreDeDemande('x'.repeat(80))).toBe(`${'x'.repeat(60)}…`);
	});
});

describe('les étapes d’un rôle en une ligne', () => {
	it('Demandée, Prise en compte, les étapes du rôle, la dernière', () => {
		expect(etapesEnUneLigne({ etapes: [{ nom: 'Commandée' }], derniere: 'Livrée' })).toBe('Demandée, Prise en compte, Commandée, Livrée');
		expect(etapesEnUneLigne({ etapes: [], derniere: 'Faite' })).toBe('Demandée, Prise en compte, Faite');
	});
});

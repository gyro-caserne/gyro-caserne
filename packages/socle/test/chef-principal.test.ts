import { describe, expect, it } from 'vitest';
import { chefPrincipal } from '../src/droits.ts';
import { aPrevenir, valideurs, type Chef } from '../src/remplacements/contexte.ts';

// Le chef de centre est le destinataire principal : l'adjoint ne reçoit pas les mêmes lignes en double (hors urgence).
describe('chef de centre et adjoint', () => {
	it('chefPrincipal : le chef de centre ; sans lui, l’adjoint', () => {
		expect(chefPrincipal([{ id: 1, systeme: 'chef_centre' }, { id: 2, systeme: 'chef_centre_adjoint' }])).toEqual([1]);
		expect(chefPrincipal([{ id: 2, systeme: 'chef_centre_adjoint' }, { id: 3, systeme: 'chef_centre_adjoint' }])).toEqual([2, 3]);
		expect(chefPrincipal([{ id: 4, systeme: 'chef_equipe' }])).toEqual([]);
	});

	const chefs: Chef[] = [
		{ personneId: 1, systeme: 'chef_centre', equipeId: null },
		{ personneId: 2, systeme: 'chef_centre_adjoint', equipeId: null },
		{ personneId: 5, systeme: 'chef_equipe', equipeId: 10 }
	];
	it('remplacements : avec un chef de garde, lui ; sans, le chef de centre seul (l’adjoint valide toujours)', () => {
		expect(aPrevenir(chefs, 10, 7)).toEqual([5]);
		expect(aPrevenir(chefs, 20, 7)).toEqual([1]);
		expect(valideurs(chefs, 20, 7)).toEqual([1, 2]);
		// Le chef de centre demandeur : l'adjoint.
		expect(aPrevenir(chefs, 20, 1)).toEqual([2]);
	});
});

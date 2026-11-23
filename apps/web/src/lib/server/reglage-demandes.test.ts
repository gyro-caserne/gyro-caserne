import { describe, expect, it } from 'vitest';
import { saisieDuFormulaire, saisieDuRole } from './reglage-demandes.ts';

const formulaire = (paires: [string, string][]) => {
	const f = new FormData();
	for (const [c, v] of paires) f.append(c, v);
	return f;
};
const actuel = { etapes: [{ id: 'ea', nom: 'Commandée' }, { id: 'eb', nom: 'Reçue' }], derniere: 'Livrée' };
// Une saisie pas encore enregistrée : « Arrivée » renommée, une étape nouvelle sans identifiant.
const saisie: [string, string][] = [['case-demandes', '1'], ['recoit', '1'], ['etape-id', 'ea'], ['etape-nom', 'Commandée'], ['etape-id', 'eb'], ['etape-nom', 'Arrivée'], ['etape-id', ''], ['etape-nom', 'Rangée'], ['derniere', 'Remise']];

describe('le réglage saisi dans le formulaire', () => {
	it('la case, les noms saisis dans l’ordre de la page, une étape nouvelle sans identifiant, la dernière étape', () => {
		expect(saisieDuFormulaire(formulaire(saisie), actuel)).toEqual({ recoit: true, etapes: [{ id: 'ea', nom: 'Commandée' }, { id: 'eb', nom: 'Arrivée' }, { nom: 'Rangée' }], derniere: 'Remise' });
		expect(saisieDuFormulaire(formulaire([['case-demandes', '1']]), actuel).recoit).toBe(false);
	});

	it('monter, descendre, retirer, ajouter : sur la saisie, sans rien perdre ; un rang hors de la liste ne change rien', () => {
		const noms = (geste: string, plus: [string, string][] = []) => saisieDuFormulaire(formulaire([...saisie, ...plus, ['geste', geste]]), actuel).etapes.map((e) => e.nom);
		expect(noms('monter:1')).toEqual(['Arrivée', 'Commandée', 'Rangée']);
		expect(noms('descendre:0')).toEqual(['Arrivée', 'Commandée', 'Rangée']);
		expect(noms('retirer:2')).toEqual(['Commandée', 'Arrivée']);
		expect(noms('ajouter', [['nouvelle', 'Vérifiée']])).toEqual(['Commandée', 'Arrivée', 'Rangée', 'Vérifiée']);
		expect(noms('monter:0')).toEqual(['Commandée', 'Arrivée', 'Rangée']);
		expect(noms('retirer:9')).toEqual(['Commandée', 'Arrivée', 'Rangée']);
		expect(saisieDuFormulaire(formulaire([...saisie, ['geste', 'monter:2']]), actuel).derniere).toBe('Remise');
	});

	it('sans les champs, le réglage du rôle ; décoché, celui gardé', () => {
		expect(saisieDuFormulaire(formulaire([]), actuel)).toEqual({ recoit: true, etapes: actuel.etapes, derniere: 'Livrée' });
		expect(saisieDuRole(null, actuel)).toEqual({ recoit: false, etapes: actuel.etapes, derniere: 'Livrée' });
		expect(saisieDuRole(null)).toEqual({ recoit: false, etapes: [], derniere: 'Faite' });
	});
});

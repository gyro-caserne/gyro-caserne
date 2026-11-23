import { describe, expect, it } from 'vitest';
import { etapesDuFormulaire } from './reglage-demandes.ts';

const formulaire = (paires: [string, string][]) => {
	const f = new FormData();
	for (const [c, v] of paires) f.append(c, v);
	return f;
};
const actuel = { etapes: [{ id: 'ea', nom: 'Commandée' }, { id: 'eb', nom: 'Reçue' }, { id: 'ec', nom: 'Rangée' }], derniere: 'Livrée' };

describe('les étapes envoyées par le formulaire', () => {
	it('enregistrer : les noms saisis, dans l’ordre de la page', () => {
		const f = formulaire([['etape-id', 'eb'], ['etape-nom', 'Arrivée'], ['etape-id', 'ea'], ['etape-nom', 'Commandée'], ['derniere', 'Faite'], ['geste', 'enregistrer']]);
		expect(etapesDuFormulaire(f, actuel)).toEqual({ etapes: [{ id: 'eb', nom: 'Arrivée' }, { id: 'ea', nom: 'Commandée' }], derniere: 'Faite' });
	});

	it('ajouter, monter, descendre, retirer, depuis les étapes du rôle ; une étape absente ne change rien', () => {
		const ids = (geste: string, plus: [string, string][] = []) => etapesDuFormulaire(formulaire([...plus, ['geste', geste]]), actuel).etapes.map((e) => e.id ?? e.nom);
		expect(ids('ajouter', [['nouvelle', 'Vérifiée']])).toEqual(['ea', 'eb', 'ec', 'Vérifiée']);
		expect(ids('monter:eb')).toEqual(['eb', 'ea', 'ec']);
		expect(ids('descendre:eb')).toEqual(['ea', 'ec', 'eb']);
		expect(ids('retirer:ea')).toEqual(['eb', 'ec']);
		expect(ids('monter:ea')).toEqual(['ea', 'eb', 'ec']);
		expect(ids('descendre:ec')).toEqual(['ea', 'eb', 'ec']);
		expect(ids('retirer:ez')).toEqual(['ea', 'eb', 'ec']);
		expect(etapesDuFormulaire(formulaire([['geste', 'ajouter'], ['nouvelle', 'X']]), null)).toEqual({ etapes: [{ nom: 'X' }], derniere: 'Faite' });
	});
});

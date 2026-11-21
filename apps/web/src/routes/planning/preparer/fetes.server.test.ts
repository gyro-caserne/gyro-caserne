import { beforeEach, describe, expect, it, vi } from 'vitest';

// La page relaie la confirmation : des remplacements deviendraient inutiles, la liste revient avec la saisie ; « confirme » repart au socle.
const enregistrerFete = vi.fn();
const supprimerFete = vi.fn();
vi.mock('@gyro-caserne/socle', async (original) => ({ ...(await original<object>()), enregistrerFete, supprimerFete }));
const { actions } = await import('./+page.server');

const envoyer = (nom: string, corps: [string, string][]) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(actions as any)[nom]({ locals: { base: {}, acteur: { type: 'personne', id: 1 } }, url: new URL('http://x/planning/preparer?annee=2027&etape=fetes&fete=7'), request: new Request('http://x', { method: 'POST', body: new URLSearchParams(corps) }) });
const saisie: [string, string][] = [['id', '7'], ['nom', 'Sainte-Barbe'], ['date', '2027-12-04'], ['debut', '18:00'], ['fin', '18:00'], ['equipe', '3']];

describe('fêtes du centre : la confirmation des remplacements devenus inutiles', () => {
	beforeEach(() => vi.clearAllMocks());

	it('enregistrer : la liste et la saisie reviennent ; confirmé, le socle le sait ; une fin égale au début reste le même jour', async () => {
		enregistrerFete.mockResolvedValueOnce({ inutiles: ['Nuit du samedi 4 décembre, Alice Test cherche un remplaçant'] });
		expect(await envoyer('feteCentre', saisie)).toEqual({ cible: 'fete', inutiles: ['Nuit du samedi 4 décembre, Alice Test cherche un remplaçant'], valeurs: { id: '7', nom: 'Sainte-Barbe', date: '2027-12-04', debut: '18:00', fin: '18:00', equipe: '3' } });
		expect(enregistrerFete.mock.calls[0]![2]).toEqual({ id: 7, nom: 'Sainte-Barbe', debut: '2027-12-04T18:00', fin: '2027-12-04T18:00', equipeId: 3 });
		expect(enregistrerFete.mock.calls[0]![5]).toBe(false);
		enregistrerFete.mockResolvedValueOnce({ id: 7 });
		expect(await envoyer('feteCentre', [...saisie, ['confirme', 'oui']])).toEqual({ cible: 'fete', succes: 'Fête enregistrée.' });
		expect(enregistrerFete.mock.calls[1]![5]).toBe(true);
	});

	it('supprimer : la liste revient, marquée suppression ; confirmé, le socle le sait', async () => {
		supprimerFete.mockResolvedValueOnce({ inutiles: ['Nuit du samedi 4 décembre, Alice Test cherche un remplaçant'] });
		expect(await envoyer('supprimerFete', [['id', '7']])).toMatchObject({ cible: 'fete', suppression: true, valeurs: { id: '7' } });
		supprimerFete.mockResolvedValueOnce({ inutiles: [] });
		expect(await envoyer('supprimerFete', [['id', '7'], ['confirme', 'oui']])).toEqual({ cible: 'fete', succes: 'Fête supprimée.' });
		expect(supprimerFete.mock.calls[1]![5]).toBe(true);
	});
});

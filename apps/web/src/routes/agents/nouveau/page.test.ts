import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const data = {
	profils: [
		{ id: 1, nom: 'Agent', typePersonne: 'agent' },
		{ id: 2, nom: 'Réserve citoyenne', typePersonne: 'exterieur' }
	],
	profilParDefaut: '1',
	statuts: ['operationnel', 'stagiaire'],
	grades: [{ id: 1, libelle: 'Sapeur' }],
	equipes: [{ id: 1, nom: 'Équipe 1' }]
};
const CHAMPS_AGENT = ['grade', 'date-grade', 'statut', 'entree-centre', 'engagement-spv', 'equipe'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (props: Record<string, unknown>) => render(Page as any, { props }).body;

describe('page ajouter un agent', () => {
	it('présélectionne le profil « Agent », sans alerte', () => {
		const page = html({ data, form: null });
		expect(page).toMatch(/<option value="1"[^>]*selected/);
		expect(page).not.toContain('Le formulaire contient des erreurs.');
	});

	it('signale dans l\'alerte un envoi qui n\'a que des erreurs de champ', () => {
		const page = html({ data, form: { erreurs: { email: 'Adresse déjà utilisée' }, valeurs: { email: 'alice@exemple.fr' } } });
		expect(page).toMatch(/role="alert"[^>]*>(<!--[^>]*-->)*<p[^>]*>Le formulaire contient des erreurs\.</);
		expect(page).toContain('Adresse déjà utilisée');
	});

	it('profil d’agent : grade, statut, dates de parcours et équipe ; le profil se choisit en premier', () => {
		const page = html({ data, form: null });
		for (const id of CHAMPS_AGENT) expect(page, id).toContain(`id="${id}"`);
		expect(page.indexOf('id="profil"')).toBeLessThan(page.indexOf('id="grade"'));
		expect(page).toContain("Ajouter l'agent");
	});

	it('profil extérieur choisi : ni grade, ni statut, ni dates de parcours, ni équipe', () => {
		const page = html({ data, form: { erreurs: { email: 'Adresse invalide' }, valeurs: { profilId: '2' } } });
		for (const id of CHAMPS_AGENT) expect(page, id).not.toContain(`id="${id}"`);
		expect(page).toMatch(/<option value="2"[^>]*selected/);
		expect(page).toContain('Ajouter la personne');
	});

	it('propose le statut, « Opérationnel » choisi par défaut, et borne les longueurs', () => {
		const page = html({ data, form: null });
		expect(page).toMatch(/<option value="operationnel"[^>]*selected[^>]*>Opérationnel</);
		expect(page).toContain('Stagiaire');
		expect(page).toMatch(/id="prenom"[^>]*maxlength="60"/);
		expect(page).toMatch(/id="email"[^>]*maxlength="254"/);
		expect(page).toMatch(/id="telephone"[^>]*maxlength="20"/);
	});
});

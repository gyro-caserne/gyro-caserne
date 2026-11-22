import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (form: unknown = null) => render(Page as any, { props: { data: {}, form } }).body;

describe('nouveau profil', () => {
	it('un nom et un type, agent ou extérieur', () => {
		const page = html();
		expect(page).toMatch(/<h1[^>]*>Nouveau profil<\/h1>/);
		expect(page).toContain('name="nom"');
		expect(page).toMatch(/name="type" value="agent"/);
		expect(page).toMatch(/name="type" value="exterieur"/);
		expect(page).toMatch(/>(<!---->)?Créer le profil/);
	});

	it('refus : le message et la saisie gardée', () => {
		const page = html({ erreurs: { nom: 'Ce nom est déjà utilisé.' }, valeurs: { nom: 'Agent', type: 'exterieur' } });
		expect(page).toContain('Ce nom est déjà utilisé.');
		expect(page).toMatch(/name="type" value="exterieur" checked/);
	});
});

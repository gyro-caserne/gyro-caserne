import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (form: unknown = null) => render(Page as any, { props: { form } }).body;

describe('nouveau comité', () => {
	it('nom, thème, et l’icône repliée qui suit le thème tant qu’on n’en choisit pas', () => {
		const page = html();
		expect(page).toMatch(/id="comite-nom"/);
		expect(page).toMatch(/id="comite-theme"/);
		expect(page).toContain('>Selon le thème<');
		expect(page).toMatch(/<details class="repli[^"]*"><summary[^>]*>Changer d’icône<\/summary>/);
		expect(page).not.toMatch(/name="icone"[^>]*checked/);
	});

	it('après un refus, l’icône choisie revient', () => {
		const page = html({ erreurs: { nom: 'Ce nom est déjà utilisé.' }, valeurs: { nom: 'Sport', theme: 'sport', icone: 'ballon' } });
		expect(page).toMatch(/name="icone" value="ballon" checked/);
		expect(page).toContain('>Ballon<');
	});
});

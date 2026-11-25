import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (form: unknown) => render(Page as any, { props: { data: { types: [{ id: 1, nom: 'VSAV' }] }, form } }).body;

describe('/engins/nouveau', () => {
	it('« Nouveau type » dans le choix du type ; choisi, son nom se tape sur place', () => {
		const page = html(null);
		expect(page).toMatch(/<option value="nouveau"[^>]*>Nouveau type<\/option>/);
		expect(page).not.toContain('name="nouveauType"');
		const refus = html({ message: 'Ce type d’engin existe déjà.', valeurs: { nom: 'CCF 1', typeId: 'nouveau', nouveauType: 'VSAV', immatriculation: '', situation: 'centre', provenance: '' } });
		expect(refus).toMatch(/Nom du nouveau type[\s\S]*?name="nouveauType"[^>]*value="VSAV"|value="VSAV"[^>]*name="nouveauType"/);
		expect(refus).toContain('Ce type d’engin existe déjà.');
	});
});

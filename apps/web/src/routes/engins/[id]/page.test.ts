import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: Record<string, unknown>) => render(Page as any, { props: { data } }).body;
const engin = { id: 7, nom: 'CCF 1', type: 'CCF', typeId: 4, immatriculation: null, situation: 'centre', provenance: null, etat: 'disponible', partiLe: null };
const fiche = { typeId: 4, type: 'CCF', zones: [], version: { numero: 1, creeLe: '2026-11-25T08:00', auteur: 'Rémi Fictif' } };

describe('/engins/[id]', () => {
	it('fiche vide : les deux suites en boutons secondaires, en tête, l’armement seulement si permis', () => {
		const page = html({ engin, gere: true, fiche, suites: { armement: true } });
		expect(page.indexOf('À compléter')).toBeLessThan(page.indexOf('État'));
		expect(page).toMatch(/class="lien-secondaire" href="\/engins\/fiches\/4">Compléter sa fiche de prise de garde<\/a>/);
		expect(page).toMatch(/class="lien-secondaire" href="\/reglages\/armement\?engin=CCF">Régler son armement<\/a>/);
		const sans = html({ engin, gere: true, fiche, suites: { armement: false } });
		expect(sans).toContain('Compléter sa fiche de prise de garde');
		expect(sans).not.toContain('Régler son armement');
		expect(html({ engin, gere: false, fiche, suites: null })).not.toContain('Compléter sa fiche');
	});
});

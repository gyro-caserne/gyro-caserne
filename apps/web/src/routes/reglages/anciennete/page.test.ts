import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

/* eslint-disable @typescript-eslint/no-explicit-any */
const html = (data: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data, form } }).body;

describe('page des paliers d’ancienneté', () => {
	it('une case par palier, de 5 en 5 jusqu’à 50, cochées selon le réglage ; un palier réglé hors liste reste proposé', () => {
		const page = html({ paliers: [10, 12, 20, 25, 30, 40] });
		expect(page.match(/type="checkbox" name="palier"/g)).toHaveLength(11);
		for (const p of [10, 12, 20, 25, 30, 40]) expect(page).toMatch(new RegExp(`value="${p}" checked[^>]*>${p}\u00a0ans`));
		expect(page).toMatch(/value="5"(?! checked)[^>]*>5\u00a0ans/);
		expect(page).toMatch(/<legend[^>]*>Paliers fêtés<\/legend>/);
		expect(page).toContain('Enregistrer les paliers');
	});

	it('le succès et le refus se disent', () => {
		expect(html({ paliers: [5] }, { cible: 'anciennete', succes: 'Paliers d’ancienneté enregistrés.' })).toMatch(/role="status"[^>]*>Paliers d’ancienneté enregistrés\./);
		expect(html({ paliers: [5] }, { cible: 'anciennete', message: 'Cochez au moins un palier.' })).toMatch(/role="alert">Cochez au moins un palier\./);
	});
});

import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (data: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data, form } }).body;

describe('réglages : remplacement court, la page', () => {
	it('les quatre durées, celles du centre cochées, et l’enregistrement', () => {
		const html = page({ durees: [2, 3] });
		expect(html).toMatch(/<h1[^>]*>Remplacement court<\/h1>/);
		for (const d of [1, 2, 3, 4]) expect(html).toContain(`value="${d}"`);
		expect(html).toMatch(/value="2"[^>]*checked/);
		expect(html).not.toMatch(/value="1"[^>]*checked/);
		expect(html).toContain('Enregistrer les durées');
	});
});

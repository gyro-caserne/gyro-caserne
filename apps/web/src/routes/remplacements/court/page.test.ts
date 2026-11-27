import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (data: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data, form } }).body;
const debuts = [
	{ debut: '2026-11-09T19:15', durees: [2, 3] },
	{ debut: '2026-11-09T19:30', durees: [2, 3] },
	{ debut: '2026-11-10T04:00', durees: [2] }
];

describe('Quelques heures', () => {
	it('le début au quart d’heure dans la liste du téléphone, 2 ou 3 h, la phrase récapitulative et l’envoi', () => {
		const html = page({ debuts, durees: [2, 3] });
		expect(html).toContain('2 h ou 3 h de votre astreinte du jour.');
		expect(html).toMatch(/<h1[^>]*>Quelques heures<\/h1>/);
		expect(html).toMatch(/<select[^>]*name="debut"/);
		expect(html).toContain('>19 h 15</option>');
		expect(html).toContain('>4 h, mardi 10 novembre</option>');
		expect(html).toMatch(/name="duree" value="2" checked/);
		expect(html).toContain('3 h');
		expect(html).toContain('Remplacement de 19 h 15 à 21 h 15, ouvert à tous les disponibles.');
		expect(html).toContain('Envoyer la demande');
		expect(html).toContain('peut refuser jusqu’au début');
	});

	it('aucune plage libre aujourd’hui (pas d’astreinte, déjà demandée, trop tard) : le dit, et mène aux jours', () => {
		const html = page({ debuts: [], durees: [2, 3] });
		expect(html).toContain('Aucune plage de 2 h libre aujourd’hui.');
		expect(html).toMatch(/<a[^>]*href="\/remplacements\/demander\?gardes"[^>]*>Choisir des jours/);
		expect(html).not.toContain('Envoyer la demande');
	});

	// Demandé à 21 h 45 : le premier début est 22 h, et la plage finit à minuit. La phrase le dit comme le reste de l'appli (la liste
	// des remplacements, le planning) : un test qui la relit y retrouve la même plage.
	it('le soir, une plage qui finit à minuit se dit « à minuit », comme ailleurs', () => {
		expect(page({ debuts: [{ debut: '2026-11-24T22:00', durees: [2] }], durees: [2, 3] })).toContain('Remplacement de 22 h à minuit, ouvert à tous les disponibles.');
		expect(page({ debuts: [{ debut: '2026-11-24T22:15', durees: [2] }], durees: [2, 3] })).toContain('Remplacement de 22 h 15 à 0 h 15, ouvert à tous les disponibles.');
	});

	it('un refus du socle est dit sur la page', () => {
		expect(page({ debuts, durees: [2, 3] }, { message: 'La plage doit tenir dans votre astreinte du jour.' })).toMatch(/role="alert"[^>]*>La plage doit tenir/);
	});

	it('les durées du centre : 1 et 4 h, la plus courte d’office ; seules celles qui tiennent', () => {
		const html = page({ debuts: [{ debut: '2026-11-09T19:15', durees: [1, 4] }, { debut: '2026-11-10T04:00', durees: [1] }], durees: [1, 4] });
		expect(html).toContain('1 h ou 4 h de votre astreinte du jour.');
		expect(html).toMatch(/name="duree" value="1" checked/);
		expect(html).toContain('value="4"');
		expect(html).toContain('Remplacement de 19 h 15 à 20 h 15, ouvert à tous les disponibles.');
		expect(page({ debuts: [], durees: [3] })).toContain('Aucune plage de 3 h libre aujourd’hui.');
	});
});

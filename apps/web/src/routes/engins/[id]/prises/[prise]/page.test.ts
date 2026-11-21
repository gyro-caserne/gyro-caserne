import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const prise = (traces: Record<string, unknown> = {}) => ({
	id: 7,
	engin: { id: 1, nom: 'FPT', type: 'FPT', typeId: 2, immatriculation: null, situation: 'centre', provenance: null, etat: 'disponible', partiLe: null },
	releve: '2026-10-30T18:00',
	valideeLe: '2026-10-30T20:10',
	equipe: 'Équipe 4',
	participants: ['Mila Clément', 'Adam Fournier'],
	zones: [{ ref: 1, nom: 'Cabine', elements: [{ ref: 10, libelle: 'Radio', quantite: null }] }],
	signalees: [],
	retrouvees: [],
	dejaOuvertes: [],
	enCours: false,
	traces: { participants: null, rouverte: null, demande: null, ...traces }
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (p: unknown) => render(Page as any, { props: { data: { prise: p } } }).body;

describe('/engins/[id]/prises/[prise]', () => {
	it('la trace d’une prise rouverte ou dont les participants ont changé : qui, quand, pourquoi', () => {
		const page = html(prise({ rouverte: { par: 'Élodie Chef-de-Garde', le: '2026-10-30T19:30', motif: 'Radio oubliée' }, participants: { par: 'Mila Clément', le: '2026-10-30T20:30' } }));
		expect(page).toMatch(/<dt[^>]*>Rouverte<\/dt><dd[^>]*>Par Élodie Chef-de-Garde, ven\. 19 h 30\. Motif : Radio oubliée\.<\/dd>/);
		expect(page).toMatch(/<dt[^>]*>Participants modifiés<\/dt><dd[^>]*>Par Mila Clément, ven\. 20 h 30<\/dd>/);
		expect(html(prise())).not.toContain('Rouverte');
	});
});

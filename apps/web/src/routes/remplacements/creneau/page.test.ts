import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const bruno = { id: 2, prenom: 'Bruno', nom: 'Martin', equipe: { nom: 'Équipe 2', couleur: '#1e6fd9' }, aptitudes: ['COD1'], manque: ['CA1'] };
const chloe = { id: 3, prenom: 'Chloé', nom: 'Petit', equipe: { nom: 'Équipe 3', couleur: '#2f9e44' }, aptitudes: ['CA1'], manque: [] };
const creneau = { debut: '2026-12-01T20:10', fin: '2026-12-01T22:40' };
const base = { maintenant: '2026-11-28T10:00', etape: 'quand', message: null, debut: '', fin: '', creneau: null, candidats: [], pour: null, recherche: '' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = (data: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data: { ...base, ...data }, form } }).body;

describe('Un créneau', () => {
	it('quand : le début et la fin, au sélecteur du téléphone, et les règles en une phrase', () => {
		const html = page({});
		expect(html).toMatch(/<h1[^>]*>Un créneau<\/h1>/);
		expect(html).toContain('Étape 1 sur 3');
		expect(html).toMatch(/<label for="debut"[^>]*>Début<\/label>[\s\S]*?<input[^>]*id="debut"[^>]*>/);
		expect(html).toMatch(/<input[^>]*name="debut"[^>]*type="datetime-local"[^>]*required/);
		expect(html).toMatch(/<label for="fin"[^>]*>Fin<\/label>/);
		expect(html).toMatch(/<input[^>]*name="fin"[^>]*type="datetime-local"[^>]*required/);
		expect(html).toContain('Au moins 1 h, demandé au moins 1 h avant son début.');
		expect(html).toMatch(/<form method="GET"/);
		expect(html).toMatch(/name="etape" value="qui"[^>]*>[\s\S]*?Continuer/);
		expect(html).toMatch(/href="\/remplacements\/demander"[\s\S]*?Me faire remplacer/);
	});

	it('un refus : dit en tête, le créneau saisi gardé', () => {
		const html = page({ message: 'Le créneau doit finir mardi 2 décembre à 6 h au plus tard.', debut: '2026-12-01T20:00', fin: '2026-12-02T08:00' });
		expect(html).toMatch(/role="alert"[^>]*>Le créneau doit finir mardi 2 décembre à 6 h au plus tard\./);
		expect(html).toContain('value="2026-12-01T20:00"');
		expect(html).toContain('value="2026-12-02T08:00"');
	});

	it('à qui : le créneau rappelé, « Tout le monde » ou un collègue libre sur ce créneau', () => {
		const html = page({ etape: 'qui', creneau, debut: creneau.debut, fin: creneau.fin, candidats: [chloe, bruno] });
		expect(html).toContain('Votre créneau, <strong>mardi 1er décembre, de 20 h 10 à 22 h 40</strong>.');
		expect(html).toContain('Tout le monde');
		expect(html).toContain('Seuls les collègues libres sur ce créneau sont proposés.');
		expect(html).toContain('Il lui manque CA1.');
		expect(html).toContain('<input type="hidden" name="debut" value="2026-12-01T20:10"');
	});

	it('vérifier : ouverte à tous, ou à un collègue à qui il manque une aptitude (le chef valide avant)', () => {
		const tous = page({ etape: 'verifier', creneau, pour: 'tous', candidats: [chloe, bruno] });
		expect(tous).toContain('Vous demandez à être remplacé mardi 1er décembre, de 20 h 10 à 22 h 40.');
		expect(tous).toContain('2 collègues disponibles sont prévenus.');
		expect(tous).toMatch(/<form method="POST"/);
		expect(tous).toMatch(/<button type="submit"[^>]*>[\s\S]*?Envoyer la demande/);
		const cible = page({ etape: 'verifier', creneau, pour: bruno, candidats: [chloe, bruno] });
		expect(cible).toContain('Vous demandez à Bruno Martin de vous remplacer mardi 1er décembre, de 20 h 10 à 22 h 40.');
		expect(cible).toContain('Il lui manque CA1. Votre chef de garde devra valider.');
		expect(cible).toContain('<input type="hidden" name="pour" value="2"');
	});

	it('personne de libre : rien à envoyer, le chef de garde à prévenir', () => {
		const html = page({ etape: 'verifier', creneau, pour: 'tous', candidats: [] });
		expect(html).toContain('Personne ne recevrait la demande.');
		expect(html).not.toContain('Envoyer la demande');
	});
});

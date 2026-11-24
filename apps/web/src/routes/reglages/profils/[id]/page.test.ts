import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const data = { profil: { id: 1, nom: 'Agent', typePersonne: 'agent', droits: ['VOIR_PLANNING', 'RESERVER'], mursOuverts: {}, personnes: 3, depart: true }, comitesChoix: [{ id: 4, nom: 'Retraités' }] };
const retraite = { ...data, profil: { id: 5, nom: 'Retraité', typePersonne: 'exterieur', droits: [], mursOuverts: { 'comite:4': 'ecriture', vie: 'lecture' }, personnes: 0, depart: false } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (props: Record<string, unknown>) => render(Page as any, { props }).body;

describe('page d’un profil', () => {
	it('les domaines seulement, au niveau actuel, sans administration ni modèle', () => {
		const page = html({ data, form: null });
		expect(page).toMatch(/<h1[^>]*>Agent<\/h1>/);
		expect(page).toMatch(/name="niveau-reservations" value="1" checked/);
		expect(page).toContain('Rien dans ce domaine.');
		expect(page).not.toContain('Administration');
		expect(page).not.toContain('Revenir au modèle');
		expect(page).toMatch(/<form method="POST"/);
		expect(page).toMatch(/>(<!---->)?Enregistrer/);
	});

	it('annonce le succès', () => {
		expect(html({ data, form: { cible: 'profil', succes: 'Le profil « Agent » est enregistré.' } })).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Le profil « Agent »/);
	});
	it('ne parle pas des droits sans effet (annuaire, motifs d’absence)', () => {
		const page = html({ data: { profil: { ...data.profil, droits: ['VOIR_PLANNING', 'VOIR_ANNUAIRE', 'VOIR_MOTIFS_ABSENCE'] } } });
		expect(page).not.toMatch(/annuaire|motifs d’absence/);
	});

	it('profil extérieur : un choix par mur ouvrable, au niveau enregistré ; jamais les équipes', () => {
		const page = html({ data: retraite, form: null });
		expect(page).toContain('Murs ouverts');
		// Un seul formulaire et un seul « Enregistrer » pour les droits et les murs.
		expect(page).not.toContain('?/murs');
		expect(page.match(/>(<!---->)?Enregistrer</g)).toHaveLength(1);
		// Une barre à trois choix par mur, sur une ligne : le bloc segmenté commun.
		expect(page.match(/<div class="segments radios[^"]*"/g)).toHaveLength(3);
		for (const nom of ['Le centre', 'Vie du centre', 'Retraités']) expect(page).toMatch(new RegExp(`<legend[^>]*>${nom}</legend>`));
		expect(page).toMatch(/name="mur-comite:4" value="2" checked/);
		expect(page).toMatch(/name="mur-vie" value="1" checked/);
		expect(page).toMatch(/name="mur-centre" value="0" checked/);
		expect(page).not.toContain('equipe:');
		expect(page).toContain('Aucun accès');
	});

	it('profil agent : pas de murs ouverts ; renommer sous « Plus » ; le profil de départ ne se supprime pas', () => {
		const page = html({ data, form: null });
		expect(page).not.toContain('Murs ouverts');
		expect(page).toMatch(/<details class="plus"/);
		expect(page).toContain('Renommer le profil');
		expect(page).not.toContain('?/supprimer');
		expect(page).toContain('Le profil des agents de départ ne se supprime pas.');
		expect(html({ data: { ...data, profil: { ...data.profil, depart: false } }, form: null })).toContain('3 personnes ont ce profil.');
	});

	it('profil que personne n’a : supprimer, en contour rouge, avec « Je confirme »', () => {
		const page = html({ data: retraite, form: null });
		expect(page).toMatch(/action="\?\/supprimer"[\s\S]*name="confirmation" value="oui"[\s\S]*class="grave[^"]*"[^>]*>(<!---->)?Supprimer le profil/);
	});

	it('murs ouverts repliés dans un groupe, avec combien et lesquels ; le formulaire vise l’action nommée', () => {
		const page = html({ data: retraite, form: null });
		expect(page).toMatch(/<h2[^>]*>[\s\S]*?Murs ouverts/);
		expect(page).toContain('2 murs ouverts, Vie du centre et Retraités');
		expect(page).toMatch(/aria-expanded="false"/);
		expect(page).toContain('action="?/enregistrer"');
		const un = { ...retraite, profil: { ...retraite.profil, mursOuverts: { vie: 'lecture' } } };
		expect(html({ data: un, form: null })).toContain('1 mur ouvert, Vie du centre');
		const trois = { ...retraite, comitesChoix: [{ id: 4, nom: 'Retraités' }, { id: 2, nom: 'Amicale' }], profil: { ...retraite.profil, mursOuverts: { vie: 'lecture', 'comite:4': 'ecriture', 'comite:2': 'lecture' } } };
		expect(html({ data: trois, form: null })).toContain('3 murs ouverts, Vie du centre, Retraités et Amicale');
		expect(html({ data: { ...retraite, profil: { ...retraite.profil, mursOuverts: {} } }, form: null })).toContain('Aucun mur ouvert');
	});
});

import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

const adresse = vi.hoisted(() => ({ url: new URL('http://x/reglages/comites/2') }));
vi.mock('$app/state', () => ({ page: adresse }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
const { default: Bloc } = await import('./BlocTitulaires.svelte');

/* eslint-disable @typescript-eslint/no-explicit-any */
const poste = (roleId: number, role: string, perimetre: { type: string; id: number | null; nom: string | null }, titulaires: unknown[], aPourvoir = false) => ({
	cle: `${roleId}-${perimetre.id ?? 'centre'}`,
	roleId,
	role,
	nature: aPourvoir ? 'fonction' : 'mission',
	perimetre,
	titulaires,
	nommer: { aPourvoir }
});
const rendu = (props: Record<string, unknown>) =>
	render(Bloc as any, { props: { resume: '', gestes: null, aujourdhui: '2026-11-24', fiches: false, form: null, question: 'Q', ...props } })
		.body.replace(/<!--[^>]*-->/g, '')
		.replace(/ ?svelte-[a-z0-9]+/g, '');

describe('bloc « Titulaires »', () => {
	it('fiche d’un comité : une carte par rôle, au nom du rôle, jamais au nom du comité', () => {
		const comite = { type: 'comite', id: 2, nom: 'Comité test' };
		const page = rendu({
			postes: [poste(12, 'Rapporteur', comite, []), poste(13, 'Membre', comite, [{ id: 4, nom: 'Alice Bernard', grade: null, ecrire: false, mandat: { id: 41, debut: '2026-01-01', fin: null } }]), poste(14, 'Président', comite, [], true)]
		});
		expect(page.match(/class="lignes carte-role/g)).toHaveLength(3);
		for (const role of ['Rapporteur', 'Membre', 'Président']) expect(page).toMatch(new RegExp(`<h3[^>]*>${role}</h3>`));
		// Le comité n'est lu que dans la suite masquée d'un geste (« Nommer (Rapporteur, Comité test) »), jamais affiché.
		expect(page.replace(/<span class="masque">[^<]*<\/span>/g, '')).not.toContain('Comité test');
		expect(page).toMatch(/>Ajouter un membre<span class="masque"> \(Membre, Comité test\)<\/span>/);
		expect(page).toMatch(/Président<\/h3>[\s\S]*?À pourvoir/);
	});

	it('fiche d’un rôle d’équipe : une seule carte, au nom du rôle, une ligne par équipe', () => {
		const page = rendu({
			role: 'Chef de garde',
			postes: [
				poste(3, 'Chef de garde', { type: 'equipe', id: 1, nom: 'Équipe 1' }, [{ id: 5, nom: 'Bruno Petit', grade: null, ecrire: false, mandat: { id: 31, debut: '2026-01-01', fin: null } }], false),
				poste(3, 'Chef de garde', { type: 'equipe', id: 2, nom: 'Équipe 2' }, [], true)
			]
		});
		expect(page.match(/class="lignes carte-role/g)).toHaveLength(1);
		expect(page).toMatch(/<h3[^>]*>Chef de garde<\/h3>/);
		expect(page).toMatch(/Bruno Petit[\s\S]*?Équipe 1/);
		expect(page).toMatch(/Équipe 2[\s\S]*?À pourvoir[\s\S]*?href="\?nommer=3-2"/);
	});
});

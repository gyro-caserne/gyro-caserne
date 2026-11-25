import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import SelecteurNiveaux from './SelecteurNiveaux.svelte';

const niveaux = [{ libelle: 'Rien de plus', phrase: 'Rien dans ce domaine.' }];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const texte = (props: Record<string, unknown>) => render(SelecteurNiveaux as any, { props: { name: 'n', legende: 'Planning', niveaux, ...props } }).body.replace(/<!--.*?-->|<[^>]+>/g, '');

describe('SelecteurNiveaux figé', () => {
	it('le niveau puis sa phrase, l’espace des deux côtés du deux-points', () => {
		expect(texte({ valeur: 'sur_mesure', surMesure: true, desactive: true })).toContain('Sur mesure : Des droits choisis un par un');
		expect(texte({ valeur: 0, desactive: true })).toContain('Rien de plus : Rien dans ce domaine.');
	});
});

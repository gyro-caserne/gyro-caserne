import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ChoixIcone from './ChoixIcone.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (props: Record<string, unknown>) => render(ChoixIcone as any, { props }).body;

describe('choix de l’icône', () => {
	it('montre l’icône choisie et son nom, la grille repliée sous « Changer d’icône »', () => {
		const page = html({ valeur: 'camion' });
		expect(page).toMatch(/<legend[^>]*>Icône<\/legend>/);
		expect(page).toMatch(/class="choisie[^"]*"[\s\S]*?<svg[\s\S]*?>Camion</);
		// Le nom de l'icône choisie est annoncé quand il change.
		expect(page).toMatch(/<span aria-live="polite"[^>]*>Camion<\/span>/);
		// Sans JavaScript, la grille reste dans un repli simple, fermé.
		expect(page).toMatch(/<details class="repli[^"]*"><summary[^>]*>Changer d’icône<\/summary>/);
		expect(page.match(/name="icone"/g)).toHaveLength(34);
		expect(page).toMatch(/<input type="radio" name="icone" value="camion" checked/);
	});

	it('sans icône choisie, la phrase donnée', () => {
		const page = html({ legende: 'Icône du mur', sansChoix: 'Selon le thème' });
		expect(page).toMatch(/<legend[^>]*>Icône du mur<\/legend>/);
		expect(page).toContain('>Selon le thème<');
		expect(page).not.toMatch(/name="icone"[^>]*checked/);
	});

	it('une erreur ouvre la grille et se dit sous la légende', () => {
		const page = html({ valeur: 'camion', erreur: 'Choisissez une icône de la liste.' });
		expect(page).toMatch(/<details class="repli[^"]*" open/);
		expect(page).toContain('Choisissez une icône de la liste.');
	});
});

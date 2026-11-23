import { describe, expect, it } from 'vitest';

// SvelteKit refuse une action « default » à côté d'actions nommées : l'envoi plante (erreur 500), et les tests qui appellent
// l'action directement ne le voient pas (profil retraité en préprod, 23/11). On le garde ici pour toutes les pages, sur l'objet exporté.
const pages = import.meta.glob<{ actions?: Record<string, unknown> }>('./routes/**/+page.server.ts');

export const melange = (actions: Record<string, unknown> | undefined) => !!actions && 'default' in actions && Object.keys(actions).length > 1;

describe('actions des formulaires', () => {
	it('la règle : « default » seule ou des actions nommées seules', () => {
		expect(melange({ default: () => {}, renommer: () => {} })).toBe(true);
		expect(melange({ default: () => {} })).toBe(false);
		expect(melange({ enregistrer: () => {}, renommer: () => {} })).toBe(false);
		expect(melange(undefined)).toBe(false);
	});
	it('les pages sont trouvées', () => expect(Object.keys(pages).length).toBeGreaterThan(50));
	it.each(Object.keys(pages))('%s : jamais « default » avec des actions nommées', async (page) => {
		const { actions } = await pages[page]!();
		expect(melange(actions), Object.keys(actions ?? {}).join(', ')).toBe(false);
	}, 30_000);
});

import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// SvelteKit refuse une action « default » à côté d'actions nommées : l'envoi plante (erreur 500), et les tests qui appellent
// l'action directement ne le voient pas (profil retraité en préprod, 23/11). On le garde ici pour toutes les pages.
describe('actions des formulaires', () => {
	const pages = globSync('src/routes/**/+page.server.ts', { cwd: new URL('..', import.meta.url).pathname });
	it('les pages sont trouvées', () => expect(pages.length).toBeGreaterThan(50));
	it.each(pages)('%s : jamais « default » avec des actions nommées', (page) => {
		const source = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
		const bloc = /export const actions[^=]*=\s*\{\n([\s\S]*?)\n\};/.exec(source)?.[1] ?? '';
		const cles = [...bloc.matchAll(/^\t(\w+)\s*[:(,]/gm)].map((m) => m[1]);
		expect(cles.includes('default') && new Set(cles).size > 1, cles.join(', ')).toBe(false);
	});
});

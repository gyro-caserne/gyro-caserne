import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connecter } from './connexion.ts';

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));
const EMAIL = 'rita.reserve@exemple.fr';

function executer(sql: string) {
	execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'BASE', '--local', '--config', `${centre}wrangler.jsonc`, '--persist-to', `${centre}.wrangler/state`, '--command', sql], { cwd: appli, stdio: 'pipe' });
}

// Une personne du profil Réserve citoyenne (extérieur). Insertion rejouable : la base est partagée entre téléphone et ordinateur.
test.describe('accès d’une personne extérieure', () => {
	test.beforeAll(() => {
		executer(`INSERT INTO personne (email, prenom, nom, profil_id) SELECT '${EMAIL}', 'Rita', 'Réserve', (SELECT id FROM profil WHERE type_personne = 'exterieur' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM personne WHERE email = '${EMAIL}');`);
	});

	test('la liste des agents lui est refusée ; son accueil ne montre pas l’astreinte', async ({ page }) => {
		await connecter(page, EMAIL);
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1, name: 'Bonjour Rita' })).toBeVisible();
		await expect(page.locator('section.plaque')).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Mon astreinte', exact: true })).toHaveCount(0);
		expect((await page.goto('/agents'))?.status()).toBe(403);
	});
});

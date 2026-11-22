import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connecter } from './connexion.ts';

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));
const EMAIL = 'rene.retraite@exemple.fr';

function executer(sql: string) {
	execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'BASE', '--local', '--config', `${centre}wrangler.jsonc`, '--persist-to', `${centre}.wrangler/state`, '--command', sql], { cwd: appli, stdio: 'pipe' });
}

// Un profil extérieur à qui le comité « Retraités e2e » est ouvert en écriture, et René qui l'a.
test.describe('murs ouverts à un profil', () => {
	test.beforeAll(() => {
		executer(`INSERT INTO comite (nom, theme) SELECT 'Retraités e2e', 'Vie du centre' WHERE NOT EXISTS (SELECT 1 FROM comite WHERE nom = 'Retraités e2e');
			INSERT INTO profil (nom, type_personne, murs_ouverts) SELECT 'Retraité e2e', 'exterieur', '{"comite:' || (SELECT id FROM comite WHERE nom = 'Retraités e2e') || '":"ecriture"}' WHERE NOT EXISTS (SELECT 1 FROM profil WHERE nom = 'Retraité e2e');
			INSERT INTO personne (email, prenom, nom, profil_id) SELECT '${EMAIL}', 'René', 'Ancien', (SELECT id FROM profil WHERE nom = 'Retraité e2e') WHERE NOT EXISTS (SELECT 1 FROM personne WHERE email = '${EMAIL}');`);
	});

	test('il voit le mur de son comité, y publie, et ne voit pas Le centre', async ({ page }) => {
		await connecter(page, EMAIL);
		await page.goto('/echanges');
		await expect(page.getByRole('link', { name: /Retraités e2e/ })).toBeVisible();
		await expect(page.locator('a[href="/echanges/centre"]')).toHaveCount(0);
		await page.getByRole('link', { name: /Retraités e2e/ }).first().click();
		await page.getByRole('link', { name: /^Publier dans / }).click();
		await page.getByLabel('Votre message', { exact: true }).fill('Bonjour les anciens');
		await page.getByRole('button', { name: /^Publier/ }).click();
		await page.waitForURL(/\/echanges\/comite:\d+#publication-\d+$/);
		await expect(page.getByText('Bonjour les anciens')).toBeVisible();
		expect((await page.goto('/echanges/centre'))?.status()).toBe(403);
	});
});

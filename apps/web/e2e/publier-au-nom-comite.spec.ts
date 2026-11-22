import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connecter } from './connexion.ts';

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));
const EMAIL = 'rapporteur.amicale@exemple.fr';

function executer(sql: string) {
	execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'BASE', '--local', '--config', `${centre}wrangler.jsonc`, '--persist-to', `${centre}.wrangler/state`, '--command', sql], { cwd: appli, stdio: 'pipe' });
}

// Lucie, rapporteur de l'Amicale : elle publie dans Vie du centre au nom du comité.
test.describe('publier au nom d’un comité', () => {
	test.beforeAll(() => {
		executer(`INSERT INTO personne (email, prenom, nom, profil_id) SELECT '${EMAIL}', 'Lucie', 'Amicale', (SELECT id FROM profil WHERE nom = 'Agent') WHERE NOT EXISTS (SELECT 1 FROM personne WHERE email = '${EMAIL}');
			INSERT INTO attribution (personne_id, responsabilite_id, perimetre_type, perimetre_id, debut, saisie_par, saisie_le)
			SELECT (SELECT id FROM personne WHERE email = '${EMAIL}'), (SELECT id FROM responsabilite WHERE nom = 'Rapporteur de comité'), 'comite', (SELECT id FROM comite WHERE nom = 'Amicale'), '2026-01-01', 'super:admin@exemple.fr', '2026-01-01'
			WHERE NOT EXISTS (SELECT 1 FROM attribution a JOIN personne p ON p.id = a.personne_id WHERE p.email = '${EMAIL}');`);
	});

	test('le choix « Publier en tant que », puis la publication signée Amicale, par Lucie', async ({ page }, info) => {
		// Un texte propre à chaque passage : la base est partagée entre téléphone et ordinateur.
		const texte = `Repas de Sainte-Barbe (${info.project.name}, ${info.retry})`;
		await connecter(page, EMAIL);
		await page.goto('/echanges/publier?mur=vie');
		await page.getByRole('group', { name: 'Publier en tant que' }).getByText('Amicale').click();
		await page.getByLabel('Votre message', { exact: true }).fill(texte);
		await page.getByRole('button', { name: /^Publier/ }).click();
		await page.waitForURL(/\/echanges\/vie#publication-\d+$/);
		const publication = page.getByRole('article', { name: 'Amicale' }).filter({ hasText: texte });
		await expect(publication).toBeVisible();
		await expect(publication).toContainText('par Lucie Amicale');
		// Ailleurs que dans Vie du centre, le choix disparaît.
		await page.goto('/echanges/publier?mur=vie');
		await expect(page.getByRole('group', { name: 'Publier en tant que' })).toBeVisible();
		await page.getByRole('group', { name: 'Où publier ?' }).getByText('Amicale').click();
		await expect(page.getByRole('group', { name: 'Publier en tant que' })).toHaveCount(0);
	});
});

import { expect, test } from '@playwright/test';
import { ETAT_SUPER } from './serveur.ts';

// Horaires de garde : le chef les règle sur une année non publiée (dans deux ans : le jeu de départ publie l'année en cours et la
// suivante), et les semaines de l'année les suivent. Une année publiée les montre en lecture seule. La base est partagée entre
// téléphone et ordinateur : les mêmes horaires sont enregistrés à chaque passage, rien n'est remis à zéro entre deux.
test.describe('chef : horaires de garde', () => {
	test.use({ storageState: ETAT_SUPER });
	const annee = new Date().getFullYear();

	test('une année non publiée suit ses horaires ; une année publiée reste en lecture seule', async ({ page }) => {
		await page.goto(`/planning/preparer?annee=${annee + 2}&etape=roulement`);
		const horaires = page.getByRole('region', { name: 'Horaires de garde' });
		await expect(horaires).toBeVisible();
		await horaires.getByLabel('Jour de la relève', { exact: true }).selectOption('lundi');
		await horaires.getByLabel('Heure de la relève', { exact: true }).fill('19:00');
		await horaires.getByLabel('Fin de l’astreinte', { exact: true }).fill('07:00');
		await horaires.getByLabel('Début en semaine', { exact: true }).fill('19:00');
		await horaires.getByLabel('Fin en semaine', { exact: true }).fill('07:00');
		await horaires.getByRole('button', { name: 'Enregistrer les horaires', exact: true }).click();
		await expect(page.getByText('Horaires enregistrés. Les semaines de l’année les suivent.', { exact: true })).toBeVisible();
		// La première semaine commence un lundi, et la page rechargée garde les horaires.
		await page.reload();
		await expect(page.getByText(/La première semaine commence le lundi /)).toBeVisible();
		await expect(horaires.getByLabel('Jour de la relève', { exact: true })).toHaveValue('lundi');
		await expect(horaires.getByLabel('Heure de la relève', { exact: true })).toHaveValue('19:00');
		await expect(horaires.getByRole('button', { name: 'Garder les horaires du centre', exact: true })).toBeVisible();

		await page.goto(`/planning/preparer?annee=${annee}&etape=roulement`);
		await expect(horaires.getByText('Année publiée. Ses horaires ne changent plus.', { exact: true })).toBeVisible();
		await expect(horaires.getByRole('button', { name: 'Enregistrer les horaires', exact: true })).toHaveCount(0);
		await expect(horaires.getByLabel('Heure de la relève', { exact: true })).toHaveCount(0);
	});
});

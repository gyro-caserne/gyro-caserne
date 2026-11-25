import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ETAT_SUPER } from './serveur.ts';

// Raccourcis : un engin d'un nouveau type et ses suites, « Part à la retraite » dans le départ, le bas de page au téléphone,
// la carte « Étapes de vos demandes ». La base est partagée entre téléphone et ordinateur : chaque test crée ses propres noms.

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));
const executer = (sql: string) => execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'BASE', '--local', '--config', `${centre}wrangler.jsonc`, '--persist-to', `${centre}.wrangler/state`, '--command', sql], { cwd: appli, stdio: 'pipe' });
const marque = () => Date.now().toString(36).slice(-5).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();

test.use({ storageState: ETAT_SUPER });

test('Ajouter un engin d’un nouveau type, puis ses deux suites', async ({ page }) => {
	const type = `CCF${marque()}`;
	await page.goto('/engins/nouveau');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Nom', { exact: true }).fill(`${type} 1`);
	await page.getByLabel('Type', { exact: true }).selectOption({ label: 'Nouveau type' });
	await page.getByLabel('Nom du nouveau type', { exact: true }).fill(type);
	await page.getByRole('button', { name: 'Ajouter l’engin', exact: true }).click();
	await expect(page).toHaveURL(/\/engins\/\d+$/);
	await expect(page.getByRole('heading', { level: 1, name: `${type} 1`, exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Compléter sa fiche de prise de garde', exact: true })).toHaveAttribute('href', /^\/engins\/fiches\/\d+$/);
	await page.getByRole('link', { name: 'Régler son armement', exact: true }).click();
	await expect(page.getByRole('dialog', { name: type, exact: true })).toBeVisible();
	// L'engin d'essai quitte le centre : il ne pèse pas sur les autres tests (prise de la relève, listes).
	executer(`UPDATE engin SET situation = 'parti', parti_le = date('now') WHERE nom = '${type} 1';`);
});

test('« Part à la retraite, reste dans l’appli » depuis « Départ du centre »', async ({ page }) => {
	executer(`INSERT INTO profil (nom, type_personne) SELECT 'Retraités', 'exterieur' WHERE NOT EXISTS (SELECT 1 FROM profil WHERE nom = 'Retraités');`);
	const nom = `Retraite${marque()}`;
	await page.goto('/agents/nouveau');
	await page.getByLabel('Prénom').fill('Rita');
	await page.getByLabel('Nom', { exact: true }).fill(nom);
	await page.getByLabel('E-mail').fill(`rita.${nom.toLowerCase()}@exemple.fr`);
	await page.locator('form[method="POST"]').getByRole('combobox', { name: 'Équipe' }).selectOption({ label: 'Équipe 1' });
	await page.getByRole('button', { name: 'Ajouter l\'agent', exact: true }).click();
	await expect(page).toHaveURL(/\/agents\/\d+$/);
	await ouvrirBloc(page, /^Départ du centre/);
	await page.getByRole('radio', { name: /^Part à la retraite, reste dans l’appli/ }).check();
	const formulaire = page.locator('form[action^="?/retraite"]');
	await expect(formulaire.getByLabel('Profil extérieur', { exact: true }).locator('option:checked')).toHaveText(/^Retrait/);
	await formulaire.getByLabel('Je confirme').check();
	await formulaire.getByRole('button', { name: 'Passer à la retraite', exact: true }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Passage à la retraite enregistré' })).toHaveCount(1);
	await expect(page.getByRole('button', { name: /^Profil/ })).toContainText(/Retrait/);
});

test('au téléphone, le bas d’une page longue reste au-dessus de la barre du bas', async ({ page }, info) => {
	test.skip(info.project.name !== 'telephone', 'La barre du bas est celle du téléphone.');
	await page.goto('/reglages');
	expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
	await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
	const { bas, barre } = await page.evaluate(() => ({
		bas: Math.max(...[...document.querySelectorAll('main *')].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0).map((r) => r.bottom)),
		barre: document.querySelector('nav:not(main nav)')!.getBoundingClientRect().top
	}));
	// Un espacement reste entre le dernier élément et la barre (la zone de sécurité de l'iPhone est vérifiée par le test du style).
	expect(barre - bas).toBeGreaterThanOrEqual(16);
});

test('Demandes reçues : la carte « Étapes de vos demandes » en tête, et son réglage sur place', async ({ page }) => {
	await page.goto('/reglages');
	const lien = await page.getByRole('link', { name: /Référent pharmacie/ }).first().getAttribute('href');
	await page.goto(`/demandes/role/${lien!.match(/\d+$/)![0]}`);
	const carte = page.getByRole('region', { name: 'Étapes de vos demandes', exact: true });
	await expect(carte).toContainText(/^Étapes de vos demandes\s*Demandée, Prise en compte, /);
	await page.waitForLoadState('networkidle');
	await carte.locator('details > summary').click();
	await expect(carte.getByRole('button', { name: 'Enregistrer les étapes', exact: true })).toBeVisible();
});

// Avant l'hydratation, le bouton d'un bloc ne fait rien : on réessaie.
async function ouvrirBloc(page: Page, nom: RegExp) {
	const bouton = page.getByRole('button', { name: nom });
	await expect(async () => {
		if ((await bouton.getAttribute('aria-expanded')) === 'false') await bouton.click();
		await expect(bouton).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
	}).toPass();
}

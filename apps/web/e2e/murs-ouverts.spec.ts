import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connecter } from './connexion.ts';
import { ETAT_SUPER } from './serveur.ts';

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

	test('il voit le mur de son comité, y publie, et ne voit pas Le centre', async ({ page }, info) => {
		// Un texte propre à chaque passage : la base est partagée entre téléphone et ordinateur.
		const texte = `Bonjour les anciens (${info.project.name}, ${info.retry})`;
		await connecter(page, EMAIL);
		await page.goto('/echanges');
		await expect(page.getByRole('link', { name: /Retraités e2e/ })).toBeVisible();
		await expect(page.locator('a[href="/echanges/centre"]')).toHaveCount(0);
		await page.getByRole('link', { name: /Retraités e2e/ }).first().click();
		await page.getByRole('link', { name: /^Publier dans / }).click();
		await page.getByLabel('Votre message', { exact: true }).fill(texte);
		await page.getByRole('button', { name: /^Publier/ }).click();
		await page.waitForURL(/\/echanges\/comite:\d+#publication-\d+$/);
		await expect(page.getByText(texte)).toBeVisible();
		expect((await page.goto('/echanges/centre'))?.status()).toBe(403);
	});

	// Un retraité n'a ni planning ni réservation : ni l'onglet Planning, ni Caserne, ni de lien vers ce qui lui serait refusé.
	test('sa navigation n’a que Accueil et Échanges, et « Moi » ni remplacements ni agenda', async ({ page }) => {
		await connecter(page, EMAIL);
		const navigation = page.getByRole('navigation', { name: 'Navigation principale' });
		await expect(navigation.getByRole('link', { name: 'Accueil', exact: true })).toBeVisible();
		await expect(navigation.getByRole('link', { name: /^Échanges/ })).toBeVisible();
		await expect(navigation.getByRole('link', { name: 'Planning', exact: true })).toHaveCount(0);
		await expect(navigation.getByRole('link', { name: 'Caserne', exact: true })).toHaveCount(0);
		await expect(page.locator('a[href^="/planning"], a[href^="/remplacements"]')).toHaveCount(0);
		await page.goto('/moi');
		await expect(page.getByRole('link', { name: /^Mon profil/ })).toBeVisible();
		await expect(page.locator('a[href^="/remplacements"], a[href="/moi/agenda"], a[href="/moi/vacances"]')).toHaveCount(0);
	});
});

// L'ajout d'une personne extérieure : grade, statut, dates de parcours et équipe se cachent dès que son profil est choisi.
test.describe('ajouter une personne extérieure', () => {
	test.use({ storageState: ETAT_SUPER });

	test('le formulaire réagit au choix du profil, puis la fiche ne montre que le profil', async ({ page }, info) => {
		const marque = `${info.project.name.replace(/\W/g, '')}${info.retry}${Date.now() % 100000}`;
		await page.goto('/agents/nouveau');
		// Le choix du profil n'agit qu'une fois la page prête.
		await page.waitForLoadState('networkidle');
		const formulaire = page.locator('form[method="POST"]');
		await expect(formulaire.getByRole('combobox', { name: 'Grade', exact: true })).toBeVisible();
		await formulaire.getByRole('combobox', { name: 'Profil', exact: true }).selectOption({ label: 'Réserve citoyenne' });
		for (const nom of ['Grade', 'Statut', 'Équipe']) await expect(formulaire.getByRole('combobox', { name: nom, exact: true })).toHaveCount(0);
		for (const nom of ['Date de nomination', 'Entrée au centre', 'Engagement SPV']) await expect(formulaire.getByLabel(nom, { exact: true })).toHaveCount(0);
		await formulaire.getByLabel('Prénom', { exact: true }).fill('Réserve');
		await formulaire.getByLabel('Nom', { exact: true }).fill(`Citoyenne${marque}`);
		await formulaire.getByLabel('E-mail', { exact: true }).fill(`rc.${marque.toLowerCase()}@exemple.fr`);
		await formulaire.getByRole('button', { name: 'Ajouter la personne', exact: true }).click();
		await expect(page).toHaveURL(/\/agents\/\d+$/);
		await expect(page.getByRole('heading', { level: 1, name: `Réserve Citoyenne${marque}` })).toBeVisible();
		await expect(page.getByRole('button', { name: /^Équipe et statut/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Profil/ })).toBeVisible();
	});
});

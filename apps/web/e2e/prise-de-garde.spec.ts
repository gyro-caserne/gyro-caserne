import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ETAT_CONNECTE, ETAT_SUPER } from './serveur.ts';

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));
function executer(sql: string) {
	execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'BASE', '--local', '--config', `${centre}wrangler.jsonc`, '--persist-to', `${centre}.wrangler/state`, '--command', sql], { cwd: appli, stdio: 'pipe' });
}

async function sansViolation(page: Page) {
	// Une fenêtre qui apparaît fausserait le calcul du contraste : on attend la fin de ce qui n'est pas sans fin.
	await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

test.describe('prise de garde', () => {
	test.use({ storageState: ETAT_CONNECTE });

	test('lire sans brouillon, puis les zones une à une ; annuler ; la validation sans défiler', async ({ page }) => {
		await page.goto('/engins/2/prise');
		await page.waitForLoadState('networkidle');
		// Un essai précédent a pu laisser un brouillon.
		const abandon = page.getByText('Abandonner la prise');
		if (await abandon.count()) {
			await abandon.click();
			await page.getByRole('button', { name: 'Oui, abandonner' }).click();
			await expect(abandon).toBeHidden();
		}
		await expect(page.getByText('Commencée par')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Commencer la prise' })).toBeHidden();
		const zones = page.getByRole('navigation', { name: 'Zones de l’engin' }).getByRole('link');
		const nombre = await zones.count();
		expect(nombre).toBeGreaterThan(1);
		await sansViolation(page);

		// Le lien « Écart » : 44 px de cible, nommé d'après son élément.
		const ecart = page.locator('summary').filter({ hasText: /^Écart/ }).first();
		expect((await ecart.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		expect((await ecart.boundingBox())!.width).toBeGreaterThanOrEqual(44);

		// Changer de zone ne demande rien au serveur.
		const requetes: string[] = [];
		page.on('request', (r) => requetes.push(r.url()));
		const premier = await page.locator('#titre-zone').textContent();
		await zones.nth(1).click();
		await expect(zones.nth(1)).toHaveAttribute('aria-current', 'true');
		await expect(page.locator('#titre-zone')).not.toHaveText(premier!);
		expect(requetes).toEqual([]);
		// Le titre de la zone choisie est à l'écran et reçoit le focus.
		await expect(page.locator('#titre-zone')).toBeFocused();
		await expect(page.locator('#titre-zone')).toBeInViewport();
		await zones.nth(0).click();
		await expect(page.locator('#titre-zone')).toHaveText(premier!);

		// Un écart avec photo commence la prise ; le fichier ne repart pas avec l'écart suivant.
		await ecart.click();
		await page.locator('input[name="photo"]').first().setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') });
		await page.getByRole('button', { name: /^Enregistrer l’écart/ }).first().click();
		await expect(page.getByText('Commencée par')).toBeVisible();
		await expect(page.getByRole('link', { name: /Photo de l’écart/ })).toBeVisible();
		expect(await page.locator('input[name="photo"]').first().inputValue()).toBe('');
		await expect(page.locator('span.zone').first()).not.toContainText('p.png');
		await page.getByRole('button', { name: /^Retirer l’écart/ }).click();
		await expect(page.getByRole('link', { name: /Photo de l’écart/ })).toBeHidden();

		const complet = page.getByRole('button', { name: /^Tout est complet/ });
		for (let i = 0; i < nombre; i++) {
			// Le geste vient après la liste.
			const liste = await page.locator('.elements').boundingBox();
			expect((await complet.boundingBox())!.y).toBeGreaterThanOrEqual(liste!.y);
			await complet.click();
			// Le compte de la plaque : « 1 / 4 » à l'écran, « 1 sur 4 » pour les lecteurs d'écran.
			await expect(page.locator('.compteur')).toContainText(`${i + 1} / sur ${nombre}`);
			if (i + 1 < nombre) {
				await expect(zones.nth(i + 1)).toHaveAttribute('aria-current', 'true');
				await expect(page.locator('#titre-zone')).toBeFocused();
				await expect(page.locator('#titre-zone')).toBeInViewport();
				// Le bandeau du bas dit ce qu'il reste ; le bouton est grisé, lu avec sa raison.
				await expect(page.getByRole('button', { name: 'Valider la prise' })).toHaveAttribute('aria-disabled', 'true');
				await expect(page.getByRole('button', { name: 'Valider la prise' })).toHaveAccessibleDescription(`Encore ${nombre - i - 1 > 1 ? `${nombre - i - 1} zones` : '1 zone'} à voir avant de valider.`);
			}
			if (i === 0) await sansViolation(page);
		}
		await expect(page.locator('#titre-valider')).toBeFocused();
		await expect(page.getByRole('button', { name: 'Valider la prise' })).toBeInViewport();
		await expect(page.getByRole('button', { name: 'Valider la prise' })).not.toHaveAttribute('aria-disabled');
		await sansViolation(page);

		// Le dernier geste s'annule d'un toucher.
		await page.getByRole('button', { name: /^Annuler/ }).click();
		await expect(page.getByRole('button', { name: 'Valider la prise' })).toHaveAttribute('aria-disabled', 'true');
		await expect(zones.nth(nombre - 1)).toHaveAttribute('aria-current', 'true');

		// Un collègue abandonne ailleurs : le geste suivant est refusé, et la page se remet à jour sans recharger.
		const ailleurs = await page.context().newPage();
		await ailleurs.goto('/engins/2/prise');
		await ailleurs.waitForLoadState('networkidle');
		await ailleurs.getByText('Abandonner la prise').click();
		await ailleurs.getByRole('button', { name: 'Oui, abandonner' }).click();
		await expect(ailleurs.getByText('Commencée par')).toBeHidden();
		await ailleurs.close();
		await complet.click();
		await expect(page.locator('.echec')).toBeVisible();
		await expect(page.getByText('Commencée par')).toBeHidden();
		await complet.click();
		await expect(page.getByText('Commencée par')).toBeVisible();

		await abandon.click();
		await page.getByRole('button', { name: 'Oui, abandonner' }).click();
		await expect(page.getByText('Commencée par')).toBeHidden();
	});
});

test.describe('prise validée', () => {
	test.use({ storageState: ETAT_CONNECTE });
	// Le compte de test devient chef de centre le temps du test ; la prise du VSAV 23 (engin 4), sans écart, repart de zéro.
	const MARQUE = 'super:e2e-reouverture';
	test.beforeAll(() => {
		executer(`DELETE FROM prise_garde WHERE engin_id = 4 AND NOT EXISTS (SELECT 1 FROM anomalie WHERE prise_id = prise_garde.id OR close_prise_id = prise_garde.id);`);
		executer(`INSERT INTO attribution (personne_id, responsabilite_id, perimetre_type, perimetre_id, debut, saisie_par, saisie_le) SELECT p.id, r.id, 'centre', NULL, '2026-01-01', '${MARQUE}', '2026-01-01' FROM personne p, responsabilite r WHERE p.email = 'test@exemple.fr' AND r.systeme = 'chef_centre';`);
	});
	test.afterAll(() => executer(`DELETE FROM attribution WHERE saisie_par = '${MARQUE}';`));

	test('valider, rouvrir avec un motif, puis valider de nouveau ; la trace reste', async ({ page }) => {
		await page.goto('/engins/4/prise');
		await page.waitForLoadState('networkidle');
		const complet = page.getByRole('button', { name: /^Tout est complet/ });
		const valider = page.getByRole('button', { name: 'Valider la prise', exact: true });
		// Une zone à la fois : après chaque geste, on attend que le compteur de la plaque l'ait pris en compte.
		const nombre = await page.getByRole('navigation', { name: 'Zones de l’engin' }).getByRole('link').count();
		for (let i = 0; i < nombre; i++) {
			await complet.click();
			await expect(page.locator('.compteur')).toContainText(`${i + 1} / sur ${nombre}`);
		}
		await expect(valider).not.toHaveAttribute('aria-disabled');
		await valider.click();
		await expect(page.getByRole('heading', { name: 'Prise validée, merci.' })).toBeVisible();

		// Validée : les participants restent modifiables sous la plaque.
		await expect(page.locator('.bande a.participants')).toBeVisible();
		const plus = page.locator('summary').filter({ hasText: /^Plus$/ });
		await plus.click();
		await sansViolation(page);
		const rouvrir = page.getByRole('button', { name: 'Rouvrir la prise', exact: true });
		// Sans « Je confirme » : refusé, rien ne change.
		await page.getByLabel('Motif').fill('Radio oubliée');
		await rouvrir.click();
		await expect(page.getByRole('alert')).toHaveText('Cochez « Je confirme » pour rouvrir la prise.');
		await page.getByLabel('Je confirme').check();
		await rouvrir.click();

		// Rouverte : la trace sous la plaque, les zones vues gardées, plus d'abandon.
		await expect(page.locator('.bande')).toContainText('Rouverte par Test Fictif');
		await expect(page.locator('.bande')).toContainText('Motif : Radio oubliée');
		await expect(page.getByText('Abandonner la prise')).toBeHidden();
		await expect(valider).not.toHaveAttribute('aria-disabled');
		await sansViolation(page);
		await valider.click();
		await expect(page.getByRole('heading', { name: 'Prise validée, merci.' })).toBeVisible();
		await expect(page.locator('.traces')).toContainText('Rouverte par Test Fictif');
	});
});

test.describe('agents, côté chef', () => {
	test.use({ storageState: ETAT_SUPER });

	test('au téléphone, une équipe ouverte le reste en revenant d’une fiche', async ({ page }) => {
		test.skip(page.viewportSize()!.width >= 1024, 'la liste reste à côté de la fiche');
		await page.goto('/agents');
		await page.waitForLoadState('networkidle');
		const entete = page.getByRole('button', { name: /^Équipe 2/ });
		await entete.click();
		await page.locator('li.agent a:visible').first().click();
		await expect(page).toHaveURL(/\/agents\/\d+/);
		await page.getByRole('link', { name: /Agents$/ }).first().click();
		await expect(page).toHaveURL(/\/agents$/);
		await expect(entete).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByRole('button', { name: /^Équipe 1/ })).toHaveAttribute('aria-expanded', 'false');
	});

	test('toute la ligne ouvre la fiche, 44 px au moins', async ({ page }) => {
		const ouvrir = async () => {
			await page.goto('/agents');
			await page.waitForLoadState('networkidle');
			// Au téléphone, les équipes sont repliées : elles s'ouvrent une à une, et l'ordinateur les montre en colonnes.
			const entete = page.getByRole('button', { name: /^Équipe 1/ });
			if (page.viewportSize()!.width < 1024) {
				await expect(entete).toHaveAttribute('aria-expanded', 'false');
				await entete.click();
			} else await expect(entete).toHaveAttribute('aria-expanded', 'true');
			const ligne = page.locator('li.agent').first();
			await expect(ligne).toBeVisible();
			return (await ligne.boundingBox())!;
		};
		const b = await ouvrir();
		expect(b.height).toBeGreaterThanOrEqual(44);
		for (const x of [b.x + 4, b.x + b.width - 4]) {
			await page.mouse.click(x, b.y + b.height / 2);
			await expect(page).toHaveURL(/\/agents\/\d+/);
			await ouvrir();
		}
	});
});

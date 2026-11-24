import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connecter } from './connexion.ts';
import { ETAT_CONNECTE, ETAT_SUPER } from './serveur.ts';

// Anomalies par zone : le chef règle « Prévenir : Référent pharmacie » sur la cellule sanitaire du VSAV ; un agent y note un écart
// à la prise du VSAV 1 ; la référente pharmacie le voit dans sa cloche, le référent engins non. Une fois (au téléphone) : le réglage
// et la prise de la relève sont communs à toute la base.

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));
const executer = (sql: string) => execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'BASE', '--local', '--config', `${centre}wrangler.jsonc`, '--persist-to', `${centre}.wrangler/state`, '--command', sql], { cwd: appli, stdio: 'pipe' });

const MARQUE = 'super:e2e-zones';
const PHARMACIE = 'pia.zones@exemple.fr';
const ENGINS = 'eric.zones@exemple.fr';
const ZONE = 'Cellule sanitaire';

test.describe('anomalies par zone', () => {
	test.beforeAll(() => {
		// Une référente pharmacie et un référent engins, le temps du test.
		executer(`INSERT INTO personne (email, prenom, nom, profil_id) SELECT '${PHARMACIE}', 'Pia', 'Zones', id FROM profil WHERE nom = 'Agent';
			INSERT INTO personne (email, prenom, nom, profil_id) SELECT '${ENGINS}', 'Éric', 'Zones', id FROM profil WHERE nom = 'Agent';
			INSERT INTO attribution (personne_id, responsabilite_id, perimetre_type, perimetre_id, debut, saisie_par, saisie_le) SELECT p.id, r.id, 'centre', NULL, '2026-01-01', '${MARQUE}', '2026-01-01' FROM personne p, responsabilite r WHERE p.email = '${PHARMACIE}' AND r.nom = 'Référent pharmacie';
			INSERT INTO attribution (personne_id, responsabilite_id, perimetre_type, perimetre_id, debut, saisie_par, saisie_le) SELECT p.id, r.id, 'centre', NULL, '2026-01-01', '${MARQUE}', '2026-01-01' FROM personne p, responsabilite r WHERE p.email = '${ENGINS}' AND r.nom = 'Référent engins';`);
	});
	test.afterAll(() => {
		executer(`UPDATE fiche_zone SET prevenir = NULL WHERE nom = '${ZONE}' AND version_id = (SELECT max(v.id) FROM fiche_version v JOIN type_engin t ON t.id = v.type_id WHERE t.nom = 'VSAV'); DELETE FROM attribution WHERE saisie_par = '${MARQUE}';`);
	});

	test('la zone prévient la pharmacie, pas le référent engins', async ({ browser }, info) => {
		test.skip(info.project.name !== 'telephone', 'Une fois suffit : le réglage et la prise sont communs à toute la base.');

		// Le chef règle la zone.
		const chef = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
		await chef.goto('/engins/fiches');
		await chef.getByRole('link', { name: /^Fiche VSAV/ }).click();
		await expect(chef.getByRole('heading', { level: 1, name: 'Fiche VSAV', exact: true })).toBeVisible();
		await chef.waitForLoadState('networkidle');
		await chef.getByRole('button', { name: new RegExp(`^${ZONE}`) }).click();
		await chef.getByRole('link', { name: new RegExp(`^Prévenir pour la zone ${ZONE}`) }).click();
		const volet = chef.getByRole('dialog', { name: `Prévenir pour ${ZONE}`, exact: true });
		await volet.getByLabel('Référent pharmacie', { exact: true }).check();
		await volet.getByRole('button', { name: 'Enregistrer', exact: true }).click();
		await expect(volet).toBeHidden();
		await expect(chef.getByRole('status').filter({ hasText: 'Réglage enregistré.' })).toHaveCount(1);
		// La zone reste ouverte, le focus revient à sa ligne Prévenir.
		await expect(chef.getByRole('link', { name: new RegExp(`^Prévenir pour la zone ${ZONE}`) })).toBeFocused();
		await expect(chef.getByRole('link', { name: new RegExp(`^Prévenir pour la zone ${ZONE}`) })).toContainText('Référent pharmacie');

		// Un agent note un écart dans la zone, à la prise du VSAV 1, puis la valide.
		const agent = await (await browser.newContext({ storageState: ETAT_CONNECTE })).newPage();
		await agent.goto('/engins/1/prise');
		await agent.waitForLoadState('networkidle');
		const zones = agent.getByRole('navigation', { name: 'Zones de l’engin' }).getByRole('link');
		await zones.filter({ hasText: ZONE }).click();
		await expect(agent.locator('#titre-zone')).toContainText(ZONE);
		await agent.locator('summary').filter({ hasText: /^Écart/ }).first().click();
		await agent.getByRole('button', { name: /^Enregistrer l’écart/ }).first().click();
		await expect(agent.getByText('Commencée par')).toBeVisible();
		const nombre = await zones.count();
		const complet = agent.getByRole('button', { name: /^(Tout est complet|Le reste est complet)/ });
		// Une zone à la fois : après chaque geste, on attend que le compteur de la plaque l'ait pris en compte.
		for (let i = 0; i < nombre; i++) {
			await zones.nth(i).click();
			await complet.click();
			await expect(agent.locator('.compteur')).toContainText(`${i + 1} / sur ${nombre}`);
		}
		const valider = agent.getByRole('button', { name: 'Valider la prise', exact: true });
		await expect(valider).not.toHaveAttribute('aria-disabled');
		await valider.click();
		await expect(agent.getByRole('heading', { name: 'Prise validée, merci.' })).toBeVisible();

		// La référente pharmacie la voit dans sa cloche ; le référent engins, non.
		const pia = await (await browser.newContext()).newPage();
		await connecter(pia, PHARMACIE);
		await pia.goto('/notifications');
		await expect(pia.getByText('VSAV 1, prise de garde')).toBeVisible();
		const eric = await (await browser.newContext()).newPage();
		await connecter(eric, ENGINS);
		await eric.goto('/notifications');
		await expect(eric.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(eric.getByText('VSAV 1, prise de garde')).toHaveCount(0);
	});
});

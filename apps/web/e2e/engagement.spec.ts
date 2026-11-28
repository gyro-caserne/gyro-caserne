import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connecter } from './connexion.ts';
import { ETAT_CONNECTE } from './serveur.ts';

// Date d'engagement : Nora la renseigne dans son profil, puis la lit sans pouvoir la changer ; le chef de centre le voit dans sa cloche.
// Une fois (au téléphone) : la base est commune. Rejouable, la date de Nora est vidée avant chaque passage.

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));
const executer = (sql: string) => execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'BASE', '--local', '--config', `${centre}wrangler.jsonc`, '--persist-to', `${centre}.wrangler/state`, '--command', sql], { cwd: appli, stdio: 'pipe' });

const NORA = 'nora.engagement@exemple.fr';
// Le compte de test devient chef de centre le temps du test.
const MARQUE = 'super:e2e-engagement';

test.describe('date d’engagement saisie par l’agent', () => {
	test.beforeAll(() => {
		executer(`INSERT INTO personne (email, prenom, nom, profil_id) SELECT '${NORA}', 'Nora', 'Engagement', id FROM profil WHERE nom = 'Agent' AND NOT EXISTS (SELECT 1 FROM personne WHERE email = '${NORA}');
			UPDATE personne SET engagement_spv = NULL WHERE email = '${NORA}';
			DELETE FROM avis_anciennete WHERE agent_id = (SELECT id FROM personne WHERE email = '${NORA}');
			DELETE FROM attribution WHERE saisie_par = '${MARQUE}';
			INSERT INTO attribution (personne_id, responsabilite_id, perimetre_type, perimetre_id, debut, saisie_par, saisie_le) SELECT p.id, r.id, 'centre', NULL, '2026-01-01', '${MARQUE}', '2026-01-01' FROM personne p, responsabilite r WHERE p.email = 'test@exemple.fr' AND r.systeme = 'chef_centre';`);
	});
	test.afterAll(() => {
		executer(`DELETE FROM attribution WHERE saisie_par = '${MARQUE}'; DELETE FROM avis_anciennete WHERE agent_id = (SELECT id FROM personne WHERE email = '${NORA}');`);
	});

	test('renseignée une fois, puis en lecture ; le chef prévenu', async ({ browser }, info) => {
		test.skip(info.project.name !== 'telephone', 'Une fois suffit : la base est commune.');

		const nora = await (await browser.newContext()).newPage();
		await connecter(nora, NORA);
		await nora.goto('/profil');
		await nora.getByLabel('Date d’engagement SPV', { exact: true }).fill('2014-03-03');
		await nora.getByRole('button', { name: 'Enregistrer', exact: true }).click();
		await expect(nora.getByText('Profil enregistré', { exact: true })).toBeVisible();
		await expect(nora.getByText('3 mars 2014', { exact: true })).toBeVisible();
		await expect(nora.getByText('Le chef de centre ou son adjoint la corrige.', { exact: true })).toBeVisible();
		await expect(nora.getByLabel('Date d’engagement SPV', { exact: true })).toHaveCount(0);

		const chef = await (await browser.newContext({ storageState: ETAT_CONNECTE })).newPage();
		await chef.goto('/notifications');
		await expect(chef.getByText('Nora Engagement a renseigné le 3 mars 2014 comme date d’engagement.', { exact: true })).toBeVisible();
	});
});

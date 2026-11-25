import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connecter } from './connexion.ts';
import { ETAT_CONNECTE } from './serveur.ts';

// Ancienneté : Thomas fête aujourd'hui ses 10 ans de service. Sur son accueil, un collègue voit la carte et le félicite ;
// Thomas le lit dans sa cloche. Une fois (au téléphone) : la félicitation est commune à toute la base.

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));
const executer = (sql: string) => execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'BASE', '--local', '--config', `${centre}wrangler.jsonc`, '--persist-to', `${centre}.wrangler/state`, '--command', sql], { cwd: appli, stdio: 'pipe' });

const THOMAS = 'thomas.palier@exemple.fr';
// Aujourd'hui à Paris, comme l'appli : engagé il y a 10 ans jour pour jour.
const aujourdhui = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date());
const engagement = `${Number(aujourdhui.slice(0, 4)) - 10}${aujourdhui.slice(4)}`;

test.describe('ancienneté de service', () => {
	// La base est partagée entre téléphone et ordinateur : l'insertion ne se fait qu'une fois, la date est remise à aujourd'hui.
	test.beforeAll(() => {
		executer(`INSERT INTO personne (email, prenom, nom, profil_id) SELECT '${THOMAS}', 'Thomas', 'Palier', id FROM profil WHERE nom = 'Agent' AND NOT EXISTS (SELECT 1 FROM personne WHERE email = '${THOMAS}');
			UPDATE personne SET engagement_spv = '${engagement}' WHERE email = '${THOMAS}';
			DELETE FROM avis_anciennete WHERE agent_id = (SELECT id FROM personne WHERE email = '${THOMAS}');`);
	});
	test.afterAll(() => {
		executer(`DELETE FROM avis_anciennete WHERE agent_id = (SELECT id FROM personne WHERE email = '${THOMAS}');`);
	});

	test('la carte du jour J, Féliciter, et l’agent prévenu', async ({ browser }, info) => {
		test.skip(info.project.name !== 'telephone', 'Une fois suffit : la félicitation est commune à toute la base.');

		const collegue = await (await browser.newContext({ storageState: ETAT_CONNECTE })).newPage();
		await collegue.goto('/');
		await expect(collegue.getByRole('heading', { name: 'Aujourd’hui au centre', exact: true })).toBeVisible();
		await expect(collegue.getByText('Thomas Palier fête ses 10 ans de service', { exact: true })).toBeVisible();
		await collegue.getByRole('button', { name: 'Féliciter Thomas Palier', exact: true }).click();
		await expect(collegue.getByText('Félicité Thomas Palier', { exact: true })).toBeVisible();
		await expect(collegue.getByRole('button', { name: 'Féliciter Thomas Palier', exact: true })).toHaveCount(0);

		const thomas = await (await browser.newContext()).newPage();
		await connecter(thomas, THOMAS);
		await expect(thomas.getByText('Vous fêtez vos 10 ans de service', { exact: true })).toBeVisible();
		await thomas.goto('/notifications');
		await expect(thomas.getByText(/vous félicite pour vos 10\s+ans de service 🎖️$/)).toBeVisible();
	});
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import exemple from '../../../centres/exemple/centre.ts';
import { connecter } from './connexion.ts';

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));

function executer(sql: string) {
	try {
		execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'BASE', '--local', '--config', `${centre}wrangler.jsonc`, '--persist-to', `${centre}.wrangler/state`, '--command', sql], { cwd: appli, stdio: 'pipe' });
	} catch (e) {
		const { status, stdout, stderr } = e as { status: number | null; stdout?: Buffer; stderr?: Buffer };
		throw new Error(`Wrangler d1 execute, statut ${status} :\n${String(stdout ?? '')}\n${String(stderr ?? '')}`);
	}
}

async function sansViolation(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

// Le jour de relève de la semaine d'après la prochaine (« AAAA-MM-JJ »), à l'heure de Paris. Loin des semaines du test du
// remplacement court, qui les remet en place à sa fin.
function releveDansDeuxSemaines(): string {
	const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
	const paris = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
	const jour = Date.parse(`${paris}T00:00:00Z`);
	const ecart = ((new Date(jour).getUTCDay() + 6) % 7 - JOURS.indexOf(exemple.astreinte.debut.jour) + 7) % 7;
	return new Date(jour + (14 - ecart) * 86_400_000).toISOString().slice(0, 10);
}

// Alice (équipe 1) demande à être remplacée le soir de sa relève, de 20 h 10 à 22 h 40, à tous ; Chloé accepte. L'équipe 1 est mise d'astreinte cette semaine-là le temps du test (insertion rejouable), tout est retiré après.
test.describe.serial('remplacement sur un créneau', () => {
	const releve = releveDansDeuxSemaines();
	const MOT = 'Essai du créneau';
	test.beforeAll(({}, info) => {
		if (info.project.name !== 'telephone') return;
		executer(`INSERT INTO semaine_changee (debut, equipe_id) SELECT '${releve}', id FROM equipe WHERE nom = 'Équipe 1' AND NOT EXISTS (SELECT 1 FROM semaine_changee WHERE debut = '${releve}');`);
	});
	test.afterAll(({}, info) => {
		if (info.project.name !== 'telephone') return;
		executer(`DELETE FROM avis_remplacement WHERE demande_id IN (SELECT id FROM demande_remplacement WHERE mot = '${MOT}'); DELETE FROM destinataire_remplacement WHERE demande_id IN (SELECT id FROM demande_remplacement WHERE mot = '${MOT}'); DELETE FROM demande_remplacement WHERE mot = '${MOT}'; DELETE FROM semaine_changee WHERE debut = '${releve}';`);
	});

	test('demander un créneau à tous, un refus dit sa raison, un collègue accepte', async ({ page, browser }, info) => {
		test.skip(info.project.name !== 'telephone', 'Un seul parcours, au téléphone.');
		test.setTimeout(180_000);
		await connecter(page, 'alice.martin@exemple.fr');
		await page.goto('/remplacements/demander');
		await page.getByRole('link', { name: /^Un créneau/ }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Un créneau', exact: true })).toBeVisible();
		await sansViolation(page);

		// Trop court : refusé, avec la raison, le créneau saisi gardé.
		await page.getByLabel('Début', { exact: true }).fill(`${releve}T20:10`);
		await page.getByLabel('Fin', { exact: true }).fill(`${releve}T20:40`);
		await page.getByRole('button', { name: 'Continuer', exact: true }).click();
		await expect(page.getByRole('alert')).toHaveText('Un créneau dure au moins 1 h.');
		await page.getByLabel('Fin', { exact: true }).fill(`${releve}T22:40`);
		await page.getByRole('button', { name: 'Continuer', exact: true }).click();
		await expect(page.getByRole('heading', { level: 2, name: 'À qui ?', exact: true })).toBeVisible();
		await expect(page.getByText(/^Votre créneau, .*de 20 h 10 à 22 h 40\.$/)).toBeVisible();
		await page.getByLabel(/^Tout le monde/).check();
		await page.getByRole('button', { name: 'Continuer', exact: true }).click();
		await expect(page.getByText(/^Vous demandez à être remplacé .*de 20 h 10 à 22 h 40\.$/)).toBeVisible();
		await sansViolation(page);
		await page.getByLabel(/^Un mot pour vos collègues/).fill(MOT);
		await page.getByRole('button', { name: 'Envoyer la demande', exact: true }).click();
		await expect(page.getByText('Demande envoyée.', { exact: false })).toBeVisible();
		await sansViolation(page);

		const autre = await browser.newContext();
		const chloe = await autre.newPage();
		await connecter(chloe, 'chloe.durand@exemple.fr');
		await chloe.goto('/remplacements');
		await chloe.getByRole('article').filter({ hasText: 'de 20 h 10 à 22 h 40' }).getByRole('button', { name: /^Accepter/ }).click();
		await expect(chloe.getByRole('status')).toContainText('Accepté.');
		await autre.close();

		// Le récapitulatif de la demande, côté Alice : Chloé la remplace sur le créneau.
		await page.reload();
		await expect(page.getByText(/de 20 h 10 à 22 h 40/).first()).toBeVisible();
		await expect(page.getByText('Chloé Durand', { exact: false }).first()).toBeVisible();
	});
});

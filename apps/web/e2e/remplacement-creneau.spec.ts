import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import exemple from '../../../centres/exemple/centre.ts';
import { connecter } from './connexion.ts';

const appli = fileURLToPath(new URL('..', import.meta.url));
const centre = fileURLToPath(new URL('../../../centres/exemple/', import.meta.url));

function wrangler(sql: string, json = false): string {
	try {
		return execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'BASE', '--local', '--config', `${centre}wrangler.jsonc`, '--persist-to', `${centre}.wrangler/state`, ...(json ? ['--json'] : []), '--command', sql], { cwd: appli, stdio: 'pipe' }).toString();
	} catch (e) {
		const { status, stdout, stderr } = e as { status: number | null; stdout?: Buffer; stderr?: Buffer };
		throw new Error(`Wrangler d1 execute, statut ${status} :\n${String(stdout ?? '')}\n${String(stderr ?? '')}`);
	}
}
const executer = (sql: string) => void wrangler(sql);
// Les lignes du dernier ordre SQL.
function lire(sql: string): Record<string, unknown>[] {
	const sortie = wrangler(sql, true);
	const lots = JSON.parse(sortie.slice(sortie.indexOf('['))) as { results: Record<string, unknown>[] }[];
	return lots.at(-1)!.results;
}

async function sansViolation(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

// Les jours de relève de la semaine d'après la prochaine et des trois suivantes (« AAAA-MM-JJ »), à l'heure de Paris. Loin des
// semaines du test du remplacement court, qui les remet en place à sa fin.
function relevesAVenir(): string[] {
	const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
	const paris = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
	const jour = Date.parse(`${paris}T00:00:00Z`);
	const ecart = ((new Date(jour).getUTCDay() + 6) % 7 - JOURS.indexOf(exemple.astreinte.debut.jour) + 7) % 7;
	return [14, 21, 28, 35].map((n) => new Date(jour + (n - ecart) * 86_400_000).toISOString().slice(0, 10));
}

const MOT = 'Essai du créneau';
// La semaine changée par le test est notée au journal : seule celle-là est retirée, même après un test interrompu.
const MARQUE = 'e2e_remplacement_creneau';
const nettoyer = () =>
	executer(
		`DELETE FROM avis_remplacement WHERE demande_id IN (SELECT id FROM demande_remplacement WHERE mot = '${MOT}'); DELETE FROM destinataire_remplacement WHERE demande_id IN (SELECT id FROM demande_remplacement WHERE mot = '${MOT}'); DELETE FROM demande_remplacement WHERE mot = '${MOT}'; DELETE FROM semaine_changee WHERE debut IN (SELECT json_extract(details, '$.debut') FROM journal WHERE action = '${MARQUE}'); DELETE FROM journal WHERE action = '${MARQUE}';`
	);

// Alice (équipe 1) demande à être remplacée le soir de sa relève, de 20 h 10 à 22 h 40, à tous ; Chloé accepte. L'équipe 1 est mise d'astreinte cette semaine-là le temps du test (insertion rejouable), tout est retiré après.
test.describe.serial('remplacement sur un créneau', () => {
	let releve = '';
	test.beforeAll(({}, info) => {
		if (info.project.name !== 'telephone') return;
		nettoyer();
		// La première de ces relèves dont l'année est publiée, hors été publié et sans fête du centre de 20 h 10 à 22 h 40,
		// et dont la semaine n'a pas été donnée à une autre équipe.
		const valeurs = relevesAVenir().map((d) => `('${d}')`).join(', ');
		const [premiere] = lire(
			`SELECT column1 AS d FROM (VALUES ${valeurs}) WHERE EXISTS (SELECT 1 FROM annee_planning a WHERE a.annee = cast(substr(column1, 1, 4) as integer) AND a.publiee_le IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM ete e WHERE e.publiee_le IS NOT NULL AND e.debut <= column1 AND e.fin >= column1) AND NOT EXISTS (SELECT 1 FROM fete_centre f WHERE f.debut < column1 || 'T22:40' AND f.fin > column1 || 'T20:10') AND NOT EXISTS (SELECT 1 FROM semaine_changee s WHERE s.debut = column1 AND s.equipe_id <> (SELECT id FROM equipe WHERE nom = 'Équipe 1')) ORDER BY column1 LIMIT 1;`
		);
		if (!premiere) throw new Error('Aucune relève utilisable dans les cinq semaines');
		releve = String(premiere.d);
		executer(
			`INSERT INTO journal (quand, acteur, action, cible_type, details) SELECT strftime('%Y-%m-%dT%H:%M', 'now'), 'e2e', '${MARQUE}', 'semaine_changee', json_object('debut', '${releve}') WHERE NOT EXISTS (SELECT 1 FROM semaine_changee WHERE debut = '${releve}'); INSERT INTO semaine_changee (debut, equipe_id) SELECT '${releve}', id FROM equipe WHERE nom = 'Équipe 1' AND NOT EXISTS (SELECT 1 FROM semaine_changee WHERE debut = '${releve}');`
		);
	});
	test.afterAll(({}, info) => {
		if (info.project.name !== 'telephone') return;
		nettoyer();
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
		await expect(page.getByLabel('Fin', { exact: true })).toHaveAttribute('aria-invalid', 'true');
		await expect(page.locator('#fin-erreur')).toHaveText('Un créneau dure au moins 1 h.');
		await sansViolation(page);
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

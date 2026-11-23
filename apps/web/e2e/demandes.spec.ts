import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { connecter } from './connexion.ts';
import { ETAT_CONNECTE, ETAT_SUPER } from './serveur.ts';

// Demandes aux référents, de bout en bout : la pharmacie reçoit une étape « Commandée… » ; un agent demande ; la référente prend en
// compte, pose une question, l'agent répond, la référente passe à l'étape puis à la fin. Une seule fois (au téléphone) : les étapes
// réglées sont communes à toute la base.

async function sansViolation(page: Page) {
	await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	expect(violations.map((v) => ({ regle: v.id, ou: v.nodes.map((n) => n.target.join(' ')) }))).toEqual([]);
}

const marque = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

async function pageAgent(browser: Browser, email: string): Promise<Page> {
	const page = await (await browser.newContext()).newPage();
	await connecter(page, email);
	return page;
}

// Le super administrateur ajoute une agente, puis la nomme référente pharmacie.
async function referentePharmacie(gestion: Page): Promise<string> {
	const nom = `Essai${marque()}`;
	const email = `zoe.${nom.toLowerCase()}@exemple.fr`;
	await gestion.goto('/agents/nouveau');
	await gestion.getByLabel('Prénom').fill('Zoé');
	await gestion.getByLabel('Nom', { exact: true }).fill(nom);
	await gestion.getByLabel('E-mail').fill(email);
	await gestion.locator('form[method="POST"]').getByRole('combobox', { name: 'Équipe' }).selectOption({ label: 'Équipe 1' });
	await gestion.getByRole('button', { name: "Ajouter l'agent" }).click();
	await expect(gestion).toHaveURL(/\/agents\/\d+$/);
	await gestion.goto('/nominations');
	const carte = gestion.locator('section').filter({ has: gestion.getByRole('heading', { level: 2, name: 'Référent pharmacie', exact: true }) });
	await carte.getByRole('button', { name: 'Nommer', exact: true }).click();
	const formulaire = carte.locator('dialog form[action="?/attribuer"]');
	await formulaire.getByLabel('Agent', { exact: true }).selectOption({ label: `Zoé ${nom} (Équipe 1)` });
	await formulaire.getByRole('button', { name: 'Nommer' }).click();
	await expect(carte.getByRole('status')).toHaveText('Rôle attribué');
	return email;
}

// Le bloc « Demandes » de la page du rôle, ouvert.
async function blocDemandes(gestion: Page) {
	await gestion.goto('/reglages');
	await gestion.getByRole('link', { name: /Référent pharmacie/ }).first().click();
	await expect(gestion.getByRole('heading', { level: 1, name: 'Référent pharmacie' })).toBeVisible();
	const bloc = gestion.locator('details', { has: gestion.locator('summary', { hasText: /^Demandes$/ }) });
	if (!(await bloc.getAttribute('open'))) await bloc.locator('summary').click();
	return bloc;
}

// « Enregistrer », le seul bouton de la page du rôle : droits et réglage des demandes ensemble ; la réussite s'annonce en tête.
async function enregistrer(gestion: Page) {
	await gestion.getByRole('button', { name: 'Enregistrer', exact: true }).click();
	await expect(gestion.getByRole('status').filter({ hasText: 'Le rôle « Référent pharmacie » est enregistré.' })).toBeVisible();
}

test('demande à la pharmacie, de la question à la fin, sans violation', async ({ browser }, info) => {
	test.skip(info.project.name !== 'telephone', 'Une fois suffit : les étapes réglées sont communes à toute la base.');
	const etape = `Commandée ${marque()}`;
	const texte = `Compresses stériles ${marque()}`;

	const gestion = await (await browser.newContext({ storageState: ETAT_SUPER })).newPage();
	const email = await referentePharmacie(gestion);
	let bloc = await blocDemandes(gestion);
	await expect(bloc.getByRole('switch', { name: 'Reçoit des demandes' })).toBeChecked();
	await bloc.getByLabel('Nouvelle étape').fill(etape);
	// « Ajouter l'étape » : la page revient, bloc ouvert, avec l'étape dans la saisie ; rien n'est encore enregistré.
	await bloc.getByRole('button', { name: 'Ajouter l’étape' }).click();
	await expect(bloc.getByRole('textbox', { name: /^Étape \d+$/ }).last()).toHaveValue(etape);
	await sansViolation(gestion);
	await enregistrer(gestion);
	bloc = await blocDemandes(gestion);
	await expect(bloc.getByRole('textbox', { name: /^Étape \d+$/ }).last()).toHaveValue(etape);

	// L'agent demande, depuis Caserne.
	const agent = await (await browser.newContext({ storageState: ETAT_CONNECTE })).newPage();
	await agent.goto('/caserne');
	await agent.getByRole('link', { name: /^Faire une demande/ }).click();
	await agent.waitForLoadState('networkidle');
	await agent.getByRole('radio', { name: 'Référent pharmacie' }).check();
	await agent.getByLabel('Votre demande').fill(texte);
	await sansViolation(agent);
	await agent.getByRole('button', { name: 'Envoyer la demande' }).click();
	await expect(agent).toHaveURL(/\/demandes\/\d+\?envoyee$/);
	const adresse = new URL(agent.url()).pathname;

	// La référente la voit dans sa casquette, la prend en compte et pose une question.
	const referente = await pageAgent(browser, email);
	await referente.goto('/');
	await expect(referente.getByRole('link', { name: /à prendre en compte/ }).first()).toBeVisible();
	await referente.goto(adresse);
	await referente.waitForLoadState('networkidle');
	await referente.getByRole('button', { name: 'Je la prends en compte' }).click();
	await expect(referente.getByText('Suivie par Zoé')).toBeVisible();
	await referente.getByRole('link', { name: 'Poser une question' }).click();
	const question = referente.getByRole('dialog', { name: 'Poser une question' });
	await question.getByLabel('Votre question').fill('En 10 x 10 ?');
	await sansViolation(referente);
	await question.getByRole('button', { name: 'Envoyer la question' }).click();
	await expect(question).toHaveCount(0);

	// L'agent répond.
	await agent.goto(adresse);
	await agent.waitForLoadState('networkidle');
	await expect(agent.getByText('En 10 x 10 ?').first()).toBeVisible();
	await agent.getByLabel('Votre réponse').fill('Oui, une boîte');
	await agent.getByRole('button', { name: 'Envoyer', exact: true }).click();
	await expect(agent.getByText('Oui, une boîte')).toBeVisible();
	await sansViolation(agent);

	// La référente passe à l'étape réglée, puis à la fin.
	await referente.goto(adresse);
	await referente.waitForLoadState('networkidle');
	await referente.getByRole('link', { name: 'Faire avancer' }).click();
	let avancer = referente.getByRole('dialog', { name: 'Faire avancer' });
	await avancer.getByRole('radio', { name: etape }).check();
	await sansViolation(referente);
	await avancer.getByRole('button', { name: 'Enregistrer l’étape' }).click();
	await expect(avancer).toHaveCount(0);
	await expect(referente.locator('.pastille', { hasText: etape }).first()).toBeVisible();
	await referente.getByRole('link', { name: 'Faire avancer' }).click();
	avancer = referente.getByRole('dialog', { name: 'Faire avancer' });
	await avancer.getByRole('radio', { name: /^Faite/ }).check();
	await avancer.getByLabel('Un mot pour l’agent (facultatif)').fill('Dans le placard de la pharmacie');
	await avancer.getByRole('button', { name: 'Enregistrer l’étape' }).click();
	await expect(avancer).toHaveCount(0);
	await expect(referente.getByText('Dans le placard de la pharmacie').first()).toBeVisible();

	// L'agent voit sa demande finie ; l'étape d'essai est retirée (plus aucune demande en cours n'y est).
	await agent.goto('/demandes');
	await expect(agent.getByRole('link', { name: new RegExp(texte) })).toContainText('Faite');
	bloc = await blocDemandes(gestion);
	await bloc.getByRole('button', { name: `Retirer ${etape}` }).click();
	await expect(bloc.getByRole('button', { name: `Retirer ${etape}` })).toHaveCount(0);
	await enregistrer(gestion);
	for (const p of [gestion, agent, referente]) await p.context().close();
});

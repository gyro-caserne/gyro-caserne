import { render } from 'svelte/server';
import { eq } from 'drizzle-orm';
import { personne, profil } from '@gyro-caserne/socle';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import { load } from './+page.server';
import { quiFaitQuoi } from '@gyro-caserne/socle';
import { aPourvoir, postesDe } from '#lib/nommer/postes.ts';
import { aujourdhuiParis } from '#lib/aujourdhui.ts';
import { preparer } from '../echanges/de-test.ts';
import { preparer as preparerEngins } from '../engins/de-test.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: Record<string, unknown>) => render(Page as any, { props: { data } }).body;
const lien = (href: string, libelle: string) => new RegExp(`<a[^>]*href="${href}"[^>]*>[\\s\\S]*?${libelle}[\\s\\S]*?</a>`);

describe('/caserne', () => {
	it('demande la connexion', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect((load as any)({ locals: { acteur: null }, parent: async () => ({ peutNominations: false }) })).rejects.toMatchObject({ status: 303, location: '/connexion' });
	});

	it('l’effectif pour tous ; ce qui est à pourvoir pour qui peut nommer, le même compte que Qui fait quoi', async () => {
		const { base, chef, alice } = await preparer();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const charger = (acteur: unknown, peutNominations: boolean) => (load as any)({ locals: { base, acteur }, parent: async () => ({ peutNominations }) });
		expect(await charger(alice, false)).toEqual({ agents: 3, aPourvoir: null, engins: 0, anomalies: 0, comites: true });
		const pourLeChef = await charger(chef, true);
		expect(pourLeChef.agents).toBe(3);
		const postes = postesDe(await quiFaitQuoi(base, chef, aujourdhuiParis(), { gestes: true }));
		// Seules les fonctions sans titulaire sont à pourvoir : pas les missions.
		expect(aPourvoir(postes).length).toBeGreaterThan(0);
		expect(postes.some((p) => p.nature === 'mission' && p.titulaires.length === 0 && p.nommer && !p.nommer.aPourvoir)).toBe(true);
		expect(pourLeChef.aPourvoir).toBe(aPourvoir(postes).length);
	});

	it('agent ordinaire : « Agents », sans « Réglages »', () => {
		const page = html({ peutNominations: false, peutReglages: false });
		expect(page).toMatch(lien('/agents', 'Agents'));
		expect(page).not.toContain('href="/nominations"');
		expect(page).not.toContain('href="/reglages"');
	});

	it('« Habillement » (Faire une demande, au référent habillement) pour un agent du centre ; pas pour le compte de la réserve citoyenne', () => {
		expect(html({ comites: true })).toMatch(lien('/habillement', 'Habillement'));
		expect(html({ comites: false })).not.toContain('href="/habillement"');
	});

	it('chef de centre : « Agents », « Qui fait quoi » et « Réglages » ; plus de page Nominations', () => {
		const page = html({ peutNominations: true, peutReglages: true, comites: true });
		expect(page).toMatch(lien('/agents', 'Agents'));
		expect(page).toMatch(lien('/comites', 'Qui fait quoi'));
		expect(page).not.toContain('Nominations');
		expect(page).toMatch(lien('/reglages', 'Réglages'));
	});

	it('des chiffres utiles : l’effectif, et ce qui est à pourvoir pour qui décide', () => {
		const page = html({ peutNominations: true, peutReglages: false, agents: 14, aPourvoir: 3, comites: true });
		expect(page).toMatch(lien('/agents', '14 agents'));
		expect(page).toMatch(lien('/comites', '3 à pourvoir'));
		expect(html({ peutNominations: true, peutReglages: false, agents: 1, aPourvoir: 0 })).not.toMatch(/>\d+ à pourvoir</);
		expect(html({ peutNominations: false, peutReglages: false, agents: 1, aPourvoir: null })).toContain('1 agent<');
	});

	it('personne extérieure (réserve citoyenne) : Réservations, sans la liste des agents', () => {
		const page = html({ exterieur: true, comites: false, agents: 3 });
		expect(page).toContain('href="/reservations"');
		expect(page).not.toContain('href="/agents"');
		// Un groupe vide ne s'affiche pas.
		expect(page).not.toContain('Organisation');
	});

	it('« Réservations » pour tous, vers la VL et le matériel', () => {
		const page = html({});
		expect(page).toMatch(/href="\/reservations"[\s\S]*?Réservations[\s\S]*?La VL et le matériel de l’amicale/);
	});

	it('« Qui fait quoi » pour les agents, pas pour le compte de la réserve citoyenne ; plus de groupe « Bientôt »', async () => {
		expect(html({ comites: false })).not.toContain('href="/comites"');
		const { base } = await preparer();
		const [ext] = await base.select().from(profil).where(eq(profil.typePersonne, 'exterieur'));
		const [p] = await base.insert(personne).values({ email: 'reserve@exemple.fr', prenom: 'Réserve', nom: 'Citoyenne', profilId: ext!.id }).returning();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect((await (load as any)({ locals: { base, acteur: { type: 'personne', id: p!.id } }, parent: async () => ({ peutNominations: false }) })).comites).toBe(false);
		const page = html({ peutNominations: false, peutReglages: false, comites: true });
		expect(page).toMatch(/href="\/comites"[\s\S]*?Qui fait quoi[\s\S]*?Les comités, les rôles et qui les tient/);
		expect(page).not.toContain('Bientôt');
		expect(page).not.toContain('arrivent bientôt');
	});

	it('deux groupes : l’organisation, puis le matériel', () => {
		const page = html({ peutNominations: true, peutReglages: true, engins: 3, anomalies: 1, comites: true });
		const organisation = page.indexOf('>Organisation<');
		const materiel = page.indexOf('>Matériel<');
		expect(organisation).toBeGreaterThan(-1);
		expect(materiel).toBeGreaterThan(organisation);
		for (const href of ['/agents', '/comites', '/reglages']) expect(page.indexOf(`href="${href}"`)).toBeLessThan(materiel);
		for (const href of ['/engins', '/engins/anomalies', '/reservations']) expect(page.indexOf(`href="${href}"`)).toBeGreaterThan(materiel);
	});

	it('« Engins » pour qui les voit, avec le nombre d’engins au centre', async () => {
		expect(html({ engins: 3 })).toMatch(lien('/engins', '3 engins'));
		expect(html({ engins: null })).not.toContain('href="/engins"');
		const { base, sans, alice } = await preparerEngins();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const charger = (acteur: unknown) => (load as any)({ locals: { base, acteur }, parent: async () => ({ peutNominations: false }) });
		expect((await charger(alice)).engins).toBe(2);
		expect((await charger(sans)).engins).toBeNull();
		expect((await charger(sans)).anomalies).toBeNull();
	});

	it('« Anomalies » pour qui voit les engins, avec le nombre d’ouvertes', () => {
		expect(html({ engins: 3, anomalies: 2 })).toMatch(lien('/engins/anomalies', '2 ouvertes'));
		expect(html({ engins: 3, anomalies: 0 })).toMatch(lien('/engins/anomalies', 'Aucune ouverte'));
		expect(html({ engins: null, anomalies: null })).not.toContain('href="/engins/anomalies"');
	});
	it('« Suivi du centre » pour le chef, l’adjoint et le super administrateur (donné par l’en-tête), avec ses nouveautés ; pas pour un agent', () => {
		expect(html({ agents: 3, suivi: 4 })).toMatch(/<a[^>]*href="\/suivi"[^>]*>[\s\S]*?Suivi du centre[\s\S]*?4 nouveautés/);
		expect(html({ agents: 3, suivi: 0 })).toMatch(lien('/suivi', 'Suivi du centre'));
		expect(html({ agents: 3, suivi: 0 })).toContain('Ce qui s’est passé au centre');
		expect(html({ agents: 3, suivi: null })).not.toContain('href="/suivi"');
	});
});

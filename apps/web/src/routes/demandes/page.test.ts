import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

const adresse = vi.hoisted(() => ({ url: new URL('http://x/demandes/3') }));
vi.mock('$app/state', () => ({ page: adresse }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
const { default: Liste } = await import('./+page.svelte');
const { default: Demande } = await import('./[id]/+page.svelte');
const { default: Role } = await import('./role/[id]/+page.svelte');

/* eslint-disable @typescript-eslint/no-explicit-any */
const propre = (html: string) => html.replace(/<!--[^>]*-->/g, '').replace(/ ?svelte-[a-z0-9]+/g, '').replace(/ class=""/g, '');
const ligne = (autres: Record<string, unknown> = {}) => ({ id: 3, texte: 'Compresses stériles, la boîte est vide.', roleId: 7, role: 'Référent pharmacie', etape: 'ea', nomEtape: 'Commandée', question: null, demandeur: 'Alice Martin', prisePar: 'Bruno Petit', creeLe: '2026-11-23T09:00', majLe: '2026-11-23T10:00', finLe: null, ...autres });
const vue = (autres: Record<string, unknown> = {}) => ({
	...ligne(),
	icone: 'croix',
	mot: null,
	sienne: true,
	fil: [
		{ quoi: 'prise', etape: null, texte: null, par: 'Bruno Petit', le: '2026-11-23T09:30', deLAgent: false },
		{ quoi: 'etape', etape: 'Commandée', texte: null, par: 'Bruno Petit', le: '2026-11-23T10:00', deLAgent: false }
	],
	gestes: ['repondre'],
	vers: [],
	etapes: [{ id: 'demandee', nom: 'Demandée' }, { id: 'prise', nom: 'Prise en compte' }, { id: 'ea', nom: 'Commandée' }, { id: 'faite', nom: 'Livrée' }],
	...autres
});
const demande = (url: string, d = vue(), form: unknown = null) => {
	adresse.url = new URL(`http://x/demandes/3${url}`);
	return propre(render(Demande as any, { props: { data: { demande: d }, form } }).body);
};
const roles = [{ id: 7, nom: 'Référent pharmacie', icone: 'croix' }, { id: 8, nom: 'Référent engins', icone: 'camion' }];

describe('/demandes', () => {
	it('à qui, avec l’icône du rôle, et un seul champ ; mes demandes avec leur rôle et leur état écrit', () => {
		const page = propre(render(Liste as any, { props: { data: { roles, recus: [], enCours: [ligne()], terminees: [ligne({ id: 4, etape: 'faite', nomEtape: 'Livrée', finLe: '2026-11-20T10:00' })], peutDemander: true, choisi: 7 }, form: null } }).body);
		expect(page).toContain('<legend>À qui ?</legend>');
		expect(page).toMatch(/value="7"[^>]*checked/);
		expect(page.match(/<textarea/g)).toHaveLength(1);
		expect(page).toMatch(/href="\/demandes\/3"[\s\S]*?Référent pharmacie, demandée le[\s\S]*?Commandée/);
		expect(page).toMatch(/href="\/demandes\/4"[\s\S]*?finie le[\s\S]*?Livrée/);
		expect(page).not.toContain('Demandes reçues');
	});

	it('qui reçoit des demandes les retrouve en tête, avec le nombre en cours ; sans rôle qui reçoit, une phrase', () => {
		const page = propre(render(Liste as any, { props: { data: { roles, recus: [{ id: 7, nom: 'Référent pharmacie', icone: 'croix', enCours: 2 }], enCours: [], terminees: [], peutDemander: true, choisi: null }, form: null } }).body);
		expect(page).toMatch(/Demandes reçues[\s\S]*?href="\/demandes\/role\/7"[\s\S]*?2 en cours/);
		const sans = propre(render(Liste as any, { props: { data: { roles: [], recus: [], enCours: [], terminees: [], peutDemander: true, choisi: null }, form: null } }).body);
		expect(sans).toContain('Aucun référent ne reçoit de demandes pour l’instant.');
		expect(sans).not.toContain('<textarea');
	});
});

describe('/demandes/[id]', () => {
	it('le suivi : les étapes du rôle dans l’ordre, l’actuelle en cours ; le fil dit l’étape par son nom', () => {
		const page = demande('');
		expect(page).toMatch(/Demandée[\s\S]*?Prise en compte[\s\S]*?aria-current="step"[\s\S]*?Commandée[\s\S]*?Livrée/);
		expect(page).toContain('Suivie par Bruno Petit.');
		expect(page).toMatch(/<strong>Commandée<\/strong>/);
		expect(page).toContain('Ajouter une précision');
		expect(page).not.toContain('Annuler ma demande');
	});

	it('une question posée : rappelée, avec « Répondre » sur sa ligne', () => {
		const page = demande('', vue({ question: 'posee', fil: [{ quoi: 'question', etape: null, texte: 'Quelle taille ?', par: 'Bruno Petit', le: '2026-11-23T10:00', deLAgent: false }] }));
		expect(page).toContain('Bruno Petit vous demande');
		expect(page).toMatch(/<div><a class="lien-secondaire" href="#texte-repondre">Répondre<\/a><\/div>/);
		expect(page).toContain('Votre réponse');
	});

	it('qui la suit : « Faire avancer » ouvre les étapes possibles, la dernière dit qu’elle finit la demande', () => {
		const page = demande('?panneau=avancer', vue({ sienne: false, gestes: ['question', 'avancer', 'refuser'], vers: [{ id: 'faite', nom: 'Livrée' }] }));
		expect(page).toContain('Demandée par Alice Martin (Référent pharmacie)');
		expect(page).toMatch(/value="faite"[\s\S]*?Livrée[\s\S]*?La demande est finie/);
		expect(page).toContain('Enregistrer l’étape');
		expect(page).toContain('Refuser la demande');
	});
});

describe('/demandes/role/[id]', () => {
	it('en cours puis terminées ; sans titulaire, la phrase ; le titulaire règle les étapes', () => {
		const data = { role: { id: 7, nom: 'Référent pharmacie', icone: 'croix', demandes: { etapes: [{ id: 'ea', nom: 'Commandée' }], derniere: 'Livrée' } }, titulaire: true, sansTitulaire: false, enCours: [ligne({ etape: 'demandee', nomEtape: 'Demandée', prisePar: null })], terminees: [], regler: 'etapes' };
		const page = propre(render(Role as any, { props: { data, form: null } }).body);
		expect(page).toMatch(/<h1[^>]*>Demandes reçues<\/h1>/);
		expect(page).toMatch(/href="\/demandes\/3"[\s\S]*?Alice Martin, le[\s\S]*?Demandée/);
		expect(page).toContain('Régler les étapes');
		expect(page).not.toContain('Reçoit des demandes');
		expect(page).not.toContain('Ce rôle n’a pas de titulaire.');
		const sans = propre(render(Role as any, { props: { data: { ...data, sansTitulaire: true, regler: null }, form: null } }).body);
		expect(sans).toContain('Ce rôle n’a pas de titulaire.');
		expect(sans).not.toContain('Régler les étapes');
	});
	it('la carte « Étapes de vos demandes » en tête, vide ou non, pour qui règle seulement ; le réglage se déplie dedans', () => {
		const data = { role: { id: 7, nom: 'Référent pharmacie', icone: 'croix', demandes: { etapes: [{ id: 'ea', nom: 'Commandée' }], derniere: 'Livrée' } }, titulaire: true, sansTitulaire: false, enCours: [], terminees: [], regler: 'etapes' };
		const vide = propre(render(Role as any, { props: { data, form: null } }).body);
		const carte = vide.match(/<section[^>]*class="etapes[^"]*"[\s\S]*?<\/section>/)![0];
		expect(carte).toMatch(/<h2[^>]*>Étapes de vos demandes<\/h2>/);
		expect(carte).toContain('Demandée, Prise en compte, Commandée, Livrée');
		expect(carte).toMatch(/<details class="plus"><summary>Régler les étapes<\/summary>[\s\S]*?action="\?\/demandes"/);
		// En tête : avant l'écran vide, puis avant la liste.
		expect(vide.indexOf('Étapes de vos demandes')).toBeLessThan(vide.indexOf('Aucune demande'));
		const avec = propre(render(Role as any, { props: { data: { ...data, enCours: [ligne()] }, form: null } }).body);
		expect(avec.indexOf('Étapes de vos demandes')).toBeLessThan(avec.indexOf('En cours'));
		expect(propre(render(Role as any, { props: { data: { ...data, regler: null }, form: null } }).body)).not.toContain('Étapes de vos demandes');
		const apres = propre(render(Role as any, { props: { data, form: { cible: 'demandes', succes: 'Étapes enregistrées.' } } }).body);
		expect(apres).toMatch(/<details class="plus" open[^>]*><summary>Régler les étapes/);
	});
});

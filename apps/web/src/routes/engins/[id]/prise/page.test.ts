import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

// La page lit son adresse : `?participants` ouvre le panneau.
const adresse = vi.hoisted(() => ({ url: new URL('http://x/engins/1/prise') }));
vi.mock('$app/state', () => ({ page: adresse }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
const { default: Page } = await import('./+page.svelte');

const zones = [
	{ ref: 1, nom: 'Cabine', elements: [{ ref: 10, libelle: 'Essai radio', quantite: null }] },
	{ ref: 2, nom: 'Coffres', elements: [{ ref: 20, libelle: 'Lances', quantite: 2 }] }
];
const data = (saisie: Record<string, unknown> = {}) => ({
	engin: { id: 1, nom: 'FPT', type: 'FPT', typeId: 2, immatriculation: null, situation: 'centre', provenance: null, etat: 'disponible', partiLe: null },
	releve: { debut: '2026-10-30T18:00', equipe: { id: 4, nom: 'Équipe 4', couleur: '#000000' } },
	peutFaire: true,
	prise: { id: 7, etat: 'en_cours', commenceePar: 'Thomas Agent', commenceeLe: '2026-10-30T18:05', modifieePar: 'Thomas Agent', modifieeLe: '2026-10-30T18:05', valideeLe: null, saisie: { zones: [], ecarts: {}, retrouves: [], participants: [1, 2, 9], ...saisie }, traces: { participants: null, rouverte: null, demande: null } },
	zones,
	ouvertes: [],
	propres: [],
	gestes: { participants: false, rouvrir: false, demander: false },
	agents: [
		{ id: 2, nom: 'Mila Clément', astreinte: true },
		{ id: 3, nom: 'Adam Fournier', astreinte: true },
		{ id: 1, nom: 'Thomas Agent', astreinte: false },
		{ id: 9, nom: 'Élodie Chef-de-Garde', astreinte: false },
		{ id: 5, nom: 'Noah André', astreinte: false }
	],
	moi: 1
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (d: unknown, form: unknown = null) => render(Page as any, { props: { data: d, form } }).body;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tete = (d: unknown) => render(Page as any, { props: { data: d, form: null } }).head;

const zonesLongues = [
	{ ref: 1, nom: 'Cabine', elements: [{ ref: 10, libelle: 'Essai radio', quantite: null }] },
	...Array.from({ length: 6 }, (_, i) => ({ ref: i + 2, nom: `Coffre arrière droit numéro ${i + 2} sous le marchepied`, elements: [] }))
];
const lecture = (autres: Record<string, unknown> = {}) => ({ ...data(), prise: null, ...autres });
const avant = (texte: string, apres: string, page: string) => page.indexOf(texte) >= 0 && page.indexOf(texte) < page.indexOf(apres);

describe('/engins/[id]/prise', () => {
	it('toutes les zones au sélecteur, seule celle à voir dessous ; « Tout est complet » après sa liste', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data());
		expect(page).toMatch(/<nav[^>]*aria-label="Zones de l’engin"/);
		expect(page).toMatch(/href="\?zone=1#titre-zone"[^>]*aria-current="true"[\s\S]*?Cabine[\s\S]*?1 à voir/);
		expect(page).toMatch(/href="\?zone=2#titre-zone"[\s\S]*?Coffres[\s\S]*?1 à voir/);
		expect(page).toContain('Essai radio');
		expect(page).not.toContain('Lances');
		expect(avant('Essai radio', 'Tout est complet', page)).toBe(true);
	});

	it('une ligne : le lien « Écart » nommé pour les lecteurs d’écran, la quantité attendue visible', () => {
		adresse.url = new URL('http://x/engins/1/prise?zone=2');
		const page = html(data());
		expect(page).toContain('Lances');
		expect(page).toMatch(/2<span class="masque[^"]*"> attendus/);
		expect(page).toMatch(/<summary[^>]*>Écart<span class="masque[^"]*"> : Lances<\/span><\/summary>/);
		expect(page).not.toContain('Signaler un écart');
	});

	it('plus de quatre zones aux noms longs : toutes listées', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html({ ...data(), zones: zonesLongues });
		for (const z of zonesLongues) expect(page).toContain(`href="?zone=${z.ref}#titre-zone"`);
		expect(page).toContain('Coffre arrière droit numéro 7 sous le marchepied');
	});

	it('après « Tout est complet » : la zone suivante à voir, et la possibilité d’annuler', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data({ zones: [1] }), { cible: 'zone:1', zone: null, zoneFaite: 1, succes: 'Zone complète.' });
		expect(page).toMatch(/href="\?zone=2#titre-zone"[^>]*aria-current="true"/);
		expect(page).toContain('Lances');
		expect(page).not.toContain('Essai radio');
		expect(page).toMatch(/name="zone" value="1"[\s\S]*?Cabine, tout est complet[\s\S]*?name="vue" value="0"[\s\S]*?Annuler/);
		expect(page).toMatch(/href="\?zone=1#titre-zone"[^>]*class="vue[\s\S]*?Tout est complet/);
	});

	it('une zone déjà complète se revoit : « Complet », et le geste s’annule', () => {
		adresse.url = new URL('http://x/engins/1/prise?zone=1');
		const page = html(data({ zones: [1] }));
		expect(page).toMatch(/Essai radio[\s\S]*?Tout est complet<\/p>[\s\S]*?Revoir la zone/);
	});

	it('un refus ou un écart : on reste sur la zone touchée', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data(), { cible: 'zone:2', zone: 2, message: 'Prise changée entre-temps.' });
		expect(page).toContain('Lances');
		expect(page).toContain('Prise changée entre-temps.');
	});

	it('« Valider la prise » : toujours en bas, désactivé avec sa raison tant qu’il reste des zones', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const reste = html(data({ zones: [1] }));
		expect(reste).toMatch(/<p id="reste-zones"[^>]*>Encore 1 zone à voir avant de valider\.<\/p>/);
		// Annoncé avec sa raison, et atteignable au clavier : pas « disabled », hors de tout formulaire.
		expect(reste).toMatch(/<button type="button"[^>]*aria-disabled="true"[^>]*aria-describedby="reste-zones"[^>]*>Valider la prise<\/button>/);
		expect(reste).not.toContain('action="?/valider"');
		expect(avant('aria-label="Zones de l’engin"', 'reste-zones', reste)).toBe(true);
		expect(avant('reste-zones', 'Abandonner la prise', reste)).toBe(true);
		expect(html(data())).toContain('Encore 2 zones à voir avant de valider.');
		expect(html({ ...data(), peutFaire: false })).not.toContain('Valider la prise');

		const pret = html(data({ zones: [1, 2] }));
		expect(pret).not.toContain('reste-zones');
		expect(pret).not.toContain('aria-disabled');
		expect(pret).toMatch(/action="\?\/valider"[\s\S]*?<button type="submit"[^>]*>(<!---->)?Valider la prise/);
		expect(avant('aria-label="Zones de l’engin"', 'id="titre-valider"', pret)).toBe(true);
		expect(avant('id="titre-valider"', 'Abandonner la prise', pret)).toBe(true);
	});

	it('avant de commencer : les zones se lisent, le premier geste part sans prise ; plus de bouton « Commencer »', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(lecture());
		expect(page).toContain('Essai radio');
		expect(page).toMatch(/name="prise" value=""/);
		expect(page).toContain('Tout est complet');
		expect(page).toContain('Le premier geste commence la prise');
		expect(page).not.toContain('Commencer la prise');
		// Le bandeau est déjà là : il dit ce qu'il reste à voir.
		expect(page).toContain('Encore 2 zones à voir avant de valider.');
		expect(page).not.toContain('action="?/valider"');
		expect(page).not.toContain('Participants :');
		expect(page).not.toContain('Abandonner');
	});

	it('une fiche sans zone : « Commencer la prise » reste le seul moyen de la faire', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		expect(html(lecture({ zones: [] }))).toContain('Commencer la prise');
	});

	it('lecture seule, brouillon ou non : les zones et les écarts se lisent, aucun geste', () => {
		const ouverte = { id: 3, ref: 10, zone: 'Cabine', libelle: 'Essai radio', genre: 'abime', manque: null, note: null, photo: null, signaleeLe: '2026-10-23T18:30', signaleePar: 'Mila Clément', etape: 'signalee', motif: null, bloquante: false };
		for (const url of ['http://x/engins/1/prise', 'http://x/engins/1/prise?participants']) {
			adresse.url = new URL(url);
			for (const d of [lecture({ peutFaire: false, ouvertes: [ouverte] }), { ...data({ zones: [1, 2], ecarts: { '10': { genre: 'abime', manque: null, note: '', photo: null } } }), peutFaire: false, ouvertes: [ouverte] }]) {
				const page = html(d);
				expect(page).toContain('Essai radio');
				expect(page).not.toContain('<form');
				expect(page).not.toContain('<summary');
				expect(page).not.toMatch(/<button[^>]*>Tout est complet/);
				expect(page).not.toContain('<dialog');
				expect(page).not.toContain('Modifier');
				expect(page).toContain('Abîmé');
			}
		}
	});

	const commune = { genre: 'abime', manque: null, note: null, photo: null, signaleeLe: '2026-10-23T18:30', signaleePar: 'Mila Clément', etape: 'signalee', motif: null, bloquante: false };
	const surRadio = { ...commune, id: 3, ref: 10, zone: 'Cabine', libelle: 'Essai radio' };
	const horsFiche = { ...commune, id: 4, ref: null, zone: 'Autre', libelle: 'Phare avant' };

	it('avant de commencer : le compte des signalements de la fiche, ceux hors de la fiche listés, le sélecteur le dit', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(lecture({ ouvertes: [surRadio, horsFiche] }));
		expect(page).toContain('1 écart encore signalé sur cet engin, à voir dans sa zone.');
		expect(page).toMatch(/Signalé hors de la fiche[\s\S]*?Phare avant[\s\S]*?Signalé le/);
		expect(page).toContain('1 à voir, 1 signalé');
		expect(page).toContain('Oui, clore le signalement');
		expect(page).not.toContain('Aucun écart ouvert');
	});

	it('seulement hors de la fiche : pas de phrase qui renvoie à une zone', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(lecture({ ouvertes: [horsFiche] }));
		expect(page).not.toContain('à voir dans');
		expect(html(lecture({ ouvertes: [{ ...horsFiche, zone: '' }] }))).not.toMatch(/Phare avant[^<]*<span class="doux[^"]*">,/);
		expect(page).not.toContain('Aucun écart ouvert');
	});

	it('la prise commencée : les signalements hors de la fiche et le compte par zone restent', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html({ ...data(), ouvertes: [surRadio, horsFiche] });
		expect(page).toContain('Phare avant');
		expect(page).toContain('1 à voir, 1 signalé');
		// Retrouvé, il n'est plus compté.
		expect(html({ ...data({ retrouves: [3] }), ouvertes: [surRadio] })).not.toContain(', 1 signalé');
	});

	it('« Annuler » vient après le titre de la zone, où se pose le focus', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data({ zones: [1] }), { cible: 'zone:1', zone: null, zoneFaite: 1, succes: 'Zone complète.' });
		expect(page).toMatch(/id="titre-zone"[\s\S]*?Cabine, tout est complet[\s\S]*?Annuler[\s\S]*?Lances/);
	});

	it('les participants : une rangée en tête (« vous + 2 »), rappelés à la validation ; pas de liste à plat', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data());
		expect(page).toMatch(/href="\?participants"[\s\S]*?Participants :<\/span> <strong>vous \+ 2<\/strong>/);
		expect(html(data({ zones: [1, 2] }))).toMatch(/<p[^>]*>La prise sera à votre nom et à celui de Mila Clément et d’Élodie Chef-de-Garde\.<\/p>/);
		expect(page).not.toContain('name="participant"');
	});

	it('le bloc Valider : des phrases, puis « Modifier les participants » en bouton secondaire sur sa ligne, et « Abandonner la prise » sans points de suspension', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const pret = html(data({ zones: [1, 2] }));
		const bloc = pret.slice(pret.indexOf('id="valider"'), pret.indexOf('action="?/valider"'));
		expect(bloc).toContain('L’engin reste disponible. Seuls le référent engins et les chefs décident d’une indisponibilité.');
		expect(bloc).toMatch(/<\/p> <div[^>]*><a class="lien-secondaire[^"]*" href="\?participants"[^>]*>Modifier les participants<\/a><\/div>/);
		expect(bloc).not.toMatch(/:\s*(<[^>]+>)*\s*vous/);
		expect(html(data({ zones: [1, 2], participants: [1] }))).toMatch(/<p[^>]*>La prise sera à votre nom\.<\/p>/);
		expect(html(data({ zones: [1, 2], participants: [2, 9] }))).toMatch(/<p[^>]*>La prise sera au nom de Mila Clément et d’Élodie Chef-de-Garde\.<\/p>/);
		expect(pret).toMatch(/<summary[^>]*>Abandonner la prise<\/summary>/);
	});

	it('le panneau : l’équipe d’astreinte d’abord, une recherche, les cochés en pastilles ; sans JavaScript, tous les agents', () => {
		adresse.url = new URL('http://x/engins/1/prise?participants');
		const page = html(data());
		expect(page).toMatch(/<dialog[\s\S]*?Équipe 4[\s\S]*?Mila Clément[\s\S]*?Adam Fournier[\s\S]*?Chercher un agent[\s\S]*?Thomas Agent \(vous\)[\s\S]*?Noah André/);
		expect(page).toMatch(/value="2" checked/);
		expect(page).not.toMatch(/value="3" checked/);
		expect(page).not.toMatch(/<label class="pastille-choix" hidden/);
		expect(html(data(), { cible: 'participants', message: 'Un des participants n’est plus agent du centre.' })).toMatch(/<dialog[\s\S]*?role="alert">Un des participants/);
	});

	it('la plaque de l’engin : son nom en titre, la relève, le compte des zones vues ; participants et « Modifier » dessous', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data({ zones: [1] }));
		expect(page).toMatch(/<section class="plaque[^"]*"[\s\S]*?<div class="aplat[^"]*">[\s\S]*?<h1[^>]*><span class="masque">Prise de garde : <\/span>FPT<\/h1>[\s\S]*?Relève du ven\. 30 oct\., équipe 4[\s\S]*?class="compteur[^"]*"><span class="nombre[^"]*">1<span aria-hidden="true"> \/ <\/span><span class="masque"> sur <\/span>2<\/span> zones vues/);
		expect(page).toMatch(/<\/div>\s*(<!--[^>]*-->)?<div class="bande[^"]*">[\s\S]*?Participants :[\s\S]*?Modifier[\s\S]*?Commencée par/);
		// Avant le premier geste : la plaque, sans participants.
		const lu = html(lecture());
		expect(lu).toMatch(/class="compteur[^"]*"><span class="nombre[^"]*">0<span aria-hidden="true"> \/ /);
		expect(lu).not.toMatch(/class="bande[\s"]/);
	});

	it('les zones en tuiles : vue en vert avec la coche et « Tout est complet », sauf ses écarts écrits', () => {
		adresse.url = new URL('http://x/engins/1/prise?zone=2');
		const page = html(data({ zones: [1, 2], ecarts: { '20': { genre: 'manquant', manque: 1, note: '', photo: null } } }));
		expect(page).toMatch(/href="\?zone=1#titre-zone" class="vue[^"]*"[^>]*>[\s\S]*?<svg[\s\S]*?Tout est complet/);
		expect(page).toMatch(/href="\?zone=2#titre-zone" class="vue[^"]*" aria-current="true"[^>]*>[\s\S]*?Complet sauf 1 écart/);
	});

	it('l’état d’une zone : des virgules, jamais de point médian', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const ouverte = { id: 3, ref: 20, zone: 'Coffres', libelle: 'Lances', genre: 'abime', manque: null, note: null, photo: null, signaleeLe: '2026-10-23T18:30', signaleePar: 'Mila Clément', etape: 'signalee', motif: null, bloquante: false };
		const zones2 = [zones[0], { ...zones[1], elements: [...zones[1].elements, { ref: 21, libelle: 'Tricoises', quantite: null }] }];
		const page = html({ ...data({ ecarts: { '21': { genre: 'manquant', manque: null, note: '', photo: null } } }), zones: zones2, ouvertes: [ouverte] });
		expect(page).toContain('À finir, 1 écart, 1 signalé');
		expect(html({ ...data({ ecarts: { '21': { genre: 'manquant', manque: null, note: '', photo: null } } }), zones: zones2 })).toContain('À finir, 1 écart');
	});

	it('la zone choisie : titre en majuscules espacées avec son nombre d’éléments, la liste dans une seule carte', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const page = html(data());
		expect(page).toMatch(/<h2 id="titre-zone" class="titre-groupe[^"]*" tabindex="-1">Cabine(<!--[^>]*-->)? <span class="compte">1<span class="masque"> élément<\/span><\/span>(<!--[^>]*-->)?<\/h2>/);
		expect(page).toMatch(/<ul role="list" class="lignes elements[^"]*">/);
	});

	it('la prise faite : le bilan en virgules, pas en points', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const d = data();
		const page = html({ ...d, prise: { ...d.prise, etat: 'validee', valideeLe: '2026-10-30T19:00' } });
		expect(page).toContain('3 participants, 0 écart, 0 élément retrouvé');
	});

	it('la prise faite : la pastille dit qui l’a faite et quand, jamais « [object Object] »', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const d = data();
		const page = html({ ...d, prise: { ...d.prise, etat: 'validee', valideeLe: '2026-10-30T19:00' } });
		expect(page).not.toContain('[object Object]');
		expect(page).toMatch(/class="pastille[^"]*"[^>]*>(<!---->)?Prise faite par l’équipe 4, ven\. 19 h/);
	});

	describe('une prise validée, jusqu’à la relève suivante', () => {
		const validee = (gestes: Record<string, boolean>, traces: Record<string, unknown> = {}) => {
			const d = data({ zones: [1, 2] });
			return { ...d, gestes: { participants: false, rouvrir: false, demander: false, ...gestes }, prise: { ...d.prise, etat: 'validee', valideeLe: '2026-10-30T19:00', traces: { ...d.prise.traces, ...traces } } };
		};

		it('un participant : « Modifier » les participants sous la plaque, « Demander la réouverture » avec un motif ; pas de « Rouvrir »', () => {
			adresse.url = new URL('http://x/engins/1/prise');
			const page = html(validee({ participants: true, demander: true }));
			expect(page).toMatch(/<div class="bande[^"]*">[\s\S]*?href="\?participants"[\s\S]*?Participants :<\/span> <strong>vous \+ 2<\/strong>[\s\S]*?Modifier/);
			expect(page).toContain('Un chef sera prévenu.');
			expect(page).not.toContain('lui seul');
			expect(page).toMatch(/<details class="plus[^"]*"[^>]*><summary[^>]*>Demander la réouverture<\/summary>[\s\S]*?action="\?\/demanderReouverture"[\s\S]*?name="motif"[\s\S]*?Envoyer la demande/);
			expect(page).not.toContain('?/rouvrir');
			expect(page).not.toContain('Commencée par');
		});

		it('un chef : « Rouvrir la prise » sous « Plus », en contour rouge, avec un motif et « Je confirme » ; pas de demande', () => {
			adresse.url = new URL('http://x/engins/1/prise');
			const page = html(validee({ participants: true, rouvrir: true }));
			expect(page).toMatch(/<details class="plus[^"]*"[^>]*><summary[^>]*>Plus<\/summary>[\s\S]*?action="\?\/rouvrir"[\s\S]*?name="motif"[\s\S]*?name="confirmation" value="oui"[\s\S]*?Je confirme[\s\S]*?class="grave[^"]*"[^>]*>(<!---->)?Rouvrir la prise(<!---->)?<\/button>/);
			expect(page).not.toContain('Demander la réouverture');
			// Le motif tapé revient après un refus, avec son message.
			expect(html(validee({ rouvrir: true }), { cible: 'rouvrir', motif: 'Radio', message: 'Cochez « Je confirme » pour rouvrir la prise.' })).toMatch(/<details class="plus[^"]*" open[\s\S]*?>Radio<\/textarea>[\s\S]*?role="alert">Cochez « Je confirme »/);
		});

		it('ni participant ni chef : les participants se lisent, aucun geste', () => {
			adresse.url = new URL('http://x/engins/1/prise?participants');
			const page = html(validee({}));
			expect(page).toMatch(/<p class="participants[^"]*">[\s\S]*?vous \+ 2/);
			expect(page).not.toContain('href="?participants"');
			expect(page).not.toContain('<dialog');
			expect(page).not.toContain('<details class="plus');
		});

		it('le panneau des participants enregistre sur la prise validée', () => {
			adresse.url = new URL('http://x/engins/1/prise?participants');
			const page = html(validee({ participants: true }));
			expect(page).toMatch(/<dialog[\s\S]*?action="\?\/participants"[\s\S]*?value="2" checked/);
			expect(page).not.toMatch(/<dialog[\s\S]*?name="quoi" value="participants"/);
		});

		it('la trace : participants modifiés, réouverture et demande, qui, quand, pourquoi', () => {
			adresse.url = new URL('http://x/engins/1/prise');
			const page = html(validee({}, { participants: { par: 'Mila Clément', le: '2026-10-30T20:00' }, rouverte: { par: 'Élodie Chef-de-Garde', le: '2026-10-30T19:30', motif: 'Radio oubliée' }, demande: { par: 'Adam Fournier', le: '2026-10-30T20:05', motif: 'Lances' } }));
			expect(page).toContain('Rouverte par Élodie Chef-de-Garde, ven. 19 h 30. Motif : Radio oubliée.');
			expect(page).toContain('Participants modifiés par Mila Clément, ven. 20 h.');
			expect(page).toContain('Réouverture demandée par Adam Fournier, ven. 20 h 05. Motif : Lances.');
			expect(page).not.toContain('[object Object]');
		});
	});

	describe('une prise rouverte', () => {
		const rouverte = (propres: unknown[] = []) => {
			const d = data({ zones: [1], ecarts: { '10': { genre: 'abime', manque: null, note: '', photo: null } } });
			return { ...d, propres, prise: { ...d.prise, traces: { ...d.prise.traces, rouverte: { par: 'Élodie Chef-de-Garde', le: '2026-10-30T19:30', motif: 'Radio oubliée' } } } };
		};

		it('la trace en tête ; les écarts se modifient ; pas d’abandon', () => {
			adresse.url = new URL('http://x/engins/1/prise?zone=1');
			const page = html(rouverte([{ id: 4, ref: 10, suivie: false, suiviePar: null }]));
			expect(avant('Rouverte par Élodie Chef-de-Garde, ven. 19 h 30. Motif : Radio oubliée.', 'Zones de l’engin', page)).toBe(true);
			expect(page).toMatch(/<summary[^>]*>Modifier<span class="masque[^"]*"> : Essai radio/);
			expect(page).toContain('Retirer l’écart');
			expect(page).not.toContain('Abandonner la prise');
			expect(page).not.toContain('Déjà suivie');
		});

		it('un écart dont l’anomalie est déjà suivie : l’écran prévient qui la close', () => {
			adresse.url = new URL('http://x/engins/1/prise?zone=1');
			expect(html(rouverte([{ id: 4, ref: 10, suivie: true, suiviePar: 'Rémi Fictif' }]))).toContain('Déjà suivie par Rémi Fictif, qui la clora. Changer ou retirer l’écart ne la modifie pas.');
			expect(html(rouverte([{ id: 4, ref: 10, suivie: true, suiviePar: null }]))).toContain('Déjà suivie, à clore depuis son suivi. Changer ou retirer l’écart ne la modifie pas.');
		});

		it('à la validation : les anomalies sans suivi annulées, au pluriel juste', () => {
			adresse.url = new URL('http://x/engins/1/prise');
			const d = rouverte([{ id: 4, ref: 20, suivie: false, suiviePar: null }, { id: 5, ref: 21, suivie: false, suiviePar: null }]);
			const page = html({ ...d, prise: { ...d.prise, saisie: { ...d.prise.saisie, zones: [1, 2] } } });
			expect(page).toContain('2 anomalies sans suivi seront annulées, leur écart retiré.');
			expect(page).toContain('1 nouvel écart deviendra une anomalie suivie.');
		});

		it('une anomalie de la prise déjà close : ni nouvel écart, ni annulation, ni avertissement', () => {
			adresse.url = new URL('http://x/engins/1/prise?zone=1');
			const d = rouverte([{ id: 4, ref: 10, suivie: true, suiviePar: null, close: true }]);
			const page = html({ ...d, prise: { ...d.prise, saisie: { ...d.prise.saisie, zones: [1, 2] } } });
			expect(page).toContain('Aucun nouvel écart.');
			expect(page).not.toContain('sera annulée');
			expect(page).not.toContain('Déjà suivie');
		});

		it('après « Rouvrir la prise » : annoncé aux lecteurs d’écran', () => {
			adresse.url = new URL('http://x/engins/1/prise?rouverte');
			expect(html(rouverte())).toMatch(/<div role="status" class="masque[^"]*">Prise rouverte\.<\/div>/);
			adresse.url = new URL('http://x/engins/1/prise');
			expect(html(rouverte())).toMatch(/<div role="status" class="masque[^"]*"><\/div>/);
		});
	});

	it('le titre de l’onglet, sans point médian', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		expect(tete(data())).toContain('<title>Prise de garde du FPT, Gyro Caserne</title>');
	});

	it('les photos d’écart, signalé ou noté pendant la prise, s’ouvrent en grand dans la visionneuse', () => {
		adresse.url = new URL('http://x/engins/1/prise');
		const ouverte = { ...surRadio, photo: 8 };
		expect(html(lecture({ ouvertes: [ouverte] }))).toMatch(/<a class="vignette[^"]*" href="\/engins\/photo\/8" data-visionneuse=""><img/);
		adresse.url = new URL('http://x/engins/1/prise?zone=1');
		const page = html(data({ ecarts: { '10': { genre: 'abime', manque: null, note: '', photo: 6 } } }));
		expect(page).toMatch(/<a class="vignette[^"]*" href="\/engins\/photo\/6" data-visionneuse=""><img/);
	});
});

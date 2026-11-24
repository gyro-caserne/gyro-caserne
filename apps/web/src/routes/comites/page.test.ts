import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { attribution, comite, personne, profil, responsabilite } from '@gyro-caserne/socle';
import { preparer } from '../echanges/de-test.ts';

// La page lit son adresse : `?mandat=` ouvre le volet d'une personne, `?nommer=` le volet « Nommer ».
const adresse = vi.hoisted(() => ({ url: new URL('http://x/comites') }));
vi.mock('$app/state', () => ({ page: adresse }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
const { default: Page } = await import('./+page.svelte');
const { load } = await import('./+page.server');

/* eslint-disable @typescript-eslint/no-explicit-any */
const html = (data: Record<string, unknown>, form: unknown = null, ici = '/comites') => {
	adresse.url = new URL(`http://x${ici}`);
	const { head, body } = render(Page as any, { props: { data: { ...vue, peutNominations: false, peutReglages: false, gestes: null, aujourdhui: '2026-11-24', fiches: false, ...data }, form } });
	return (head + body).replace(/<!--[^>]*-->/g, '').replace(/ ?svelte-[a-z0-9]+/g, '').replace(/ class=""/g, '');
};
const parent = (peutNominations = false) => async () => ({ peutNominations });

const vue = {
	comites: [
		{
			id: 2,
			nom: 'Amicale',
			icone: 'coeur',
			mur: true,
			membres: [
				{ id: 5, nom: 'Bruno Petit', grade: 'Sergent', roles: ['Rapporteur'], ecrire: true },
				{ id: 4, nom: 'Alice Bernard', grade: null, roles: ['Membre', 'Trésorière'], ecrire: false }
			],
			ressources: [{ id: 7, nom: 'Barnum', icone: 'outil' }]
		},
		{ id: 1, nom: 'Comité du centre', icone: 'etoile', mur: false, membres: [], ressources: [] }
	],
	commandement: [
		{ id: 1, nom: 'Chef de centre', icone: 'etoile', titulaires: [{ id: 1, nom: 'Claire Martin', grade: 'Lieutenant', ecrire: true }] },
		{ id: 2, nom: 'Chef de centre adjoint', icone: 'etoile', titulaires: [] }
	],
	equipes: [
		{
			id: 3,
			nom: 'Chef de garde',
			systeme: 'chef_equipe',
			nature: 'fonction',
			parEquipe: [
				{ equipeId: 1, equipe: 'Équipe 1', titulaires: [{ id: 5, nom: 'Bruno Petit', grade: 'Sergent', ecrire: true }] },
				{ equipeId: 2, equipe: 'Équipe 2', titulaires: [] }
			]
		}
	],
	fonctions: [{ id: 9, nom: 'Référent technique', icone: 'cle', titulaires: [] }],
	missions: [
		{
			id: 6,
			nom: 'Référent pharmacie',
			icone: 'croix',
			titulaires: [
				{ id: 4, nom: 'Alice Bernard', grade: null, ecrire: false },
				{ id: 8, nom: 'Denis Roux', grade: 'Grade maison', ecrire: true }
			]
		},
		{ id: 7, nom: 'Référent engins', icone: 'camion', titulaires: [] }
	]
};

describe('/comites', () => {
	it('demande la connexion ; refusée au compte de la réserve citoyenne', async () => {
		await expect((load as any)({ locals: { acteur: null }, parent: parent() })).rejects.toMatchObject({ status: 303, location: '/connexion' });
		const { base } = await preparer();
		const [ext] = await base.select().from(profil).where(eq(profil.typePersonne, 'exterieur'));
		const [p] = await base.insert(personne).values({ email: 'reserve@exemple.fr', prenom: 'Réserve', nom: 'Citoyenne', profilId: ext!.id }).returning();
		await expect((load as any)({ locals: { base, acteur: { type: 'personne', id: p!.id } }, parent: parent() })).rejects.toMatchObject({ status: 403 });
	});

	it('ouverte à tout agent : les comités et les rôles du centre', async () => {
		const { base, alice } = await preparer();
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		const [membre] = await base.select().from(responsabilite).where(eq(responsabilite.nom, 'Membre de comité'));
		await base.insert(attribution).values({ personneId: alice.id, responsabiliteId: membre!.id, perimetreType: 'comite', perimetreId: amicale!.id, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		const data = await (load as any)({ locals: { base, acteur: alice }, parent: parent() });
		expect(data.comites.find((c: { nom: string }) => c.nom === 'Amicale')).toMatchObject({ mur: true, membres: [{ nom: 'Alice Test', roles: ['Membre'] }] });
		expect(data.commandement[0]).toMatchObject({ nom: 'Chef de centre', titulaires: [{ nom: 'Chef Test', ecrire: true }] });
	});

	it('un titre, puis un groupe replié par sorte, avec sa ligne de résumé ; une carte par comité', () => {
		const page = html({});
		expect(page).toMatch(/<h1[^>]*>Qui fait quoi<\/h1>/);
		expect(page).toContain('<title>Qui fait quoi</title>');
		for (const titre of ['Comités', 'Chef de centre et adjoint', 'Chefs de garde', 'Autres fonctions', 'Missions']) expect(page).toMatch(new RegExp(`<details class="repli groupe[^"]*"[^>]*><summary[^>]*><span[^>]*><h2[^>]*>${titre}</h2>`));
		// Tous repliés tant qu'on ne vise rien.
		expect(page).not.toMatch(/<details[^>]*open/);
		expect(page).toMatch(/>Comités<\/h2><span[^>]*>2 comités<\/span>/);
		expect(page).toMatch(/>Chefs de garde<\/h2><span[^>]*>2 équipes<\/span>/);
		expect(page).toMatch(/>Missions<\/h2><span[^>]*>2 rôles<\/span>/);
		for (const titre of ['Amicale', 'Comité du centre']) expect(page).toMatch(new RegExp(`<h3[^>]*>${titre}`));
		// Une carte par groupe, pas une par ligne.
		expect(page.match(/<ul role="list" class="lignes"/g)).toHaveLength(6);
		// Un agent : ni « À pourvoir », ni geste.
		expect(page).not.toContain('À pourvoir');
		expect(page).not.toContain('?mandat=');
		expect(page).not.toContain('?nommer=');
	});

	it('à l’ordinateur, une seule colonne à la largeur d’une liste, centrée : les lignes ne s’étirent pas', () => {
		const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');
		expect(source).toMatch(/\.page \{[^}]*max-width: var\(--largeur-liste\);[^}]*margin-inline: auto;/);
		expect(source).not.toContain('grid-template-columns');
	});

	it('les fonctions (chef de centre et adjoint, chefs de garde, autres fonctions) puis les missions', () => {
		const page = html({});
		expect(page).toMatch(/Chef de centre et adjoint[\s\S]*?Chefs de garde[\s\S]*?Autres fonctions[\s\S]*?Référent technique[\s\S]*?<h2[^>]*>Missions<\/h2>[\s\S]*?Référent pharmacie/);
		// Un rôle d'équipe de nature mission se range après les missions.
		const avecMission = html({ equipes: [...vue.equipes, { id: 10, nom: 'Référent sport', systeme: null, nature: 'mission', parEquipe: [{ equipeId: 1, equipe: 'Équipe 1', titulaires: [] }] }] });
		expect(avecMission).toMatch(/<h2[^>]*>Missions<\/h2>[\s\S]*?<h2[^>]*>Référent sport/);
		// Une partie vide n'apparaît pas.
		expect(html({ missions: [] })).not.toMatch(/<h2[^>]*>Missions/);
		expect(html({ fonctions: [] })).not.toContain('Autres fonctions');
	});

	it('un comité : ses membres et leur rôle, son mur, son matériel', () => {
		const page = html({});
		expect(page).toMatch(/Bruno Petit[\s\S]*?Rapporteur[\s\S]*?Alice Bernard[\s\S]*?Membre, Trésorière/);
		expect(page).toMatch(/<a[^>]*href="\/echanges\/comite:2"[^>]*>[\s\S]*?Le mur de l’Amicale/);
		expect(page).toMatch(/<a[^>]*href="\/reservations\/7"[^>]*>[\s\S]*?Barnum/);
	});

	it('une carte de comité en trois parties : « Membres », le lien du mur, « À réserver » ; pas d’intertitre pour une partie vide', () => {
		const page = html({});
		const carte = (nom: string) => page.slice(page.indexOf(`>${nom}`), page.indexOf('</ul>', page.indexOf(`>${nom}`)));
		expect(carte('Amicale')).toMatch(/<h4[^>]*>Membres<\/h4>[\s\S]*?Bruno Petit[\s\S]*?href="\/echanges\/comite:2"[\s\S]*?<h4[^>]*>À réserver<\/h4>[\s\S]*?Barnum/);
		expect(carte('Comité du centre')).not.toContain('<h4');
	});

	it('pas de lien vers un mur qu’on ne lit pas ; un comité vide le dit', () => {
		const page = html({});
		expect(page).not.toContain('href="/echanges/comite:1"');
		expect(page).toContain('Aucun membre pour l’instant');
	});

	it('sans comité en cours : la section le dit', () => {
		expect(html({ comites: [] })).toMatch(/<h2[^>]*>Comités<\/h2>[\s\S]*?Aucun comité pour l’instant/);
	});

	it('chaque rôle et ses titulaires ; « Personne pour l’instant » s’il est vide ; les chefs de garde par équipe', () => {
		const page = html({});
		expect(page).toMatch(/Chef de centre(<!--[^>]*-->)*<\/span>[\s\S]*?Claire Martin/);
		expect(page).toMatch(/Chef de centre adjoint(<!--[^>]*-->)*<\/span>[\s\S]*?Personne pour l’instant/);
		expect(page).toMatch(/Équipe 1(<!--[^>]*-->)*<\/span>[\s\S]*?Bruno Petit/);
		expect(page).toMatch(/Équipe 2(<!--[^>]*-->)*<\/span>[\s\S]*?Personne pour l’instant/);
		expect(page).toMatch(/Référent pharmacie(<!--[^>]*-->)*<\/span>[\s\S]*?Alice Bernard(<!--[^>]*-->)*, (<!--[^>]*-->)*Denis Roux/);
		expect(page).toMatch(/Référent engins(<!--[^>]*-->)*<\/span>[\s\S]*?Personne pour l’instant/);
		// Ni droits ni lien vers une fiche réservée aux gestionnaires.
		expect(page).not.toContain('href="/agents/');
		expect(page).not.toContain('GERER_');
	});

	it('« Écrire » à côté de chaque titulaire et de chaque membre à qui l’on peut écrire, par l’entrée de la messagerie', () => {
		const page = html({});
		const ecrire = (id: number, nom: string) => new RegExp(`<a[^>]*href="/echanges/messages/a/${id}"[^>]*>Écrire<span class="masque"> à ${nom}</span></a>`);
		expect(page).toMatch(ecrire(5, 'Bruno Petit'));
		expect(page).toMatch(ecrire(1, 'Claire Martin'));
		// Plusieurs titulaires : le nom se lit sur le lien.
		expect(page).toMatch(/<a[^>]*href="\/echanges\/messages\/a\/8"[^>]*>Écrire à Denis Roux<\/a>/);
		// Ni à soi-même, ni à qui n'a pas la messagerie.
		expect(page).not.toContain('/echanges/messages/a/4"');
		// Bruno : comme membre de l'Amicale et comme chef de garde.
		expect(page.match(/\/echanges\/messages\/a\/5"/g)).toHaveLength(2);
	});

	it('l’insigne du grade à côté de chaque nom, nommé par le grade ; rien sans grade ou pour un grade sans insigne', () => {
		const page = html({});
		expect(page).toMatch(/Bruno Petit(<!--[^>]*-->)*<svg[^>]*role="img"[^>]*aria-label="Sergent"/);
		expect(page).toMatch(/Claire Martin(<!--[^>]*-->)*<svg[^>]*aria-label="Lieutenant"/);
		expect(page).not.toMatch(/Alice Bernard(<!--[^>]*-->)*<svg/);
		expect(page).not.toMatch(/Denis Roux(<!--[^>]*-->)*<svg/);
	});

	it('« Régler les rôles et les comités » mène aux réglages, pour qui peut régler', () => {
		expect(html({})).not.toContain('href="/reglages"');
		expect(html({ peutNominations: true })).not.toContain('href="/reglages"');
		expect(html({ peutReglages: true })).toMatch(/<a class="lien-secondaire" href="\/reglages">Régler les rôles et les comités<\/a>/);
		expect(html({ peutReglages: true, peutNominations: true })).not.toContain('/nominations');
		expect(html({ peutReglages: true })).not.toContain('>Gérer');
	});

	it('« Demander » sur la ligne d’un rôle qui reçoit des demandes, pour un agent ; jamais pour le super administrateur', () => {
		const missions = [{ id: 6, nom: 'Référent pharmacie', icone: 'croix', titulaires: [{ id: 8, nom: 'Denis Roux', grade: null, ecrire: true }], demandes: true }, { id: 11, nom: 'Référent sport', icone: 'sport', titulaires: [], demandes: false }];
		const page = html({ missions, peutDemander: true });
		expect(page).toContain('href="/demandes?role=6"');
		expect(page).toContain('au rôle Référent pharmacie');
		expect(page).not.toContain('href="/demandes?role=11"');
		expect(html({ missions, peutDemander: false })).not.toContain('/demandes?role=');
	});

	describe('pour qui peut nommer', () => {
		const mandat = (id: number, debut = '2026-01-01') => ({ id, debut, fin: null });
		const chef = {
			...vue,
			commandement: [vue.commandement[0], { ...vue.commandement[1], nommer: { aPourvoir: true } }],
			equipes: [
				{
					...vue.equipes[0],
					parEquipe: [
						{ equipeId: 1, equipe: 'Équipe 1', titulaires: [{ id: 5, nom: 'Bruno Petit', grade: 'Sergent', ecrire: true, mandat: mandat(31) }], nommer: { aPourvoir: false } },
						{ equipeId: 2, equipe: 'Équipe 2', titulaires: [], nommer: { aPourvoir: true } }
					]
				}
			],
			missions: [vue.missions[0], { ...vue.missions[1], nommer: { aPourvoir: false } }],
			comites: [{ ...vue.comites[0], postes: [{ id: 12, nom: 'Rapporteur', nature: 'mission', titulaires: [{ id: 5, nom: 'Bruno Petit', grade: 'Sergent', ecrire: true, mandat: mandat(40, '2026-12-10') }], nommer: { aPourvoir: false } }] }, vue.comites[1]],
			gestes: {
				agents: [
					{ id: 4, nom: 'Alice Bernard', equipeId: 1, equipe: 'Équipe 1' },
					{ id: 9, nom: 'Zoé Garde', equipeId: 2, equipe: 'Équipe 2' },
					{ id: 5, nom: 'Bruno Petit', equipeId: 1, equipe: 'Équipe 1' }
				]
			},
			peutNominations: true,
			fiches: true
		};

		it('« À pourvoir » en tête, chaque ligne avec « Nommer » ; seulement ce qu’il peut nommer', () => {
			const page = html(chef);
			expect(page.indexOf('À pourvoir')).toBeLessThan(page.indexOf('>Comités</h2>'));
			const tete = page.slice(page.indexOf('>À pourvoir'), page.indexOf('</ul>', page.indexOf('>À pourvoir')));
			expect(tete).toMatch(/Chef de centre adjoint[\s\S]*?<a[^>]*href="\?nommer=2-centre"[^>]*>Nommer<span class="masque"> \(Chef de centre adjoint\)<\/span>/);
			expect(tete).toMatch(/Chef de garde[\s\S]*?Équipe 2[\s\S]*?href="\?nommer=3-2"/);
			// Une mission vide ni le chef de centre ne sont à pourvoir.
			expect(tete).not.toContain('Référent engins');
			expect(tete).not.toContain('nommer=1-centre');
		});

		it('la ligne d’un titulaire : son nom et une flèche, toute la ligne ouvre son volet ; un mandat à venir le dit', () => {
			const page = html(chef);
			expect(page).toMatch(/<a class="rangee[^"]*" href="\?mandat=31"[^>]*>[\s\S]*?Bruno Petit[\s\S]*?Équipe 1[\s\S]*?class="chevron"/);
			expect(page).toMatch(/href="\?mandat=40"[\s\S]*?Rapporteur, à partir du 10 déc\. 2026/);
			// Une mission garde « Nommer » sous ses titulaires ; le chef de centre, qu'il ne nomme pas, reste lu.
			expect(page).toMatch(/Référent engins[\s\S]*?href="\?nommer=7-centre"/);
			expect(page).toMatch(/Chef de centre(<!--[^>]*-->)*<\/span>[\s\S]*?Claire Martin/);
			expect(page).not.toContain('?mandat=undefined');
		});

		it('le volet de la personne : son rôle et depuis quand, puis des gestes visibles, sans « Plus »', () => {
			const page = html(chef, null, '/comites?mandat=31');
			expect(page).toMatch(/<dialog class="panneau[^"]*" open[\s\S]*?<h2[^>]*>Bruno Petit<\/h2>/);
			const volet = page.slice(page.indexOf('<dialog'));
			expect(volet).toContain('Chef de garde, Équipe 1');
			expect(volet).toContain('Depuis le 1 janv. 2026');
			expect(volet).not.toContain('<details');
			expect(volet).not.toContain('>Plus<');
			expect(volet).toMatch(/<a class="lien-secondaire" href="\/agents\/5">Voir sa fiche<\/a>/);
			expect(volet).toMatch(/href="\/echanges\/messages\/a\/5">Écrire/);
			// Sans JavaScript (le rendu du serveur), les deux formulaires sont dépliés.
			expect(volet).toMatch(/<form id="remplacer-31" method="POST" action="\?\/remplacer"[^>]*>[\s\S]*?name="attributionId" value="31"[\s\S]*?>Confirmer le remplacement<\/button>/);
			expect(volet).not.toMatch(/<form id="remplacer-31"[^>]*hidden/);
			expect(volet).toContain('Le mandat de Bruno Petit finira la veille.');
			expect(volet).not.toMatch(/<option value="5"/);
			expect(volet).toMatch(/<option value="4"[^>]*>Alice Bernard \(Équipe 1\)[\s\S]*?<option value="9"/);
			expect(volet).toMatch(/<form id="finir-31" method="POST" action="\?\/finir"[\s\S]*?name="confirmation"[\s\S]*?class="grave"[^>]*>Confirmer la fin du mandat<\/button>/);
			// Le groupe de la ligne visée s'ouvre.
			expect(page).toMatch(/<details class="repli groupe[^"]*" open[^>]*><summary[^>]*><span[^>]*><h2[^>]*>Chefs de garde/);
		});

		it('le volet d’un mandat à venir propose d’annuler la nomination, sans remplacer', () => {
			const volet = html(chef, null, '/comites?mandat=40');
			expect(volet).toContain('À partir du 10 déc. 2026');
			expect(volet).toMatch(/action="\?\/terminer"[\s\S]*?>Confirmer l’annulation<\/button>/);
			expect(volet).not.toContain('action="?/finir"');
			expect(volet).not.toContain('action="?/remplacer"');
		});

		it('le volet « Nommer » : le poste, les agents de l’équipe d’abord, la date de début', () => {
			const page = html(chef, null, '/comites?nommer=3-2');
			const volet = page.slice(page.indexOf('<dialog'));
			expect(volet).toMatch(/<h2[^>]*>Nommer<\/h2>/);
			expect(volet).toContain('Chef de garde, Équipe 2');
			expect(volet).toMatch(/action="\?\/nommer"[\s\S]*?name="responsabiliteId" value="3"[\s\S]*?name="perimetre" value="2"/);
			expect(volet).toMatch(/<option value="9"[^>]*>Zoé Garde \(Équipe 2\)[\s\S]*?<option value="4"/);
			expect(volet).toMatch(/name="debut"[^>]*value="2026-11-24"/);
			// Un poste qu'il ne peut pas nommer n'ouvre rien.
			expect(html(chef, null, '/comites?nommer=1-centre')).not.toContain('<dialog');
		});

		it('un refus rouvre son volet avec ses erreurs, même sans JavaScript ; une réussite s’annonce', () => {
			const refus = html(chef, { cible: 'mandat-31', erreurs: { personneId: 'Choisissez un agent.' }, valeurs: { personneId: '', debut: '2026-11-30' } }, '/comites?/remplacer');
			expect(refus).toMatch(/<dialog[\s\S]*?Choisissez un agent\.[\s\S]*?value="2026-11-30"/);
			// Sans JavaScript, le groupe du mandat remplacé se rouvre pour qu'on voie le résultat.
			expect(html(chef, { cible: 'mandat-31', succes: 'Remplacement enregistré.' }, '/comites?/remplacer')).toMatch(/<details class="repli groupe[^"]*" open[^>]*><summary[^>]*><span[^>]*><h2[^>]*>Chefs de garde/);
			const reussite = html(chef, { cible: 'nommer-3-2', succes: 'Nomination enregistrée.' }, '/comites?/nommer');
			expect(reussite).not.toContain('<dialog');
			expect(reussite).toMatch(/<div role="status"><p class="succes[^"]*">Nomination enregistrée\.<\/p>/);
		});
	});
});

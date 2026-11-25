import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

// Le bloc « Titulaires » lit l'adresse : `?mandat=` et `?nommer=` ouvrent ses volets.
const adresse = vi.hoisted(() => ({ url: new URL('http://x/reglages/roles/3') }));
vi.mock('$app/state', () => ({ page: adresse }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
const { default: Page } = await import('./+page.svelte');

const droit = (d: string, verrouille = false) => ({ droit: d, verrouille });
const role = (champs: Record<string, unknown> = {}) => ({
	id: 3,
	nom: 'Référent engins',
	nature: 'mission',
	portee: 'centre',
	attributeur: { type: 'chef_centre' },
	droits: [droit('TRAITER_ANOMALIE'), droit('GERER_FICHES'), droit('GERER_STOCK')],
	systeme: null,
	archiveeLe: null,
	modele: 'referent_materiel',
	icone: null,
	titulaires: 2,
	protegee: false,
	...champs
});
const base = {
	role: role(),
	modele: { id: 'referent_materiel', nom: 'Référent matériel', droits: ['TRAITER_ANOMALIE', 'GERER_FICHES'] },
	comitesChoix: [{ id: 1, nom: 'Comité du centre' }],
	raison: null,
	peutPouvoir: false,
	droitsMetier: ['VOIR_PLANNING', 'TRAITER_ANOMALIE', 'GERER_FICHES', 'GERER_STOCK'],
	droitsPouvoir: ['GERER_ACCES', 'ATTRIBUER_RESPONSABILITE', 'GERER_LISTES', 'GERER_COMITES']
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (data: Record<string, unknown>, form: unknown = null) => render(Page as any, { props: { data: { ...base, ...data }, form } }).body;

describe('page d’un rôle', () => {
	it('en-tête : nom, pour qui il est tenu, qui nomme, modèle et « Personnalisé »', () => {
		const page = html({});
		expect(page).toMatch(/<h1[^>]*>Référent engins<\/h1>/);
		expect(page).toContain('Tenu pour tout le centre, nommé par le chef de centre');
		expect(page).toContain('Créé à partir du modèle Référent matériel');
		expect(page).toMatch(/>(<!---->)?Personnalisé/);
		expect(html({ role: role({ droits: [droit('TRAITER_ANOMALIE'), droit('GERER_FICHES')] }) })).not.toContain('Personnalisé');
	});

	it('un groupe par domaine, résumé au niveau, sélecteur en boutons radio', () => {
		const page = html({});
		for (const nom of ['Planning et gardes', 'Engins et anomalies', 'Stock et pharmacie', 'Réservations', 'Messagerie', 'Administration de l’appli']) expect(page).toContain(`>${nom}<`);
		expect(page).not.toContain('Salons');
		expect(page).toMatch(/<input type="radio" name="niveau-engins" value="1" checked/);
		expect(page.match(/name="niveau-planning"/g)).toHaveLength(3);
		expect(page).toMatch(/<form[^>]*method="POST"[^>]*action="\?\/enregistrer"/);
	});

	it('« Revenir au modèle » sur le seul domaine qui diffère, « Tout revenir » dans la barre', () => {
		const page = html({});
		expect(page.match(/Revenir au modèle/g)).toHaveLength(1);
		expect(page).toMatch(/<button[^>]*form="revenir"[^>]*name="domaine"[^>]*value="stock"[^>]*>↺ Revenir au modèle \(Rien de plus\)/);
		expect(page).toMatch(/<button[^>]*form="revenir"[^>]*value="tout"[^>]*>↺ Tout revenir/);
		expect(page).toMatch(/<form id="revenir" method="POST" action="\?\/revenir">/);
		expect(page).toMatch(/<button[^>]*type="submit"[^>]*>(<!---->)?Enregistrer/);
	});

	it('sans modèle : ni « Revenir au modèle » ni « Tout revenir »', () => {
		const page = html({ modele: null, role: role({ modele: null }) });
		expect(page).not.toContain('Revenir au modèle');
		expect(page).not.toContain('Tout revenir');
	});

	it('« Sur mesure » quand les droits ne tombent sur aucun niveau', () => {
		const page = html({ role: role({ droits: [droit('GERER_PLANNING')] }) });
		expect(page).toMatch(/<input type="radio" name="niveau-planning" value="sur_mesure" checked/);
		expect(page).toMatch(/Planning et gardes<\/span>[\s\S]{0,40}<span class="resume[^"]*">Sur mesure</);
	});

	it('cases d’administration grisées pour qui ne gère pas le pouvoir, avec la raison', () => {
		const page = html({ role: role({ droits: [droit('GERER_LISTES')] }) });
		expect(page).toMatch(/<input type="checkbox" name="admin" value="GERER_LISTES" checked[^>]*disabled/);
		expect(page).toContain('Seuls le chef de centre, son adjoint et le super administrateur');
		expect(page).not.toContain('name="administration"');
		const chef = html({ peutPouvoir: true });
		expect(chef).toContain('<input type="hidden" name="administration" value="oui"');
		expect(chef).not.toMatch(/name="admin"[^>]*disabled/);
	});

	describe('droits réservés à un rôle du centre', () => {
		const PHRASE = 'Gérer les accès, les comités et les rôles est réservé';
		const RESERVES = ['GERER_ACCES', 'GERER_COMITES', 'GERER_LISTES'];
		const grisee = (page: string, nom: string, droit: string) => new RegExp(`<input type="checkbox" name="${nom}" value="${droit}"[^>]*disabled`).test(page);
		const cochee = (page: string, nom: string, droit: string) => new RegExp(`<input type="checkbox" name="${nom}" value="${droit}"[^>]*checked`).test(page);

		it.each(['equipe', 'comite'])('portée « %s » : les trois cases grisées, pas « Nommer », avec la phrase, dans les deux formulaires', (portee) => {
			const page = html({ peutPouvoir: true, role: role({ portee, titulaires: 0 }) });
			for (const nom of ['admin', 'droits']) {
				for (const droit of RESERVES) expect(grisee(page, nom, droit)).toBe(true);
				expect(grisee(page, nom, 'ATTRIBUER_RESPONSABILITE')).toBe(false);
			}
			expect(page.match(new RegExp(PHRASE, 'g'))).toHaveLength(2);
			expect(page).toMatch(/<p id="admin-centre"[^>]*>Gérer les accès, les comités et les rôles est réservé/);
			expect(page).toMatch(/<p id="detail-centre"[^>]*>Gérer les accès, les comités et les rôles est réservé/);
			// La phrase est reliée à chaque case qu'elle concerne, et à elles seules.
			for (const d of RESERVES) {
				expect(page).toMatch(new RegExp(`name="admin" value="${d}"[^>]*aria-describedby="admin-centre"`));
				expect(page).toMatch(new RegExp(`name="droits" value="${d}"[^>]*aria-describedby="detail-centre"`));
			}
			expect(page).not.toMatch(/value="ATTRIBUER_RESPONSABILITE"[^>]*aria-describedby/);
		});

		it('portée « centre » : rien de grisé, pas de phrase', () => {
			const page = html({ peutPouvoir: true });
			for (const nom of ['admin', 'droits']) for (const droit of RESERVES) expect(grisee(page, nom, droit)).toBe(false);
			expect(page).not.toContain(PHRASE);
		});

		it('sans le pouvoir, sur une équipe : les deux raisons sont dites et reliées', () => {
			const page = html({ role: role({ portee: 'equipe', titulaires: 0 }) });
			expect(page).toContain('Seuls le chef de centre, son adjoint et le super administrateur');
			expect(page).toContain(PHRASE);
			expect(page).toMatch(/<fieldset class="admin[^"]*" aria-describedby="admin-aide"/);
			expect(page).toMatch(/name="admin" value="GERER_ACCES"[^>]*aria-describedby="admin-centre"/);
		});

		it('un rôle d’équipe tenu : portée fixe, sans liste, cases grisées quand même', () => {
			const page = html({ peutPouvoir: true, role: role({ portee: 'equipe', titulaires: 2 }) });
			expect(page).not.toContain('name="portee"');
			expect(page).toContain('Tenu pour chaque équipe. Ne change pas tant que le rôle a un titulaire.');
			expect(grisee(page, 'admin', 'GERER_ACCES')).toBe(true);
			expect(page).toContain(PHRASE);
		});

		it('un rôle ancien d’équipe qui porte ces droits : cases décochées, ce que l’envoi retirera, et le compte le dit', () => {
			const page = html({ peutPouvoir: true, role: role({ portee: 'equipe', titulaires: 0, droits: [droit('GERER_ACCES'), droit('ATTRIBUER_RESPONSABILITE')] }), modele: null });
			for (const nom of ['admin', 'droits']) {
				expect(cochee(page, nom, 'GERER_ACCES')).toBe(false);
				expect(cochee(page, nom, 'ATTRIBUER_RESPONSABILITE')).toBe(true);
			}
			expect(page).toContain('1 domaine modifié, pas encore enregistré');
			expect(page).not.toMatch(/class="resume[^"]*">[^<]*Gérer les accès/);
		});

		it('après un refus du serveur sans JavaScript : la portée envoyée grise les cases du formulaire, le détail suit la portée enregistrée', () => {
			const page = html({ peutPouvoir: true, role: role({ titulaires: 0 }) }, { cible: 'role', message: 'Refusé', valeurs: { nom: 'X', portee: 'equipe', admin: ['GERER_ACCES', 'ATTRIBUER_RESPONSABILITE'] } });
			expect(page).toMatch(/<input type="radio" name="portee" value="equipe"[^>]*checked/);
			expect(grisee(page, 'admin', 'GERER_ACCES')).toBe(true);
			expect(cochee(page, 'admin', 'GERER_ACCES')).toBe(false);
			expect(cochee(page, 'admin', 'ATTRIBUER_RESPONSABILITE')).toBe(true);
			expect(grisee(page, 'droits', 'GERER_ACCES')).toBe(false);
		});
	});

	it('rôle système : tout en lecture seule, sans formulaire ni « Revenir au modèle »', () => {
		const page = html({ peutPouvoir: true, modele: null, raison: 'Ce rôle fait partie du système. Ses droits sont fixés, il ne se modifie pas.', role: role({ systeme: 'chef_equipe', modele: null, droits: [droit('VALIDER_REMPLACEMENT', true), droit('VOIR_MOTIFS_ABSENCE', true)] }) });
		expect(page).toContain('fait partie du système');
		expect(page).not.toMatch(/<form/);
		expect(page).not.toContain('Revenir au modèle');
		expect(page).not.toContain('Enregistrer');
		expect(page.match(/<fieldset class="selecteur[^"]*" disabled/g)).toHaveLength(5);
		expect(page).toMatch(/name="admin"[^>]*disabled/);
		expect(page).toContain('Valider un remplacement');
		// Les droits sans effet ne s'affichent pas, même tenus par le rôle.
		expect(page).not.toContain('Voir les motifs d’absence');
	});

	it('les droits sans effet (motifs d’absence, annuaire) ne s’affichent nulle part sur la page', () => {
		const droits = [droit('GERER_STOCK'), droit('VOIR_MOTIFS_ABSENCE'), droit('VOIR_ANNUAIRE')];
		for (const page of [html({ role: role({ droits }) }), html({ raison: 'Ce rôle est archivé. Il ne se modifie plus.', role: role({ droits, archiveeLe: '2026-01-01' }) })]) {
			expect(page).not.toMatch(/motifs d’absence|annuaire|VOIR_MOTIFS_ABSENCE|VOIR_ANNUAIRE/);
		}
	});

	it('rôle système vu par le chef ou l’adjoint : les cases grisées disent pourquoi, sans parler de leurs droits', () => {
		const raison = 'Ce rôle fait partie du système. Ses droits sont fixés, il ne se modifie pas.';
		const page = html({ peutPouvoir: true, modele: null, raison, role: role({ systeme: 'chef_equipe', modele: null }) });
		expect(page).not.toContain('Seuls le chef de centre, son adjoint et le super administrateur');
		expect(page).toMatch(/<p id="admin-aide" class="aide[^"]*">Ces cases ne se modifient pas sur ce rôle\./);
		expect(page).toMatch(/<fieldset class="admin[^"]*" aria-describedby="admin-aide"/);
	});

	it('message d’erreur à côté du bon formulaire, saisie réaffichée', () => {
		const page = html({}, { cible: 'role', erreurs: { nom: 'Ce nom est déjà utilisé.' }, valeurs: { nom: 'Doublon' } });
		expect(page).toContain('Ce nom est déjà utilisé.');
		expect(page).toMatch(/id="role-nom"[^>]*value="Doublon"/);
		expect(page.match(/Le formulaire contient des erreurs\./g)).toHaveLength(1);
		expect(html({}, { cible: 'role', succes: 'Le rôle « X » est enregistré.' })).toMatch(/role="status"[^>]*>(<!--[^>]*-->)*<p[^>]*>Le rôle « X » est enregistré\./);
	});

	it('après un refus, réaffiche les niveaux, les cases d’administration et l’icône choisis', () => {
		const page = html({ peutPouvoir: true }, { cible: 'role', erreurs: { nom: 'Ce nom est déjà utilisé.' }, valeurs: { nom: 'Doublon', niveaux: { stock: '0', reservations: '2' }, admin: ['GERER_COMITES'], icone: 'ballon' } });
		expect(page).toMatch(/<input type="radio" name="niveau-stock" value="0" checked/);
		expect(page).toMatch(/<input type="radio" name="niveau-reservations" value="2" checked/);
		expect(page).toMatch(/<input type="checkbox" name="admin" value="GERER_COMITES" checked/);
		expect(page).toMatch(/name="icone" value="ballon" checked/);
		expect(page).toContain('3 domaines modifiés, pas encore enregistrés');
	});

	it('archiver : un geste grave en bas de page, sans menu « Plus », qui demande « Je confirme »', () => {
		const page = html({});
		expect(page).toContain('Les 2 personnes qui tiennent ce rôle le perdent aujourd’hui, avec ses droits.');
		expect(page).toMatch(/action="\?\/archiver"[\s\S]*name="confirmation" value="oui"[\s\S]*Confirmer l’archivage/);
		// Sans JavaScript, la confirmation reste repliée sous « Archiver le rôle ».
		expect(page).toMatch(/<details class="repli[^"]*"><summary[^>]*>Archiver le rôle<\/summary>/);
		expect(page).not.toContain('class="plus');
		expect(page).not.toMatch(/>Plus</);
	});

	it('après un refus : l’identité est ouverte et l’interrupteur garde la saisie', () => {
		const page = html({}, { cible: 'role', erreurs: { nom: 'Ce nom est déjà utilisé.' }, valeurs: { nom: 'Doublon', nature: 'fonction' } });
		const identite = page.slice(page.indexOf('>Identité<'));
		expect(identite).toMatch(/<div[^>]*class="contenu[^"]*"[^>]*>/);
		expect(identite.match(/<div[^>]*class="contenu[^"]*"[^>]*>/)![0]).not.toContain('hidden');
		expect(page).toMatch(/name="toujours" value="1"[^>]*checked/);
		// Sans refus, l'identité reste repliée au téléphone.
		const repliee = html({}).slice(html({}).indexOf('>Identité<'));
		expect(repliee.match(/<div[^>]*class="contenu[^"]*"[^>]*>/)![0]).toContain('hidden');
	});

	it('après un refus de l’archivage, la confirmation est dépliée', () => {
		const page = html({}, { cible: 'archiver', message: 'Cochez « Je confirme » pour continuer.' });
		expect(page).toMatch(/<details class="repli archiver[^"]*" open/);
		expect(page).toContain('Cochez « Je confirme » pour continuer.');
	});

	it('rôle système ou archivé : l’identité se lit, sans geste', () => {
		const raison = 'Ce rôle est archivé. Il ne se modifie plus.';
		const page = html({ raison, role: role({ archiveeLe: '2026-01-01', attributeur: { type: 'chef_centre' } }) });
		const identite = page.slice(page.indexOf('>Identité<'));
		expect(page).toContain('>Identité<');
		expect(identite).toMatch(/Tenu pour[\s\S]*?Tout le centre/);
		expect(identite).toMatch(/Qui nomme[\s\S]*?Le chef de centre/);
		expect(identite).toMatch(/Icône[\s\S]*?Camion/);
		expect(page).not.toContain('Changer d’icône');
		expect(page).not.toContain('name="toujours"');
		expect(page).not.toContain('Archiver le rôle');
	});

	it('l’ordre de la fiche : titulaires, identité, ce qu’il peut faire, demandes, puis le détail et l’archivage en bas', () => {
		const titulairesDuRole = { postes: [], gestes: null, fiches: false };
		const page = html({ titulairesDuRole, aujourdhui: '2026-11-24', nouveau: false, role: role({ demandes: null, demandesGardees: null }), demandesPossibles: true });
		const reperes = ['Titulaires</h2>', '>Identité<', 'Ce qu’il peut faire', '>Demandes</summary>', '>Enregistrer', '>Détail droit par droit</summary>', '>Archiver le rôle</summary>'].map((r) => page.indexOf(r));
		expect(reperes.every((i) => i >= 0)).toBe(true);
		expect(reperes).toEqual([...reperes].sort((a, b) => a - b));
	});

	it('identité : nom, « Doit toujours être tenu », « Tenu pour », « Qui nomme », sans les anciens mots', () => {
		const page = html({ role: role({ titulaires: 0 }) });
		expect(page).toMatch(/id="role-nom"[^>]*value="Référent engins"/);
		expect(page).toContain('Doit toujours être tenu');
		expect(page).toContain('Signalé à pourvoir dès qu’il n’a plus de titulaire.');
		expect(page).toMatch(/<input type="checkbox" role="switch" name="toujours" value="1"/);
		expect(page).not.toMatch(/name="toujours"[^>]*checked/);
		expect(page).toMatch(/<legend[^>]*>Tenu pour<\/legend>/);
		expect(page).toMatch(/<input type="radio" name="portee" value="centre"[^>]*checked/);
		expect(page).toContain('Ses titulaires sont nommés équipe par équipe.');
		expect(page).toMatch(/<label[^>]*>Qui nomme<\/label>/);
		expect(page).toContain('Peut rester sans titulaire');
		expect(page).not.toMatch(/Nature|Portée|Qui attribue|responsabilit|Nom, icône/);
		// Une fonction : l'interrupteur est coché, et le résumé le dit.
		const fonction = html({ role: role({ nature: 'fonction' }) });
		expect(fonction).toMatch(/name="toujours" value="1"[^>]*checked/);
		expect(fonction).toMatch(/class="resume[^"]*">Doit toujours être tenu</);
	});

	it('choix de l’icône dans la liste fixe, celle du modèle par défaut', () => {
		const page = html({});
		expect(page.match(/name="icone"/g)).toHaveLength(34);
		expect(page).toMatch(/<input type="radio" name="icone" value="camion" checked/);
		expect(page).toContain('Camion');
	});

	it('« Demandes » : la case et les étapes, chacune avec ses gestes ; absent d’un rôle qui ne peut pas en recevoir', () => {
		const reglage = { etapes: [{ id: 'ea', nom: 'Commandée' }, { id: 'eb', nom: 'Reçue' }], derniere: 'Livrée' };
		const page = html({ role: role({ demandes: reglage, demandesGardees: null }), demandesPossibles: true });
		expect(page).toMatch(/<summary[^>]*>Demandes<\/summary>/);
		expect(page).toContain('Reçoit des demandes');
		expect(page).toMatch(/value="Commandée"/);
		expect(page).toMatch(/value="Livrée"/);
		expect(page).toContain('value="descendre:0"');
		expect(page).not.toContain('value="monter:0"');
		expect(page).toContain('value="monter:1"');
		expect(page).toMatch(/formaction="\?\/apercu"[^>]*value="retirer:1"|value="retirer:1"[^>]*formaction/);
		expect(page).toContain('Ajouter l’étape');
		// Les noms que lit l'essai de bout en bout : le champ « Étape 2 », « Retirer Reçue », le seul bouton « Enregistrer ».
		expect(page).toMatch(/<label for="[^"]+"[^>]*>Étape 2<\/label>/);
		expect(page).toMatch(/>Retirer(<!---->)?<span class="masque[^"]*"> Reçue<\/span>/);
		expect(page.match(/>(<!---->)?Enregistrer(<!---->)?<\/button>/g)).toHaveLength(1);
		// Un seul bouton pour la page : le réglage part avec « Enregistrer ».
		expect(page).not.toContain('Enregistrer les étapes');
		const formulaire = page.slice(page.indexOf('action="?/enregistrer"'), page.indexOf('</form>', page.indexOf('action="?/enregistrer"')));
		expect(formulaire).toContain('name="derniere"');
		expect(formulaire).toMatch(/>(<!---->)?Enregistrer(<!---->)?<\/button>/);
		// La saisie renvoyée par le serveur s'affiche à la place du réglage enregistré.
		expect(html({ role: role({ demandes: reglage, demandesGardees: null }), demandesPossibles: true }, { cible: 'role', demandes: { recoit: true, etapes: [{ nom: 'Rangée' }], derniere: 'Remise' } })).toMatch(/value="Rangée"[\s\S]*value="Remise"/);
		expect(html({ role: role({ demandes: null }), demandesPossibles: false })).not.toMatch(/>Demandes<\/summary>/);
	});

	it('le bloc « Titulaires » en tête : replié, ses lignes et ses gestes ; ouvert avec « Qui le tiendra ? » après la création', () => {
		const titulairesDuRole = {
			postes: [{ cle: '3-centre', roleId: 3, role: 'Référent engins', nature: 'mission', perimetre: { type: 'centre', id: null, nom: null }, titulaires: [{ id: 8, nom: 'Denis Roux', grade: null, ecrire: false, mandat: { id: 21, debut: '2026-01-01', fin: null } }], nommer: { aPourvoir: false } }],
			gestes: { agents: [{ id: 4, nom: 'Alice Bernard', equipeId: null, equipe: null }] },
			fiches: false
		};
		const page = html({ titulairesDuRole, aujourdhui: '2026-11-24', nouveau: false });
		expect(page.indexOf('Titulaires')).toBeLessThan(page.indexOf('Ce qu’il peut faire'));
		expect(page).toMatch(/<details class="repli titulaires[^"]*"><summary/);
		expect(page).toMatch(/Titulaires<\/h2>(<!---->)?<span[^>]*>1 titulaire<\/span>/);
		expect(page).toMatch(/href="\?mandat=21"[\s\S]*?Denis Roux/);
		expect(page).toMatch(/href="\?nommer=3-centre"/);
		const apres = html({ titulairesDuRole, aujourdhui: '2026-11-24', nouveau: true });
		expect(apres).toMatch(/<details class="repli titulaires[^"]*" open/);
		expect(apres).toContain('Qui le tiendra ?');
		// Sans le bloc (rôle archivé, ou pas d'accès à Qui fait quoi), rien.
		expect(html({})).not.toContain('Titulaires');
	});

	it('« Prévenu pour » : les zones du rôle, dans le bloc Titulaires, en vue même replié ; rien sans zone', () => {
		const titulairesDuRole = { postes: [], gestes: null, fiches: false };
		const page = html({ titulairesDuRole, aujourdhui: '2026-11-24', nouveau: false, prevenuPour: [{ zone: 'Sac PS', types: ['VSAV', 'CCRM'] }, { zone: 'Tiroir rouge', types: ['VSAV'] }] });
		expect(page).toMatch(/<summary[^>]*>[\s\S]*?Prévenu pour Sac PS \(VSAV, CCRM\), Tiroir rouge \(VSAV\)[\s\S]*?<\/summary>/);
		expect(html({ titulairesDuRole, aujourdhui: '2026-11-24', nouveau: false, prevenuPour: [] })).not.toContain('Prévenu pour');
	});
});

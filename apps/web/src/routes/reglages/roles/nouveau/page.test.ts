import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { MODELES } from '@gyro-caserne/socle';
import Page from './+page.svelte';

const modeles = MODELES.map((m) => ({ ...m, reserve: m.id === 'rapporteur_comite' || m.id === 'referent_technique' }));
const data = { modeles, choisi: null, comitesChoix: [{ id: 2, nom: 'Amicale' }] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (props: Record<string, unknown>) => render(Page as any, { props }).body;

describe('nouveau rôle', () => {
	it('d’abord le modèle : une carte par modèle, ce qu’il donne, les réservés sans lien', () => {
		const page = html({ data, form: null });
		expect(page).toMatch(/href="\?modele=referent_pharmacie"[\s\S]*?Référent pharmacie[\s\S]*?Stock et pharmacie : Gérer/);
		expect(page).toMatch(/href="\?modele=vierge"[\s\S]*?Aucun droit en plus/);
		expect(page).not.toContain('href="?modele=rapporteur_comite"');
		expect(page).toMatch(/Rapporteur de comité[\s\S]*?Réservé au chef de centre/);
	});

	it('puis le formulaire prérempli, dans l’ordre de la fiche : nom, toujours tenu, tenu pour, qui nomme, icône du modèle', () => {
		const choisi = modeles.find((m) => m.id === 'membre_comite');
		const page = html({ data: { ...data, choisi }, form: null });
		expect(page).toContain('<input type="hidden" name="modele" value="membre_comite"');
		expect(page).toMatch(/id="nouveau-nom"[^>]*value="Membre de comité"/);
		expect(page).toContain('Doit toujours être tenu');
		expect(page).toContain('Signalé à pourvoir dès qu’il n’a plus de titulaire.');
		expect(page).toMatch(/<input type="checkbox" role="switch" name="toujours" value="1"/);
		expect(page).not.toMatch(/name="toujours"[^>]*checked/);
		expect(page).toMatch(/<legend[^>]*>Tenu pour<\/legend>/);
		expect(page).toMatch(/<input type="radio" name="portee" value="comite"[^>]*checked/);
		expect(page).toContain('Chaque équipe');
		expect(page).toContain('Ses titulaires sont nommés comité par comité.');
		expect(page).toMatch(/<label[^>]*>Qui nomme<\/label>/);
		expect(page).toMatch(/<option value="comite_vise" selected/);
		expect(page).toMatch(/name="icone" value="groupe" checked/);
		expect(page).toContain('href="/reglages/roles/nouveau"');
		// Les anciens mots ne reviennent pas.
		expect(page).not.toMatch(/Nature|Portée|Qui attribue|responsabilité/);
		const ordre = ['id="nouveau-nom"', 'name="toujours"', 'name="portee"', 'id="nouveau-attributeur"', 'name="icone"', 'Créer le rôle'].map((m) => page.indexOf(m));
		expect(ordre).toEqual([...ordre].sort((a, b) => a - b));
		// Un modèle qui est une fonction : l'interrupteur est coché.
		const fonction = { ...choisi, nature: 'fonction' };
		expect(html({ data: { ...data, choisi: fonction }, form: null })).toMatch(/name="toujours" value="1"[^>]*checked/);
	});

	it('vierge : nom vide ; une erreur réaffiche la saisie', () => {
		const vierge = modeles.find((m) => m.id === 'vierge');
		expect(html({ data: { ...data, choisi: vierge }, form: null })).toMatch(/id="nouveau-nom"[^>]*value=""/);
		const erreur = html({ data: { ...data, choisi: vierge }, form: { cible: 'role-nouveau', erreurs: { nom: 'Ce nom est déjà utilisé.' }, valeurs: { nom: 'Sport', icone: 'ballon' } } });
		expect(erreur).toContain('Ce nom est déjà utilisé.');
		expect(erreur).toMatch(/name="icone" value="ballon" checked/);
	});
});

import type { Attributeur } from '@gyro-caserne/socle';
import type { IconeRole } from '#lib/ui/icones-roles.ts';

// Les icônes proposées, avec leur nom lu par les lecteurs d'écran.
export const NOMS_ICONES: Record<IconeRole, string> = {
	etoile: 'Étoile',
	casque: 'Casque',
	camion: 'Camion',
	croix: 'Croix',
	cle: 'Clé',
	ballon: 'Ballon',
	livre: 'Livre',
	groupe: 'Groupe',
	coeur: 'Cœur',
	outil: 'Outil',
	veste: 'Veste',
	banc: 'Banc',
	table: 'Table',
	tente: 'Tente',
	barbecue: 'Barbecue',
	musique: 'Musique',
	sifflet: 'Sifflet',
	trophee: 'Trophée',
	calendrier: 'Calendrier',
	secourisme: 'Secourisme',
	photo: 'Appareil photo',
	ordinateur: 'Ordinateur',
	drapeau: 'Drapeau',
	haltere: 'Haltère',
	megaphone: 'Mégaphone',
	euro: 'Euro',
	retraites: 'Retraités',
	pharmacie: 'Pharmacie',
	sport: 'Sport',
	informatique: 'Informatique',
	formation: 'Formation',
	cuisine: 'Cuisine',
	outils: 'Boîte à outils',
	medaille: 'Médaille'
};

// Pour qui le rôle est tenu (la portée, dans le code) : le libellé du choix, sa sous-ligne, et la phrase de l'en-tête.
export const TENU_POUR = [
	{ valeur: 'centre', libelle: 'Tout le centre', sous: 'Ses titulaires valent pour tout le centre.', phrase: 'Tenu pour tout le centre' },
	{ valeur: 'equipe', libelle: 'Chaque équipe', sous: 'Ses titulaires sont nommés équipe par équipe.', phrase: 'Tenu pour chaque équipe' },
	{ valeur: 'comite', libelle: 'Chaque comité', sous: 'Ses titulaires sont nommés comité par comité.', phrase: 'Tenu pour chaque comité' }
];
export const tenuPour = (portee: string) => TENU_POUR.find((t) => t.valeur === portee)?.phrase ?? portee;

// « Doit toujours être tenu » : coché, c'est une fonction (signalée à pourvoir sans titulaire) ; sinon une mission.
export const TOUJOURS_TENU = { libelle: 'Doit toujours être tenu', description: 'Signalé à pourvoir dès qu’il n’a plus de titulaire.' };
export const natureDe = (formulaire: FormData) => (formulaire.get('toujours') === '1' ? 'fonction' : 'mission');

export function valeurAttributeur(a: Attributeur): string {
	return a.type === 'comite' ? `comite:${a.id}` : a.type;
}

export function quiAttribue(a: Attributeur, comites: { id: number; nom: string }[]): string {
	if (a.type === 'comite') return `nommé par le comité « ${comites.find((c) => c.id === a.id)?.nom ?? 'dissous'} »`;
	return a.type === 'comite_vise' ? 'nommé par son comité' : 'nommé par le chef de centre';
}

export function optionsAttributeur(comites: { id: number; nom: string }[]) {
	return [
		{ valeur: 'chef_centre', libelle: 'Le chef de centre' },
		{ valeur: 'comite_vise', libelle: 'Son comité (rôle tenu pour chaque comité)' },
		...comites.map((c) => ({ valeur: `comite:${c.id}`, libelle: `Le comité « ${c.nom} »` }))
	];
}

export const titulaires = (n: number) => (n === 0 ? 'Aucun titulaire' : n === 1 ? '1 titulaire' : `${n} titulaires`);

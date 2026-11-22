import { fail } from '@sveltejs/kit';
import { DonneeInvalide, RefusDroit } from '@gyro-caserne/socle';

export type ReponsePlanning = { cible: string; succes?: string; message?: string; valeurs?: Record<string, string | string[]> };

// Les refus du socle, dits simplement ; un message absent de la table s'affiche tel quel.
const MESSAGES: Record<string, string> = {
	'Au moins deux équipes, chacune une fois': 'Mettez chaque équipe une fois dans le roulement (au moins deux).',
	'Équipe inconnue': 'Une des équipes choisies n’existe pas.',
	'Réglez d’abord le roulement': 'Réglez d’abord le roulement de l’année.',
	'Semaine inconnue': 'Une des semaines n’appartient pas à cette année.',
	'Fin avant le début': 'La fin est avant le début.',
	'Nom vide': 'Indiquez le nom des vacances.',
	'Thème vide': 'Indiquez le thème de la manœuvre.',
	'Lieu vide': 'Indiquez le lieu.',
	'Début invalide': 'Indiquez la date et l’heure de début.',
	'Manœuvre passée': 'Cette date est déjà passée.',
	'Choisissez au moins une équipe': 'Choisissez au moins une équipe, ou tout le centre.',
	'Manœuvre inconnue': 'Cette manœuvre n’existe plus.',
	'Année invalide': 'Choisissez une année à partir de 2020.',
	'Jour de relève attendu': 'Le début et la fin de l’été sont des jours de relève.',
	'Été publié, la période ne change plus': 'L’été est publié. Sa période ne change plus.',
	'Été pas encore ouvert': 'Ouvrez d’abord l’été (période et date limite).',
	'Été déjà publié': 'L’été est déjà publié. Ajustez plutôt plage par plage.',
	'Proposez d’abord l’été': 'Proposez d’abord la répartition.',
	'Plage commencée': 'Cette plage est commencée. Elle ne change plus.',
	'Plage inconnue': 'Cette plage n’existe plus. Rechargez la page.',
	'Déjà relancés aujourd’hui': 'Les agents sans réponse ont déjà été relancés aujourd’hui.',
	'Tout le monde a répondu': 'Tout le monde a répondu. Personne à relancer.',
	'Une autre fête tombe à ces heures': 'Une autre fête tombe à ces heures. Choisissez d’autres heures.',
	'La fin doit suivre le début': 'Indiquez une heure de fin différente du début.',
	'Une fête dure 24 h au plus': 'Une fête dure 24 h au plus.',
	'Fête passée': 'Cette date est déjà passée.',
	'Fête inconnue': 'Cette fête n’existe plus. Rechargez la page.',
	'Fête commencée : elle ne change plus': 'Cette fête a commencé. Elle ne change plus.',
	'Nom de la fête vide': 'Indiquez le nom de la fête.',
	'Nom de la fête trop long': 'Un nom de 60 caractères au plus.'
};

export function echecPlanning(erreur: unknown, cible: string, valeurs?: ReponsePlanning['valeurs']) {
	if (erreur instanceof RefusDroit) return fail<ReponsePlanning>(403, { cible, message: 'Seul qui gère le planning du centre peut faire cela.' });
	if (erreur instanceof DonneeInvalide) return fail<ReponsePlanning>(400, { cible, message: MESSAGES[erreur.message] ?? erreur.message, valeurs });
	throw erreur;
}

export const champ = (formulaire: FormData, cle: string) => {
	const v = formulaire.get(cle);
	return typeof v === 'string' ? v : '';
};

export const nombres = (formulaire: FormData, cle: string) => formulaire.getAll(cle).map((v) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN));

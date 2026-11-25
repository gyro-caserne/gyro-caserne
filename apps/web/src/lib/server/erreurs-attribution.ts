import { echec, type Reponse } from './formulaire-agent.ts';

// Refus de nomination qui visent un champ précis du formulaire (le reste s'affiche en message général).
const CHAMP_DE_L_ERREUR: Record<string, string> = {
	'Cette personne tient déjà ce rôle sur cette période': 'debut',
	'Fin avant le début': 'fin',
	'Choisissez une date après le début du mandat': 'debut',
	'Ce mandat finit avant cette date': 'debut',
	'Une personne extérieure ne tient aucun rôle. Seuls les agents du centre sont nommés.': 'personneId',
	'Une attribution ne peut qu’être raccourcie': 'fin',
	'Personne inconnue': 'personneId',
	'Cette personne est partie': 'personneId',
	'Responsabilité inconnue': 'responsabiliteId',
	'Responsabilité archivée': 'responsabiliteId',
	'Périmètre différent de celui de la responsabilité': 'perimetreId',
	'Équipe inconnue': 'perimetreId',
	'Comité inconnu': 'perimetreId',
	'Comité dissous': 'perimetreId'
};

// Traduit un refus du socle pour les formulaires de nomination (fiche agent, Qui fait quoi, fiches d'un rôle et d'un comité).
export const echecAttribution = (erreur: unknown, contexte: Reponse = {}) => echec(erreur, contexte, CHAMP_DE_L_ERREUR);

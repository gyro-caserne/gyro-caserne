import type { NomIcone } from './icones.ts';
import type { Droit, ReglageDemandes } from './listes.ts';

export type Modele = { id: string; nom: string; nature: 'fonction' | 'mission'; portee: 'centre' | 'equipe' | 'comite'; icone: NomIcone; droits: Droit[]; demandes?: ReglageDemandes };

// Fixés par l'appli : « Nouveau rôle → à partir de… ». Un rôle créé garde l'identifiant de son modèle.
// Le réglage des demandes d'habillement (décision 0044) : le référent saute l'une des deux étapes selon le cas. Les identifiants
// sont ceux de la reprise (migration 0037).
export const REGLAGE_HABILLEMENT: ReglageDemandes = { etapes: [{ id: 'estock', nom: 'En stock' }, { id: 'ecommande', nom: 'Commandée au SDIS' }], derniere: 'Livrée' };
export const SANS_ETAPE: ReglageDemandes = { etapes: [], derniere: 'Faite' };

// `demandes` : le rôle créé reçoit des demandes (demandes.ts), avec ce réglage.
export const MODELES: Modele[] = [
	{ id: 'referent_materiel', nom: 'Référent matériel', nature: 'mission', portee: 'centre', icone: 'camion', droits: ['TRAITER_ANOMALIE', 'GERER_FICHES'], demandes: SANS_ETAPE },
	{ id: 'referent_pharmacie', nom: 'Référent pharmacie', nature: 'mission', portee: 'centre', icone: 'croix', droits: ['GERER_STOCK'], demandes: SANS_ETAPE },
	{ id: 'referent_habillement', nom: 'Référent habillement', nature: 'mission', portee: 'centre', icone: 'veste', droits: ['GERER_HABILLEMENT'], demandes: REGLAGE_HABILLEMENT },
	{ id: 'referent_technique', nom: 'Référent technique', nature: 'fonction', portee: 'centre', icone: 'cle', droits: ['GERER_LISTES', 'GERER_COMITES'] },
	{ id: 'membre_comite', nom: 'Membre de comité', nature: 'mission', portee: 'comite', icone: 'groupe', droits: [] },
	{ id: 'rapporteur_comite', nom: 'Rapporteur de comité', nature: 'mission', portee: 'comite', icone: 'livre', droits: ['ATTRIBUER_RESPONSABILITE'] },
	{ id: 'vierge', nom: 'Vierge', nature: 'mission', portee: 'centre', icone: 'outil', droits: [] }
];

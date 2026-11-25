import type { Sujet } from '@gyro-caserne/socle';

// Moi, puis Notifications : chaque sujet qui se coupe au téléphone, dans l'ordre de l'écran.
export const NOMS_SUJETS: Record<Sujet, { libelle: string; description: string }> = {
	remplacements: { libelle: 'Remplacements', description: 'Les demandes reçues, les réponses et les validations.' },
	engins: { libelle: 'Engins', description: 'Les anomalies et les prises de garde.' },
	demandes: { libelle: 'Demandes aux référents', description: 'Habillement, pharmacie et matériel, les vôtres et celles adressées à vos rôles.' },
	planning: { libelle: 'Planning', description: 'L’été, les semaines changées et les manœuvres.' },
	vie: { libelle: 'Anniversaires et nominations', description: 'Les souhaits d’anniversaire, les félicitations d’ancienneté et les nominations.' }
};

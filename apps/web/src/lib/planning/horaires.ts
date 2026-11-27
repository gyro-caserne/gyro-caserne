import type { Horaires } from '@gyro-caserne/socle';
import { heure } from '../murs/quand.ts';

// Les horaires de garde d'une année, à l'écran (Préparer l'année, étape Roulement) et à la saisie.

export const JOURS_RELEVE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

// « 18 h », « 7 h 30 », « minuit ».
export const enHeure = (hhmm: string) => (hhmm === '00:00' ? 'minuit' : heure(`2000-01-01T${hhmm}`));
const majuscule = (t: string) => `${t[0]!.toUpperCase()}${t.slice(1)}`;

// Les lignes de la lecture seule : relève, fin, semaine.
export const lignesHoraires = (h: Horaires) => [
	{ titre: 'Relève', valeur: `${majuscule(h.debut.jour)}, ${enHeure(h.debut.heure)}` },
	{ titre: 'Fin de l’astreinte', valeur: h.fin.jour === h.debut.jour ? enHeure(h.fin.heure) : `${majuscule(h.fin.jour)}, ${enHeure(h.fin.heure)}` },
	{ titre: 'En semaine', valeur: h.semaine ? `De ${enHeure(h.semaine.debut)} à ${enHeure(h.semaine.fin)}` : 'Astreinte continue' }
];

// « Relève le vendredi à 18 h, fin à 6 h, en semaine de 18 h à 6 h. »
export function phraseHoraires(h: Horaires): string {
	const fin = h.fin.jour === h.debut.jour ? `fin à ${enHeure(h.fin.heure)}` : `fin le ${h.fin.jour} à ${enHeure(h.fin.heure)}`;
	return `Relève le ${h.debut.jour} à ${enHeure(h.debut.heure)}, ${fin}, ${h.semaine ? `en semaine de ${enHeure(h.semaine.debut)} à ${enHeure(h.semaine.fin)}` : 'astreinte continue'}.`;
}

const texte = (f: FormData, cle: string) => {
	const v = f.get(cle);
	return typeof v === 'string' ? v : '';
};

// La saisie du formulaire, telle quelle : le socle la contrôle (exigerHoraires). La fin tombe le jour de la relève suivante.
export function horairesDeLaSaisie(f: FormData): unknown {
	const jour = texte(f, 'jour');
	const semaine = f.get('continue') === '1' ? undefined : { debut: texte(f, 'semaine-debut'), fin: texte(f, 'semaine-fin') };
	return { debut: { jour, heure: texte(f, 'releve') }, fin: { jour, heure: texte(f, 'fin') }, ...(semaine ? { semaine } : {}) };
}

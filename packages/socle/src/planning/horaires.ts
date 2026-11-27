import type { JourSemaine } from '@gyro-caserne/centre';
import { DonneeInvalide } from '../erreurs.ts';
import type { Horaires } from './calendrier.ts';

// Les horaires de garde saisis pour une année : contrôlés, et rendus sans rien d'autre.

const JOURS: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

const objet = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : null);

function moment(x: unknown, jourInconnu: string, heureInvalide: string): { jour: JourSemaine; heure: string } {
	const m = objet(x);
	if (!m) throw new DonneeInvalide('Horaires invalides');
	if (!JOURS.includes(m.jour as JourSemaine)) throw new DonneeInvalide(jourInconnu);
	if (typeof m.heure !== 'string' || !HEURE.test(m.heure)) throw new DonneeInvalide(heureInvalide);
	return { jour: m.jour as JourSemaine, heure: m.heure };
}

// La relève et la fin forment une semaine : une fin le jour de la relève tombe au plus tard à son heure. Sans heures de semaine,
// l'astreinte est continue ; avec, elles sont deux heures différentes (la nuit si le début suit la fin).
export function exigerHoraires(x: unknown): Horaires {
	const h = objet(x);
	if (!h) throw new DonneeInvalide('Horaires invalides');
	const debut = moment(h.debut, 'Jour de relève inconnu', 'Heure de relève invalide');
	const fin = moment(h.fin, 'Jour de fin inconnu', 'Heure de fin invalide');
	if (fin.jour === debut.jour && fin.heure > debut.heure) throw new DonneeInvalide('La fin doit tomber au plus tard à l’heure de la relève suivante');
	if (h.semaine === undefined || h.semaine === null) return { debut, fin };
	const s = objet(h.semaine);
	if (!s || typeof s.debut !== 'string' || typeof s.fin !== 'string' || !HEURE.test(s.debut) || !HEURE.test(s.fin)) throw new DonneeInvalide('Heure de semaine invalide');
	if (s.debut === s.fin) throw new DonneeInvalide('Les heures de semaine doivent être différentes');
	return { debut, fin, semaine: { debut: s.debut, fin: s.fin } };
}

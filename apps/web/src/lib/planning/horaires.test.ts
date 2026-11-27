import { describe, expect, it } from 'vitest';
import { horairesDeLaSaisie, lignesHoraires, phraseHoraires } from './horaires.ts';

const centre = { debut: { jour: 'vendredi' as const, heure: '18:00' }, fin: { jour: 'vendredi' as const, heure: '06:00' }, semaine: { debut: '18:00', fin: '06:00' } };
const continue_ = { debut: { jour: 'lundi' as const, heure: '07:30' }, fin: { jour: 'lundi' as const, heure: '07:30' } };

describe('horaires de garde à l’écran', () => {
	it('les lignes de la lecture seule', () => {
		expect(lignesHoraires(centre)).toEqual([
			{ titre: 'Relève', valeur: 'Vendredi, 18 h' },
			{ titre: 'Fin de l’astreinte', valeur: '6 h' },
			{ titre: 'En semaine', valeur: 'De 18 h à 6 h' }
		]);
		expect(lignesHoraires({ ...continue_, fin: { jour: 'dimanche', heure: '00:00' } }).slice(1)).toEqual([
			{ titre: 'Fin de l’astreinte', valeur: 'Dimanche, minuit' },
			{ titre: 'En semaine', valeur: 'Astreinte continue' }
		]);
	});

	it('la phrase des horaires du centre', () => {
		expect(phraseHoraires(centre)).toBe('Relève le vendredi à 18 h, fin à 6 h, en semaine de 18 h à 6 h.');
		expect(phraseHoraires(continue_)).toBe('Relève le lundi à 7 h 30, fin à 7 h 30, astreinte continue.');
	});

	it('la saisie : la fin le jour de la relève ; continue, sans heures de semaine', () => {
		const f = new FormData();
		for (const [k, v] of [['jour', 'lundi'], ['releve', '19:00'], ['fin', '07:00'], ['semaine-debut', '19:00'], ['semaine-fin', '07:00']]) f.set(k, v!);
		expect(horairesDeLaSaisie(f)).toEqual({ debut: { jour: 'lundi', heure: '19:00' }, fin: { jour: 'lundi', heure: '07:00' }, semaine: { debut: '19:00', fin: '07:00' } });
		f.set('continue', '1');
		expect(horairesDeLaSaisie(f)).toEqual({ debut: { jour: 'lundi', heure: '19:00' }, fin: { jour: 'lundi', heure: '07:00' } });
	});
});

import { NOMS_ICONES } from '@gyro-caserne/socle';
import { expect, it } from 'vitest';
import { NOMS_ICONES as NOMS_LUS } from '../../routes/reglages/roles.ts';
import { ICONES_ROLES } from './icones-roles.ts';

it('les icônes de l’appli et leurs noms lus sont exactement celles du socle', () => {
	expect(Object.keys(ICONES_ROLES).sort()).toEqual([...NOMS_ICONES].sort());
	expect(Object.keys(NOMS_LUS).sort()).toEqual([...NOMS_ICONES].sort());
	expect(NOMS_ICONES).toHaveLength(34);
});

it('les 12 icônes ajoutées, avec le nom lu par les lecteurs d’écran', () => {
	expect(NOMS_LUS).toMatchObject({
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
		euro: 'Euro'
	});
});

it('les 8 icônes des comités, rôles et référents (musique et appareil photo existaient déjà)', () => {
	expect(NOMS_LUS).toMatchObject({
		retraites: 'Retraités',
		pharmacie: 'Pharmacie',
		sport: 'Sport',
		informatique: 'Informatique',
		formation: 'Formation',
		cuisine: 'Cuisine',
		outils: 'Boîte à outils',
		medaille: 'Médaille'
	});
});

import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const texteDe = (prefixe: string) => readFileSync(new URL(migrations.find((f) => f.startsWith(prefixe))!, dossier), 'utf8');
const jouer = (sqlite: DatabaseSync, texte: string) => {
	for (const i of texte.split('--> statement-breakpoint')) sqlite.exec(i);
};
const comptage = readFileSync(new URL('../../../docs/technique/comptage-reprise-habillement.sql', import.meta.url), 'utf8');
const REGLAGE = '{"etapes":[{"id":"estock","nom":"En stock"},{"id":"ecommande","nom":"Commandée au SDIS"}],"derniere":"Livrée"}';

// Une base d'avant la reprise : le chef (1), le référent habillement (2), Alice (3) et Bruno (4) ; une demande d'habillement
// dans chaque état, avec son fil et des avis ; et une demande à la pharmacie (C1), qui prend le numéro 1.
function baseAvant(avecReferent = true) {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	for (const f of migrations.filter((f) => f < '0036_')) jouer(sqlite, readFileSync(new URL(f, dossier), 'utf8'));
	sqlite.exec(`
		INSERT INTO personne (email, prenom, nom) VALUES ('c@x.fr', 'Claire', 'Chef'), ('r@x.fr', 'Rémi', 'Roux'), ('a@x.fr', 'Alice', 'Martin'), ('b@x.fr', 'Bruno', 'Petit');
		INSERT INTO responsabilite (id, nom, nature, type_perimetre, systeme) VALUES (1, 'Chef de centre', 'fonction', 'centre', 'chef_centre');
		INSERT INTO responsabilite_droit (responsabilite_id, droit, verrouille) VALUES (1, 'GERER_HABILLEMENT', 1);
		INSERT INTO responsabilite (id, nom, nature, type_perimetre, demandes) VALUES (3, 'Référent pharmacie', 'mission', 'centre', '{"etapes":[],"derniere":"Faite"}');
		INSERT INTO responsabilite (id, nom, nature, type_perimetre, archivee_le) VALUES (4, 'Tenues', 'mission', 'centre', '2026-10-01');
		INSERT INTO responsabilite_droit (responsabilite_id, droit) VALUES (4, 'GERER_HABILLEMENT');
		INSERT INTO responsabilite (id, nom, nature, type_perimetre, modele) VALUES (5, 'Tenues de sport', 'mission', 'centre', 'referent_habillement');
		INSERT INTO demande_referent (responsabilite_id, demandeur_id, texte, cree_le, maj_le) VALUES (3, 4, 'Pansements', '2026-11-20T08:00', '2026-11-20T08:00');
		INSERT INTO demande_habillement (id, demandeur_id, texte, etape, issue, prise_par, livraison, cree_le, maj_le, fin_le) VALUES
			(1, 3, 'Veste en L', 'demandee', NULL, NULL, NULL, '2026-11-01T08:00', '2026-11-01T08:00', NULL),
			(2, 3, 'Rangers 43', 'prise', NULL, 1, NULL, '2026-11-02T08:00', '2026-11-03T09:00', NULL),
			(3, 4, 'Pantalon F1', 'question', NULL, 2, NULL, '2026-11-03T08:00', '2026-11-03T10:00', NULL),
			(4, 4, 'Gants', 'prise', NULL, 2, NULL, '2026-11-04T08:00', '2026-11-04T11:00', NULL),
			(5, 3, 'Polo', 'traitee', 'stock', 2, NULL, '2026-11-05T08:00', '2026-11-05T09:00', NULL),
			(6, 4, 'Parka', 'traitee', 'commande', 2, NULL, '2026-11-06T08:00', '2026-11-06T09:00', NULL),
			(7, 3, 'Ceinturon', 'livree', 'stock', 2, 'Dans votre casier', '2026-11-07T08:00', '2026-11-08T09:00', '2026-11-08T09:00'),
			(8, 4, 'Casque F1', 'refusee', NULL, 2, NULL, '2026-11-08T08:00', '2026-11-08T10:00', '2026-11-08T10:00'),
			(9, 3, 'Cagoule', 'annulee', NULL, NULL, NULL, '2026-11-09T08:00', '2026-11-09T09:00', '2026-11-09T09:00');
		INSERT INTO fil_habillement (demande_id, quoi, texte, par, le, jeton) VALUES
			(2, 'prise', NULL, 2, '2026-11-02T09:00', 'j1'),
			(3, 'prise', NULL, 2, '2026-11-03T09:00', NULL),
			(2, 'precision', 'Plutôt montantes', 3, '2026-11-03T08:00', NULL),
			(3, 'question', 'Quelle taille ?', 2, '2026-11-03T10:00', NULL),
			(2, 'reprise', NULL, 1, '2026-11-03T09:00', NULL),
			(4, 'prise', NULL, 2, '2026-11-04T09:00', NULL),
			(4, 'question', 'Taille 9 ?', 2, '2026-11-04T10:00', NULL),
			(4, 'reponse', 'Oui, 9', 4, '2026-11-04T11:00', NULL),
			(5, 'prise', NULL, 2, '2026-11-05T08:30', NULL),
			(5, 'stock', 'Taille M', 2, '2026-11-05T09:00', NULL),
			(6, 'commande', NULL, 2, '2026-11-06T09:00', NULL),
			(7, 'prise', NULL, 2, '2026-11-07T09:00', NULL),
			(7, 'stock', NULL, 2, '2026-11-07T10:00', NULL),
			(7, 'livraison', 'Dans votre casier', 2, '2026-11-08T09:00', NULL),
			(8, 'refus', 'Plus en dotation', 2, '2026-11-08T10:00', NULL),
			(9, 'annulation', NULL, 3, '2026-11-09T09:00', NULL);
		INSERT INTO avis_habillement (personne_id, titre, texte, url, cree_le, lue_le) VALUES
			(2, 'Nouvelle demande d’habillement', 'Alice Martin : Veste en L', '/habillement/1', '2026-11-01T08:00', NULL),
			(3, 'Demande prise en compte', 'Rémi Roux s’en occupe : Rangers 43', '/habillement/2', '2026-11-02T09:00', '2026-11-02T10:00'),
			(4, 'Question sur votre demande', 'Rémi Roux : Quelle taille ?', '/habillement/3', '2026-11-03T10:00', NULL),
			(3, 'Tenue livrée', 'Dans votre casier : Ceinturon', '/habillement/7', '2026-11-08T09:00', NULL),
			(3, 'Demande ancienne', 'Une demande effacée depuis', '/habillement/99', '2026-10-01T09:00', NULL);
	`);
	if (avecReferent) {
		sqlite.exec(`
			INSERT INTO responsabilite (id, nom, nature, type_perimetre) VALUES (2, 'Référent habillement', 'mission', 'centre');
			INSERT INTO responsabilite_droit (responsabilite_id, droit) VALUES (2, 'GERER_HABILLEMENT');
		`);
	}
	return sqlite;
}

const tout = (sqlite: DatabaseSync, requete: string) => sqlite.prepare(requete).all().map((l) => ({ ...l }));
const anciennes = (sqlite: DatabaseSync) => ['demande_habillement', 'fil_habillement', 'avis_habillement'].map((t) => tout(sqlite, `SELECT * FROM ${t} ORDER BY id`));
const etat = (sqlite: DatabaseSync) => ({
	demandes: tout(sqlite, 'SELECT * FROM demande_referent ORDER BY id'),
	fil: tout(sqlite, 'SELECT * FROM fil_demande_referent ORDER BY id'),
	avis: tout(sqlite, 'SELECT * FROM avis_demande_referent ORDER BY id'),
	roles: tout(sqlite, 'SELECT id, demandes, demandes_gardees FROM responsabilite ORDER BY id'),
	journal: tout(sqlite, `SELECT acteur, action, cible_type, cible_id, details FROM journal WHERE action = 'reprendre_habillement'`)
});

function migrer(sqlite: DatabaseSync) {
	jouer(sqlite, texteDe('0036_'));
	jouer(sqlite, texteDe('0037_'));
}

describe('migrations 0036 et 0037 : les demandes d’habillement passent dans les demandes aux référents', () => {
	it('ne fait qu’ajouter : aucune suppression, et seule la ligne du rôle est modifiée', () => {
		const texte = `${texteDe('0036_')}\n${texteDe('0037_')}`;
		expect(texte).not.toMatch(/\b(DROP|DELETE|REPLACE)\b/i);
		expect([...texte.matchAll(/\bUPDATE\s+`?(\w+)/gi)].map((m) => m[1])).toEqual(['responsabilite']);
	});

	it('règle le rôle habillement, recopie chaque demande avec son état, son fil et ses avis non lus, sans toucher aux anciennes tables', () => {
		const sqlite = baseAvant();
		const avant = anciennes(sqlite);
		migrer(sqlite);
		expect(anciennes(sqlite)).toEqual(avant);
		const e = etat(sqlite);

		// Le rôle qui porte le droit de l'habillement reçoit des demandes ; l'archivé et celui qui n'a que le modèle, non.
		expect(e.roles).toEqual([
			{ id: 1, demandes: null, demandes_gardees: null },
			{ id: 2, demandes: REGLAGE, demandes_gardees: null },
			{ id: 3, demandes: '{"etapes":[],"derniere":"Faite"}', demandes_gardees: null },
			{ id: 4, demandes: null, demandes_gardees: null },
			{ id: 5, demandes: null, demandes_gardees: null }
		]);

		// La demande de la pharmacie garde son numéro ; les recopiées suivent, dans l'ordre, avec leur numéro d'origine.
		const commun = { responsabilite_id: 2 };
		expect(e.demandes).toEqual([
			{ id: 1, responsabilite_id: 3, demandeur_id: 4, texte: 'Pansements', etape: 'demandee', question: null, prise_par: null, mot: null, cree_le: '2026-11-20T08:00', maj_le: '2026-11-20T08:00', fin_le: null, habillement_id: null },
			{ id: 2, ...commun, demandeur_id: 3, texte: 'Veste en L', etape: 'demandee', question: null, prise_par: null, mot: null, cree_le: '2026-11-01T08:00', maj_le: '2026-11-01T08:00', fin_le: null, habillement_id: 1 },
			{ id: 3, ...commun, demandeur_id: 3, texte: 'Rangers 43', etape: 'prise', question: null, prise_par: 1, mot: null, cree_le: '2026-11-02T08:00', maj_le: '2026-11-03T09:00', fin_le: null, habillement_id: 2 },
			{ id: 4, ...commun, demandeur_id: 4, texte: 'Pantalon F1', etape: 'prise', question: 'posee', prise_par: 2, mot: null, cree_le: '2026-11-03T08:00', maj_le: '2026-11-03T10:00', fin_le: null, habillement_id: 3 },
			// La réponse est arrivée après la dernière question : le référent la retrouve dans « À décider ».
			{ id: 5, ...commun, demandeur_id: 4, texte: 'Gants', etape: 'prise', question: 'repondue', prise_par: 2, mot: null, cree_le: '2026-11-04T08:00', maj_le: '2026-11-04T11:00', fin_le: null, habillement_id: 4 },
			{ id: 6, ...commun, demandeur_id: 3, texte: 'Polo', etape: 'estock', question: null, prise_par: 2, mot: null, cree_le: '2026-11-05T08:00', maj_le: '2026-11-05T09:00', fin_le: null, habillement_id: 5 },
			{ id: 7, ...commun, demandeur_id: 4, texte: 'Parka', etape: 'ecommande', question: null, prise_par: 2, mot: null, cree_le: '2026-11-06T08:00', maj_le: '2026-11-06T09:00', fin_le: null, habillement_id: 6 },
			{ id: 8, ...commun, demandeur_id: 3, texte: 'Ceinturon', etape: 'faite', question: null, prise_par: 2, mot: 'Dans votre casier', cree_le: '2026-11-07T08:00', maj_le: '2026-11-08T09:00', fin_le: '2026-11-08T09:00', habillement_id: 7 },
			{ id: 9, ...commun, demandeur_id: 4, texte: 'Casque F1', etape: 'refusee', question: null, prise_par: 2, mot: 'Plus en dotation', cree_le: '2026-11-08T08:00', maj_le: '2026-11-08T10:00', fin_le: '2026-11-08T10:00', habillement_id: 8 },
			{ id: 10, ...commun, demandeur_id: 3, texte: 'Cagoule', etape: 'annulee', question: null, prise_par: null, mot: null, cree_le: '2026-11-09T08:00', maj_le: '2026-11-09T09:00', fin_le: '2026-11-09T09:00', habillement_id: 9 }
		]);

		// Le fil, dans l'ordre d'origine, avec les auteurs et les heures ; chaque ligne garde la trace de son origine.
		const ligne = (demande_id: number, quoi: string, texte: string | null, par: number, le: string, origine: number, etape: string | null = null, nom_etape: string | null = null) => ({ demande_id, quoi, etape, nom_etape, texte, par, le, jeton: `habillement:${origine}` });
		expect(e.fil.map(({ id, ...l }) => l)).toEqual([
			ligne(3, 'prise', null, 2, '2026-11-02T09:00', 1),
			ligne(4, 'prise', null, 2, '2026-11-03T09:00', 2),
			ligne(3, 'precision', 'Plutôt montantes', 3, '2026-11-03T08:00', 3),
			ligne(4, 'question', 'Quelle taille ?', 2, '2026-11-03T10:00', 4),
			ligne(3, 'reprise', null, 1, '2026-11-03T09:00', 5),
			ligne(5, 'prise', null, 2, '2026-11-04T09:00', 6),
			ligne(5, 'question', 'Taille 9 ?', 2, '2026-11-04T10:00', 7),
			ligne(5, 'reponse', 'Oui, 9', 4, '2026-11-04T11:00', 8),
			ligne(6, 'prise', null, 2, '2026-11-05T08:30', 9),
			ligne(6, 'etape', 'Taille M', 2, '2026-11-05T09:00', 10, 'estock', 'En stock'),
			ligne(7, 'etape', null, 2, '2026-11-06T09:00', 11, 'ecommande', 'Commandée au SDIS'),
			ligne(8, 'prise', null, 2, '2026-11-07T09:00', 12),
			ligne(8, 'etape', null, 2, '2026-11-07T10:00', 13, 'estock', 'En stock'),
			ligne(8, 'fin', 'Dans votre casier', 2, '2026-11-08T09:00', 14, 'faite', 'Livrée'),
			ligne(9, 'refus', 'Plus en dotation', 2, '2026-11-08T10:00', 15),
			ligne(10, 'annulation', null, 3, '2026-11-09T09:00', 16)
		]);

		// Les avis non lus d'une demande reprise, vers sa nouvelle adresse ; ni les lus, ni ceux d'une demande disparue.
		expect(e.avis.map(({ id, ...a }) => a)).toEqual([
			{ personne_id: 2, titre: 'Nouvelle demande d’habillement', texte: 'Alice Martin : Veste en L', url: '/demandes/2', cree_le: '2026-11-01T08:00', lue_le: null },
			{ personne_id: 4, titre: 'Question sur votre demande', texte: 'Rémi Roux : Quelle taille ?', url: '/demandes/4', cree_le: '2026-11-03T10:00', lue_le: null },
			{ personne_id: 3, titre: 'Tenue livrée', texte: 'Dans votre casier : Ceinturon', url: '/demandes/8', cree_le: '2026-11-08T09:00', lue_le: null }
		]);

		expect(e.journal).toEqual([{ acteur: 'migration', action: 'reprendre_habillement', cible_type: 'responsabilite', cible_id: 2, details: '{"demandes":9,"recopiees":9,"fil":16,"avis":3}' }]);
	});

	it('donne les mêmes nombres avant et après, état par état, à la requête de comptage', () => {
		const sqlite = baseAvant();
		migrer(sqlite);
		const lignes = tout(sqlite, comptage) as { quoi: string; avant: number; apres: number }[];
		expect(lignes.map((l) => [l.quoi, l.avant])).toEqual([['demandee', 1], ['prise', 2], ['question', 1], ['stock', 1], ['commande', 1], ['traitee sans issue', 0], ['livree', 1], ['refusee', 1], ['annulee', 1], ['fil', 16], ['avis non lus', 3]]);
		for (const l of lignes) expect(l.apres, l.quoi).toBe(l.quoi === 'traitee sans issue' ? null : l.avant);
	});

	it('rejouée, ne duplique rien, même après un geste sur une demande reprise', () => {
		const sqlite = baseAvant();
		migrer(sqlite);
		sqlite.exec(`INSERT INTO fil_demande_referent (demande_id, quoi, texte, par, le, jeton) VALUES (2, 'precision', 'Encore là', 3, '2026-11-24T08:00', 'abc')`);
		const une = etat(sqlite);
		jouer(sqlite, texteDe('0037_'));
		expect(etat(sqlite)).toEqual(une);
	});

	it('rejouée après un changement du réglage, ne règle pas un autre rôle', () => {
		const sqlite = baseAvant();
		migrer(sqlite);
		sqlite.exec(`UPDATE responsabilite SET demandes = '{"etapes":[],"derniere":"Remise"}' WHERE id = 2`);
		const une = etat(sqlite);
		jouer(sqlite, texteDe('0037_'));
		expect(etat(sqlite)).toEqual(une);
	});

	it('parmi les rôles qui portent le droit, prend celui qui a un titulaire en cours', () => {
		const sqlite = baseAvant();
		sqlite.exec(`
			INSERT INTO responsabilite (id, nom, nature, type_perimetre) VALUES (6, 'Tenues du centre', 'mission', 'centre');
			INSERT INTO responsabilite_droit (responsabilite_id, droit) VALUES (6, 'GERER_HABILLEMENT');
			INSERT INTO attribution (personne_id, responsabilite_id, perimetre_type, debut, saisie_par, saisie_le) VALUES (2, 6, 'centre', '2026-01-01', 'super:a@b.fr', '2026-01-01');
		`);
		migrer(sqlite);
		const e = etat(sqlite);
		expect(e.roles.filter((r) => r.demandes === REGLAGE).map((r) => r.id)).toEqual([6]);
		expect(e.demandes.filter((d) => d.responsabilite_id === 6)).toHaveLength(9);
	});

	it('sans demande d’habillement : le rôle est réglé, et une relance après un changement de réglage n’en règle pas un second', () => {
		const sqlite = baseAvant();
		sqlite.exec('DELETE FROM avis_habillement; DELETE FROM fil_habillement; DELETE FROM demande_habillement;');
		migrer(sqlite);
		expect(etat(sqlite).roles.find((r) => r.id === 2)?.demandes).toBe(REGLAGE);
		expect(etat(sqlite).journal).toEqual([]);
		sqlite.exec(`UPDATE responsabilite SET demandes = NULL, demandes_gardees = '${REGLAGE}' WHERE id = 2`);
		const une = etat(sqlite);
		jouer(sqlite, texteDe('0037_'));
		expect(etat(sqlite)).toEqual(une);
	});

	it('à défaut d’un rôle qui porte le droit, prend le rôle créé à partir du modèle', () => {
		const sqlite = baseAvant(false);
		migrer(sqlite);
		const e = etat(sqlite);
		expect(e.roles.find((r) => r.id === 5)?.demandes).toBe(REGLAGE);
		expect(e.demandes.filter((d) => d.responsabilite_id === 5)).toHaveLength(9);
	});

	it('sans rôle habillement, ne recopie rien et le dit au journal', () => {
		const sqlite = baseAvant(false);
		sqlite.exec('DELETE FROM responsabilite WHERE id = 5');
		const avant = anciennes(sqlite);
		migrer(sqlite);
		expect(anciennes(sqlite)).toEqual(avant);
		const e = etat(sqlite);
		expect(e.demandes).toHaveLength(1);
		expect(e.fil).toEqual([]);
		expect(e.avis).toEqual([]);
		expect(e.roles.every((r) => r.id === 3 || r.demandes === null)).toBe(true);
		expect(e.journal).toEqual([{ acteur: 'migration', action: 'reprendre_habillement', cible_type: 'responsabilite', cible_id: null, details: '{"demandes":9,"recopiees":0,"fil":0,"avis":0}' }]);
	});

	it('sur une base neuve, n’écrit rien', () => {
		const sqlite = new DatabaseSync(':memory:');
		for (const f of migrations) jouer(sqlite, readFileSync(new URL(f, dossier), 'utf8'));
		expect(tout(sqlite, 'SELECT count(*) AS n FROM journal')).toEqual([{ n: 0 }]);
		expect(tout(sqlite, 'SELECT count(*) AS n FROM demande_referent')).toEqual([{ n: 0 }]);
	});
});

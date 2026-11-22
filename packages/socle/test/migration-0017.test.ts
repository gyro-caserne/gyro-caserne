import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { FICHES_PAR_DEFAUT } from '../src/fiches-de-depart.ts';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const fichier = migrations.find((f) => f.startsWith('0017_'))!;
const appliquer = (sqlite: DatabaseSync, nom: string) => {
	for (const instruction of readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint')) sqlite.exec(instruction);
};
const avant = () => {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	for (const f of migrations.filter((f) => f < '0017_')) appliquer(sqlite, f);
	return sqlite;
};
const remplie = () => {
	const sqlite = avant();
	sqlite.exec(`INSERT INTO profil (nom, type_personne) VALUES ('Agent', 'agent');`);
	sqlite.exec(`INSERT INTO responsabilite (nom, nature, type_perimetre, systeme) VALUES ('Chef de garde', 'fonction', 'equipe', 'chef_equipe'), ('Référent engins', 'mission', 'centre', NULL);`);
	sqlite.exec(`INSERT INTO responsabilite_droit (responsabilite_id, droit, verrouille) VALUES (1, 'VALIDER_REMPLACEMENT', 1), (2, 'GERER_FICHES', 0);`);
	return sqlite;
};
const lignes = (sqlite: DatabaseSync, requete: string) => sqlite.prepare(requete).all().map((l) => ({ ...l }));

function fichesLues(sqlite: DatabaseSync) {
	const types = lignes(sqlite, 'SELECT id, nom FROM type_engin ORDER BY ordre') as { id: number; nom: string }[];
	return types.map((t) => ({
		type: t.nom,
		zones: (lignes(sqlite, `SELECT z.id, z.nom FROM fiche_zone z JOIN fiche_version v ON v.id = z.version_id WHERE v.type_id = ${t.id} ORDER BY z.ordre`) as { id: number; nom: string }[]).map((z) => ({
			nom: z.nom,
			elements: (lignes(sqlite, `SELECT libelle, quantite FROM fiche_element WHERE zone_id = ${z.id} ORDER BY ordre`) as { libelle: string; quantite: number | null }[]).map((e) => [e.libelle, e.quantite])
		}))
	}));
}

// Les libellés renommés depuis (charte des textes, 21/11/2026) : la migration garde les anciens, les bases déjà remplies aussi.
const RENOMMES: Record<string, string> = {
	'Radio : essai': 'Essai radio',
	'Terminal / GPS': 'Terminal et GPS',
	'Aspirateur de mucosités : essai': 'Essai de l’aspirateur de mucosités',
	'Bouteille d’oxygène fixe : pression': 'Pression de la bouteille d’oxygène fixe',
	'DSA : voyant vert, électrodes adulte et enfant': 'DSA (voyant vert, électrodes adulte et enfant)',
	'Bouteille d’oxygène portable : pression': 'Pression de la bouteille d’oxygène portable',
	'ARI : pression et fonctionnement': 'ARI (pression et fonctionnement)',
	'Émulseur : niveau': 'Niveau d’émulseur',
	'Pompe : essai': 'Essai de la pompe',
	'Tronçonneuse : plein et essai': 'Tronçonneuse (plein et essai)',
	'Motopompe : plein et essai': 'Motopompe (plein et essai)',
	'Groupe électrogène : plein et essai': 'Groupe électrogène (plein et essai)'
};
const renommees = (fiches: ReturnType<typeof fichesLues>) =>
	fiches.map((f) => ({ ...f, zones: f.zones.map((z) => ({ ...z, elements: z.elements.map(([l, q]) => [RENOMMES[l as string] ?? l, q]) })) }));

describe('migration 0017', () => {
	it('base déjà remplie : les fiches de départ, identiques à celles du jeu de départ (aux libellés renommés près), en version 1', () => {
		const sqlite = remplie();
		appliquer(sqlite, fichier);
		expect(renommees(fichesLues(sqlite))).toEqual(FICHES_PAR_DEFAUT);
		expect(lignes(sqlite, 'SELECT numero, utilisee FROM fiche_version')).toEqual([1, 2, 3].map(() => ({ numero: 1, utilisee: 0 })));
		expect(lignes(sqlite, 'SELECT count(DISTINCT ref) AS n, count(*) AS total FROM fiche_element')).toEqual([{ n: 72, total: 72 }]);
	});

	it('le chef de garde reçoit « Engins : Gérer » (verrouillé) ; le reste ne bouge pas', () => {
		const sqlite = remplie();
		appliquer(sqlite, fichier);
		expect(lignes(sqlite, 'SELECT responsabilite_id AS r, droit, verrouille FROM responsabilite_droit ORDER BY r, droit')).toEqual([
			{ r: 1, droit: 'GERER_FICHES', verrouille: 1 },
			{ r: 1, droit: 'TRAITER_ANOMALIE', verrouille: 1 },
			{ r: 1, droit: 'VALIDER_REMPLACEMENT', verrouille: 1 },
			{ r: 2, droit: 'GERER_FICHES', verrouille: 0 }
		]);
	});

	it('base vide : aucune fiche (le jeu de départ les posera)', () => {
		const sqlite = avant();
		appliquer(sqlite, fichier);
		expect(lignes(sqlite, 'SELECT * FROM type_engin')).toEqual([]);
		expect(lignes(sqlite, 'SELECT * FROM fiche_element')).toEqual([]);
	});

	it('un engin prêté a sa provenance ; un engin parti, sa date de départ', () => {
		const sqlite = remplie();
		appliquer(sqlite, fichier);
		const ajouter = (situation: string, provenance: string | null, partiLe: string | null) => () =>
			sqlite.prepare(`INSERT INTO engin (nom, type_id, situation, provenance, parti_le, cree_le) VALUES ('VSAV 2', 1, ?, ?, ?, 'x')`).run(situation, provenance, partiLe);
		expect(ajouter('prete', null, null)).toThrow();
		expect(ajouter('parti', null, null)).toThrow();
		expect(ajouter('centre', null, '2026-11-02')).toThrow();
		expect(ajouter('prete', 'CIS Exemple-Nord', null)).not.toThrow();
		expect(ajouter('parti', null, '2026-11-02')).not.toThrow();
	});
});

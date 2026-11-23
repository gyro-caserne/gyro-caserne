import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const jouer = (sqlite: DatabaseSync, f: string) => {
	for (const i of readFileSync(new URL(f, dossier), 'utf8').split('--> statement-breakpoint')) sqlite.exec(i);
};
const tout = (sqlite: DatabaseSync, requete: string) => sqlite.prepare(requete).all().map((l) => ({ ...l }));
const tables = (sqlite: DatabaseSync) => tout(sqlite, `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%habillement%'`).map((t) => t.name);

// Une base après la reprise 0037 : une demande d'habillement reprise avec son fil et un avis, des droits de profil et de rôle.
function baseRepris() {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	for (const f of migrations.filter((f) => f < '0037_')) jouer(sqlite, f);
	sqlite.exec(`
		INSERT INTO personne (email, prenom, nom) VALUES ('c@x.fr', 'Claire', 'Chef'), ('a@x.fr', 'Alice', 'Martin');
		INSERT INTO profil (id, nom, type_personne) VALUES (1, 'Agent', 'agent');
		INSERT INTO profil_droit (profil_id, droit, perimetre_type) VALUES (1, 'VOIR_PLANNING', 'centre'), (1, 'GERER_HABILLEMENT', 'centre'), (1, 'RESERVER', 'centre');
		INSERT INTO responsabilite (id, nom, nature, type_perimetre, systeme) VALUES (1, 'Chef de centre', 'fonction', 'centre', 'chef_centre');
		INSERT INTO responsabilite (id, nom, nature, type_perimetre) VALUES (2, 'Référent habillement', 'mission', 'centre');
		INSERT INTO responsabilite_droit (responsabilite_id, droit, verrouille) VALUES (1, 'GERER_STOCK', 1), (1, 'GERER_HABILLEMENT', 1), (2, 'GERER_HABILLEMENT', 0), (2, 'GERER_FICHES', 0);
		INSERT INTO demande_habillement (id, demandeur_id, texte, etape, issue, prise_par, cree_le, maj_le) VALUES (5, 2, 'Polo', 'traitee', 'commande', 1, '2026-11-05T08:00', '2026-11-05T09:00');
		INSERT INTO fil_habillement (demande_id, quoi, par, le) VALUES (5, 'prise', 1, '2026-11-05T08:30'), (5, 'commande', 1, '2026-11-05T09:00');
		INSERT INTO avis_habillement (personne_id, titre, texte, url, cree_le) VALUES (2, 'Demande traitée', 'Commandée au SDIS : Polo', '/habillement/5', '2026-11-05T09:00');
	`);
	jouer(sqlite, migrations.find((f) => f.startsWith('0037_'))!);
	return sqlite;
}
const repris = (sqlite: DatabaseSync) => ({
	demandes: tout(sqlite, 'SELECT * FROM demande_referent ORDER BY id'),
	fil: tout(sqlite, 'SELECT * FROM fil_demande_referent ORDER BY id'),
	avis: tout(sqlite, 'SELECT * FROM avis_demande_referent ORDER BY id'),
	roles: tout(sqlite, 'SELECT * FROM responsabilite ORDER BY id'),
	journal: tout(sqlite, 'SELECT * FROM journal ORDER BY id')
});
const la0038 = migrations.find((f) => f.startsWith('0038_'))!;

describe('migration 0038 : les anciennes tables de l’habillement et le droit GERER_HABILLEMENT disparaissent', () => {
	it('supprime les trois tables ; les demandes reprises, leur fil, leurs avis et le réglage du rôle restent intacts', () => {
		const sqlite = baseRepris();
		const avant = repris(sqlite);
		expect(avant.demandes).toHaveLength(1);
		expect(avant.fil).toHaveLength(2);
		expect(avant.avis).toHaveLength(1);
		jouer(sqlite, la0038);
		expect(tables(sqlite)).toEqual([]);
		expect(repris(sqlite)).toEqual(avant);
	});

	it('retire le droit des profils et des rôles, garde les autres lignes avec leur rowid, et refuse désormais ce droit', () => {
		const sqlite = baseRepris();
		const garde = (t: string) => tout(sqlite, `SELECT rowid, * FROM ${t} WHERE droit <> 'GERER_HABILLEMENT' ORDER BY rowid`);
		const profils = garde('profil_droit');
		const roles = garde('responsabilite_droit');
		jouer(sqlite, la0038);
		expect(tout(sqlite, 'SELECT rowid, * FROM profil_droit ORDER BY rowid')).toEqual(profils);
		expect(tout(sqlite, 'SELECT rowid, * FROM responsabilite_droit ORDER BY rowid')).toEqual(roles);
		expect(() => sqlite.exec(`INSERT INTO responsabilite_droit (responsabilite_id, droit) VALUES (2, 'GERER_HABILLEMENT')`)).toThrow(/CHECK/);
		expect(() => sqlite.exec(`INSERT INTO profil_droit (profil_id, droit, perimetre_type) VALUES (1, 'GERER_HABILLEMENT', 'centre')`)).toThrow(/CHECK/);
		// Le reste des contraintes tient : clé étrangère et clé primaire.
		expect(() => sqlite.exec(`INSERT INTO responsabilite_droit (responsabilite_id, droit) VALUES (99, 'GERER_STOCK')`)).toThrow();
		expect(() => sqlite.exec(`INSERT INTO responsabilite_droit (responsabilite_id, droit) VALUES (1, 'GERER_STOCK')`)).toThrow();
		expect(tout(sqlite, 'PRAGMA foreign_key_check')).toEqual([]);
	});

	it('ne fait qu’effacer : pas d’UPDATE, et ne touche à aucune table des demandes aux référents', () => {
		const texte = readFileSync(new URL(la0038, dossier), 'utf8');
		expect(texte).not.toMatch(/^\s*UPDATE\b/m);
		expect(texte).not.toMatch(/referent/);
		expect([...texte.matchAll(/DROP TABLE `(\w+)`/g)].map((m) => m[1])).toEqual(['avis_habillement', 'fil_habillement', 'demande_habillement', 'profil_droit', 'responsabilite_droit']);
	});
});

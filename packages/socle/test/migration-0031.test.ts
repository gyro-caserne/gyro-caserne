import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const instructions = (nom: string) => readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint');

describe('migration 0031 : les traces d’une prise de garde', () => {
	it('ajoute des traces vides à chaque prise, sans rien toucher d’autre', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const f of migrations.filter((f) => f < '0031_')) for (const i of instructions(f)) sqlite.exec(i);
		sqlite.exec(`INSERT INTO personne (email, prenom, nom) VALUES ('a@exemple.fr', 'Alice', 'Martin')`);
		sqlite.exec(`INSERT INTO type_engin (nom, ordre) VALUES ('VSAV', 1)`);
		sqlite.exec(`INSERT INTO engin (nom, type_id, cree_le) VALUES ('VSAV 1', 1, '2026-11-01T10:00')`);
		sqlite.exec(`INSERT INTO fiche_version (type_id, numero, auteur, cree_le) VALUES (1, 1, 'a', '2026-11-01T10:00')`);
		sqlite.exec(`INSERT INTO prise_garde (engin_id, releve, version_id, etat, saisie, commencee_par, commencee_le, modifiee_par, modifiee_le, validee_le) VALUES (1, '2026-11-20T18:00', 1, 'validee', '{"zones":[1]}', 1, '2026-11-20T18:05', 1, '2026-11-20T18:30', '2026-11-20T18:30')`);
		for (const i of instructions(migrations.find((f) => f.startsWith('0031_'))!)) sqlite.exec(i);
		expect(sqlite.prepare('SELECT id, etat, saisie, traces FROM prise_garde').all()).toEqual([{ id: 1, etat: 'validee', saisie: '{"zones":[1]}', traces: '{}' }]);
	});
});

import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const instructions = (nom: string) => readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint');

describe('migration 0039 : qui prévenir, par zone', () => {
	it('ajoute la colonne, vide, sans rien toucher d’autre', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const f of migrations.filter((f) => f < '0039_')) for (const i of instructions(f)) sqlite.exec(i);
		sqlite.exec(`INSERT INTO type_engin (nom, ordre) VALUES ('VSAV', 1)`);
		sqlite.exec(`INSERT INTO fiche_version (type_id, numero, auteur, cree_le) VALUES (1, 1, 'x', '2026-11-01')`);
		sqlite.exec(`INSERT INTO fiche_zone (version_id, ref, nom, ordre) VALUES (1, 1, 'Sac PS', 1)`);
		const migration = migrations.find((f) => f.startsWith('0039_'))!;
		expect(readFileSync(new URL(migration, dossier), 'utf8').trim()).toMatch(/^ALTER TABLE `fiche_zone` ADD `prevenir` text;$/);
		for (const i of instructions(migration)) sqlite.exec(i);
		expect(sqlite.prepare('SELECT ref, nom, ordre, prevenir FROM fiche_zone').all()).toEqual([{ ref: 1, nom: 'Sac PS', ordre: 1, prevenir: null }]);
	});
});

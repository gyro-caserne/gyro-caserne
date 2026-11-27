import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const instructions = (nom: string) => readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint');

describe('migration 0041 : horaires de garde et remplacement court', () => {
	it('ne fait qu’ajouter une colonne vide et une table, sans toucher aux années', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const f of migrations.filter((f) => f < '0041_')) for (const i of instructions(f)) sqlite.exec(i);
		sqlite.exec(`INSERT INTO annee_planning (annee, ordre, publiee_le) VALUES (2026, '[1,2,3,4]', '2025-12-01T10:00')`);
		const migration = migrations.find((f) => f.startsWith('0041_'))!;
		for (const i of instructions(migration)) expect(i.trim()).toMatch(/^(CREATE TABLE|ALTER TABLE `annee_planning` ADD `horaires` text;$)/);
		for (const i of instructions(migration)) sqlite.exec(i);
		expect(sqlite.prepare('SELECT annee, ordre, publiee_le, horaires FROM annee_planning').all()).toEqual([{ annee: 2026, ordre: '[1,2,3,4]', publiee_le: '2025-12-01T10:00', horaires: null }]);
		expect(sqlite.prepare('SELECT count(*) AS n FROM reglage_court').get()).toEqual({ n: 0 });
	});
});

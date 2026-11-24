import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const instructions = (nom: string) => readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint');

describe('migration 0040 : ancienneté', () => {
	it('ne fait qu’ajouter deux tables et leurs index, sans toucher aux fiches', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const f of migrations.filter((f) => f < '0040_')) for (const i of instructions(f)) sqlite.exec(i);
		sqlite.exec(`INSERT INTO personne (email, prenom, nom, engagement_spv) VALUES ('a@b.fr', 'Thomas', 'Agent', '2016-12-12')`);
		const migration = migrations.find((f) => f.startsWith('0040_'))!;
		for (const i of instructions(migration)) expect(i.trim()).toMatch(/^CREATE (TABLE|UNIQUE INDEX|INDEX) /);
		for (const i of instructions(migration)) sqlite.exec(i);
		expect(sqlite.prepare('SELECT prenom, engagement_spv FROM personne').all()).toEqual([{ prenom: 'Thomas', engagement_spv: '2016-12-12' }]);
		expect(sqlite.prepare('SELECT count(*) AS n FROM avis_anciennete').get()).toEqual({ n: 0 });
		expect(sqlite.prepare('SELECT count(*) AS n FROM reglage_anciennete').get()).toEqual({ n: 0 });
	});
});

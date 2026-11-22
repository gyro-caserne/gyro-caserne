import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const instructions = (nom: string) => readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint');

describe('migration 0033 : les murs ouverts à un profil', () => {
	it('ajoute une liste vide à chaque profil, sans rien toucher d’autre', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const f of migrations.filter((f) => f < '0033_')) for (const i of instructions(f)) sqlite.exec(i);
		sqlite.exec(`INSERT INTO profil (nom, type_personne) VALUES ('Agent', 'agent'), ('Réserve citoyenne', 'exterieur')`);
		for (const i of instructions(migrations.find((f) => f.startsWith('0033_'))!)) sqlite.exec(i);
		expect(sqlite.prepare('SELECT nom, type_personne, murs_ouverts FROM profil ORDER BY id').all()).toEqual([
			{ nom: 'Agent', type_personne: 'agent', murs_ouverts: '{}' },
			{ nom: 'Réserve citoyenne', type_personne: 'exterieur', murs_ouverts: '{}' }
		]);
	});
});

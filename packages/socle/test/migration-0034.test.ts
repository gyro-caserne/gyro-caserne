import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dossier = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort();
const instructions = (nom: string) => readFileSync(new URL(nom, dossier), 'utf8').split('--> statement-breakpoint');

describe('migration 0034 : publier au nom d’un comité', () => {
	it('ajoute un comité vide à chaque publication, sans rien toucher d’autre', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		for (const f of migrations.filter((f) => f < '0034_')) for (const i of instructions(f)) sqlite.exec(i);
		sqlite.exec(`INSERT INTO publication (mur, auteur, type, texte, cree_le) VALUES ('vie', 'personne:1', 'message', 'Bonjour', '2026-11-01T10:00')`);
		for (const i of instructions(migrations.find((f) => f.startsWith('0034_'))!)) sqlite.exec(i);
		expect(sqlite.prepare('SELECT mur, auteur, texte, comite_id FROM publication').all()).toEqual([{ mur: 'vie', auteur: 'personne:1', texte: 'Bonjour', comite_id: null }]);
	});
});

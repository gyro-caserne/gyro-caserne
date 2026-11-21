import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// La charte, section « Les textes » : jamais de point médian, de tiret cadratin, de flèche ni de barre
// pour séparer des informations dans un texte que voit un agent. On écrit une phrase, avec des virgules.
const appli = new URL('.', import.meta.url).pathname;
const socle = new URL('../../../packages/socle/src/', import.meta.url).pathname;

const SEPARATEURS: [RegExp, string][] = [
	[/·/, 'point médian'],
	[/—/, 'tiret cadratin'],
	[/→/, 'flèche'],
	[/(?<![|\\])\s\|\s(?!\|)/, 'barre'],
];

type Texte = { texte: string; ligne: number };

// Les chaînes d'un code TypeScript ou JavaScript, sans ses commentaires.
// Lecture caractère par caractère : guillemets, gabarits `…${…}…`, expressions régulières.
export function chaines(code: string, decalage = 0): Texte[] {
	const trouvees: Texte[] = [];
	const pile: number[] = []; // profondeur d'accolades de chaque `${` ouvert
	let i = 0;
	let ligne = 1 + decalage;
	let dernier = ''; // dernier caractère significatif du code, pour reconnaître une expression régulière
	const avance = (n = 1) => {
		for (let k = 0; k < n; k++) if (code[i++] === '\n') ligne++;
	};
	const gabarit = () => {
		// Lit un gabarit jusqu'à « ` » ou « ${ » ; rend true si une expression s'ouvre.
		let morceau = '';
		const debut = ligne;
		while (i < code.length) {
			const c = code[i];
			if (c === '\\') { morceau += code.slice(i, i + 2); avance(2); continue; }
			if (c === '`') { avance(); trouvees.push({ texte: morceau, ligne: debut }); return false; }
			if (c === '$' && code[i + 1] === '{') { avance(2); trouvees.push({ texte: morceau, ligne: debut }); pile.push(0); return true; }
			morceau += c;
			avance();
		}
		return false;
	};
	while (i < code.length) {
		const c = code[i]!;
		const s = code[i + 1];
		if (c === '/' && s === '/') { while (i < code.length && code[i] !== '\n') avance(); continue; }
		if (c === '/' && s === '*') { const fin = code.indexOf('*/', i + 2); avance((fin < 0 ? code.length : fin + 2) - i); continue; }
		if (c === "'" || c === '"') {
			const debut = ligne;
			let morceau = '';
			avance();
			while (i < code.length && code[i] !== c && code[i] !== '\n') {
				if (code[i] === '\\') { morceau += code.slice(i, i + 2); avance(2); } else { morceau += code[i]; avance(); }
			}
			avance();
			trouvees.push({ texte: morceau, ligne: debut });
			dernier = 'a';
			continue;
		}
		if (c === '`') { avance(); gabarit(); dernier = 'a'; continue; }
		if (c === '/' && (dernier === '' || '(,=:[!&|?{};+-*%<>~^'.includes(dernier))) {
			// Une expression régulière : on la saute.
			avance();
			let classe = false;
			while (i < code.length && code[i] !== '\n') {
				const r = code[i];
				if (r === '\\') { avance(2); continue; }
				if (r === '[') classe = true;
				else if (r === ']') classe = false;
				else if (r === '/' && !classe) break;
				avance();
			}
			avance();
			dernier = 'a';
			continue;
		}
		if (pile.length) {
			if (c === '{') pile[pile.length - 1]!++;
			else if (c === '}') {
				if (pile[pile.length - 1] === 0) { pile.pop(); avance(); gabarit(); dernier = 'a'; continue; }
				pile[pile.length - 1]!--;
			}
		}
		if (!/\s/.test(c)) dernier = /[\w$)\]]/.test(c) ? 'a' : c;
		// Un mot-clé suivi d'une expression régulière (« return /…/ »).
		if (/\w/.test(c) && /\b(return|typeof|case)$/.test(code.slice(Math.max(0, i - 6), i + 1))) dernier = '';
		avance();
	}
	return trouvees;
}

// Le balisage d'un fichier Svelte (hors <script>, <style> et commentaires) et les chaînes de ses scripts.
// Dans le balisage, le texte se lit tel quel ; dans une expression `{…}`, seules ses chaînes comptent.
export function textesSvelte(source: string): Texte[] {
	const lignesAvant = (pos: number) => source.slice(0, pos).split('\n').length - 1;
	const textes: Texte[] = [];
	for (const m of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) textes.push(...chaines(m[1]!, lignesAvant(m.index! + m[0].indexOf('>') + 1)));
	const balisage = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, (b) => b.replace(/[^\n]/g, ' '));
	let profondeur = 0;
	let debut = 0;
	let texte = '';
	let ligne = 1;
	for (let i = 0; i < balisage.length; i++) {
		const c = balisage[i]!;
		if (c === '{') {
			if (profondeur++ === 0) debut = i + 1;
		} else if (c === '}' && profondeur > 0) {
			if (--profondeur === 0) textes.push(...chaines(balisage.slice(debut, i), lignesAvant(debut)));
		} else if (profondeur === 0) {
			if (c === '\n') { textes.push({ texte, ligne }); texte = ''; ligne++; } else texte += c;
		}
		if (profondeur > 0 && c === '\n') ligne++;
	}
	textes.push({ texte, ligne });
	return textes;
}

export function fautes(fichier: string, textes: Texte[]): string[] {
	return textes.flatMap(({ texte, ligne }) => SEPARATEURS.filter(([motif]) => motif.test(texte)).map(([, nom]) => `${fichier}:${ligne} ${nom} : ${texte.trim().slice(0, 80)}`));
}

const tous = (dossier: string): string[] =>
	readdirSync(dossier, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tous(join(dossier, e.name)) : [join(dossier, e.name)]));
const produits = (dossier: string) => tous(dossier).filter((f) => /\.(ts|svelte)$/.test(f) && !/\.(test|spec)\.ts$/.test(f) && !f.endsWith('.d.ts'));

function relevees(f: string): string[] {
	const source = readFileSync(f, 'utf8');
	const nom = relative(join(appli, '../../..'), f);
	return fautes(nom, f.endsWith('.svelte') ? textesSvelte(source) : chaines(source));
}

describe('textes visibles', () => {
	it('la lecture des chaînes ignore les commentaires et garde les gabarits', () => {
		const code = "// a · b\nconst x = 'Feux · forêt'; /* c — d */ const y = `${n} → ${m ? 'oui | non' : ''}`; const r = /a|b/;";
		expect(chaines(code).map((c) => c.texte)).toEqual(['Feux · forêt', '', ' → ', 'oui | non', '', '']);
	});

	it('la garde attrape un texte fautif, et pas un commentaire', () => {
		const svelte = "<script>\n\t// Exemple : « A · B »\n\tconst s = `${a} — ${b}`;\n</script>\n\n<!-- a · b -->\n<p>{nom} · {date}</p>\n<p>{a || b}</p>\n{#snippet s(x: string | null)}{/snippet}<p>{x ? 'a · b' : ''}</p>\n<style>\n\t.a::after { content: '·'; }\n</style>";
		expect(fautes('exemple.svelte', textesSvelte(svelte))).toEqual(['exemple.svelte:3 tiret cadratin : —', 'exemple.svelte:7 point médian : <p> · </p>', 'exemple.svelte:9 point médian : a · b']);
		expect(fautes('exemple.ts', chaines("const t = (a: 'x' | 'y') => a; // a → b\nconst u = 'Radio | essai';"))).toEqual(['exemple.ts:2 barre : Radio | essai']);
	});

	it('aucun texte visible de l’appli ni du socle ne sépare ses infos par « · », « — », « → » ou « | »', () => {
		const racine = readdirSync(appli).filter((f) => /\.ts$/.test(f) && !/\.(test|d)\.ts$/.test(f)).map((f) => join(appli, f));
		const trouvees = [...racine, ...produits(join(appli, 'lib')), ...produits(join(appli, 'routes')), ...produits(socle)].flatMap(relevees);
		expect(trouvees).toEqual([]);
	});
});

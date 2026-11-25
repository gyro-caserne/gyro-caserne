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

// Le balisage brut d'un fichier Svelte, ligne par ligne, sans <script>, <style> ni commentaires.
export const balisage = (source: string): Texte[] =>
	source
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, (b) => b.replace(/[^\n]/g, ' '))
		.split('\n')
		.map((texte, n) => ({ texte, ligne: n + 1 }));

// Dans le balisage : « au nom de : vous » (ligne par ligne). Les autres deux-points entre deux idées se relisent à la main.
const DEUX_POINTS = /\bde\s?:\s|:\s+vous\b/;

// Un bouton ou un lien qui finit par « … », même écrit sur plusieurs lignes ou en ternaire :
// on lit le contenu de la balise jusqu'à sa fermeture, son texte et les chaînes de ses expressions.
const CONTROLE = /<(Bouton|button|a|summary)\b[^>]*>([\s\S]*?)<\/\1>/g;
// Un lien collé derrière la fin d'une phrase, même à la ligne ou derrière un {#if …} : il va sur sa ligne, en bouton secondaire.
const LIEN_COLLE = /[.!?](?:\s|&nbsp;|\{'\s*'\}|\{[#:/][^}]*\})*<a\s/g;

export function fautesBalisage(fichier: string, lignes: Texte[]): string[] {
	const texte = lignes.map((l) => l.texte).join('\n');
	const ligneDe = (pos: number) => texte.slice(0, pos).split('\n').length;
	const extrait = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 80);
	const trouvees: [number, string][] = lignes.filter((l) => DEUX_POINTS.test(l.texte)).map((l) => [l.ligne, `deux-points devant un nom : ${extrait(l.texte)}`]);
	for (const m of texte.matchAll(CONTROLE)) {
		const contenu = m[2]!;
		const brut = contenu.replace(/\{[^}]*\}/g, ' ').replace(/<[^>]*>/g, ' ');
		const morceaux = [brut, ...[...contenu.matchAll(/\{([^}]*)\}/g)].flatMap((e) => chaines(e[1]!).map((c) => c.texte))];
		if (morceaux.some((x) => /…\s*$/.test(x.trim()) || /…$/.test(brut.trim()))) trouvees.push([ligneDe(m.index!), `points de suspension dans un bouton ou un lien : ${extrait(m[0])}`]);
	}
	for (const m of texte.matchAll(LIEN_COLLE)) trouvees.push([ligneDe(m.index!), `lien collé derrière une phrase : ${extrait(m[0])}`]);
	return trouvees.sort((x, y) => x[0] - y[0]).map(([l, t]) => `${fichier}:${l} ${t}`);
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
	if (!f.endsWith('.svelte')) return fautes(nom, chaines(source));
	return [...fautes(nom, textesSvelte(source)), ...fautesBalisage(nom, balisage(source))];
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

	it('la garde attrape aussi « … » dans un bouton, « au nom de : vous » et un lien collé derrière une phrase', () => {
		const svelte = [
			"<script>const t = 'Voir. <a href=x>';</script>",
			'<summary>Abandonner la prise…</summary>',
			'<a href="?x">{TITRES[cle]}…</a>',
			'<p>La prise sera au nom de : <strong>{noms}</strong>.</p>',
			'<p>Responsable : vous</p>',
			'<p>Réglez le roulement. <a href="/r">Aller au roulement</a></p>',
			'<p>Pour ajuster, passez par <a href="/agents">Agents</a>.</p>',
			'<Bouton',
			'\tvariante="secondaire"',
			'>',
			'\tAnnuler ma demande…',
			'</Bouton>',
			"<button type=\"submit\">{envoi ? 'Envoi…' : 'Publier'}</button>",
			'<p>Ses anomalies sont closes.',
			'\t{#if x}<a href="/a">Voir l’anomalie</a>{/if}</p>',
			'<!-- Fin. <a href=x> -->',
			'<button type="submit">Publier</button>'
		].join('\n');
		expect(fautesBalisage('exemple.svelte', balisage(svelte)).map((f) => f.split(' : ')[0])).toEqual([
			'exemple.svelte:2 points de suspension dans un bouton ou un lien',
			'exemple.svelte:3 points de suspension dans un bouton ou un lien',
			'exemple.svelte:4 deux-points devant un nom',
			'exemple.svelte:5 deux-points devant un nom',
			'exemple.svelte:6 lien collé derrière une phrase',
			'exemple.svelte:8 points de suspension dans un bouton ou un lien',
			'exemple.svelte:13 points de suspension dans un bouton ou un lien',
			'exemple.svelte:14 lien collé derrière une phrase'
		]);
	});

	it('aucun texte visible de l’appli ni du socle ne sépare ses infos par « · », « — », « → » ou « | »', () => {
		const racine = readdirSync(appli).filter((f) => /\.ts$/.test(f) && !/\.(test|d)\.ts$/.test(f)).map((f) => join(appli, f));
		const trouvees = [...racine, ...produits(join(appli, 'lib')), ...produits(join(appli, 'routes')), ...produits(socle)].flatMap(relevees);
		expect(trouvees).toEqual([]);
	});

	it('aucun texte de notification du socle ne met deux-points entre deux idées', () => {
		expect(fautesNotifications('exemple.ts', "const texte = `Vous êtes de garde : ${quand}.`;\navis(base, ids, 'x', `Nuit du ${jour}, par ${nom}`, '/');\nconst titre = 'Date invalide : ' + x;")).toEqual(['exemple.ts:1 deux-points entre deux idées : Vous êtes de garde : ', 'exemple.ts:3 deux-points entre deux idées : Date invalide : ']);
		expect(produits(socle).flatMap((f) => fautesNotifications(relative(join(appli, '../../..'), f), readFileSync(f, 'utf8')))).toEqual([]);
	});

	it('emoji : jamais à l’écran ; un seul, en fin de texte, dans les seuls avis conviviaux', () => {
		expect(fautesEmoji('exemple.ts', chaines("const a = 'Bravo 👏'; const b = '🎉 Fête'; const c = 'Joie 🎉🎉'; const d = 'Attention ⚠ et ✓';"), true)).toEqual(['exemple.ts:1 emoji ailleurs qu’en fin de texte : 🎉 Fête', 'exemple.ts:1 un seul emoji : Joie 🎉🎉']);
		expect(fautesEmoji('exemple.ts', chaines("const a = 'Remplacement 🚒';"), false)).toEqual(['exemple.ts:1 emoji hors d’un avis convivial : Remplacement 🚒']);
		const racine = readdirSync(appli).filter((f) => /\.ts$/.test(f) && !/\.(test|d)\.ts$/.test(f)).map((f) => join(appli, f));
		const fichiers = [...racine, ...produits(join(appli, 'lib')), ...produits(join(appli, 'routes')), ...produits(socle)];
		const trouvees = fichiers.flatMap((f) => {
			const nom = relative(join(appli, '../../..'), f);
			if (nom in SANS_GARDE_EMOJI) return [];
			const source = readFileSync(f, 'utf8');
			const textes = f.endsWith('.svelte') ? textesSvelte(source) : chaines(source);
			const permis = AVIS_CONVIVIAUX[nom];
			return [...fautesEmoji(nom, textes.filter((t) => !permis?.test(t.texte)), false), ...fautesEmoji(nom, textes.filter((t) => permis?.test(t.texte)), true)];
		});
		expect(trouvees).toEqual([]);
	});
});

// Les avis conviviaux, seuls à pouvoir finir par un emoji (charte, « Les textes », décision du porteur du 25/11/2026).
// Par fichier, la forme exacte du texte permis : un emoji ailleurs dans le même fichier reste refusé.
const AVIS_CONVIVIAUX: Record<string, RegExp> = {
	// Un souhait d'anniversaire, au téléphone et dans la cloche.
	'packages/socle/src/souhaits.ts': /^ vous souhaite un joyeux anniversaire 🎂$/,
	'apps/web/src/routes/notifications/+page.svelte': /^ vous souhaite un joyeux anniversaire 🎂$/,
	// Les félicitations d'un collègue pour un palier d'ancienneté.
	'packages/socle/src/anciennete.ts': /^ de service 🎖️$/
};
// Pas des textes : les réactions qu'un agent choisit sous une publication.
const SANS_GARDE_EMOJI: Record<string, string> = { 'packages/socle/src/listes.ts': 'les réactions' };

// Un emoji : un pictogramme en couleur, ou un symbole forcé en emoji (sélecteur U+FE0F). Les signes typographiques (✓, ⚠) n'en sont pas.
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/gu;
export function fautesEmoji(fichier: string, textes: Texte[], convivial: boolean): string[] {
	return textes.flatMap(({ texte, ligne }) => {
		const trouves = [...texte.matchAll(EMOJI)];
		if (trouves.length === 0) return [];
		const extrait = texte.trim().slice(0, 80);
		if (!convivial) return [`${fichier}:${ligne} emoji hors d’un avis convivial : ${extrait}`];
		if (trouves.length > 1) return [`${fichier}:${ligne} un seul emoji : ${extrait}`];
		const fin = texte.trimEnd();
		const dernier = trouves[0]!;
		return dernier.index! + dernier[0].length + (fin.endsWith('\uFE0F') && !dernier[0].endsWith('\uFE0F') ? 1 : 0) === fin.length ? [] : [`${fichier}:${ligne} emoji ailleurs qu’en fin de texte : ${extrait}`];
	});
}

// Les titres et textes des notifications : les chaînes des appels qui écrivent un avis, et des constantes qui préparent leur titre,
// leur texte ou leur phrase. Deux-points entre deux idées : deux phrases, ou une virgule (charte, « Les textes »).
const APPELS_AVIS = /\b(?:avis|avisAnomalies|avisUrgence|mettreEnFile|avisDe)\(|\bconst (?:titre|texte|textes|phrase|auChef|avec|avis)\b[^=]*=/g;
export function fautesNotifications(fichier: string, code: string): string[] {
	const trouvees: string[] = [];
	for (const m of code.matchAll(APPELS_AVIS)) {
		// Jusqu'à la parenthèse fermante ou au point-virgule du même niveau.
		let profondeur = 0;
		let fin = m.index! + m[0].length;
		for (; fin < code.length; fin++) {
			const c = code[fin];
			if (c === '(' || c === '{' || c === '[') profondeur++;
			else if (c === ')' || c === '}' || c === ']') {
				if (profondeur-- === 0) break;
			} else if (c === ';' && profondeur <= 0) break;
		}
		const decalage = code.slice(0, m.index!).split('\n').length - 1;
		for (const c of chaines(code.slice(m.index!, fin), decalage)) if (/\S\s:\s|\s:\s*$/.test(c.texte)) trouvees.push(`${fichier}:${c.ligne} deux-points entre deux idées : ${c.texte}`);
	}
	return [...new Set(trouvees)];
}

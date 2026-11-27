import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { ajouterJours } from '../src/dates.ts';
import { agendaDe, monLienAgenda } from '../src/planning/agenda.ts';
import { planningDe, preparerAnnee } from '../src/planning/annee.ts';
import { astreinteDe } from '../src/planning/astreinte.ts';
import { eteAPreparer } from '../src/planning/repartition.ts';
import { prisesDeLaReleve, releveDe } from '../src/prises.ts';
import { pourDemander } from '../src/remplacements/lectures.ts';
import { jeuGrossi } from './jeu-grossi.ts';

// Les horaires réglables par année ne changent rien tant qu'une année garde ceux du centre : les empreintes du calcul d'avant
// (gravées avant le changement, dans le fichier voisin) doivent rester les mêmes, sur 2026 et 2027 entières, pour quatre profils.
// Pour les regraver (seulement si un changement voulu les modifie) : GRAVER_EMPREINTES=1.
const FICHIER = new URL('./horaires-non-regression.json', import.meta.url);
const empreinte = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);

type Jeu = Awaited<ReturnType<typeof jeuGrossi>>;
let jeu: Jeu;
const PROFILS = ['agent', 'chef', 'chefGarde', 'referent'] as const;
// Chaque jour des deux années, de la veille du 1er janvier 2026 au 31 décembre 2027.
const JOURS: string[] = [];
for (let j = '2025-12-31'; j <= '2027-12-31'; j = ajouterJours(j, 1)) JOURS.push(j);

beforeAll(async () => {
	jeu = await jeuGrossi();
}, 120_000);

async function empreintes() {
	const { base, reglage, acteurs, m } = jeu;
	const e: Record<string, string> = {};
	// La relève en cours, d'heure en heure (pur calcul).
	e['releve'] = empreinte(JOURS.flatMap((j) => Array.from({ length: 24 }, (_, h) => releveDe(`${j}T${String(h).padStart(2, '0')}:30`, reglage))));
	for (const p of PROFILS) {
		const acteur = acteurs[p];
		// L'astreinte de l'accueil, chaque jour à 10 h et à 19 h ; seuls les champs d'avant comptent.
		const astreintes = [];
		for (const j of JOURS)
			for (const h of ['10:00', '19:00']) {
				const a = await astreinteDe(base, acteur, `${j}T${h}`, reglage);
				astreintes.push(a && { debut: a.debut, fin: a.fin, equipe: a.equipe, enCours: a.enCours, mienne: a.mienne, periodes: a.periodes, fetes: a.fetes, courtsCedes: a.courtsCedes });
			}
		e[`astreinte ${p}`] = empreinte(astreintes);
		// Les tranches de ses douze semaines, toutes les quatre semaines.
		const tranches = [];
		for (let i = 0; i < JOURS.length; i += 28) tranches.push((await pourDemander(base, acteur, `${JOURS[i]}T10:00`, reglage)).semaines);
		e[`tranches ${p}`] = empreinte(tranches);
		// Le planning des deux années, vu le 1er de chaque mois.
		const plannings = [];
		for (const j of JOURS.filter((x) => x.endsWith('-01'))) for (const a of [2026, 2027]) plannings.push(await planningDe(base, acteur, a, `${j}T10:00`, reglage));
		e[`planning ${p}`] = empreinte(plannings);
		// L'agenda, vu chaque mois.
		const lien = await monLienAgenda(base, acteur, m);
		const agendas = [];
		for (const j of JOURS.filter((x) => x.endsWith('-15'))) agendas.push(await agendaDe(base, lien, `${j}T10:00`, reglage));
		e[`agenda ${p}`] = empreinte(agendas);
	}
	// L'été et les fêtes : l'écran du chef, pour chaque année.
	for (const a of [2026, 2027]) {
		const ete = await eteAPreparer(base, acteurs.chef, a, m, reglage);
		e[`ete ${a}`] = empreinte({ ete: ete.ete, defaut: ete.defaut, semaines: ete.semaines, impossibles: ete.impossibles });
		const p = await preparerAnnee(base, acteurs.chef, a, m, reglage);
		e[`fetes ${a}`] = empreinte({ semaines: p.semaines, fetes: p.fetes, fetesCentre: p.fetesCentre, ordrePropose: p.ordrePropose });
	}
	// La relève vue par la prise de garde, chaque vendredi soir.
	const releves = [];
	for (const j of JOURS.filter((x) => new Date(`${x}T00:00:00Z`).getUTCDay() === 5)) releves.push((await prisesDeLaReleve(base, acteurs.chefGarde, `${j}T18:30`, reglage)).releve);
	e['prise de garde'] = empreinte(releves);
	return e;
}

describe('horaires de garde : rien ne change avec les horaires du centre', () => {
	it('mêmes résultats qu’avant, sur deux années entières et quatre profils', async () => {
		const e = await empreintes();
		if (process.env.GRAVER_EMPREINTES === '1') writeFileSync(FICHIER, `${JSON.stringify(e, null, '\t')}\n`);
		expect(e).toEqual(JSON.parse(readFileSync(FICHIER, 'utf8')));
	}, 600_000);
});

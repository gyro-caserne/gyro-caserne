import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import type { JourSemaine } from '@gyro-caserne/centre';
import type { Base } from '../base.ts';
import type { Acteur } from '../droits.ts';
import { DonneeInvalide } from '../erreurs.ts';
import { ajouterJours } from '../dates.ts';
import { periodesDe } from '../remplacements/contexte.ts';
import { chevauche } from '../remplacements/tranches.ts';
import { anneePlanning, demandeRemplacement, ete, feteCentre, semaineChangee } from '../schema.ts';
import { exigerAnnee, exigerGestion, journalPlanning } from './annee.ts';
import { horairesDu, reglageDeLAnnee, semainesDe, type Horaires, type Reglage } from './calendrier.ts';

// Les horaires de garde d'une année du planning : contrôlés à la saisie, puis gardés sur sa ligne (annee_planning.horaires).

const JOURS: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

const objet = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : null);

function moment(x: unknown, jourInconnu: string, heureInvalide: string): { jour: JourSemaine; heure: string } {
	const m = objet(x);
	if (!m) throw new DonneeInvalide('Horaires invalides');
	if (!JOURS.includes(m.jour as JourSemaine)) throw new DonneeInvalide(jourInconnu);
	if (typeof m.heure !== 'string' || !HEURE.test(m.heure)) throw new DonneeInvalide(heureInvalide);
	return { jour: m.jour as JourSemaine, heure: m.heure };
}

// La relève et la fin forment une semaine : la fin tombe le jour de la relève suivante, au plus tard à son heure. Sans heures de semaine,
// l'astreinte est continue ; avec, elles sont deux heures différentes (la nuit si le début suit la fin).
export function exigerHoraires(x: unknown): Horaires {
	const h = objet(x);
	if (!h) throw new DonneeInvalide('Horaires invalides');
	const debut = moment(h.debut, 'Jour de relève inconnu', 'Heure de relève invalide');
	const fin = moment(h.fin, 'Jour de fin inconnu', 'Heure de fin invalide');
	if (fin.jour !== debut.jour) throw new DonneeInvalide('La fin tombe le jour de la relève suivante');
	if (fin.heure > debut.heure) throw new DonneeInvalide('La fin doit tomber au plus tard à l’heure de la relève suivante');
	if (h.semaine === undefined || h.semaine === null) return { debut, fin };
	const s = objet(h.semaine);
	if (!s || typeof s.debut !== 'string' || typeof s.fin !== 'string' || !HEURE.test(s.debut) || !HEURE.test(s.fin)) throw new DonneeInvalide('Heure de semaine invalide');
	if (s.debut === s.fin) throw new DonneeInvalide('Les heures de semaine doivent être différentes');
	return { debut, fin, semaine: { debut: s.debut, fin: s.fin } };
}

// Régler les horaires de garde d'une année pas encore publiée (`null` : garder ceux du centre). Des horaires égaux à ceux du centre
// ne sont pas gardés : l'année suit le centre. Refusé si l'été de l'année est ouvert (ses plages suivent les heures), si la dernière
// semaine de l'année d'avant a commencé (sa fin suit la première relève) ou si une autre relève la ferait toucher des remplacements ou une fête
// du centre, ou, pour un autre jour de relève, si des semaines sont changées.
export async function reglerHoraires(base: Base, acteur: Acteur, annee: number, horaires: unknown, maintenant: string, reglage: Reglage): Promise<void> {
	exigerAnnee(annee);
	await exigerGestion(base, acteur, maintenant);
	const h = horaires === null ? null : exigerHoraires(horaires);
	const json = h === null || JSON.stringify(h) === JSON.stringify(horairesDu(reglage)) ? null : JSON.stringify(h);
	// Autour du 1er janvier : les remplacements et les fêtes du centre que la dernière semaine de l'année d'avant peut toucher.
	const [lignes, [ouvert], changees, demandes, fetes] = await base.batch([
		base.select().from(anneePlanning).where(inArray(anneePlanning.annee, [annee - 1, annee])),
		base.select({ annee: ete.annee }).from(ete).where(eq(ete.annee, annee)),
		base.select({ debut: semaineChangee.debut }).from(semaineChangee).where(and(gte(semaineChangee.debut, `${annee}-01-01`), lte(semaineChangee.debut, `${annee}-12-31`))),
		base
			.select({ periodes: demandeRemplacement.periodes, periodesCible: demandeRemplacement.periodesCible })
			.from(demandeRemplacement)
			.where(and(inArray(demandeRemplacement.etat, ['attente', 'a_valider', 'conclue']), gte(demandeRemplacement.debut, `${annee - 1}-12-01`), lte(demandeRemplacement.debut, `${annee}-01-31`))),
		base.select({ debut: feteCentre.debut, fin: feteCentre.fin }).from(feteCentre).where(and(gte(feteCentre.fin, `${annee - 1}-12-01`), lte(feteCentre.debut, `${annee}-01-31`)))
	]);
	const ligne = lignes.find((l) => l.annee === annee);
	if (ligne?.publieeLe) throw new DonneeInvalide(`Planning ${annee} publié. Ses horaires ne changent plus`);
	if ((ligne?.horaires ?? null) === json) return;
	if (ouvert) throw new DonneeInvalide(`L’été ${annee} est ouvert. Les horaires de l’année ne changent plus`);
	const avant = reglageDeLAnnee(reglage, ligne?.horaires);
	const apres = reglageDeLAnnee(reglage, json);
	if (changees.length > 0 && avant.debut.jour !== apres.debut.jour) throw new DonneeInvalide('Des semaines sont déjà changées. Gardez le jour de relève, ou remettez d’abord ces semaines au roulement');
	const precedente = lignes.find((l) => l.annee === annee - 1);
	const r = reglageDeLAnnee(reglage, precedente?.horaires);
	const derniere = `${semainesDe(annee - 1, r).at(-1)!.debut}T${r.debut.heure}`;
	if (precedente?.publieeLe && derniere <= maintenant.slice(0, 16)) throw new DonneeInvalide(`La dernière semaine de ${annee - 1} a commencé. Les horaires de ${annee} ne changent plus`);
	// Une autre relève allonge ou raccourcit la dernière semaine de l'année d'avant, déjà publiée : rien de conclu ni de prévu ne doit y tomber.
	const releve = (x: Reglage) => `${semainesDe(annee, x)[0]!.debut}T${x.debut.heure}`;
	if (precedente?.publieeLe && releve(avant) !== releve(apres)) {
		const zone = { debut: derniere, fin: `${ajouterJours([releve(avant), releve(apres)].sort().at(-1)!.slice(0, 10), 1)}T00:00` };
		const touchees = [...demandes.flatMap((d) => [...periodesDe(d.periodes), ...periodesDe(d.periodesCible)]), ...fetes].some((p) => chevauche(p, zone));
		if (touchees) throw new DonneeInvalide(`Des remplacements ou une fête du centre tombent dans la dernière semaine de ${annee - 1}. Gardez la même relève, ou réglez-les d’abord`);
	}
	await base.batch([
		base.insert(anneePlanning).values({ annee, horaires: json }).onConflictDoUpdate({ target: anneePlanning.annee, set: { horaires: json } }),
		journalPlanning(base, acteur, 'regler_horaires', { annee, horaires: json === null ? null : h }, maintenant)
	]);
}

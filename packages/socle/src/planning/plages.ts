import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import type { Base } from '../base.ts';
import { dePlage, jourEnLettres, reunir, soustraire } from '../remplacements/tranches.ts';
import { ajouterJours } from '../dates.ts';
import { ete, feteCentre, plageEte } from '../schema.ts';
import type { Periode, SemaineCalculee } from './calendrier.ts';

// Les plages de l'été publié et les vacances des agents : ce que le planning, l'agenda et les remplacements en retiennent.

export type PlageLue = Periode & { ajoutes: number[]; retires: number[] };
export const lirePlage = (l: { debut: string; fin: string; ajoutes: string; retires: string }): PlageLue => ({ debut: l.debut, fin: l.fin, ajoutes: JSON.parse(l.ajoutes) as number[], retires: JSON.parse(l.retires) as number[] });

// Les plages des étés publiés qui commencent entre `du` et `au` (dates).
export function requetePlagesPubliees(base: Base, du: string, au: string) {
	return base
		.select({ debut: plageEte.debut, fin: plageEte.fin, ajoutes: plageEte.ajoutes, retires: plageEte.retires })
		.from(plageEte)
		.innerJoin(ete, eq(ete.annee, plageEte.annee))
		.where(and(isNotNull(ete.publieeLe), gte(plageEte.debut, du), lte(plageEte.debut, `${au}T23:59`)));
}

// Les fêtes qui touchent ces jours (une fête dure 24 h au plus : elle commence au plus tard la veille). Quelques lignes, à placer
// dans le batch qui lit déjà l'astreinte.
export function requeteFetes(base: Base, du: string, au: string) {
	// Sans liste de colonnes ni tri : la requête la plus simple à construire, elle est lue à chaque page qui montre l'astreinte.
	return base
		.select()
		.from(feteCentre)
		.where(and(gte(feteCentre.debut, ajouterJours(du.slice(0, 10), -1)), lte(feteCentre.debut, `${au.slice(0, 10)}T23:59`)));
}

export const dansLaSemaine = (s: SemaineCalculee, p: Periode) => s.periodes.some((x) => x.debut <= p.debut && p.fin <= x.fin);

// Les heures d'astreinte de la personne cette semaine : celles de son équipe ; en été publié, ses plages. Pendant une fête du centre,
// ces heures passent à l'équipe imposée. `equipeId` : son équipe au jour de relève.
export function heuresDe(s: SemaineCalculee, equipeId: number | null, id: number, plages: PlageLue[]): Periode[] {
	const h = heuresDuRoulement(s, equipeId, id, plages);
	if (!s.imposees) return h;
	const prises = s.imposees.filter((i) => i.equipeId === equipeId).map(({ debut, fin }) => ({ debut, fin }));
	return reunir([...soustraire(h, s.imposees), ...prises]);
}
function heuresDuRoulement(s: SemaineCalculee, equipeId: number | null, id: number, plages: PlageLue[]): Periode[] {
	const deBase = equipeId === s.equipeId;
	const siennes = plages.filter((p) => dansLaSemaine(s, p));
	if (siennes.length === 0) return deBase ? s.periodes : [];
	return reunir(siennes.filter((p) => (deBase && !p.retires.includes(id)) || p.ajoutes.includes(id)).map(({ debut, fin }) => ({ debut, fin })));
}

// Les vacances données couvrent la plage : elle commence un jour de vacances.
export const enVacances = (vacances: { personneId: number; debut: string; fin: string }[], id: number, p: Periode) =>
	vacances.some((v) => v.personneId === id && v.debut <= p.debut.slice(0, 10) && p.debut.slice(0, 10) <= v.fin);


// Les fêtes du centre de la semaine, en clair : « Sainte-Barbe, samedi 5 décembre, Équipe 3 de 18 h à 2 h ».
export const textesFetes = (s: SemaineCalculee, equipes: { id: number; nom: string }[]) =>
	(s.imposees ?? []).map((i) => `${i.nom}, ${jourEnLettres(i.debut)}, ${equipes.find((x) => x.id === i.equipeId)?.nom ?? 'une autre équipe'} ${dePlage(i)}`);

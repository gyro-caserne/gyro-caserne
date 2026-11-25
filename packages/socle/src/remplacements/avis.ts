import { and, inArray, sql, type SQL } from 'drizzle-orm';
import type { Base } from '../base.ts';
import type { AvisRemplacement } from '../listes.ts';
import { TITRES_AVIS } from './titres.ts';
import { mettreEnFile } from '../notifications.ts';
import { avisRemplacement, personne } from '../schema.ts';

// Ce qu'une personne apprend d'une demande : une ligne dans sa cloche et un envoi au téléphone (sujet « remplacements »).

// L'heure de Paris (« AAAA-MM-JJTHH:MM ») tombe entre 22 h et 7 h.
const nuit = (maintenant: string) => maintenant.slice(11, 16) >= '22:00' || maintenant.slice(11, 16) < '07:00';

const parmi = (ids: number[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;

// Écritures à placer dans le batch de l'action. `demandeId` : un nombre, ou la demande créée dans le même batch.
// `si` : une condition vérifiée à l'écriture (la décision a bien été prise). `lieu` : « urgences » pour le chef de centre et l'adjoint.
// `pressant` : sonne aussi la nuit (une demande courte, une demande expirée : le titulaire reste d'astreinte).
export function avis(base: Base, ids: number[], demandeId: number | SQL, quoi: AvisRemplacement, texte: string, url: string, maintenant: string, si?: SQL, lieu: 'remplacements' | 'urgences' = 'remplacements', pressant = false) {
	if (ids.length === 0) return [];
	const qui = and(inArray(personne.id, parmi(ids)), si);
	const prefixe = `${lieu === 'urgences' ? 'urgence:' : ''}remplacement:`;
	return [
		base.insert(avisRemplacement).select(
			base
				.select({
					id: sql<number | null>`null`.as('id'),
					personneId: personne.id,
					demandeId: sql<number>`${demandeId}`.as('demande_id'),
					quoi: sql<string>`${quoi}`.as('quoi'),
					creeLe: sql<string>`${maintenant}`.as('cree_le'),
					lueLe: sql<string | null>`null`.as('lue_le')
				})
				.from(personne)
				.where(qui)
		),
		// De 22 h à 7 h, la cloche suffit : rien au téléphone, sauf une urgence ou un avis pressant.
		...(lieu !== 'urgences' && !pressant && nuit(maintenant)
			? []
			: [
					mettreEnFile(
						base,
						ids,
						lieu,
						{ titre: TITRES_AVIS[quoi], texte, url, tag: `${prefixe}${typeof demandeId === 'number' ? demandeId : ''}:${quoi}` },
						maintenant,
						si,
						undefined,
						// Une demande créée dans le même batch : son identifiant, lu à l'écriture. Une notification par demande.
						typeof demandeId === 'number' ? {} : { tag: sql`${prefixe} || (${demandeId}) || ${`:${quoi}`}` }
					)
				])
	] as const;
}

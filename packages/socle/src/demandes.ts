import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Base } from './base.ts';
import { enCours, exigerDateHeure } from './dates.ts';
import { aLeDroit, type Acteur } from './droits.ts';
import { DonneeInvalide, RefusDroit } from './erreurs.ts';
import { ligneJournal } from './journal.ts';
import { STATUTS_AVEC_ACCES, type ReglageDemandes } from './listes.ts';
import { attribution, demandeReferent, personne, responsabilite, responsabiliteDroit } from './schema.ts';

// Demandes aux référents : un rôle de centre qui « reçoit des demandes » (pharmacie, matériel…) les suit comme l'habillement,
// avec des étapes intermédiaires réglées sur le rôle. L'habillement garde son propre circuit (décision 0043).

export const ETAPES_MAX = 6;
export const NOM_ETAPE_MAX = 30;
export const DERNIERE_PAR_DEFAUT = 'Faite';
// Les étapes fixes, qui ne se renomment pas : un nom d'étape réglée ne les reprend pas.
const NOMS_FIXES = ['Demandée', 'Prise en compte', 'Refusée', 'Annulée'];

const nomPropre = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const nouvelId = () => `e${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

// Un rôle peut recevoir des demandes : de portée centre, ni système, ni archivé, ni chargé de l'habillement (avant C2).
export function recoitPossible(r: { typePerimetre: string; systeme: string | null; archiveeLe: string | null }, droits: string[]): boolean {
	return r.typePerimetre === 'centre' && r.systeme === null && r.archiveeLe === null && !droits.includes('GERER_HABILLEMENT');
}

// Qui règle : qui gère les rôles (tout), ou un titulaire en cours d'un rôle qui reçoit déjà des demandes (ses étapes seulement).
export async function peutReglerDemandes(base: Base, acteur: Acteur, roleId: number, recoit: boolean, aujourdhui: string): Promise<'tout' | 'etapes' | null> {
	if (acteur.type === 'super' || (await aLeDroit(base, acteur, 'GERER_LISTES', { type: 'centre' }, aujourdhui))) return 'tout';
	if (!recoit) return null;
	return (await estTitulaire(base, acteur.id, roleId, aujourdhui)) ? 'etapes' : null;
}

async function estTitulaire(base: Base, personneId: number, roleId: number, aujourdhui: string): Promise<boolean> {
	const lignes = await base
		.select({ debut: attribution.debut, fin: attribution.fin })
		.from(attribution)
		.innerJoin(personne, eq(personne.id, attribution.personneId))
		.where(and(eq(attribution.personneId, personneId), eq(attribution.responsabiliteId, roleId), eq(attribution.perimetreType, 'centre'), sql`${personne.statut} in (select value from json_each(${JSON.stringify(STATUTS_AVEC_ACCES)}))`));
	return lignes.some((l) => enCours(l.debut, l.fin, aujourdhui));
}

// Le nouveau réglage, vérifié : chaque étape gardée par son identifiant, les nouvelles en reçoivent un.
function reglageVerifie(actuel: ReglageDemandes | null, demande: { etapes: { id?: string; nom: string }[]; derniere: string }): ReglageDemandes {
	if (!Array.isArray(demande.etapes)) throw new DonneeInvalide('Étapes inconnues');
	if (demande.etapes.length > ETAPES_MAX) throw new DonneeInvalide('Trop d’étapes');
	const connus = new Set(actuel?.etapes.map((e) => e.id) ?? []);
	const etapes = demande.etapes.map((e) => {
		if (e.id !== undefined && !connus.has(e.id)) throw new DonneeInvalide('Étape inconnue');
		return { id: e.id ?? nouvelId(), nom: nomPropre(e.nom) };
	});
	const derniere = nomPropre(demande.derniere);
	const noms = [...etapes.map((e) => e.nom), derniere];
	if (noms.some((n) => !n)) throw new DonneeInvalide('Nom d’étape vide');
	if (noms.some((n) => n.length > NOM_ETAPE_MAX)) throw new DonneeInvalide('Nom d’étape trop long');
	const enMinuscules = [...noms, ...NOMS_FIXES].map((n) => n.toLocaleLowerCase('fr'));
	if (new Set(enMinuscules).size !== enMinuscules.length) throw new DonneeInvalide('Nom d’étape en double');
	if (new Set(etapes.map((e) => e.id)).size !== etapes.length) throw new DonneeInvalide('Étape inconnue');
	return { etapes, derniere };
}

// Régler les demandes d'un rôle : `null` le décoche. Retirer une étape, ou décocher, est refusé tant qu'une demande en cours s'y trouve.
// Au journal. Une lecture, puis l'écriture (plus les droits).
export async function reglerDemandes(base: Base, acteur: Acteur, roleId: number, reglage: { etapes: { id?: string; nom: string }[]; derniere: string } | null, maintenant: string): Promise<void> {
	const aujourdhui = exigerDateHeure(maintenant, 'Date');
	const [[role], droits, occupees] = await base.batch([
		base.select().from(responsabilite).where(eq(responsabilite.id, roleId)),
		base.select({ droit: responsabiliteDroit.droit }).from(responsabiliteDroit).where(eq(responsabiliteDroit.responsabiliteId, roleId)),
		base.selectDistinct({ etape: demandeReferent.etape }).from(demandeReferent).where(and(eq(demandeReferent.responsabiliteId, roleId), isNull(demandeReferent.finLe)))
	]);
	if (!role) throw new DonneeInvalide('Responsabilité inconnue');
	if (!recoitPossible(role, droits.map((d) => d.droit))) throw new DonneeInvalide('Ce rôle ne reçoit pas de demandes');
	const actuel = role.demandes;
	const qui = await peutReglerDemandes(base, acteur, roleId, actuel !== null, aujourdhui);
	if (qui === null || (qui === 'etapes' && (reglage === null || actuel === null))) throw new RefusDroit('GERER_LISTES', { type: 'centre' }, 'Réservé à qui gère les rôles et aux titulaires du rôle');

	let nouveau: ReglageDemandes | null = null;
	if (reglage === null) {
		if (occupees.length > 0) throw new DonneeInvalide('Demandes en cours');
	} else {
		nouveau = reglageVerifie(actuel, reglage);
		const gardees = new Set(nouveau.etapes.map((e) => e.id));
		if (occupees.some((o) => actuel?.etapes.some((e) => e.id === o.etape) && !gardees.has(o.etape))) throw new DonneeInvalide('Étape occupée');
	}
	await base.batch([
		base.update(responsabilite).set({ demandes: nouveau }).where(eq(responsabilite.id, roleId)),
		ligneJournal(base, { acteur: acteur.type === 'super' ? `super:${acteur.email}` : `personne:${acteur.id}`, action: 'regler_demandes', cibleType: 'responsabilite', cibleId: roleId, details: nouveau ? { recoit: true, etapes: nouveau.etapes.map((e) => e.nom), derniere: nouveau.derniere } : { recoit: false } }, maintenant)
	]);
}

// Des demandes en cours pour ce rôle (archiver est alors refusé). Une requête.
export async function aDesDemandesEnCours(base: Base, roleId: number): Promise<boolean> {
	const [l] = await base.select({ id: demandeReferent.id }).from(demandeReferent).where(and(eq(demandeReferent.responsabiliteId, roleId), isNull(demandeReferent.finLe))).limit(1);
	return l !== undefined;
}

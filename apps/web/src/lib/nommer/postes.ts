import type { QuiFaitQuoi } from '@gyro-caserne/socle';

// Un poste : un rôle sur un périmètre (le centre, une équipe, un comité). `nommer` seulement si l'acteur peut y nommer.
type Titulaire = QuiFaitQuoi['missions'][number]['titulaires'][number];
export type Poste = {
	cle: string;
	roleId: number;
	role: string;
	// Une mission peut avoir plusieurs titulaires : « Nommer » reste proposé.
	nature: 'fonction' | 'mission';
	perimetre: { type: 'centre' | 'equipe' | 'comite'; id: number | null; nom: string | null };
	titulaires: Titulaire[];
	nommer?: { aPourvoir: boolean; unique?: boolean };
};
export type Agent = { id: number; nom: string; equipeId: number | null; equipe: string | null; exterieur?: boolean };

export const cleDePoste = (roleId: number, perimetreId: number | null) => `${roleId}-${perimetreId ?? 'centre'}`;

// Tous les postes de la page, à plat : pour les volets, « À pourvoir » et les fiches d'un rôle ou d'un comité.
export function postesDe(vue: Pick<QuiFaitQuoi, 'comites' | 'commandement' | 'equipes' | 'fonctions' | 'missions'>): Poste[] {
	type RoleDuCentre = QuiFaitQuoi['missions'][number];
	const duRole = (nature: Poste['nature']) => (r: RoleDuCentre): Poste => ({ cle: cleDePoste(r.id, null), roleId: r.id, role: r.nom, nature, perimetre: { type: 'centre', id: null, nom: null }, titulaires: r.titulaires, nommer: r.nommer });
	const duCentre = [...[...vue.commandement, ...vue.fonctions].map(duRole('fonction')), ...vue.missions.map(duRole('mission'))];
	const dEquipe = vue.equipes.flatMap((r) =>
		r.parEquipe.map((l) => ({ cle: cleDePoste(r.id, l.equipeId), roleId: r.id, role: r.nom, nature: r.nature, perimetre: { type: 'equipe' as const, id: l.equipeId, nom: l.equipe }, titulaires: l.titulaires, nommer: l.nommer }))
	);
	const deComite = vue.comites.flatMap((c) =>
		(c.postes ?? []).map((p) => ({ cle: cleDePoste(p.id, c.id), roleId: p.id, role: p.nom, nature: p.nature, perimetre: { type: 'comite' as const, id: c.id, nom: c.nom }, titulaires: p.titulaires, nommer: p.nommer }))
	);
	return [...duCentre, ...dEquipe, ...deComite];
}

// « Chef de garde, Équipe 2 » ; « Référent engins ».
export const intitule = (p: Pick<Poste, 'role' | 'perimetre'>) => (p.perimetre.nom ? `${p.role}, ${p.perimetre.nom}` : p.role);

// Les postes que l'acteur peut nommer et que personne ne tient : en tête de « Qui fait quoi ».
export const aPourvoir = (postes: Poste[]) => postes.filter((p) => p.nommer?.aPourvoir);

// Le résumé d'un groupe replié : « 4 équipes, 1 à pourvoir », « 6 rôles ».
export function resume(compte: string, postes: { nommer?: { aPourvoir: boolean } }[]): string {
	const vides = postes.filter((p) => p.nommer?.aPourvoir).length;
	return vides > 0 ? `${compte}, ${vides} à pourvoir` : compte;
}

// Les agents proposés pour nommer : ceux de l'équipe du poste d'abord, puis les autres, chacun dans l'ordre des noms.
export function agentsPour(agents: Agent[], poste: Pick<Poste, 'perimetre'>, sauf: number[] = []): Agent[] {
	// Une personne extérieure ne tient aucun rôle (règle du socle) : elle n'est jamais proposée.
	const libres = agents.filter((a) => !sauf.includes(a.id) && !a.exterieur);
	if (poste.perimetre.type !== 'equipe') return libres;
	return [...libres.filter((a) => a.equipeId === poste.perimetre.id), ...libres.filter((a) => a.equipeId !== poste.perimetre.id)];
}

// Les paramètres de l'adresse de la page (ceux de `page.url`, en lecture seule).
type Adresse = { get(nom: string): string | null; toString(): string };

// L'adresse d'un volet, en gardant le reste de l'adresse ; sans volet, `vers(null)`.
export function adresseVolet(recherche: Adresse, volet: { mandat: number } | { nommer: string } | null): string {
	const p = new URLSearchParams(recherche.toString());
	p.delete('mandat');
	p.delete('nommer');
	if (volet && 'mandat' in volet) p.set('mandat', String(volet.mandat));
	if (volet && 'nommer' in volet) p.set('nommer', volet.nommer);
	const texte = p.toString();
	return texte ? `?${texte}` : '?';
}

// Sans accents ni majuscules, pour chercher un agent par son nom.
export const simple = (texte: string) => texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

// Le volet visé : celui d'un refus (rouvert avec ses erreurs, même sans JavaScript), sinon celui de l'adresse.
type Envoi = { cible?: unknown; succes?: unknown } | null | undefined;
export function voletVise(recherche: Adresse, form: Envoi): { mandat: number } | { nommer: string } | null {
	const refus = form && !form.succes ? String(form.cible ?? '') : '';
	if (refus.startsWith('mandat-') && /^\d+$/.test(refus.slice(7))) return { mandat: Number(refus.slice(7)) };
	if (refus.startsWith('nommer-')) return { nommer: refus.slice(7) };
	const mandat = recherche.get('mandat');
	if (mandat && /^\d+$/.test(mandat)) return { mandat: Number(mandat) };
	const nommer = recherche.get('nommer');
	return nommer ? { nommer } : null;
}

// Le poste visé par le volet ouvert, et le titulaire pour le volet d'une personne.
export function posteVise(postes: Poste[], vise: ReturnType<typeof voletVise>) {
	if (!vise) return null;
	if ('nommer' in vise) {
		const poste = postes.find((p) => p.cle === vise.nommer && p.nommer);
		return poste ? { poste, titulaire: null } : null;
	}
	for (const poste of postes) {
		const titulaire = poste.titulaires.find((t) => t.mandat?.id === vise.mandat);
		if (titulaire?.mandat) return { poste, titulaire: { ...titulaire, mandat: titulaire.mandat } };
	}
	return null;
}

// Le bloc « Titulaires » de la fiche d'un rôle : ses postes. Un rôle de comité, comité par comité : les gestes là où l'acteur
// peut nommer, sinon les membres qui le tiennent, lus.
type Vue = Pick<QuiFaitQuoi, 'comites' | 'commandement' | 'equipes' | 'fonctions' | 'missions'>;
export function postesDuRole(vue: Vue, role: { id: number; nom: string; nature: 'fonction' | 'mission'; portee: string }, court: string): Poste[] {
	const tous = postesDe(vue).filter((p) => p.roleId === role.id);
	if (role.portee !== 'comite') return tous;
	return vue.comites.map(
		(c) =>
			tous.find((p) => p.perimetre.id === c.id) ?? {
				cle: cleDePoste(role.id, c.id),
				roleId: role.id,
				role: court,
				nature: role.nature,
				perimetre: { type: 'comite', id: c.id, nom: c.nom },
				titulaires: c.membres.filter((m) => m.roles.includes(court))
			}
	);
}

// Le bloc « Titulaires » de la fiche d'un comité : ses postes nommables, et les membres qu'ils ne montrent pas, lus.
export function postesDuComite(vue: Vue, comiteId: number) {
	const carte = vue.comites.find((c) => c.id === comiteId);
	const postes = postesDe(vue).filter((p) => p.perimetre.type === 'comite' && p.perimetre.id === comiteId);
	const tenus = new Set(postes.flatMap((p) => p.titulaires.map((t) => t.id)));
	return { postes, autres: (carte?.membres ?? []).filter((m) => !tenus.has(m.id)) };
}

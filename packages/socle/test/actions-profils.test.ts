import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import centreExemple from '../../../centres/exemple/centre.ts';
import { attribuer } from '../src/actions/attributions.ts';
import { creerProfil, enregistrerProfil, listerProfils, modifierDroitsProfil, modifierMursOuverts, renommerProfil, supprimerProfil } from '../src/actions/profils.ts';
import { aLeDroit, type Acteur } from '../src/droits.ts';
import { DonneeInvalide, RefusDroit } from '../src/erreurs.ts';
import { chargerJeuDeDepart } from '../src/jeu-de-depart.ts';
import { comite, journal, personne, profil, profilDroit, responsabilite } from '../src/schema.ts';
import { baseDeTest } from './base-de-test.ts';

const aujourdhui = '2026-10-28';
const superAdmin: Acteur = { type: 'super', email: 'admin@exemple.fr' };

async function jeu() {
	const base = await baseDeTest();
	await chargerJeuDeDepart(base, centreExemple);
	const [agent] = await base.select().from(profil).where(eq(profil.nom, 'Agent'));
	const donner = async (email: string, nomResp: string) => {
		const [p] = await base.insert(personne).values({ email, prenom: 'P', nom: 'N', profilId: agent!.id }).returning();
		const [r] = await base.select().from(responsabilite).where(eq(responsabilite.nom, nomResp));
		await attribuer(base, superAdmin, { personneId: p!.id, responsabiliteId: r!.id, perimetre: { type: 'centre' }, debut: '2026-01-01' }, aujourdhui);
		return { type: 'personne', id: p!.id } as Acteur;
	};
	const chef = await donner('chef@exemple.fr', 'Chef de centre');
	const adjoint = await donner('adjoint@exemple.fr', 'Chef de centre adjoint');
	const referent = await donner('ref@exemple.fr', 'Référent technique');
	const droitsDuProfil = async (id: number) =>
		(await base.select().from(profilDroit).where(eq(profilDroit.profilId, id))).map((l) => `${l.droit}@${l.perimetreType}${l.perimetreId ?? ''}`).sort();
	return { base, agent: agent!, chef, adjoint, referent, droitsDuProfil };
}

describe('listerProfils', () => {
	it('donne chaque profil et ses droits sur le centre', async () => {
		const { base, chef } = await jeu();
		const profils = await listerProfils(base, chef, aujourdhui);
		expect(profils.map((p) => p.nom)).toEqual(['Agent', 'Réserve citoyenne']);
		expect(profils[0]).toMatchObject({ typePersonne: 'agent' });
		expect(profils[0]!.droits).toContain('SIGNALER_ANOMALIE');
		expect(profils[0]!.droits).toHaveLength(12);
		expect(profils[1]!.droits).toEqual(['RESERVER']);
		expect(profils.map((p) => [p.personnes, p.depart, p.mursOuverts])).toEqual([[3, true, {}], [0, false, {}]]);
	});

	it('refuse le référent technique', async () => {
		const { base, referent } = await jeu();
		await expect(listerProfils(base, referent, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});
});

describe('modifierDroitsProfil', () => {
	it('le chef de centre modifie les droits, journalise avant et après', async () => {
		const { base, chef, agent, droitsDuProfil } = await jeu();
		const avant = (await listerProfils(base, chef, aujourdhui))[0]!.droits;
		const apres = [...avant.filter((d) => d !== 'UTILISER_MESSAGERIE'), 'VOIR_MOTIFS_ABSENCE' as const];
		await modifierDroitsProfil(base, chef, agent.id, apres, aujourdhui);
		const lus = await droitsDuProfil(agent.id);
		expect(lus).toContain('VOIR_MOTIFS_ABSENCE@centre');
		expect(lus).not.toContain('UTILISER_MESSAGERIE@centre');
		expect(lus).toHaveLength(12);
		const [ligne] = await base.select().from(journal).where(eq(journal.action, 'modifier_droits_profil'));
		expect(ligne).toMatchObject({ cibleType: 'profil', cibleId: agent.id, acteur: `personne:${(chef as { id: number }).id}` });
		expect(JSON.parse(ligne!.details)).toEqual({ droits: { avant: [...avant].sort(), apres: [...apres].sort() } });
	});

	it('l’adjoint et le super administrateur modifient aussi ; rien n’est écrit si rien ne change', async () => {
		const { base, adjoint, agent } = await jeu();
		const [reserve] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
		await modifierDroitsProfil(base, adjoint, reserve!.id, [], aujourdhui);
		await modifierDroitsProfil(base, superAdmin, reserve!.id, [], aujourdhui);
		expect(await base.select().from(journal).where(eq(journal.action, 'modifier_droits_profil'))).toHaveLength(1);
		const personneReserve = (await base.insert(personne).values({ email: 'r@exemple.fr', prenom: 'R', nom: 'C', profilId: reserve!.id }).returning())[0]!;
		expect(await aLeDroit(base, { type: 'personne', id: personneReserve.id }, 'RESERVER', { type: 'centre' }, aujourdhui)).toBe(false);
		expect(agent.id).not.toBe(reserve!.id);
	});

	it('refuse le référent technique, rien n’est écrit', async () => {
		const { base, referent, agent, droitsDuProfil } = await jeu();
		const avant = await droitsDuProfil(agent.id);
		await expect(modifierDroitsProfil(base, referent, agent.id, ['VOIR_PLANNING'], aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		expect(await droitsDuProfil(agent.id)).toEqual(avant);
	});

	it('refuse un droit de pouvoir, un droit inconnu ou un profil inconnu', async () => {
		const { base, chef, agent, droitsDuProfil } = await jeu();
		const avant = await droitsDuProfil(agent.id);
		await expect(modifierDroitsProfil(base, chef, agent.id, ['VOIR_PLANNING', 'GERER_ACCES'], aujourdhui)).rejects.toThrow(new DonneeInvalide('Un profil ne donne pas de droit de pouvoir'));
		await expect(modifierDroitsProfil(base, superAdmin, agent.id, ['GERER_LISTES'], aujourdhui)).rejects.toThrow(new DonneeInvalide('Un profil ne donne pas de droit de pouvoir'));
		await expect(modifierDroitsProfil(base, chef, agent.id, ['N_IMPORTE_QUOI' as never], aujourdhui)).rejects.toThrow(new DonneeInvalide('Droit inconnu'));
		await expect(modifierDroitsProfil(base, chef, 999, ['VOIR_PLANNING'], aujourdhui)).rejects.toThrow(new DonneeInvalide('Profil inconnu'));
		expect(await droitsDuProfil(agent.id)).toEqual(avant);
		expect(await base.select().from(journal).where(eq(journal.action, 'modifier_droits_profil'))).toHaveLength(0);
	});

	it('ne touche pas aux droits du profil hors périmètre centre', async () => {
		const { base, chef, agent } = await jeu();
		await base.insert(profilDroit).values({ profilId: agent.id, droit: 'LIRE_SALON', perimetreType: 'salon', perimetreId: 7 });
		await modifierDroitsProfil(base, chef, agent.id, ['VOIR_PLANNING'], aujourdhui);
		const salon = await base.select().from(profilDroit).where(and(eq(profilDroit.profilId, agent.id), eq(profilDroit.perimetreType, 'salon')));
		expect(salon).toHaveLength(1);
		expect((await listerProfils(base, chef, aujourdhui))[0]!.droits).toEqual(['VOIR_PLANNING']);
	});

	it('un profil extérieur ne donne que RESERVER : tout droit d’agent est refusé, avec la raison, et rien n’est écrit', async () => {
		const { base, chef, droitsDuProfil } = await jeu();
		const [reserve] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
		const message = 'Un profil extérieur ne donne que le droit de réserver. Le planning, les engins, les remplacements et les autres droits des agents lui sont refusés.';
		for (const droit of ['VOIR_PLANNING', 'GERER_RESERVATIONS', 'VALIDER_REMPLACEMENT', 'TRAITER_ANOMALIE', 'UTILISER_MESSAGERIE'] as const)
			await expect(modifierDroitsProfil(base, chef, reserve!.id, ['RESERVER', droit], aujourdhui), droit).rejects.toThrow(new DonneeInvalide(message));
		expect(await droitsDuProfil(reserve!.id)).toEqual(['RESERVER@centre']);
		await modifierDroitsProfil(base, chef, reserve!.id, [], aujourdhui);
		await modifierDroitsProfil(base, chef, reserve!.id, ['RESERVER'], aujourdhui);
		expect(await droitsDuProfil(reserve!.id)).toEqual(['RESERVER@centre']);
	});

	it('profil extérieur : un droit d’agent d’avant cette règle part au prochain enregistrement de l’écran', async () => {
		const { base, chef, droitsDuProfil } = await jeu();
		const [reserve] = await base.select().from(profil).where(eq(profil.nom, 'Réserve citoyenne'));
		await base.insert(profilDroit).values({ profilId: reserve!.id, droit: 'VOIR_PLANNING', perimetreType: 'centre', perimetreId: null });
		await enregistrerProfil(base, chef, reserve!.id, { droits: (avant) => avant }, aujourdhui);
		expect(await droitsDuProfil(reserve!.id)).toEqual(['RESERVER@centre']);
	});

	it('reste sous le budget de requêtes', async () => {
		const { base, chef, agent } = await jeu();
		base.requetes = 0;
		await modifierDroitsProfil(base, chef, agent.id, ['VOIR_PLANNING', 'RESERVER'], aujourdhui);
		expect(base.requetes).toBeLessThanOrEqual(10);
	});
});

describe('créer, renommer, supprimer un profil', () => {
	it('le chef de centre crée un profil (nom unique, 60 caractères), au journal', async () => {
		const { base, chef } = await jeu();
		const id = await creerProfil(base, chef, { nom: ' Retraité ', typePersonne: 'exterieur' }, aujourdhui);
		const [lu] = await base.select().from(profil).where(eq(profil.id, id));
		expect(lu).toMatchObject({ nom: 'Retraité', typePersonne: 'exterieur', mursOuverts: '{}' });
		expect(await base.select().from(journal).where(eq(journal.action, 'creer_profil'))).toMatchObject([{ cibleType: 'profil', cibleId: id }]);
		await expect(creerProfil(base, chef, { nom: 'retraité', typePersonne: 'agent' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Nom déjà utilisé'));
		await expect(creerProfil(base, chef, { nom: 'x'.repeat(61), typePersonne: 'agent' }, aujourdhui)).rejects.toThrow(DonneeInvalide);
		await expect(creerProfil(base, chef, { nom: 'Autre', typePersonne: 'pompier' as 'agent' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Type inconnu'));
	});

	it('réservé au chef de centre, à l’adjoint et au super administrateur', async () => {
		const { base, adjoint, referent, agent } = await jeu();
		await expect(creerProfil(base, referent, { nom: 'Retraité', typePersonne: 'exterieur' }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(renommerProfil(base, referent, agent.id, 'Pompier', aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		await expect(supprimerProfil(base, referent, agent.id, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
		expect(await creerProfil(base, adjoint, { nom: 'Retraité', typePersonne: 'exterieur' }, aujourdhui)).toBeGreaterThan(0);
		expect(await creerProfil(base, superAdmin, { nom: 'Jeune', typePersonne: 'agent' }, aujourdhui)).toBeGreaterThan(0);
	});

	it('renommer : toujours, même « Agent » ; nom unique ; au journal', async () => {
		const { base, chef, agent } = await jeu();
		await renommerProfil(base, chef, agent.id, 'Sapeur', aujourdhui);
		expect((await base.select().from(profil).where(eq(profil.id, agent.id)))[0]!.nom).toBe('Sapeur');
		expect(await base.select().from(journal).where(eq(journal.action, 'renommer_profil'))).toMatchObject([{ cibleId: agent.id, details: JSON.stringify({ nom: { avant: 'Agent', apres: 'Sapeur' } }) }]);
		await expect(renommerProfil(base, chef, agent.id, 'Réserve citoyenne', aujourdhui)).rejects.toThrow(new DonneeInvalide('Nom déjà utilisé'));
		await expect(renommerProfil(base, chef, 999, 'Autre', aujourdhui)).rejects.toThrow(new DonneeInvalide('Profil inconnu'));
	});

	it('supprimer : seulement si personne ne l’a, jamais le profil Agent de départ ; ses droits partent avec ; au journal', async () => {
		const { base, chef, agent } = await jeu();
		await expect(supprimerProfil(base, chef, agent.id, aujourdhui)).rejects.toThrow(new DonneeInvalide('Le profil des agents ne se supprime pas'));
		const id = await creerProfil(base, chef, { nom: 'Retraité', typePersonne: 'exterieur' }, aujourdhui);
		await modifierDroitsProfil(base, chef, id, ['RESERVER'], aujourdhui);
		const [p] = await base.insert(personne).values({ email: 'rene@exemple.fr', prenom: 'René', nom: 'Ancien', profilId: id }).returning();
		await expect(supprimerProfil(base, chef, id, aujourdhui)).rejects.toThrow(new DonneeInvalide('Ce profil est encore attribué'));
		await base.delete(personne).where(eq(personne.id, p!.id));
		await supprimerProfil(base, chef, id, aujourdhui);
		expect(await base.select().from(profil).where(eq(profil.id, id))).toEqual([]);
		expect(await base.select().from(profilDroit).where(eq(profilDroit.profilId, id))).toEqual([]);
		expect(await base.select().from(journal).where(eq(journal.action, 'supprimer_profil'))).toMatchObject([{ cibleId: id, details: JSON.stringify({ nom: 'Retraité' }) }]);
	});
});

describe('modifierMursOuverts', () => {
	it('ouvre Le centre, Vie du centre et des comités en cours à un profil extérieur, au journal avant et après', async () => {
		const { base, chef } = await jeu();
		const id = await creerProfil(base, chef, { nom: 'Retraité', typePersonne: 'exterieur' }, aujourdhui);
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		const cle = `comite:${amicale!.id}`;
		await modifierMursOuverts(base, chef, id, { vie: 'lecture', [cle]: 'ecriture' }, aujourdhui);
		expect(JSON.parse((await base.select().from(profil).where(eq(profil.id, id)))[0]!.mursOuverts)).toEqual({ vie: 'lecture', [cle]: 'ecriture' });
		expect((await listerProfils(base, chef, aujourdhui)).find((p) => p.id === id)!.mursOuverts).toEqual({ vie: 'lecture', [cle]: 'ecriture' });
		await modifierMursOuverts(base, chef, id, { [cle]: 'lecture' }, aujourdhui);
		const lignes = await base.select().from(journal).where(eq(journal.action, 'modifier_murs_ouverts'));
		expect(lignes).toHaveLength(2);
		expect(JSON.parse(lignes[1]!.details!)).toEqual({ murs: { avant: { vie: 'lecture', [cle]: 'ecriture' }, apres: { [cle]: 'lecture' } } });
		// Sans changement : rien au journal.
		await modifierMursOuverts(base, chef, id, { [cle]: 'lecture' }, aujourdhui);
		expect(await base.select().from(journal).where(eq(journal.action, 'modifier_murs_ouverts'))).toHaveLength(2);
	});

	it('refusé : profil agent, équipe, comité dissous ou inconnu, niveau inconnu, sans le droit', async () => {
		const { base, chef, referent, agent } = await jeu();
		const id = await creerProfil(base, chef, { nom: 'Retraité', typePersonne: 'exterieur' }, aujourdhui);
		const [amicale] = await base.select().from(comite).where(eq(comite.nom, 'Amicale'));
		await expect(modifierMursOuverts(base, chef, agent.id, { vie: 'lecture' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Seul un profil extérieur reçoit des murs ouverts'));
		await expect(modifierMursOuverts(base, chef, id, { 'equipe:1': 'lecture' } as Record<string, 'lecture'>, aujourdhui)).rejects.toThrow(new DonneeInvalide('Mur inconnu'));
		await expect(modifierMursOuverts(base, chef, id, { 'comite:999': 'lecture' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Mur inconnu'));
		await expect(modifierMursOuverts(base, chef, id, { vie: 'tout' as 'lecture' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Niveau inconnu'));
		await base.update(comite).set({ dissousLe: '2026-10-01' }).where(eq(comite.id, amicale!.id));
		await expect(modifierMursOuverts(base, chef, id, { [`comite:${amicale!.id}`]: 'lecture' }, aujourdhui)).rejects.toThrow(new DonneeInvalide('Mur inconnu'));
		await expect(modifierMursOuverts(base, referent, id, { vie: 'lecture' }, aujourdhui)).rejects.toBeInstanceOf(RefusDroit);
	});
});

describe('enregistrerProfil (l’écran en un geste)', () => {
	it('droits et murs ensemble ; rien d’écrit si rien ne change ; un mur fermé de nouveau', async () => {
		const { base, chef } = await jeu();
		const id = await creerProfil(base, chef, { nom: 'Retraité', typePersonne: 'exterieur' }, aujourdhui);
		await enregistrerProfil(base, chef, id, { droits: () => ['RESERVER'], murs: { vie: 'lecture' } }, aujourdhui);
		const lignes = async () => (await base.select().from(journal)).filter((l) => l.action === 'modifier_murs_ouverts' || l.action === 'modifier_droits_profil').length;
		expect(await lignes()).toBe(2);
		await enregistrerProfil(base, chef, id, { droits: (avant) => avant, murs: { vie: 'lecture' } }, aujourdhui);
		expect(await lignes()).toBe(2);
		await enregistrerProfil(base, chef, id, { droits: (avant) => avant, murs: {} }, aujourdhui);
		expect(JSON.parse((await base.select().from(profil).where(eq(profil.id, id)))[0]!.mursOuverts)).toEqual({});
		expect(await lignes()).toBe(3);
	});

	it('profil agent : les murs envoyés sont ignorés, même invalides', async () => {
		const { base, chef, agent } = await jeu();
		await enregistrerProfil(base, chef, agent.id, { droits: (avant) => avant, murs: { 'equipe:1': 'lecture' } }, aujourdhui);
		expect((await base.select().from(profil).where(eq(profil.id, agent.id)))[0]!.mursOuverts).toBe('{}');
		expect(await base.select().from(journal).where(eq(journal.action, 'modifier_murs_ouverts'))).toHaveLength(0);
	});

	it('tout ou rien : un mur refusé n’écrit aucun droit, un droit de pouvoir n’écrit aucun mur ; profil inconnu : null', async () => {
		const { base, chef, droitsDuProfil } = await jeu();
		const id = await creerProfil(base, chef, { nom: 'Retraité', typePersonne: 'exterieur' }, aujourdhui);
		await expect(enregistrerProfil(base, chef, id, { droits: () => ['RESERVER'], murs: { 'equipe:1': 'lecture' } }, aujourdhui)).rejects.toThrow('Mur inconnu');
		expect(await droitsDuProfil(id)).toEqual([]);
		await expect(enregistrerProfil(base, chef, id, { droits: () => ['GERER_ACCES'], murs: { vie: 'lecture' } }, aujourdhui)).rejects.toThrow(DonneeInvalide);
		expect((await base.select().from(profil).where(eq(profil.id, id)))[0]!.mursOuverts).toBe('{}');
		expect(await enregistrerProfil(base, chef, 9999, { droits: () => [] }, aujourdhui)).toBeNull();
	});
});

import { describe, expect, it } from 'vitest';
import { appliquerFetes, calculerAnnee, equipeA, equipeAuMoment, type Reglage } from '../src/planning/calendrier.ts';
import { heuresDe, type PlageLue } from '../src/planning/plages.ts';

const laille: Reglage = {
	debut: { jour: 'vendredi', heure: '18:00' },
	fin: { jour: 'vendredi', heure: '06:00' },
	reference: { date: '2026-01-02', equipe: 1 },
	semaine: { debut: '18:00', fin: '06:00' }
};
// Roulement 1-2-3-4 : la semaine du vendredi 4 décembre 2026 revient à l'équipe 1, celle du 11 à l'équipe 2.
const annee = () => calculerAnnee(2026, laille, [1, 2, 3, 4], new Map());
const semaine = (s: ReturnType<typeof annee>, debut: string) => s.find((x) => x.debut === debut)!;
const sainteBarbe = { nom: 'Sainte-Barbe', debut: '2026-12-05T18:00', fin: '2026-12-06T02:00', equipeId: 3 };

describe('les fêtes appliquées à l’astreinte', () => {
	it('sans fête : les mêmes semaines, rien de recalculé', () => {
		const s = annee();
		expect(appliquerFetes(s, [])).toBe(s);
	});

	it('à cheval sur minuit : l’équipe imposée sur ces heures seulement', () => {
		const s = appliquerFetes(annee(), [sainteBarbe]);
		expect(semaine(s, '2026-12-04').equipeId).toBe(1);
		expect(semaine(s, '2026-12-04').imposees).toEqual([{ debut: '2026-12-05T18:00', fin: '2026-12-06T02:00', nom: 'Sainte-Barbe', equipeId: 3 }]);
		expect(semaine(s, '2026-11-27').imposees).toBeUndefined();
		expect(equipeA('2026-12-05T20:00', s)).toBe(3);
		expect(equipeA('2026-12-06T03:00', s)).toBe(1);
		expect(equipeAuMoment(semaine(s, '2026-12-04'), '2026-12-05T19:00')).toBe(3);
		expect(equipeAuMoment(semaine(s, '2026-12-04'), '2026-12-05T17:00')).toBe(1);
	});

	it('à cheval sur une relève : chaque semaine garde sa part', () => {
		const s = appliquerFetes(annee(), [{ nom: 'Méchoui', debut: '2026-12-11T05:00', fin: '2026-12-11T19:00', equipeId: 4 }]);
		expect(semaine(s, '2026-12-04').imposees).toEqual([{ debut: '2026-12-11T05:00', fin: '2026-12-11T06:00', nom: 'Méchoui', equipeId: 4 }]);
		expect(semaine(s, '2026-12-11').imposees).toEqual([{ debut: '2026-12-11T18:00', fin: '2026-12-11T19:00', nom: 'Méchoui', equipeId: 4 }]);
	});

	it('hors des heures d’astreinte ou tenue par l’équipe de la semaine : rien ne change', () => {
		const s = appliquerFetes(annee(), [
			{ nom: 'Repas', debut: '2026-12-08T11:00', fin: '2026-12-08T14:00', equipeId: 3 },
			{ nom: 'Loto', debut: '2026-12-12T14:00', fin: '2026-12-12T18:00', equipeId: 2 }
		]);
		expect(semaine(s, '2026-12-04').imposees).toBeUndefined();
		expect(semaine(s, '2026-12-11').imposees).toBeUndefined();
	});

	it('les heures de chacun : l’équipe libérée les perd, l’équipe imposée les prend, les autres rien', () => {
		const s = semaine(appliquerFetes(annee(), [sainteBarbe]), '2026-12-04');
		expect(heuresDe(s, 1, 10, [])[0]).toEqual({ debut: '2026-12-04T18:00', fin: '2026-12-05T18:00' });
		expect(heuresDe(s, 1, 10, [])[1]).toEqual({ debut: '2026-12-06T02:00', fin: '2026-12-07T06:00' });
		expect(heuresDe(s, 3, 30, [])).toEqual([{ debut: '2026-12-05T18:00', fin: '2026-12-06T02:00' }]);
		expect(heuresDe(s, 2, 20, [])).toEqual([]);
	});

	it('pendant l’été : la plage de la semaine perd les heures de la fête', () => {
		const ete = appliquerFetes(calculerAnnee(2026, laille, [1, 2, 3, 4], new Map()), [{ nom: 'Bal', debut: '2026-07-18T20:00', fin: '2026-07-19T02:00', equipeId: 2 }]);
		const s = semaine(ete, '2026-07-17');
		expect(s.equipeId).toBe(1);
		const plages: PlageLue[] = [{ debut: '2026-07-17T18:00', fin: '2026-07-20T06:00', ajoutes: [99], retires: [] }];
		expect(heuresDe(s, 1, 10, plages)).toEqual([
			{ debut: '2026-07-17T18:00', fin: '2026-07-18T20:00' },
			{ debut: '2026-07-19T02:00', fin: '2026-07-20T06:00' }
		]);
		expect(heuresDe(s, null, 99, plages)).toHaveLength(2);
		expect(heuresDe(s, 2, 20, plages)).toEqual([{ debut: '2026-07-18T20:00', fin: '2026-07-19T02:00' }]);
	});
});

// Avec une base : chef de centre (sans équipe), un agent par équipe ; 2026 publiée, roulement 1-2-3-4.
describe('les fêtes du centre, enregistrées', async () => {
	const { eq } = await import('drizzle-orm');
	const centreExemple = (await import('../../../centres/exemple/centre.ts')).default;
	const { chargerJeuDeDepart } = await import('../src/jeu-de-depart.ts');
	const { planningDe, publierAnnee, reglerRoulement, preparerAnnee } = await import('../src/planning/annee.ts');
	const { astreinteDe } = await import('../src/planning/astreinte.ts');
	const { enregistrerFete, noterFeteCentre, supprimerFete } = await import('../src/planning/fetes.ts');
	const { disponible, lireContexte } = await import('../src/remplacements/contexte.ts');
	const { demanderRemplacement } = await import('../src/remplacements/demandes.ts');
	const { agendaDe, monLienAgenda } = await import('../src/planning/agenda.ts');
	const schema = await import('../src/schema.ts');
	const { baseDeTest } = await import('./base-de-test.ts');
	const reglage = centreExemple.astreinte;
	const AVANT = '2026-11-21T10:00';

	async function jeu({ publier = true } = {}) {
		const base = await baseDeTest();
		await chargerJeuDeDepart(base, centreExemple);
		const [agent] = await base.select().from(schema.profil).where(eq(schema.profil.nom, 'Agent'));
		const ids = (await base.select().from(schema.equipe).orderBy(schema.equipe.ordreRotation)).map((e) => e.id);
		const nouvelle = async (prenom: string, equipe?: number) => {
			const id = (await base.insert(schema.personne).values({ email: `${prenom}@exemple.fr`, prenom, nom: 'Test', profilId: agent!.id }).returning())[0]!.id;
			if (equipe !== undefined) await base.insert(schema.affectationEquipe).values({ personneId: id, equipeId: equipe, debut: '2026-01-01' });
			return id;
		};
		const chef = await nouvelle('chef');
		const [r] = await base.select().from(schema.responsabilite).where(eq(schema.responsabilite.systeme, 'chef_centre'));
		await base.insert(schema.attribution).values({ personneId: chef, responsabiliteId: r!.id, perimetreType: 'centre', perimetreId: null, debut: '2026-01-01', saisiePar: 'super:a@b.fr', saisieLe: '2026-01-01' });
		const agents = [await nouvelle('un', ids[0]), await nouvelle('deux', ids[1]), await nouvelle('trois', ids[2]), await nouvelle('quatre', ids[3]), await nouvelle('cinq', ids[0])];
		const a = (id: number) => ({ type: 'personne' as const, id });
		await reglerRoulement(base, a(chef), 2026, ids, '2026-01-01T10:00');
		if (publier) await publierAnnee(base, a(chef), 2026, '2026-01-01T10:00');
		const fete = { nom: 'Sainte-Barbe', debut: '2026-12-05T18:00', fin: '2026-12-06T02:00', equipeId: ids[2]! };
		return { base, ids, agents, chef: a(chef), a, fete };
	}

	it('refuse un chevauchement, une fin avant le début, plus de 24 h, une fête passée, sans le droit', async () => {
		const { base, chef, a, agents, fete } = await jeu();
		await enregistrerFete(base, chef, fete, AVANT, reglage);
		await expect(enregistrerFete(base, chef, { ...fete, nom: 'Loto', debut: '2026-12-06T01:00', fin: '2026-12-06T04:00' }, AVANT, reglage)).rejects.toThrow('Une autre fête tombe à ces heures');
		await expect(enregistrerFete(base, chef, { ...fete, debut: '2026-12-06T02:00', fin: '2026-12-05T18:00' }, AVANT, reglage)).rejects.toThrow('La fin doit suivre le début');
		await expect(enregistrerFete(base, chef, { ...fete, debut: '2026-12-10T18:00', fin: '2026-12-11T19:00' }, AVANT, reglage)).rejects.toThrow('24 h au plus');
		await expect(enregistrerFete(base, chef, { ...fete, debut: '2026-11-20T18:00', fin: '2026-11-20T20:00' }, AVANT, reglage)).rejects.toThrow('Fête passée');
		await expect(enregistrerFete(base, a(agents[0]!), { ...fete, debut: '2026-12-12T18:00', fin: '2026-12-12T20:00' }, AVANT, reglage)).rejects.toThrow();
		// Juste après la première : accepté.
		await enregistrerFete(base, chef, { ...fete, nom: 'Loto', debut: '2026-12-06T02:00', fin: '2026-12-06T04:00' }, AVANT, reglage);
		const journal = await base.select().from(schema.journal);
		expect(journal.filter((j) => j.action === 'ajouter_fete')).toHaveLength(2);
	});

	it('l’astreinte suit : accueil, planning, disponibles des remplacements', async () => {
		const { base, chef, a, agents, ids, fete } = await jeu();
		await enregistrerFete(base, chef, fete, AVANT, reglage);
		// L'équipe 3 tient la Sainte-Barbe : à l'accueil, sa prochaine astreinte, à sa couleur.
		const trois = await astreinteDe(base, a(agents[2]!), '2026-12-01T10:00', reglage);
		expect(trois).toMatchObject({ debut: '2026-12-05T18:00', fin: '2026-12-06T02:00', equipe: { id: ids[2] }, mienne: true });
		expect(trois!.fetes).toEqual(['Sainte-Barbe, samedi 5 décembre, Équipe 3 de 18 h à 2 h']);
		// L'équipe 1, libérée pendant la fête : sa semaine le dit.
		expect((await astreinteDe(base, a(agents[0]!), '2026-12-01T10:00', reglage))!.fetes).toEqual(['Sainte-Barbe, samedi 5 décembre, Équipe 3 de 18 h à 2 h']);
		expect((await astreinteDe(base, a(agents[1]!), '2026-12-01T10:00', reglage))!.fetes).toEqual([]);
		// Le chef de centre, pendant la fête : l'équipe 3 d'astreinte.
		expect(await astreinteDe(base, chef, '2026-12-05T20:00', reglage)).toMatchObject({ mienne: false, equipe: { id: ids[2] } });
		const p = await planningDe(base, a(agents[0]!), 2026, AVANT, reglage);
		if (!p.publiee) throw new Error('publiée');
		// Sa semaine du 4 décembre : la fête y est dite.
		expect(p.prochaine.astreinte!.fetes).toEqual(['Sainte-Barbe, samedi 5 décembre, Équipe 3 de 18 h à 2 h']);
		const p3 = await planningDe(base, a(agents[2]!), 2026, '2026-12-01T10:00', reglage);
		if (!p3.publiee) throw new Error('publiée');
		expect(p3.prochaine.astreinte).toMatchObject({ debut: '2026-12-05T18:00', equipeId: ids[2], fetes: ['Sainte-Barbe, samedi 5 décembre, Équipe 3 de 18 h à 2 h'] });
		expect(p.semaines.find((s) => s.debut === '2026-12-04')!.imposees).toEqual([{ debut: '2026-12-05T18:00', fin: '2026-12-06T02:00', nom: 'Sainte-Barbe', equipeId: ids[2] }]);
		const ctx = await lireContexte(base, AVANT, reglage);
		const pendant = { debut: '2026-12-05T20:00', fin: '2026-12-05T22:00' };
		expect(disponible(ctx, agents[0]!, [pendant])).toBe(true);
		expect(disponible(ctx, agents[2]!, [pendant])).toBe(false);
	});

	it('un créneau rendu inutile par la fête est dit par ses heures', async () => {
		const { base, chef, agents, fete } = await jeu();
		const p = { debut: '2026-12-05T21:00', fin: '2026-12-06T01:30' };
		await base.insert(schema.demandeRemplacement).values({ genre: 'remplacement', creneau: 1, demandeurId: agents[0]!, remplacantId: agents[3]!, periodes: JSON.stringify([p]), debut: p.debut, etat: 'conclue', creeLe: '2026-11-20T10:00' });
		expect(await enregistrerFete(base, chef, fete, AVANT, reglage)).toEqual({ inutiles: ['Du samedi 5 décembre, 21 h au dimanche 6 décembre, 1 h 30, un Test remplacé par quatre Test'] });
	});

	it('après la publication : les deux équipes prévenues ; un remplacement devenu inutile est montré, puis annulé avec avis', async () => {
		const { base, chef, agents, fete } = await jeu();
		const [quatre, un] = [agents[3]!, agents[0]!];
		const [d] = await base
			.insert(schema.demandeRemplacement)
			.values({ genre: 'remplacement', demandeurId: un, remplacantId: quatre, periodes: JSON.stringify([{ debut: '2026-12-05T20:00', fin: '2026-12-05T23:00' }]), debut: '2026-12-05T20:00', etat: 'conclue', creeLe: '2026-11-20T10:00' })
			.returning();
		const r = await enregistrerFete(base, chef, fete, AVANT, reglage);
		expect(r).toEqual({ inutiles: ['Samedi 5 décembre, de 20 h à 23 h, un Test remplacé par quatre Test'] });
		expect(await base.select().from(schema.feteCentre)).toHaveLength(0);
		const fait = await enregistrerFete(base, chef, fete, AVANT, reglage, true);
		expect(fait).toHaveProperty('id');
		const [apres] = await base.select().from(schema.demandeRemplacement).where(eq(schema.demandeRemplacement.id, d!.id));
		expect(apres).toMatchObject({ etat: 'annulee', motif: 'Fête du centre' });
		const avisRemplacement = await base.select().from(schema.avisRemplacement);
		expect(avisRemplacement.map((x) => x.personneId).sort()).toEqual([un, quatre].sort());
		// Les équipes 1 (libérée) et 3 (imposée) ; pas les autres, ni ceux du remplacement annulé (ils ont leur avis).
		const avisEquipes = await base.select().from(schema.avisEte);
		expect(avisEquipes.map((x) => x.personneId).sort()).toEqual([agents[2]!, agents[4]!].sort());
		expect(avisEquipes[0]!.texte).toBe('Sainte-Barbe, samedi 5 décembre de 18 h à 2 h. Équipe 3 d’astreinte.');
	});

	it('modifier puis supprimer : prévient, au journal ; une année en brouillon ne prévient personne', async () => {
		const { base, chef, agents, ids, fete } = await jeu();
		const { id } = (await enregistrerFete(base, chef, fete, AVANT, reglage)) as { id: number };
		await enregistrerFete(base, chef, { ...fete, id, equipeId: ids[1]! }, AVANT, reglage);
		await supprimerFete(base, chef, id, AVANT, reglage);
		expect(await base.select().from(schema.feteCentre)).toHaveLength(0);
		const textes = (await base.select().from(schema.avisEte)).filter((x) => x.personneId === agents[1]).map((x) => x.texte);
		expect(textes).toEqual(['Sainte-Barbe, samedi 5 décembre de 18 h à 2 h. Équipe 2 d’astreinte.', 'Sainte-Barbe, samedi 5 décembre de 18 h à 2 h, annulée. L’astreinte suit le roulement.']);
		expect((await base.select().from(schema.journal)).map((j) => j.action).filter((x) => x.endsWith('_fete'))).toEqual(['ajouter_fete', 'modifier_fete', 'supprimer_fete']);
		const brouillon = await jeu({ publier: false });
		await enregistrerFete(brouillon.base, brouillon.chef, brouillon.fete, AVANT, reglage);
		expect(await brouillon.base.select().from(schema.avisEte)).toHaveLength(0);
	});

	it('une fête à plus de douze semaines : l’équipe libérée est prévenue aussi', async () => {
		const { base, chef, agents, fete } = await jeu();
		await enregistrerFete(base, chef, fete, '2026-08-01T10:00', reglage);
		// Équipe 1 (libérée) et équipe 3 (imposée).
		expect((await base.select().from(schema.avisEte)).map((x) => x.personneId).sort()).toEqual([agents[0]!, agents[2]!, agents[4]!].sort());
	});

	it('pendant la fête : la demande d’un agent de l’équipe imposée va à son équipe ; supprimer la fête l’annule ; l’agenda nomme l’équipe', async () => {
		const { base, chef, a, agents, ids, fete } = await jeu();
		const { id } = (await enregistrerFete(base, chef, fete, AVANT, reglage)) as { id: number };
		const demande = await demanderRemplacement(base, a(agents[2]!), { periodes: [{ debut: '2026-12-05T18:00', fin: '2026-12-06T02:00' }], cibleId: null }, AVANT, reglage);
		const [d] = await base.select().from(schema.demandeRemplacement).where(eq(schema.demandeRemplacement.id, demande));
		expect(d!.equipeId).toBe(ids[2]);
		const lien = await monLienAgenda(base, a(agents[2]!), AVANT);
		const ics = (await agendaDe(base, String(lien).split('/').at(-1)!.replace(/\.ics$/, ''), AVANT, reglage))!;
		expect(ics).toContain('SUMMARY:Astreinte\\, Équipe 3');
		expect(await supprimerFete(base, chef, id, AVANT, reglage)).toEqual({ inutiles: ['Nuit du samedi 5 décembre, trois Test cherche un remplaçant'] });
		await supprimerFete(base, chef, id, AVANT, reglage, true);
		const [apres] = await base.select().from(schema.demandeRemplacement).where(eq(schema.demandeRemplacement.id, demande));
		expect(apres!.etat).toBe('annulee');
	});

	it('l’accueil du chef lit les fêtes une seule fois, dans le batch de l’astreinte, par l’index', async () => {
		const { base, chef, fete } = await jeu();
		await enregistrerFete(base, chef, fete, AVANT, reglage);
		const { accueilDe } = await import('../src/casquettes.ts');
		base.jouees = [];
		await Promise.all([accueilDe(base, chef, null, '2026-12-05', '2026-12-05T20:00', reglage), astreinteDe(base, chef, '2026-12-05T20:00', reglage)]);
		const lectures = base.jouees.filter((r) => /from "fete_centre"/.test(r.sql));
		expect(lectures).toHaveLength(1);
		expect(base.plan(lectures[0]!).join(" ")).toMatch(/fete_centre_debut/);
	});

	it('historique et tour : par nom, saisie des années passées, hors du tour signalé', async () => {
		const { base, chef, ids, fete } = await jeu();
		await noterFeteCentre(base, chef, 2025, 'Sainte-Barbe', ids[2]!, AVANT);
		await noterFeteCentre(base, chef, 2024, 'Sainte-Barbe', ids[0]!, AVANT);
		await noterFeteCentre(base, chef, 2023, 'Sainte-Barbe', ids[1]!, AVANT);
		await enregistrerFete(base, chef, fete, AVANT, reglage);
		const p = await preparerAnnee(base, chef, 2026, AVANT, reglage);
		expect(p.fetesCentre.historique.filter((h) => h.nom === 'Sainte-Barbe').map((h) => [h.annee, h.equipeId])).toEqual([[2025, ids[2]], [2024, ids[0]], [2023, ids[1]]]);
		// L'équipe 4 ne l'a jamais tenue : c'est son tour ; l'équipe 3 l'a tenue l'an dernier.
		expect(p.fetesCentre.fetes).toEqual([expect.objectContaining({ nom: 'Sainte-Barbe', equipeId: ids[2], attendues: [ids[3]] })]);
		await noterFeteCentre(base, chef, 2025, 'Sainte-Barbe', null, AVANT);
		expect((await preparerAnnee(base, chef, 2026, AVANT, reglage)).fetesCentre.historique).toHaveLength(2);
	});
});
